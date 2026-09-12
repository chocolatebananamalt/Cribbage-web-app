"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../../components/shared-device-sign-out";
import { deriveScore, isScoreEntryReady, type ScoreResult } from "../../../../../lib/score";
import type { AssignedGameContext } from "../../../../../lib/games/assigned-game-context";
import { clearPendingScoreSubmission, isDefinitiveScoreMutationFailure, pendingSubmissionRecovery, readPendingScoreSubmission, type PendingScoreSubmission } from "../../../../../lib/score-retry-envelope";
import { canDeleteOfflineQueueRecord, type OfflineQueueRecord, type OfflineSubmissionCapability } from "../../../../../lib/offline-score-queue-contract";
import { deleteOfflineSubmission, provisionOfflineSubmission, queueOfflineSubmission, readOfflineSubmission, readPreparedOfflineSubmissionCapability, replayOfflineSubmission } from "../../../../../lib/offline-score-queue";
import { prepareCurrentScorePageForOffline } from "../../../../../lib/offline-score-page-cache";

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

function SkunkAid({ level }: { level: 0 | 1 | 2 | 3 }) {
  if (level === 0) return null;
  const label = level === 1 ? "Skunk" : level === 2 ? "Double skunk" : "Triple skunk";
  return <span className="skunk" role="status" aria-label={label}>{"🦨".repeat(level)} {label}</span>;
}

function ResultPreview({ context, score }: { context: AssignedGameContext; score: ScoreResult }) {
  const playerWon = score.winner === "player";
  const playerSpread = playerWon ? `+${score.playerPlus}` : `-${score.playerMinus}`;
  const opponentSpread = playerWon ? `-${score.opponentMinus}` : `+${score.opponentPlus}`;
  return <div className="result" aria-live="polite"><div className="result-rows"><div><strong>{context.player.displayName} {playerWon ? "won" : "lost"} by {score.margin}</strong><dl><div><dt>Game Points</dt><dd>{score.playerGamePoints}</dd></div><div><dt>Spread Points</dt><dd>{playerSpread}</dd></div></dl></div><div><strong>{context.opponent.displayName} {playerWon ? "lost" : "won"} by {score.margin}</strong><dl><div><dt>Game Points</dt><dd>{score.opponentGamePoints}</dd></div><div><dt>Spread Points</dt><dd>{opponentSpread}</dd></div></dl></div></div></div>;
}

function PaperDigitalGuide() {
  return <details className="how-to"><summary>Playing with one paper card and one digital card</summary><p>Keep the paper card as the shared reference. Both assigned players must sign in as themselves, independently enter that result, and confirm their own entry. On a shared device, the first player must sign out before the second player signs in. If either player cannot sign in and submit, leave the card pending for the authorized cross-check or judge process.</p></details>;
}

