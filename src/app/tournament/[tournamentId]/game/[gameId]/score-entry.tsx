"use client";

import { useState } from "react";
import { deriveScore, isScoreEntryReady } from "../../../../../lib/score";
import type { AssignedGameContext } from "../../../../../lib/games/assigned-game-context";

const keypad = [1, 2, 3, 4, 5, 6, 7, 8, 9, "clear", 0, "backspace"] as const;
type Winner = "player" | "opponent" | null;

function publicMessage(status: number, payload: unknown) {
  if (status === 401) return "Sign in again before submitting this score.";
  if (status === 400) return "Enter a possible spread point number and choose the winner.";
  const code = payload && typeof payload === "object" ? (payload as Record<string, unknown>).code : undefined;
  if (code === "not_assigned") return "This scorecard is not assigned to your account.";
  if (code === "event_not_approved") return "This event is not approved for digital scoring.";
  if (code === "tournament_closed") return "This tournament is no longer open for score entry.";
  return "This result could not be accepted. Refresh the game before trying again.";
}

export function LiveScoreEntry({ context }: { context: AssignedGameContext }) {
  const [winner, setWinner] = useState<Winner>(() => context.ownSubmission ? context.ownSubmission.winnerSide === context.player.side ? "player" : "opponent" : null);
  const [marginText, setMarginText] = useState(() => context.ownSubmission ? String(context.ownSubmission.margin) : "");
  const [submissionId, setSubmissionId] = useState<string | null>(context.ownSubmission?.id ?? null);
  const [canConfirm, setCanConfirm] = useState(context.canConfirm);
  const [status, setStatus] = useState(() => context.canConfirm
    ? "Both entries match. Confirm your own entry to continue."
    : context.ownSubmission
      ? context.state === "mismatch"
        ? "The entries do not match. This game needs cross-checking."
        : context.state === "verified"
          ? "Game verified. The authoritative scorecard is updated."
          : context.ownConfirmed
            ? "Your confirmation is saved. The game will verify after the other player confirms their own entry."
        : "Your entry is saved and waiting for your opponent’s independent entry."
      : "Enter your independent result. It is not verified until both players submit and confirm.");
  const [busy, setBusy] = useState(false);
  const margin = Number(marginText);
  const derived = isScoreEntryReady(margin, winner) ? deriveScore(margin, winner) : null;
  const winnerSide = winner === "player" ? context.player.side : context.opponent.side;
  const slot = context.player.side === "a" ? 1 : 2;
  const operationId = (kind: "submission" | "confirmation", fingerprint: string) => {
    const storageKey = `acc-score:${context.gameId}:${kind}:${fingerprint}`;
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return { storageKey, value: existing };
    const value = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, value);
    return { storageKey, value };
  };
  const key = (value: (typeof keypad)[number]) => {
    if (busy || submissionId) return;
    if (value === "clear") return setMarginText("");
    if (value === "backspace") return setMarginText((old) => old.slice(0, -1));
    setMarginText((old) => old.length >= 3 ? old : old === "0" ? String(value) : `${old}${value}`);
  };
  const submit = async () => {
    if (!derived || !winner || busy || submissionId) return;
    const fingerprint = `${slot}:${winnerSide}:${derived.margin}`;
    const request = operationId("submission", fingerprint);
    const submissionRequest = operationId("submission", `id:${fingerprint}`);
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/games/${context.gameId}/submissions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId: submissionRequest.value, submissionSlot: slot, winnerSide, margin: derived.margin, idempotencyKey: request.value }) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status < 500) { window.sessionStorage.removeItem(request.storageKey); window.sessionStorage.removeItem(submissionRequest.storageKey); }
        setStatus(publicMessage(response.status, payload));
        return;
      }
      if (!payload || typeof payload !== "object") { setStatus("The server response was incomplete. Please try again; this entry will safely retry."); return; }
      const result = payload as { status?: string; submission_id?: string };
      const id = result.submission_id;
      if (!id || !["submitted", "confirmation_pending", "mismatch"].includes(result.status ?? "")) { setStatus("The server response was incomplete. Please try again; this entry will safely retry."); return; }
      window.sessionStorage.removeItem(request.storageKey);
      window.sessionStorage.removeItem(submissionRequest.storageKey);
      setSubmissionId(id);
      setCanConfirm(result.status === "confirmation_pending");
      setStatus(result.status === "confirmation_pending" ? "Both entries match. Confirm your own entry to continue." : result.status === "mismatch" ? "The entries do not match. This game needs cross-checking." : "Your entry is saved and waiting for your opponent’s independent entry.");
    } catch {
      setStatus("Network issue. Please try again; this entry will safely retry with the same request ID.");
    } finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!submissionId || !canConfirm || busy) return;
    const request = operationId("confirmation", submissionId);
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/games/${context.gameId}/confirmations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId, idempotencyKey: request.value }) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status < 500) window.sessionStorage.removeItem(request.storageKey);
        setStatus(publicMessage(response.status, payload));
        return;
      }
      if (!payload || typeof payload !== "object") { setStatus("The server response was incomplete. Please try again; this confirmation will safely retry."); return; }
      const result = payload as { status?: string };
      if (!["verified", "confirmation_pending"].includes(result.status ?? "")) { setStatus("The server response was incomplete. Please try again; this confirmation will safely retry."); return; }
      window.sessionStorage.removeItem(request.storageKey);
      setCanConfirm(false);
      setStatus(result.status === "verified" ? "Game verified. The authoritative scorecard is updated." : "Your confirmation is saved. The game will verify after the other player confirms their own entry.");
    } catch {
      setStatus("Network issue. Please try again; this confirmation will safely retry with the same request ID.");
    } finally { setBusy(false); }
  };
  return <main className="auth-shell"><section className="auth-card live-score" aria-labelledby="live-score-title"><p className="eyebrow">SCORE ENTRY</p><h1 id="live-score-title">Current Game Results</h1><p className="auth-note">{context.eventName} · Game {context.matchInstance} · Round {context.roundNumber}</p><div className="live-matchup"><strong>{context.player.displayName}</strong><span>Table/Seat {context.player.tableSeat}</span><b>VS</b><strong>{context.opponent.displayName}</strong><span>Table/Seat {context.opponent.tableSeat}</span></div><fieldset><legend>Game Winner:</legend><button type="button" className={winner === "player" ? "pick selected" : "pick"} disabled={busy || !!submissionId} aria-pressed={winner === "player"} onClick={() => setWinner("player")}>{context.player.displayName} won</button><button type="button" className={winner === "opponent" ? "pick selected" : "pick"} disabled={busy || !!submissionId} aria-pressed={winner === "opponent"} onClick={() => setWinner("opponent")}>{context.opponent.displayName} won</button></fieldset><div className="entry"><span>Spread Points:</span><output className={derived ? "number" : "number invalid"}>{marginText || "—"}</output><span /></div><div className="keypad" aria-label="Spread points keypad">{keypad.map((value) => <button type="button" key={value} onClick={() => key(value)} disabled={busy || !!submissionId}>{value === "clear" ? "Clear" : value === "backspace" ? "⌫" : value}</button>)}</div><p className="live-status" role="status">{status}</p>{!submissionId ? <button type="button" className="primary full" disabled={!derived || busy} onClick={submit}>{busy ? "Submitting…" : "Submit My Independent Entry"}</button> : canConfirm ? <button type="button" className="primary full" disabled={busy} onClick={confirm}>{busy ? "Confirming…" : "Confirm My Entry"}</button> : null}<details className="how-to"><summary>Playing with one paper card and one digital card</summary><p>Both assigned players independently enter the paper result, then each confirms their own entry. The score is official only after both entries match and both players confirm. If either player cannot enter it, leave the card pending for cross-checking.</p></details></section></main>;
}
