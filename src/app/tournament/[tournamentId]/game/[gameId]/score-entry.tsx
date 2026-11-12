"use client";
import { GamePlayerLocation } from "../../../../../components/game-player-location";
import { setAppRecoveryItem } from "../../../../../lib/recovery-write-coordinator";

import { useEffect, useRef, useState } from "react";
import { PlayerPageFrame } from "../../../../../components/player-page-frame";
import { useRouter } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../../components/shared-device-sign-out";
import { deriveScore, isScoreEntryReady, type ScoreResult } from "../../../../../lib/score";
import type { AssignedGameContext } from "../../../../../lib/games/assigned-game-context";
import { clearPendingScoreSubmission, isDefinitiveScoreMutationFailure, pendingSubmissionRecovery, readPendingScoreSubmission, type PendingScoreSubmission } from "../../../../../lib/score-retry-envelope";
import { canDeleteOfflineQueueRecord, type OfflineQueueRecord, type OfflineSubmissionCapability } from "../../../../../lib/offline-score-queue-contract";
import { deleteOfflineSubmission, provisionOfflineSubmission, queueOfflineSubmission, readOfflineSubmission, readPreparedOfflineSubmissionCapability, replayOfflineSubmission } from "../../../../../lib/offline-score-queue";
import { prepareCurrentScorePageForOffline } from "../../../../../lib/offline-score-page-cache";
import { JudgeCallButton } from "./judge-call-button";
import { scoreEntryServerState } from "../../../../../lib/games/score-entry-server-state";
import { scoreEntryDraftKey, readScoreEntryDraft, clearScoreEntryDraft } from "../../../../../lib/games/score-entry-draft";
import { playerStatusCopy } from "../../../../../lib/games/player-status-copy";
import type {GameScorecardNumbers} from '../../../../../lib/games/scorecard-number-context';
import {MakeupCardLines} from '../../../../../components/makeup-card-lines';

const keypad = [1, 2, 3, 4, 5, 6, 7, 8, 9, "clear", 0, "backspace"] as const;
type Winner = "player" | "opponent" | null;

function publicMessage(status: number, payload: unknown) {
  if (status === 401) return "Sign in again before submitting this score.";
  if (status === 400) return "Enter a possible spread point number and choose the winner.";
  const code = payload && typeof payload === "object" ? (payload as Record<string, unknown>).code : undefined;
  if (code === "not_assigned") return "This scorecard is not assigned to your account.";
  if (code === "event_not_approved") return "This event is not approved for digital scoring.";
  if (code === "tournament_closed") return "This tournament is no longer open for score entry.";
  if (code === "future_game_locked") return "This upcoming game opens after your earlier scheduled game is verified.";
  if (code === "event_play_paused") return "The director has paused play. Your entry is kept on this device. Submit it again once play resumes.";
  if (code === "event_play_closed") return "The director has closed play for this event, so no new score can be entered. Speak to the director if this game still needs a result.";
  return "This result could not be accepted. Refresh the game before trying again.";
}

function SkunkAid({ level }: { level: 0 | 1 | 2 | 3 }) {
  if (level === 0) return null;
  const label = level === 1 ? "Skunk" : level === 2 ? "Double skunk" : "Triple skunk";
  return <span className="skunk" role="status" aria-label={label}><b aria-hidden="true">{"\u{1F9A8}".repeat(level)}</b><span>{label}</span></span>;
}

function ResultPreview({ score }: { score: ScoreResult }) {
  const won = score.winner === "player";
  const spread = won ? `+${score.playerPlus}` : `-${score.playerMinus}`;
  return <section className="player-result-summary" aria-label="Your result" aria-live="polite"><h2>Your Result:</h2><p>{won ? "WON" : "LOST"} - Points: {score.playerGamePoints} Game | {spread} Spread</p></section>;
}

function PaperDigitalGuide() {
  return <details className="how-to"><summary>Playing with one paper card and one digital card</summary><p>The digital player submits their own result in the app. The paper player records the same result on the original paper scorecard and does not need an app account. Keep that card for an assigned cross-checker to match against the digital entry. A second distinct authorized non-playing official must independently re-enter and confirm both sources before the result counts. A missing entry or mismatch stays unresolved; ask the director for help.</p></details>;
}