export function LiveScoreEntry({ context }: { context: AssignedGameContext }) {
  const router = useRouter();
  const [winner, setWinner] = useState<Winner>(() => context.ownSubmission ? context.ownSubmission.winnerSide === context.player.side ? "player" : "opponent" : null);
  const [marginText, setMarginText] = useState(() => context.ownSubmission ? String(context.ownSubmission.margin) : "");
  const [submissionId, setSubmissionId] = useState<string | null>(context.ownSubmission?.id ?? null);
  const [pendingSubmission, setPendingSubmission] = useState<PendingScoreSubmission | null>(null);
  const [offlineCapability, setOfflineCapability] = useState<OfflineSubmissionCapability | null>(null);
  const [offlineRecord, setOfflineRecord] = useState<OfflineQueueRecord | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [canConfirm, setCanConfirm] = useState(context.canConfirm);
  const [reviewing, setReviewing] = useState(false);
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
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [offlinePageReady, setOfflinePageReady] = useState(false);
  const margin = Number(marginText);
  const derived = isScoreEntryReady(margin, winner) ? deriveScore(margin, winner) : null;
  const winnerSide = winner === "player" ? context.player.side : context.opponent.side;

  const syncOffline = async (record: OfflineQueueRecord) => {
    if (busy || !navigator.onLine) return;
    setBusy(true);
    setStatus("Connection restored. Syncing your saved offline entry…");
    try {
      const { response, payload } = await replayOfflineSubmission(record);
      if (!response.ok) {
        if (response.status === 401) setStatus("Your saved offline entry is still on this device. Sign in as the same player to sync it.");
        else if (response.status === 409) setStatus("Your saved offline entry needs review and was not applied to the scorecard.");
        else setStatus("Your saved offline entry is still on this device. Sync will retry when service returns.");
        return;
      }
      if (!canDeleteOfflineQueueRecord(record, payload)) {
        setStatus("The sync response was incomplete. Your saved offline entry remains on this device.");
        return;
      }
      await deleteOfflineSubmission(record.intent.queueId);
      setOfflineRecord(null);
      setSubmissionId(record.intent.submissionId);
      setStatus("Offline entry synchronized. Refreshing the server scorecard status…");
      router.refresh();
    } catch {
      setStatus("Your saved offline entry is still on this device. Sync will retry when service returns.");
    } finally { setBusy(false); }
  };

  useEffect(() => {
    let active = true;
    let queuedForReconnect: OfflineQueueRecord | null = null;
    const preparePage = async (capabilityExpiresAtMs: number) => {
      try {
        const ready = await prepareCurrentScorePageForOffline(context.actorId, context.gameId, capabilityExpiresAtMs);
        if (active) setOfflinePageReady(ready);
        return ready;
      } catch {
        if (active) setOfflinePageReady(false);
        return false;
      }
    };
    const prepareOfflineUse = async () => {
      if (context.ownSubmission || !navigator.onLine) return;
      const prepared = await readPreparedOfflineSubmissionCapability(context.actorId, context.gameId);
      const capability = await provisionOfflineSubmission(context.actorId, context.gameId).catch(() => prepared);
      if (!capability || !active) return;
      setOfflineCapability(capability);
      await preparePage(capability.capabilityExpiresAtMs);
    };
    const timer = window.setTimeout(async () => {
      const pending = readPendingScoreSubmission(window.sessionStorage, context.actorId, context.tournamentId, context.gameId, context.player.side);
      const recovery = pendingSubmissionRecovery(pending, context.ownSubmission?.id ?? null);
      if (recovery.action === "clear" && pending) {
        clearPendingScoreSubmission(window.sessionStorage, pending);
      } else if (recovery.action === "retry") {
        setPendingSubmission(recovery.envelope);
        setWinner(recovery.envelope.winnerSide === context.player.side ? "player" : "opponent");
        setMarginText(String(recovery.envelope.margin));
        setStatus("A previous entry is awaiting a safe retry. Only that exact result can be sent until the tournament server responds.");
      }
      try {
        const queued = await readOfflineSubmission(context.actorId, context.gameId);
        if (!active) return;
        if (queued?.intent.kind === "submission") {
          queuedForReconnect = queued;
          setOfflineRecord(queued);
          setWinner(queued.intent.winnerSide === context.player.side ? "player" : "opponent");
          setMarginText(String(queued.intent.margin));
          setHydrated(true);
          setStatus(navigator.onLine ? "A saved offline entry is ready to sync." : "Saved Offline — Waiting to Sync");
          if (navigator.onLine) {
            await preparePage(queued.intent.capabilityExpiresAtMs);
            void syncOffline(queued);
          } else {
            // An offline reload can only reach this component through the
            // actor-bound cached game page established before disconnection.
            setOfflinePageReady(true);
          }
        } else {
          setHydrated(true);
          if (!context.ownSubmission) {
            const prepared = await readPreparedOfflineSubmissionCapability(context.actorId, context.gameId);
            const capability = navigator.onLine
              ? await provisionOfflineSubmission(context.actorId, context.gameId).catch(() => prepared)
              : prepared;
            if (!capability) throw new Error("offline_capability_unavailable");
            if (active) {
              setOfflineCapability(capability);
              if (navigator.onLine) void preparePage(capability.capabilityExpiresAtMs);
              else setOfflinePageReady(true);
            }
          }
        }
      } catch {
        if (active && !navigator.onLine) setStatus("Offline entry is not ready on this device. Reconnect before leaving this page.");
      }
      if (active) setHydrated(true);
    });
    const connectionRestored = () => {
      setOnline(true);
      if (queuedForReconnect) void syncOffline(queuedForReconnect);
      else void prepareOfflineUse();
    };
    const connectionLost = () => setOnline(false);
    window.addEventListener("online", connectionRestored);
    window.addEventListener("offline", connectionLost);
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener("online", connectionRestored); window.removeEventListener("offline", connectionLost); };
    // The active queue is intentionally rebound when its identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.actorId, context.gameId, context.ownSubmission?.id, context.player.side, context.tournamentId]);

  const saveOffline = async () => {
    if (!derived || !winner) return null;
    try {
      const capability = offlineCapability
        ?? await readPreparedOfflineSubmissionCapability(context.actorId, context.gameId)
        ?? await provisionOfflineSubmission(context.actorId, context.gameId);
      const record = await queueOfflineSubmission(capability, winnerSide, derived.margin);
      if (pendingSubmission) clearPendingScoreSubmission(window.sessionStorage, pendingSubmission);
      setPendingSubmission(null);
      setOfflineCapability(capability);
      setOfflineRecord(record);
      setReviewing(false);
      setStatus("Saved Offline — Waiting to Sync");
      return record;
    } catch {
      setStatus("This device could not safely save the offline entry. Keep this page open and reconnect before submitting.");
      return null;
    }
  };
  const operationId = (kind: "confirmation", fingerprint: string) => {
    const storageKey = `acc-score:${context.actorId}:${context.gameId}:${kind}:${fingerprint}`;
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
    if (!pendingSubmission) {
      const record = await saveOffline();
      if (record && navigator.onLine) await syncOffline(record);
      return;
    }
    const envelope = pendingSubmission;
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
    if (!navigator.onLine) {
      setStatus("You are offline. This confirmation has not been saved. Reconnect before confirming.");
      return;
    }
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
  if (!submissionId && reviewing && derived) return <main className="auth-shell"><section className="auth-card live-score" aria-labelledby="live-score-title"><p className="eyebrow">SCORE ENTRY</p><h1 id="live-score-title">Review Current Game Result</h1><p className="auth-note">{context.eventName} · Game {context.roundNumber}</p><p className="game-line">Game {context.roundNumber} · {context.player.displayName}: Table/Seat {context.player.tableSeat} · {context.opponent.displayName}: Table/Seat {context.opponent.tableSeat}</p><ResultPreview context={context} score={derived} /><SkunkAid level={derived.skunkLevel} /><div className="actions"><button type="button" className="secondary" disabled={busy || !!pendingSubmission || !!offlineRecord} onClick={() => setReviewing(false)}>Edit Result</button><button type="button" className="primary" disabled={busy || !hydrated} onClick={submit}>{busy ? "Submitting…" : "Submit My Independent Entry"}</button></div><SharedDeviceSignOut /></section></main>;
  return <main className="auth-shell"><section className="auth-card live-score" aria-labelledby="live-score-title"><p className="eyebrow">SCORE ENTRY</p><h1 id="live-score-title">Current Game Results</h1><p className="auth-note">{context.eventName} · Game {context.roundNumber}</p><p className="auth-note" role="status">{offlinePageReady ? "Offline Ready" : online ? "Preparing Offline Use…" : "Offline reload is not ready on this device."}</p><div className="live-matchup"><strong>{context.player.displayName} <em>(ID#: {context.player.verificationId})</em></strong><span>Table/Seat {context.player.tableSeat}</span><b>VS</b><strong>{context.opponent.displayName} <em>(ID#: {context.opponent.verificationId})</em></strong><span>Table/Seat {context.opponent.tableSeat}</span></div><fieldset><legend>Game Winner:</legend><button type="button" className={winner === "player" ? "pick selected" : "pick"} disabled={busy || !!submissionId || !!pendingSubmission || !!offlineRecord} aria-pressed={winner === "player"} onClick={() => setWinner("player")}>{context.player.displayName} won</button><button type="button" className={winner === "opponent" ? "pick selected" : "pick"} disabled={busy || !!submissionId || !!pendingSubmission || !!offlineRecord} aria-pressed={winner === "opponent"} onClick={() => setWinner("opponent")}>{context.opponent.displayName} won</button></fieldset><div className="entry"><span>Spread Points:</span><output className={derived ? "number" : "number invalid"}>{marginText || "—"}</output><SkunkAid level={derived?.skunkLevel ?? 0} /></div><div className="keypad" aria-label="Spread points keypad">{keypad.map((value) => <button type="button" key={value} onClick={() => key(value)} disabled={busy || !!submissionId || !!pendingSubmission || !!offlineRecord}>{value === "clear" ? "Clear" : value === "backspace" ? "⌫" : value}</button>)}</div>{derived ? <ResultPreview context={context} score={derived} /> : null}<p className="live-status" role="status">{status}</p>{offlineRecord ? <button type="button" className="primary full" disabled={busy || !online} onClick={() => syncOffline(offlineRecord)}>{busy ? "Syncing…" : online ? "Sync Saved Entry" : "Waiting for Connection"}</button> : !submissionId ? pendingSubmission ? <button type="button" className="primary full" disabled={busy || !hydrated} onClick={submit}>{busy ? "Submitting…" : "Retry This Same Entry"}</button> : <button type="button" className="primary full" disabled={!derived || busy || !hydrated} onClick={() => setReviewing(true)}>Review Result</button> : canConfirm ? <button type="button" className="primary full" disabled={busy} onClick={confirm}>{busy ? "Confirming…" : "Confirm My Entry"}</button> : null}<PaperDigitalGuide /><Link className="guide-link" href={`/tournament/${context.tournamentId}/scorecard?event=${context.eventId}`}>View Scorecard</Link><Link className="guide-link" href={`/tournament/${context.tournamentId}/how-to`}>Open Start Here / How To</Link><SharedDeviceSignOut /></section></main>;
}
