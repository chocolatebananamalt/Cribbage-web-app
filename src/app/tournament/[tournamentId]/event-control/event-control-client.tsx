"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  eventControlRejectionMessage,
  isEventPlayCloseResult,
  isEventPlayPauseResult,
  type EventControlEvent,
  type EventControlWorkspace,
} from "../../../../lib/api/event-control";
import { formatUtcDateTime } from "../../../../lib/date-time";
import type { SyntheticEventContext } from "../../../../lib/api/synthetic-event-evidence";
import { SyntheticEventArtifactView } from "../../../../components/synthetic-event-notice";

import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";
import { isUuid } from "../../../../lib/api/validation";

type SyntheticCloseEnvelope = { action: "close"; reason: string; confirmed: true; idempotencyKey: string };
function validCloseEnvelope(v: unknown): v is SyntheticCloseEnvelope {
  return !!v && typeof v === "object" && Object.keys(v).sort().join() === "action,confirmed,idempotencyKey,reason"
    && "action" in v && v.action === "close" && "confirmed" in v && v.confirmed === true
    && "idempotencyKey" in v && isUuid(v.idempotencyKey) && "reason" in v && typeof v.reason === "string"
    && /^TEST ONLY SYNTHETIC: SYNTHETIC-EVENT-v1:[a-f0-9-]{36}:[a-f0-9]{64} /.test(v.reason);
}
type ConfirmKind = "close" | "reopen" | null;

function playStateLabel(value: string) {
  return value.replaceAll("_", " ");
}

function pauseLine(event: EventControlEvent) {
  if (event.pauseState !== "paused") {
    if (!event.pausedAt) return "Play is running. It has not been paused.";
    return `Play is running. Last resumed ${formatUtcDateTime(event.pausedAt)} by ${event.pauseActor ?? "an official"}.`;
  }
  const when = event.pausedAt ? ` since ${formatUtcDateTime(event.pausedAt)}` : "";
  const who = event.pauseActor ? ` by ${event.pauseActor}` : "";
  return `Play is PAUSED${when}${who}. Reason: ${event.pauseReason ?? "not recorded"}`;
}

function closeLine(event: EventControlEvent) {
  if (event.closeState !== "closed") {
    if (event.closeAction !== "reopened" || !event.closedAt) return "Play is open. This event has not been closed.";
    return `Play is open. Reopened ${formatUtcDateTime(event.closedAt)} by ${event.closeActor ?? "an official"}.`;
  }
  const when = event.closedAt ? ` ${formatUtcDateTime(event.closedAt)}` : "";
  const who = event.closeActor ? ` by ${event.closeActor}` : "";
  return `Play is CLOSED${when}${who}. Reason: ${event.closeReason ?? "not recorded"}`;
}

function readinessLine(event: EventControlEvent) {
  const { scheduledGames, resolvedGames, unresolvedGames } = event.readiness;
  if (scheduledGames === 0) return "No scheduled games. There is nothing to close.";
  if (unresolvedGames === 0) return `All ${scheduledGames} scheduled games are recorded and verified. Close Event is available.`;
  return `${resolvedGames} of ${scheduledGames} scheduled games are recorded and verified. ${unresolvedGames} still unresolved, so Close Event is refused.`;
}

