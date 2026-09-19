"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  eventControlRejectionMessage,
  isEventPlayCloseResult,
  isEventPlayPauseResult,
  type EventControlEvent,
  type EventControlWorkspace,
} from "../../../../lib/api/event-control";
import { formatUtcDateTime } from "../../../../lib/date-time";

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

export default function EventControlClient({ tournamentId, workspace }: { tournamentId: string; workspace: EventControlWorkspace }) {
  const router = useRouter();
  const [events, setEvents] = useState(workspace.events);
  const [selectedId, setSelectedId] = useState(workspace.events[0]?.eventId ?? "");
  const [reason, setReason] = useState("");
  const [closeTicked, setCloseTicked] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmKind>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // router.refresh() re-runs the server page and hands down a new workspace.
  // Without this the panel would keep showing the state it had before the last
  // action, which on a pause screen is the one thing that must never go stale.
  useEffect(() => {
    setEvents(workspace.events);
    setSelectedId((current) => workspace.events.some((item) => item.eventId === current) ? current : workspace.events[0]?.eventId ?? "");
  }, [workspace]);

  const selected = events.find((item) => item.eventId === selectedId) ?? null;
  const trimmedReason = reason.trim();
  const reasonUsable = trimmedReason.length > 0 && trimmedReason.length <= 1000;
  const controllable = !!selected && selected.started && !selected.teamEvent;
  const canClose = !!selected && controllable && selected.closeState === "open"
    && selected.readiness.scheduledGames > 0 && selected.readiness.unresolvedGames === 0;

  async function send(path: "play-pause" | "play-close", body: Record<string, unknown>) {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${selectedId}/${path}`, {
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
    if (busy || !controllable) return;
    if (!reasonUsable) { setMessage("Enter a reason of 1 to 1000 characters. Nothing was recorded."); return; }
    if (action === "close" && (!closeTicked || !canClose)) return;
    setBusy(true);
    setMessage(action === "close" ? "Closing this event…" : "Reopening this event…");
    try {
      const body = action === "close"
        ? { action, reason: trimmedReason, confirmed: true, idempotencyKey: crypto.randomUUID() }
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
    return <section className="event-control"><p className="auth-note">No events are set up for this tournament yet, so there is no play to pause or close.</p></section>;
  }

  return <section className="event-control">
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
      <select value={selectedId} onChange={(changed) => { setSelectedId(changed.target.value); setConfirming(null); setCloseTicked(false); setMessage(""); }} disabled={busy}>
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
          <label>Reason, kept with the record
            <input value={reason} onChange={(changed) => setReason(changed.target.value)} disabled={busy} maxLength={1000} aria-label="Reason for this change" />
          </label>

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
                <label className="tick"><input type="checkbox" checked={closeTicked} onChange={(changed) => setCloseTicked(changed.target.checked)} disabled={!canClose} /> I have checked every table and play is finished for this event.</label>
              </>}
            <div className="registration-link-actions">
              {selected.closeState === "closed"
                ? <button className="secondary" type="button" onClick={() => setConfirming("reopen")} disabled={!selected.canReopen}>Reopen Event</button>
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