export function LiveScoreEntry({ context,cardNumbers,tournamentName = "Tournament" }: { context: AssignedGameContext;cardNumbers?:GameScorecardNumbers|null;tournamentName?:string }) {
  const displayedGame=cardNumbers?.isMakeup?(context.player.side==='a'?cardNumbers.sideACardGameNumber:cardNumbers.sideBCardGameNumber):context.roundNumber;
  const makeupNotice=<MakeupCardLines numbers={cardNumbers} sideAName={context.player.side==='a'?context.player.displayName:context.opponent.displayName} sideBName={context.player.side==='b'?context.player.displayName:context.opponent.displayName}/>;
  const router = useRouter();
  const serverState = scoreEntryServerState(context);
  const [winner, setWinner] = useState<Winner>(() => context.ownSubmission ? context.ownSubmission.winnerSide === context.player.side ? "player" : "opponent" : null);
  const [marginText, setMarginText] = useState(() => context.ownSubmission ? String(context.ownSubmission.margin) : "");
  const [submissionId, setSubmissionId] = useState<string | null>(context.ownSubmission?.id ?? null);
  const [pendingSubmission, setPendingSubmission] = useState<PendingScoreSubmission | null>(null);
  const [offlineCapability, setOfflineCapability] = useState<OfflineSubmissionCapability | null>(null);
  const [offlineRecord, setOfflineRecord] = useState<OfflineQueueRecord | null>(null);
  const [offlineReplayClosed, setOfflineReplayClosed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [canConfirm, setCanConfirm] = useState(serverState.canConfirm);
  const [status, setStatus] = useState(serverState.status);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [offlinePageReady, setOfflinePageReady] = useState(false);
  const offlineSyncInFlight = useRef(false);

  // RSC refresh preserves client state. Follow the complete saved-state
  // snapshot, including accepted offline submission and other-player progress,
  // rather than only the canConfirm boolean captured at first mount.
  const [lastServerStateKey, setLastServerStateKey] = useState(serverState.key);
  if (lastServerStateKey !== serverState.key && !busy && !offlineRecord && !pendingSubmission) {
    setLastServerStateKey(serverState.key);
    setCanConfirm(serverState.canConfirm);
    setStatus(serverState.status);
    if (context.ownSubmission) {
      setSubmissionId(context.ownSubmission.id);
      setWinner(context.ownSubmission.winnerSide === context.player.side ? "player" : "opponent");
      setMarginText(String(context.ownSubmission.margin));
    }
  }

  useEffect(() => {
    if (!submissionId || busy || offlineRecord || pendingSubmission || context.state === "verified") return;
    // Read-only refresh: never submits, replays, confirms, or deletes a queue.
    const refresh = () => { if (navigator.onLine && document.visibilityState === "visible") router.refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === "acc-score-result-accepted") refresh(); };
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("storage", storage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("storage", storage);
    };
  }, [submissionId, busy, offlineRecord, pendingSubmission, context.state, router]);
  const draftIdentity = { actorId: context.actorId, tournamentId: context.tournamentId, eventId: context.eventId, gameId: context.gameId, side: context.player.side };
  const persistDraft = (nextWinner: Winner, nextMargin: string) => {
    try {
      if (nextWinner === null && nextMargin === "") { clearScoreEntryDraft(window.sessionStorage, draftIdentity); return; }
      const revision = (readScoreEntryDraft(window.sessionStorage, draftIdentity)?.revision ?? 0) + 1;
      const key = `${scoreEntryDraftKey(draftIdentity)}:${revision}`;
      setAppRecoveryItem(window.sessionStorage, key, JSON.stringify({ ...draftIdentity, version: 1, revision, winner: nextWinner, marginText: nextMargin }));
      clearScoreEntryDraft(window.sessionStorage, draftIdentity, key);
    }
    catch { setStatus("These choices could not be kept for navigation. Keep this page open until you submit or clear the result."); }
  };
  const discardDraft = () => { try { clearScoreEntryDraft(window.sessionStorage, draftIdentity); return true; } catch { return false; } };
  const choose = (choice: Winner) => { persistDraft(choice, marginText); setWinner(choice); };
  const hasUnsubmittedDraft = !submissionId && !pendingSubmission && !offlineRecord && !offlineReplayClosed && (!!winner || marginText.length > 0);
  useEffect(() => {
    if (!hasUnsubmittedDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsubmittedDraft]);
  const beforeNavigate = () => {
    if (busy) { setStatus("Please wait while this entry is being saved."); return false; }
    if (!hasUnsubmittedDraft) return true;
    if (!window.confirm("This result has not been submitted. Leave this page and discard these unsubmitted choices?")) return false;
    if (discardDraft()) return true;
    setStatus("These unsubmitted choices could not be cleared. Keep this page open until the browser can preserve recovery work."); return false;
  };
  const margin = Number(marginText);
  const derived = isScoreEntryReady(margin, winner) ? deriveScore(margin, winner) : null;
  const winnerSide = winner === "player" ? context.player.side : context.opponent.side;

  const syncOffline = async (record: OfflineQueueRecord) => {
    if (offlineSyncInFlight.current || !navigator.onLine) return;
    offlineSyncInFlight.current = true;
    setBusy(true);
    setStatus("Connection restored. Syncing your saved offline entry…");
    try {
      const { response, payload } = await replayOfflineSubmission(record);
      if (response.ok || response.status === 409) {
        if (!canDeleteOfflineQueueRecord(record, payload)) {
          setStatus("The sync response was incomplete. Your saved offline entry remains on this device.");
          return;
        }
        const disposition = (payload as { disposition: "accepted" | "rejected" | "quarantined" | "conflict" }).disposition;
        if ((response.ok && disposition !== "accepted") || (response.status === 409 && disposition === "accepted")) {
          setStatus("The sync response contradicted its receipt. Your saved offline entry remains on this device.");
          return;
        }
        await deleteOfflineSubmission(record.intent.queueId);
        setOfflineRecord(null);
        if (response.ok) {
          setSubmissionId(record.intent.submissionId);
          setStatus("Offline entry synchronized. Refreshing the server scorecard status…");
        } else {
          setOfflineReplayClosed(true);
          setStatus(disposition === "conflict"
            ? "The server recorded a conflict for this offline entry. It was not applied to the scorecard and this device no longer holds it. Re-enter the result from the paper card and tell your director."
            : disposition === "quarantined"
              ? "The server quarantined this offline entry. It was not applied to the scorecard and this device no longer holds it. Re-enter the result from the paper card and tell your director."
              : "The server rejected this offline entry. It was not applied to the scorecard and this device no longer holds it. Re-enter the result from the paper card and tell your director.");
        }
        router.refresh();
        return;
      }
      if (!response.ok) {
        if (response.status === 401) setStatus("Your saved offline entry is still on this device. Sign in as the same player to sync it.");
        else if (response.status === 423) setStatus("The director has paused or closed play, so this score was not sent. Your saved entry is still on this device and will sync once play resumes.");
        else setStatus("Your saved offline entry is still on this device. Tap Sync Saved Entry to try again.");
        return;
      }
    } catch {
      setStatus("Your saved offline entry is still on this device. Tap Sync Saved Entry to try again.");
    } finally { offlineSyncInFlight.current = false; setBusy(false); }
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
        setPendingSubmission(null);
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
          setStatus(navigator.onLine ? "A saved offline entry is ready to sync." : "Saved Offline, Waiting to Sync");
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
          if (!context.ownSubmission && recovery.action !== "retry") {
            const draft = readScoreEntryDraft(window.sessionStorage, draftIdentity);
            if (draft && (draft.winner !== null || draft.marginText !== "")) { setWinner(draft.winner); setMarginText(draft.marginText); }
            else if (draft) discardDraft();
          } else if (context.ownSubmission) discardDraft();
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
      discardDraft();
      if (pendingSubmission) clearPendingScoreSubmission(window.sessionStorage, pendingSubmission);
      setPendingSubmission(null);
      setOfflineCapability(capability);
      setOfflineRecord(record);
      setStatus("Saved Offline, Waiting to Sync");
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
      setAppRecoveryItem(window.sessionStorage, storageKey, value);
      return { storageKey, value };
    } catch { return null; }
  };
  const key = (value: (typeof keypad)[number]) => {
    if (busy || submissionId || pendingSubmission || offlineReplayClosed) return;
    const next = value === "clear" ? "" : value === "backspace" ? marginText.slice(0, -1) : marginText.length >= 3 ? marginText : marginText === "0" ? String(value) : `${marginText}${value}`;
    persistDraft(winner, next); setMarginText(next);
  };
  const submit = async () => {
    if (busy || submissionId || offlineReplayClosed || !hydrated) return;
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
      try { window.localStorage.setItem("acc-score-result-accepted", new Date().toISOString()); } catch { /* ten-second refresh remains available */ }
      setCanConfirm(result.status === "confirmation_pending");
      setStatus(result.status === "confirmation_pending" ? "Both entries match. Confirm your own entry to continue." : result.status === "mismatch" ? "The entries do not match. This game needs cross-checking." : "Your entry is saved. Required verification is still pending.");
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
      try { window.localStorage.setItem("acc-score-result-accepted", new Date().toISOString()); } catch { /* ten-second refresh remains available */ }
      setStatus(result.status === "verified" ? "Game verified. The authoritative scorecard is updated." : "Your confirmation is saved. The game will verify after the other player confirms their own entry.");
    } catch {
      setStatus("Network issue. Please try again; this confirmation will safely retry with the same request ID.");
    } finally { setBusy(false); }
  };
  const locked = !hydrated || busy || !!submissionId || !!pendingSubmission || !!offlineRecord || offlineReplayClosed;
  return <PlayerPageFrame tournamentId={context.tournamentId} tournamentName={tournamentName} eventId={context.eventId} eventName={context.eventName} activeTab="entry" player={context.player} beforeNavigate={beforeNavigate}>
    <section className="player-entry" aria-labelledby="live-score-title">
      <h1 id="live-score-title">{cardNumbers?.isMakeup ? <>Card game {displayedGame}</> : <>Game {context.roundNumber}</>}</h1>
      <div className="player-matchup"><GamePlayerLocation label={context.player.displayName} playerId={context.player.verificationId} tableSeat={context.player.tableSeat} identityLabel="Tournament ID#" /><GamePlayerLocation label={context.opponent.displayName} playerId={context.opponent.verificationId} tableSeat={context.opponent.tableSeat} /></div>
      {makeupNotice}
      <fieldset className="player-result-choices"><legend className="sr-only">Your result</legend>
        <button type="button" className={`player-won${winner === "player" ? " selected" : ""}`} disabled={locked} aria-pressed={winner === "player"} onClick={() => choose("player")}>{context.player.displayName} WON{winner === "player" ? <span aria-hidden="true">✓ Selected</span> : null}</button>
        <button type="button" className={`player-lost${winner === "opponent" ? " selected" : ""}`} disabled={locked} aria-pressed={winner === "opponent"} onClick={() => choose("opponent")}>{context.player.displayName} LOST{winner === "opponent" ? <span aria-hidden="true">✓ Selected</span> : null}</button>
      </fieldset>
      <div className="player-spread-entry"><label htmlFor="player-spread-value">Spread Points</label><output id="player-spread-value" aria-live="polite">{marginText || "—"}</output><SkunkAid level={derived?.skunkLevel ?? 0} /></div>
      <div className="keypad player-keypad" aria-label="Spread points keypad">{keypad.map((value) => <button type="button" key={value} aria-label={value === "clear" ? "Clear spread points" : value === "backspace" ? "Delete last digit" : undefined} onClick={() => key(value)} disabled={locked}>{value === "clear" ? "Clear" : value === "backspace" ? "Delete" : value}</button>)}</div>
      {derived ? <ResultPreview score={derived} /> : null}
      {offlineRecord ? <button type="button" className="primary full" disabled={busy || !online} onClick={() => syncOffline(offlineRecord)}>{busy ? "Syncing…" : online ? "Sync Saved Entry" : "Waiting for Connection"}</button>
        : !submissionId && !offlineReplayClosed ? <button type="button" className="primary full" disabled={(!pendingSubmission && !derived) || busy || !hydrated} onClick={submit}>{busy ? "Submitting…" : pendingSubmission ? "Retry This Same Entry" : "Submit result"}</button>
          : canConfirm ? <button type="button" className="primary full" disabled={busy || !online} onClick={confirm}>{busy ? "Confirming…" : "Confirm My Entry"}</button> : null}
      <p className="live-status player-entry-status" role="status">{playerStatusCopy(status)}</p>
      <p className="player-offline-status" role="status">{canConfirm && !online ? "Reconnect before confirming. Confirmations are saved only online." : offlinePageReady ? "Offline Ready" : online ? "Preparing Offline Use…" : "Offline reload is not ready on this device."}</p>
      <details className="player-help"><summary>Help and account options</summary><JudgeCallButton tournamentId={context.tournamentId} gameId={context.gameId} /><PaperDigitalGuide /><a className="guide-link" href={`/tournament/${context.tournamentId}/how-to`}>Open Start Here / How To</a><SharedDeviceSignOut /></details>
    </section>
  </PlayerPageFrame>;
}