export default function EventControlClient({ actorId, tournamentId, workspace, syntheticContext: tournamentSyntheticContext }: { actorId?: string; tournamentId: string; workspace: EventControlWorkspace; syntheticContext?: SyntheticEventContext | null }) {
  const router = useRouter();
  const flight = useRef(false);
  const [retained, setRetained] = useState<SyntheticCloseEnvelope | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryScope, setRecoveryScope] = useState<string | null>(null);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const events = workspace.events;
  const [selectedId, setSelectedId] = useState(events[0]?.eventId ?? "");
  const [reason, setReason] = useState("");
  const [closeTicked, setCloseTicked] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmKind>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // router.refresh() re-runs the server page and hands down a new workspace, so
  // the event list is read straight off that prop rather than copied into state.
  // The copy was the whole reason this needed an effect, and an effect that
  // calls setState on every new workspace is a cascading render on a pause
  // screen. Only the selection is local, and it is corrected during render, the
  // one place React sanctions for state that derives from props.
  const fallbackId = events[0]?.eventId ?? "";
  const resolvedId = events.some((item) => item.eventId === selectedId) ? selectedId : fallbackId;
  if (resolvedId !== selectedId) setSelectedId(resolvedId);

  const syntheticContext = tournamentSyntheticContext?.eventIds.includes(resolvedId) ? tournamentSyntheticContext : null;
  const selected = events.find((item) => item.eventId === resolvedId) ?? null;
  const closeArtifact = syntheticContext?.artifacts.find(item => item.kind === "close" && item.eventId === resolvedId);
  const trimmedReason = reason.trim();
  const reasonUsable = trimmedReason.length > 0 && trimmedReason.length <= 1000;
  const closeReason = syntheticContext && closeArtifact ? `TEST ONLY SYNTHETIC: ${closeArtifact.reference} ${trimmedReason}` : trimmedReason;
  const controllable = !!selected && selected.started && !selected.teamEvent;
  const canClose = !!selected && controllable && selected.closeState === "open"
    && selected.readiness.scheduledGames > 0 && selected.readiness.unresolvedGames === 0;

  const recoveryKey = `qualification-finalization:synthetic-close:${actorId}:${tournamentId}:${resolvedId}`;
  const scopedRetained = recoveryScope === recoveryKey ? retained : null;
  const scopedReady = recoveryReady && recoveryScope === recoveryKey;
  useEffect(() => {
    const timer = setTimeout(() => {
    setRecoveryScope(recoveryKey);
    if (!syntheticContext) { setRecoveryReady(true); setRetained(null); setRecoveryBlocked(false); return; }
    setRecoveryReady(false); setRetained(null); setRecoveryBlocked(false);
    if (!actorId) { setRecoveryBlocked(true); setMessage("Current actor is unavailable; synthetic closure is blocked."); setRecoveryReady(true); return; }
    try {
      const raw = sessionStorage.getItem(recoveryKey);
      if (raw) { const value: unknown = JSON.parse(raw); if (!validCloseEnvelope(value)) throw Error("invalid retained envelope"); setRetained(value); setMessage("An uncertain synthetic close request is retained. Retry the exact request to recover its outcome."); }
    } catch { setRecoveryBlocked(true); setMessage("Retained closure could not be read safely. It was not cleared or overwritten."); }
    setRecoveryReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [actorId, recoveryKey, syntheticContext]);
  async function syntheticClose(envelope: SyntheticCloseEnvelope) {
    if (flight.current || recoveryBlocked || !scopedReady || !actorId || !syntheticContext) return;
    flight.current = true; setBusy(true);
    const raw = JSON.stringify(envelope);
    try {
      const existing = sessionStorage.getItem(recoveryKey);
      if (existing !== null && existing !== raw) throw Error("retained identity conflict");
      if (!existing) setAppRecoveryItem(sessionStorage, recoveryKey, raw);
      setRetained(envelope);
      const result = await send("play-close", envelope);
      if (!isEventPlayCloseResult(result.body)
        || (result.body.status === "rejected" ? result.status !== 409 || result.body.code === "idempotency_conflict"
          : result.status < 200 || result.status >= 300 || result.body.eventId !== resolvedId || !["event_play_closed", "already_closed"].includes(result.body.status))) {
        setMessage("Closure outcome remains uncertain or conflicted. The exact request is retained."); return;
      }
      if (sessionStorage.getItem(recoveryKey) !== raw) throw Error("retained identity changed");
      sessionStorage.removeItem(recoveryKey); setRetained(null);
      if (result.body.status === "rejected") setMessage(eventControlRejectionMessage(result.body));
      else finish("Simulated event closure confirmed. No physical table check is claimed.");
    } catch { setMessage("Closure could not be confirmed. Retained work stays intact; retry uses the same operation and evidence."); }
    finally { flight.current = false; setBusy(false); }
  }

  async function send(path: "play-pause" | "play-close", body: Record<string, unknown>) {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${resolvedId}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  }

  function finish(text: string) {
    setMessage(text);
    setReason("");
    setCloseTicked(false);
    setConfirming(null);
    router.refresh();
  }

  async function pause(action: "pause" | "resume") {
    if (busy || !controllable) return;
    if (!reasonUsable) { setMessage("Enter a reason of 1 to 1000 characters. Nothing was recorded."); return; }
    setBusy(true);
    setMessage(action === "pause" ? "Pausing play…" : "Resuming play…");
    try {
      const result = await send("play-pause", { action, reason: trimmedReason, idempotencyKey: crypto.randomUUID() });
      if (!isEventPlayPauseResult(result.body)) {
        setMessage("The pause state did not change. Nothing was recorded. Reload and try again.");
        return;
      }
      if (result.body.status === "rejected") {
        setMessage(eventControlRejectionMessage(result.body));
        return;
      }
      if (result.body.status === "already_paused") { finish("Play was already paused. Nothing changed."); return; }
      if (result.body.status === "not_paused") { finish("Play was already running. Nothing changed."); return; }
      finish(result.body.status === "event_play_paused"
        ? "Play is paused. New score entry is refused for this event until you resume."
        : "Play has resumed. Players can enter scores again.");
    } catch {
      setMessage("The pause state did not change. Nothing was recorded. Reload and try again.");
    } finally { setBusy(false); }
  }

  async function closeOrReopen(action: "close" | "reopen") {
    if (busy || !controllable || scopedRetained || recoveryBlocked) return;
    if (action === "reopen" && syntheticContext) { setMessage("Reopening is unavailable for the synthetic fixture."); return; }
    if (!reasonUsable) { setMessage("Enter a reason of 1 to 1000 characters. Nothing was recorded."); return; }
    if (action === "close" && (!closeTicked || !canClose)) return;
    if (action === "close" && syntheticContext) {
      await syntheticClose({ action: "close", reason: closeReason, confirmed: true, idempotencyKey: crypto.randomUUID() }); return;
    }
    setBusy(true);
    setMessage(action === "close" ? "Closing this event…" : "Reopening this event…");
    try {
      const body = action === "close"
        ? { action, reason: closeReason, confirmed: true, idempotencyKey: crypto.randomUUID() }
        : { action, reason: trimmedReason, idempotencyKey: crypto.randomUUID() };
      const result = await send("play-close", body);
      if (!isEventPlayCloseResult(result.body)) {
        setMessage("The event was not closed. Nothing was recorded. Reload and try again.");
        return;
      }
      if (result.body.status === "rejected") {
        setMessage(eventControlRejectionMessage(result.body));
        return;
      }
      if (result.body.status === "already_closed") { finish("This event was already closed. Nothing changed."); return; }
      if (result.body.status === "not_closed") { finish("This event was already open. Nothing changed."); return; }
      finish(result.body.status === "event_play_closed"
        ? `Play is closed for this event. All ${result.body.scheduledGames} scheduled games are recorded and verified, and no new score will be accepted.`
        : selected?.pauseState === "paused"
          ? "This event is open again, but play is still paused. Press Resume Play before any score will be accepted."
          : "This event is open again. Score entry is accepted once more.");
    } catch {
      setMessage("The event was not closed. Nothing was recorded. Reload and try again.");
    } finally { setBusy(false); }
  }

  if (!events.length) {
    return <section className="event-control">
    {scopedRetained && <aside role="alert"><p>An uncertain synthetic close request is retained.</p><button type="button" disabled={busy || !scopedReady || recoveryBlocked} onClick={() => void syntheticClose(scopedRetained)}>Recover exact synthetic close</button></aside>}<p className="auth-note">No events are set up for this tournament yet, so there is no play to pause or close.</p></section>;
  }

  return <section className="event-control">
    {scopedRetained && <aside role="alert"><p>An uncertain synthetic close request is retained.</p><button type="button" disabled={busy || !scopedReady || recoveryBlocked} onClick={() => void syntheticClose(scopedRetained)}>Recover exact synthetic close</button></aside>}
    <section aria-label="Event play status">
      <h2>Every event right now</h2>
      <ul className="event-control-summary">
        {events.map((item) => <li key={item.eventId}>
          <strong>{item.name}</strong>
          <span>{playStateLabel(item.playState)}{item.pauseState === "paused" ? " · PAUSED" : ""}{item.closeState === "closed" ? " · CLOSED" : ""}</span>
          <span>{readinessLine(item)}</span>
        </li>)}
      </ul>
    </section>

    <label>Event to control
      <select value={resolvedId} onChange={(changed) => { setSelectedId(changed.target.value); setConfirming(null); setCloseTicked(false); setMessage(""); }} disabled={busy}>
        {events.map((item) => <option key={item.eventId} value={item.eventId}>{item.name}</option>)}
      </select>
    </label>

    {selected ? <>
      <p className="auth-note">{pauseLine(selected)}</p>
      <p className="auth-note">{closeLine(selected)}</p>
      <p className="auth-note">{readinessLine(selected)}</p>

      {!selected.started ? <p className="auth-note">Play has not started for this event, so there is nothing to pause or close yet.</p>
        : selected.teamEvent ? <p className="auth-note">Team events record scores through a separate path that these controls do not reach, so Pause and Close Event are not offered for them.</p>
    : <>
          <label>Reason (<span className="required-field">*</span>required), kept with the record
            <input value={reason} onChange={(changed) => setReason(changed.target.value)} disabled={busy} maxLength={1000} aria-label="Reason for this change" />
          </label>
          {/* Both fieldsets below are disabled until a reason is typed. Nothing
              said so, and the readiness line directly above can read "All 24
              scheduled games are recorded and verified. Close Event is
              available." while every control under it is inert. Verified live:
              the tick box reported disabled:false yet could not be ticked,
              because the ancestor fieldset carried the disabled attribute. */}
          {!reasonUsable ? <p className="auth-note">Pause All Play and Close Event are disabled until you enter a reason above. It is kept with the record of what you did.</p> : null}

          <fieldset disabled={busy || !reasonUsable}>
            <legend>Pause all play</legend>
            <p>While play is paused, every score submission for this event is refused and the player is told to try again. Scores already recorded are untouched.</p>
            <div className="registration-link-actions">
              {selected.pauseState === "paused"
                ? <button className="primary" type="button" onClick={() => void pause("resume")}>{busy ? "Working…" : "Resume Play"}</button>
                : <button className="secondary" type="button" onClick={() => void pause("pause")} disabled={selected.closeState === "closed"}>{busy ? "Working…" : "Pause All Play"}</button>}
            </div>
          </fieldset>

          <fieldset disabled={busy || !reasonUsable}>
            <legend>{selected.closeState === "closed" ? "Reopen this event" : "Close event"}</legend>
            {selected.closeState === "closed"
              ? <p>{selected.canReopen
                ? "Reopening puts this event back into play and allows score entry again. It is available only while nothing downstream has been produced from the closed scorecard."
                : "This event can no longer be reopened. Qualification, a settlement draft, a playoff result or a final settlement already reads from the closed scorecard."}</p>
              : <>
                <p>Closing ends play for this event and hands it to cross-checking. No new score is accepted afterwards.</p>
                {syntheticContext && closeArtifact && <SyntheticEventArtifactView artifact={closeArtifact}/>}
                <label className="tick"><input type="checkbox" checked={closeTicked} onChange={(changed) => setCloseTicked(changed.target.checked)} disabled={!canClose || !!scopedRetained || recoveryBlocked || (!!syntheticContext && (!closeArtifact || !scopedReady))} /> {syntheticContext ? "I confirm the server verified simulated games are complete; no physical table check is claimed." : "I have checked every table and play is finished for this event."}</label>
              </>}
            <div className="registration-link-actions">
              {selected.closeState === "closed"
                ? <button className="secondary" type="button" onClick={() => setConfirming("reopen")} disabled={!selected.canReopen || !!syntheticContext}>Reopen Event</button>
                : <button className="secondary" type="button" onClick={() => setConfirming("close")} disabled={!canClose || !closeTicked}>Close Event</button>}
            </div>
          </fieldset>

          {confirming ? <section className="registration-link-secret" aria-label="Confirm event play change">
            <h2>{confirming === "close" ? `Close ${selected.name}?` : `Reopen ${selected.name}?`}</h2>
            <p>{confirming === "close"
              ? "Every scheduled game is recorded and verified. After this, no player can submit a score for this event, and the event belongs to cross-checking."
              : "Score entry for this event is accepted again from the moment this is applied. The close and this reopen both stay in the record."}</p>
            <div className="registration-link-actions">
              <button className="primary" type="button" disabled={busy} onClick={() => { const action = confirming; setConfirming(null); void closeOrReopen(action === "close" ? "close" : "reopen"); }}>
                {confirming === "close" ? "Yes, close this event" : "Yes, reopen this event"}
              </button>
              <button className="secondary" type="button" disabled={busy} onClick={() => setConfirming(null)}>Cancel</button>
            </div>
          </section> : null}
        </>}
    </> : null}

    {message ? <p className="registration-note" role="status">{message}</p> : null}
  </section>;
}
