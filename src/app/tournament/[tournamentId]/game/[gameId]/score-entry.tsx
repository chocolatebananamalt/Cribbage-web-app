"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SharedDeviceSignOut } from "../../../../../components/shared-device-sign-out";
import { deriveScore, isScoreEntryReady } from "../../../../../lib/score";
import type { AssignedGameContext } from "../../../../../lib/games/assigned-game-context";
import { clearPendingScoreSubmission, isDefinitiveScoreMutationFailure, pendingSubmissionRecovery, readPendingScoreSubmission, type PendingScoreSubmission, writePendingScoreSubmission } from "../../../../../lib/score-retry-envelope";

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
  const [pendingSubmission, setPendingSubmission] = useState<PendingScoreSubmission | null>(null);
  const [hydrated, setHydrated] = useState(false);
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
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const pending = readPendingScoreSubmission(window.sessionStorage, context.tournamentId, context.gameId, context.player.side);
      const recovery = pendingSubmissionRecovery(pending, context.ownSubmission?.id ?? null);
      if (recovery.action === "clear" && pending) {
        clearPendingScoreSubmission(window.sessionStorage, pending);
      } else if (recovery.action === "retry") {
        setPendingSubmission(recovery.envelope);
        setWinner(recovery.envelope.winnerSide === context.player.side ? "player" : "opponent");
        setMarginText(String(recovery.envelope.margin));
        setStatus("A previous entry is awaiting a safe retry. Only that exact result can be sent until the tournament server responds.");
      }
      setHydrated(true);
    });
    return () => window.clearTimeout(timer);
  }, [context.gameId, context.ownSubmission?.id, context.player.side, context.tournamentId]);
  const operationId = (kind: "confirmation", fingerprint: string) => {
    const storageKey = `acc-score:${context.gameId}:${kind}:${fingerprint}`;
    try {
      const existing = window.sessionStorage.getItem(storageKey);
      if (existing) return { storageKey, value: existing };
      const value = crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, value);
      return { storageKey, value };
    } catch { return null; }
  };
  const key = (value: (typeof keypad)[number]) => {
    if (busy || submissionId || pendingSubmission) return;
    if (value === "clear") return setMarginText("");
    if (value === "backspace") return setMarginText((old) => old.slice(0, -1));
    setMarginText((old) => old.length >= 3 ? old : old === "0" ? String(value) : `${old}${value}`);
  };
  const submit = async () => {
    if (busy || submissionId || !hydrated) return;
    const envelope = pendingSubmission ?? (() => {
      if (!derived || !winner) return null;
      const next: PendingScoreSubmission = { version: 1, kind: "submission", tournamentId: context.tournamentId, gameId: context.gameId, playerSide: context.player.side, submissionId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), submissionSlot: slot, winnerSide, margin: derived.margin };
      if (!writePendingScoreSubmission(window.sessionStorage, next)) {
        setStatus("This browser cannot safely preserve your entry for recovery. Enable session storage before submitting.");
        return null;
      }
      setPendingSubmission(next);
      return next;
    })();
    if (!envelope) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/games/${context.gameId}/submissions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId: envelope.submissionId, submissionSlot: envelope.submissionSlot, winnerSide: envelope.winnerSide, margin: envelope.margin, idempotencyKey: envelope.idempotencyKey }) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (isDefinitiveScoreMutationFailure(response.status, payload, context.gameId, "submission")) { clearPendingScoreSubmission(window.sessionStorage, envelope); setPendingSubmission(null); }
        setStatus(publicMessage(response.status, payload));
        return;
      }
      if (!payload || typeof payload !== "object") { setStatus("The server response was incomplete. Retry this same entry after the connection is restored."); return; }
      const result = payload as { status?: string; submission_id?: string };
      const id = result.submission_id;
      if (id !== envelope.submissionId || !["submitted", "confirmation_pending", "mismatch"].includes(result.status ?? "")) { setStatus("The server response was incomplete. Retry this same entry after the connection is restored."); return; }
      clearPendingScoreSubmission(window.sessionStorage, envelope);
      setPendingSubmission(null);
      setSubmissionId(id);
      setCanConfirm(result.status === "confirmation_pending");
      setStatus(result.status === "confirmation_pending" ? "Both entries match. Confirm your own entry to continue." : result.status === "mismatch" ? "The entries do not match. This game needs cross-checking." : "Your entry is saved and waiting for your opponent’s independent entry.");
    } catch {
      setStatus("Network issue. Retry this same entry after the connection is restored.");
    } finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!submissionId || !canConfirm || busy) return;
    const request = operationId("confirmation", submissionId);
    if (!request) { setStatus("This browser cannot safely preserve your confirmation for recovery. Enable session storage before confirming."); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/games/${context.gameId}/confirmations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId, idempotencyKey: request.value }) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (isDefinitiveScoreMutationFailure(response.status, payload, context.gameId, "confirmation")) window.sessionStorage.removeItem(request.storageKey);
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
  return <main className="auth-shell"><section className="auth-card live-score" aria-labelledby="live-score-title"><p className="eyebrow">SCORE ENTRY</p><h1 id="live-score-title">Current Game Results</h1><p className="auth-note">{context.eventName} · Game {context.matchInstance} · Round {context.roundNumber}</p><div className="live-matchup"><strong>{context.player.displayName} <em>(ID#: {context.player.verificationId})</em></strong><span>Table/Seat {context.player.tableSeat}</span><b>VS</b><strong>{context.opponent.displayName} <em>(ID#: {context.opponent.verificationId})</em></strong><span>Table/Seat {context.opponent.tableSeat}</span></div><fieldset><legend>Game Winner:</legend><button type="button" className={winner === "player" ? "pick selected" : "pick"} disabled={busy || !!submissionId || !!pendingSubmission} aria-pressed={winner === "player"} onClick={() => setWinner("player")}>{context.player.displayName} won</button><button type="button" className={winner === "opponent" ? "pick selected" : "pick"} disabled={busy || !!submissionId || !!pendingSubmission} aria-pressed={winner === "opponent"} onClick={() => setWinner("opponent")}>{context.opponent.displayName} won</button></fieldset><div className="entry"><span>Spread Points:</span><output className={derived ? "number" : "number invalid"}>{marginText || "—"}</output><span /></div><div className="keypad" aria-label="Spread points keypad">{keypad.map((value) => <button type="button" key={value} onClick={() => key(value)} disabled={busy || !!submissionId || !!pendingSubmission}>{value === "clear" ? "Clear" : value === "backspace" ? "⌫" : value}</button>)}</div><p className="live-status" role="status">{status}</p>{!submissionId ? <button type="button" className="primary full" disabled={(!derived && !pendingSubmission) || busy || !hydrated} onClick={submit}>{busy ? "Submitting…" : pendingSubmission ? "Retry This Same Entry" : "Submit My Independent Entry"}</button> : canConfirm ? <button type="button" className="primary full" disabled={busy} onClick={confirm}>{busy ? "Confirming…" : "Confirm My Entry"}</button> : null}<details className="how-to"><summary>Playing with one paper card and one digital card</summary><p>Both assigned players independently enter the paper result, then each confirms their own entry. The score is official only after both entries match and both players confirm. If either player cannot enter it, leave the card pending for cross-checking.</p></details><Link className="guide-link" href={`/tournament/${context.tournamentId}/how-to`}>Open Start Here / How To</Link><SharedDeviceSignOut /></section></main>;
}
