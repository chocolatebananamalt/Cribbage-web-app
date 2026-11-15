"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  if (unresolvedGames === 0) return `All ${scheduledGames} scheduled games are recorded and verified. ${event.closeState === "closed" ? "Event play is closed." : "Close Event is available."}`;
  return `${resolvedGames} of ${scheduledGames} scheduled games are recorded and verified. ${unresolvedGames} still unresolved, so Close Event is refused.`;
}

export default function EventControlClient({ actorId, tournamentId, workspace, initialEventId, syntheticContext: tournamentSyntheticContext }: { actorId?: string; tournamentId: string; workspace: EventControlWorkspace; initialEventId?:string; syntheticContext?: SyntheticEventContext | null }) {
  const router = useRouter();
  const flight = useRef(false);
  const [retained, setRetained] = useState<SyntheticCloseEnvelope | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryScope, setRecoveryScope] = useState<string | null>(null);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const events = workspace.events;
  const [selectedId, setSelectedId] = useState(events.some(e=>e.eventId===initialEventId)?initialEventId!:events[0]?.eventId ?? "");
  const [reason, setReason] = useState("");
  const [closeTicked, setCloseTicked] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmKind>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [requestScope,setRequestScope]=useState(initialEventId??null);
  const uncertainNormal=useRef(false),bindingCurrent=useRef<string|null>(null),ownerCurrent=useRef<string|null>(null);
  const requestedChanged=(initialEventId??null)!==requestScope;


  // Refresh updates event facts directly. Never transfer a missing event's
  // reason, confirmation or pending operation to a fallback event. Requested
  // URL changes are adopted only from clean, recovered controls below.
  const fallbackId = events[0]?.eventId ?? "";
  const selectedMissing=selectedId!==""&&!events.some(item=>item.eventId===selectedId);
  const resolvedId = selectedId || fallbackId;
  if (resolvedId !== selectedId) {setSelectedId(resolvedId);setMessage("");}

  const syntheticContext = tournamentSyntheticContext?.eventIds.includes(resolvedId) ? tournamentSyntheticContext : null;
  const selected = events.find((item) => item.eventId === resolvedId) ?? null;
  const closeArtifact = syntheticContext?.artifacts.find(item => item.kind === "close" && item.eventId === resolvedId);
  const trimmedReason = reason.trim();
  const reasonUsable = trimmedReason.length > 0 && trimmedReason.length <= 1000;
  const closeReason = syntheticContext && closeArtifact ? `TEST ONLY SYNTHETIC: ${closeArtifact.reference} ${trimmedReason}` : trimmedReason;
  const controllable = !!selected && selected.started && !selected.teamEvent;
  const canClose = !!selected && controllable && selected.closeState === "open"
    && selected.readiness.scheduledGames > 0 && selected.readiness.unresolvedGames === 0;

  const ownerBinding=JSON.stringify([actorId,tournamentId,requestScope,resolvedId]);
  const intentBinding=JSON.stringify([actorId,tournamentId,requestScope,resolvedId,reason,closeTicked,confirming]);
  useLayoutEffect(()=>{bindingCurrent.current=requestedChanged||selectedMissing?null:intentBinding;ownerCurrent.current=requestedChanged||selectedMissing?null:ownerBinding;return()=>{if(bindingCurrent.current===intentBinding)bindingCurrent.current=null;if(ownerCurrent.current===ownerBinding)ownerCurrent.current=null;};},[requestedChanged,selectedMissing,intentBinding,ownerBinding]);

  const recoveryKey = `qualification-finalization:synthetic-close:${actorId}:${tournamentId}:${resolvedId}`;
  const scopedRetained = recoveryScope === recoveryKey ? retained : null;
  const scopedReady = recoveryReady && recoveryScope === recoveryKey;
  if(requestedChanged&&!selectedMissing&&(!syntheticContext||scopedReady)&&!busy&&!flight.current&&!retained&&!reason.trim()&&!closeTicked&&!confirming&&!uncertainNormal.current){setRequestScope(initialEventId??null);setMessage("");setSelectedId(events.some(e=>e.eventId===initialEventId)?initialEventId!:events[0]?.eventId??"");}
  useEffect(() => {
    if(selectedMissing)return;
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
  }, [actorId, recoveryKey, syntheticContext,selectedMissing]);
  async function syntheticClose(envelope: SyntheticCloseEnvelope) {
    if (bindingCurrent.current!==intentBinding || flight.current || recoveryBlocked || !scopedReady || !actorId || !syntheticContext) return;
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
    if(bindingCurrent.current!==intentBinding)throw Error("event_selection_changed");
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
    if(ownerCurrent.current!==ownerBinding)return;
    setMessage(text);
    setReason("");
    setCloseTicked(false);
    setConfirming(null);
    router.refresh();
  }

  async function pause(action: "pause" | "resume") {
    if (bindingCurrent.current!==intentBinding || busy || flight.current || uncertainNormal.current || !controllable) return;
    if (!reasonUsable) { setMessage("Enter a reason of 1 to 1000 characters. Nothing was recorded."); return; }
    flight.current=true;uncertainNormal.current=true;setBusy(true);
    setMessage(action === "pause" ? "Pausing play…" : "Resuming play…");
    try {
      const result = await send("play-pause", { action, reason: trimmedReason, idempotencyKey: crypto.randomUUID() });
      if (!isEventPlayPauseResult(result.body)|| (result.body.status==='rejected'?result.status!==409||result.body.code==='idempotency_conflict':result.status<200||result.status>=300||result.body.eventId!==resolvedId)) {
        setMessage("The pause outcome is unknown. Check the current event status before another operation.");
        return;
      }
      uncertainNormal.current=false;
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
      setMessage("The pause outcome is unknown. Check the current event status before another operation.");
    } finally { flight.current=false;setBusy(false); }
  }

  async function closeOrReopen(action: "close" | "reopen") {
    if (bindingCurrent.current!==intentBinding || busy || flight.current || uncertainNormal.current || !controllable || scopedRetained || recoveryBlocked) return;
    if (action === "reopen" && syntheticContext) { setMessage("Reopening is unavailable for the synthetic fixture."); return; }
    if (!reasonUsable) { setMessage("Enter a reason of 1 to 1000 characters. Nothing was recorded."); return; }
    if (action === "close" && (!closeTicked || !canClose)) return;
    if (action === "close" && syntheticContext) {
      await syntheticClose({ action: "close", reason: closeReason, confirmed: true, idempotencyKey: crypto.randomUUID() }); return;
    }
    flight.current=true;uncertainNormal.current=true;setBusy(true);
    setMessage(action === "close" ? "Closing this event…" : "Reopening this event…");
    try {
      const body = action === "close"
        ? { action, reason: closeReason, confirmed: true, idempotencyKey: crypto.randomUUID() }
        : { action, reason: trimmedReason, idempotencyKey: crypto.randomUUID() };
      const result = await send("play-close", body);
      if (!isEventPlayCloseResult(result.body)|| (result.body.status==='rejected'?result.status!==409||result.body.code==='idempotency_conflict':result.status<200||result.status>=300||result.body.eventId!==resolvedId)) {
        setMessage("The event close outcome is unknown. Check the current event status before another operation.");
        return;
      }
      uncertainNormal.current=false;
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
      setMessage("The event close outcome is unknown. Check the current event status before another operation.");
    } finally { flight.current=false;setBusy(false); }
  }

  if(selectedMissing)return <section role="alert"><h2>Original Event Unavailable</h2><p>The selected event is no longer in the current workspace. Its unsaved or pending controls are preserved and cannot act on another event.</p><Link className="guide-link" href={`/tournament/${tournamentId}`} target="_blank" rel="noopener noreferrer">Review Tournament in a Separate Tab</Link></section>;

  if(requestedChanged)return <section role="alert"><h2>Requested Event Changed</h2><p>Unsaved or pending controls for {selected?.name??"the original event"} are preserved. No action is retargeted to the event in the new link.</p><p>{busy?"Wait for the current request to finish.":uncertainNormal.current?"The earlier operation remains unresolved; verify its outcome before switching.":"Return to the original event to review or clear its controls."}</p><Link className="guide-link" href={`/tournament/${tournamentId}/event-control${requestScope?`?event=${requestScope}`:""}`}>Return to Original Event Controls</Link></section>;

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

    <label>Event to Control
      <select value={resolvedId} onChange={(changed) => { if(bindingCurrent.current!==intentBinding||flight.current||uncertainNormal.current)return;bindingCurrent.current=null;ownerCurrent.current=null;setSelectedId(changed.target.value); setConfirming(null); setCloseTicked(false); setMessage(""); }} disabled={busy}>
        {events.map((item) => <option key={item.eventId} value={item.eventId}>{item.name}</option>)}
      </select>
    </label>

    {selected ? <>
      <p className="auth-note">{pauseLine(selected)}</p>
      <p className="auth-note">{closeLine(selected)}</p>
      {selected.closeState==="closed"&&<Link className="guide-link" href={`/tournament/${tournamentId}/results?event=${selected.eventId}`}>Review Closed Event Results</Link>}
      <p className="auth-note">{readinessLine(selected)}</p>

      {!selected.started ? <p className="auth-note">Play has not started for this event, so there is nothing to pause or close yet.</p>
        : selected.teamEvent ? <p className="auth-note">Team events record scores through a separate path that these controls do not reach, so Pause and Close Event are not offered for them.</p>
    : <>
          <label>Reason (<span className="required-field">*</span>required), kept with the record
            <input value={reason} onChange={(changed) => {if(bindingCurrent.current!==intentBinding||flight.current)return;bindingCurrent.current=null;setReason(changed.target.value);}} disabled={busy} maxLength={1000} aria-label="Reason for This Change" />
          </label>
          {/* Both fieldsets below are disabled until a reason is typed. Nothing
              said so, and the readiness line directly above can read "All 24
              scheduled games are recorded and verified. Close Event is
              available." while every control under it is inert. Verified live:
              the tick box reported disabled:false yet could not be ticked,
              because the ancestor fieldset carried the disabled attribute. */}
          {!reasonUsable ? <p className="auth-note">Pause All Play and Close Event are disabled until you enter a reason above. It is kept with the record of what you did.</p> : null}

          <fieldset disabled={busy || uncertainNormal.current || !reasonUsable}>
            <legend>Pause all play</legend>
            <p>While play is paused, every score submission for this event is refused and the player is told to try again. Scores already recorded are untouched.</p>
            <div className="registration-link-actions">
              {selected.pauseState === "paused"
                ? <button className="primary" type="button" onClick={() => void pause("resume")}>{busy ? "Working…" : "Resume Play"}</button>
                : <button className="secondary" type="button" onClick={() => void pause("pause")} disabled={selected.closeState === "closed"}>{busy ? "Working…" : "Pause All Play"}</button>}
            </div>
          </fieldset>

          <fieldset disabled={busy || uncertainNormal.current || !reasonUsable}>
            <legend>{selected.closeState === "closed" ? "Reopen this event" : "Close event"}</legend>
            {selected.closeState === "closed"
              ? <p>{selected.canReopen
                ? "Reopening puts this event back into play and allows score entry again. It is available only while nothing downstream has been produced from the closed scorecard."
                : "This event can no longer be reopened. Qualification, a settlement draft, a playoff result or a final settlement already reads from the closed scorecard."}</p>
              : <>
                <p>Closing ends play for this event and hands it to cross-checking. No new score is accepted afterwards.</p>
                {syntheticContext && closeArtifact && <SyntheticEventArtifactView artifact={closeArtifact}/>}
                <label className="tick"><input type="checkbox" checked={closeTicked} onChange={(changed) => {if(bindingCurrent.current!==intentBinding||flight.current||uncertainNormal.current)return;bindingCurrent.current=null;setCloseTicked(changed.target.checked);}} disabled={!canClose || !!scopedRetained || recoveryBlocked || (!!syntheticContext && (!closeArtifact || !scopedReady))} /> {syntheticContext ? "I confirm the server verified simulated games are complete; no physical table check is claimed." : "I have checked every table and play is finished for this event."}</label>
              </>}
            <div className="registration-link-actions">
              {selected.closeState === "closed"
                ? <button className="secondary" type="button" onClick={() => {if(bindingCurrent.current!==intentBinding||flight.current||uncertainNormal.current)return;bindingCurrent.current=null;setConfirming("reopen");}} disabled={!selected.canReopen || !!syntheticContext}>Reopen Event</button>
                : <button className="secondary" type="button" onClick={() => {if(bindingCurrent.current!==intentBinding||flight.current||uncertainNormal.current)return;bindingCurrent.current=null;setConfirming("close");}} disabled={!canClose || !closeTicked}>Close Event</button>}
            </div>
          </fieldset>

          {confirming ? <section className="registration-link-secret" aria-label="Confirm event play change">
            <h2>{confirming === "close" ? `Close ${selected.name}?` : `Reopen ${selected.name}?`}</h2>
            <p>{confirming === "close"
              ? "Every scheduled game is recorded and verified. After this, no player can submit a score for this event, and the event belongs to cross-checking."
              : "Score entry for this event is accepted again from the moment this is applied. The close and this reopen both stay in the record."}</p>
            <div className="registration-link-actions">
              <button className="primary" type="button" disabled={busy} onClick={() => { if(bindingCurrent.current!==intentBinding||flight.current||uncertainNormal.current)return;const action = confirming; setConfirming(null); void closeOrReopen(action === "close" ? "close" : "reopen"); }}>
                {confirming === "close" ? "Yes, close this event" : "Yes, reopen this event"}
              </button>
              <button className="secondary" type="button" disabled={busy} onClick={() => {if(bindingCurrent.current!==intentBinding||flight.current)return;bindingCurrent.current=null;setConfirming(null);}}>Cancel</button>
            </div>
          </section> : null}
        </>}
    </> : null}

    {message ? <p className="registration-note" role="status">{message}</p> : null}
  </section>;
}
