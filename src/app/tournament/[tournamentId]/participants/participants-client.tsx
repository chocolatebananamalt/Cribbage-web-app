"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  isEventRosterEnrollmentRequest,
  isEventRosterEnrollmentResult,
  isRejectedEventRosterEnrollment,
  type EventRosterEnrollmentRequest,
  type EventRosterEnrollmentWorkspace,
} from "../../../../lib/api/event-roster-enrollment";

type SavedRequest = { kind: "event-roster-enrollment"; request: EventRosterEnrollmentRequest };

function isSavedRequest(value: unknown): value is SavedRequest {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 2
    && (value as Record<string, unknown>).kind === "event-roster-enrollment"
    && isEventRosterEnrollmentRequest((value as Record<string, unknown>).request);
}
function readSaved(key: string) {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
    return isSavedRequest(value) ? value.request : null;
  } catch { return null; }
}
function writeSaved(key: string, request: EventRosterEnrollmentRequest) {
  try { window.sessionStorage.setItem(key, JSON.stringify({ kind: "event-roster-enrollment", request })); return true; }
  catch { return false; }
}
function clearSaved(key: string) { try { window.sessionStorage.removeItem(key); } catch { /* server receipt is authoritative */ } }

export default function ParticipantsClient({ actorId, tournamentId, workspace }: {
  actorId: string;
  tournamentId: string;
  workspace: EventRosterEnrollmentWorkspace;
}) {
  const router = useRouter();
  const storageKey = `event-roster-enrollment:${actorId}:${tournamentId}`;
  const digitalEvents = useMemo(() => workspace.events.filter((event) => event.format === "standard_singles" && event.scoringMethod === "digital"), [workspace.events]);
  const [eventId, setEventId] = useState(digitalEvents[0]?.eventId ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<EventRosterEnrollmentRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const flight = useRef(false);
  const activeEvent = digitalEvents.find((event) => event.eventId === eventId);
  const eligible = workspace.roster.filter((entry) => entry.checkInState === "checked_in");
  const unenrolled = eligible.filter((entry) => !entry.enrolledEventIds.includes(eventId));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readSaved(storageKey);
      if (saved) {
        setPending(saved);
        setEventId(saved.eventId);
        setSelected(saved.rosterEntryIds);
        setMessage("A prior enrollment request is unresolved. Retry this exact saved request.");
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  async function submit(request: EventRosterEnrollmentRequest) {
    if (busy || flight.current) return;
    flight.current = true; setBusy(true); setPending(request); setMessage(null);
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/event-roster-enrollment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(request),
      });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && isEventRosterEnrollmentResult(data, request)) {
        clearSaved(storageKey); setPending(null); setSelected([]);
        setMessage(`${data.createdCount} player${data.createdCount === 1 ? "" : "s"} enrolled. ${data.existingCount ? `${data.existingCount} already enrolled.` : ""}`.trim());
        router.refresh();
      } else if (response.status === 409 && isRejectedEventRosterEnrollment(data)) {
        clearSaved(storageKey); setPending(null);
        setMessage("Enrollment was not changed. Refresh the roster and review check-in status before retrying.");
      } else {
        setMessage("The request is unresolved. Retry the same protected request.");
      }
    } catch {
      setMessage("The request is unresolved. Retry the same protected request.");
    } finally { flight.current = false; setBusy(false); }
  }

  function startEnrollment() {
    if (!eventId || selected.length === 0 || pending) return;
    const request = { eventId, rosterEntryIds: selected, idempotencyKey: crypto.randomUUID() };
    if (!isEventRosterEnrollmentRequest(request) || !writeSaved(storageKey, request)) {
      setMessage("This browser cannot safely retain the enrollment request for retry.");
      return;
    }
    void submit(request);
  }

  if (workspace.events.length === 0) return <section className="correction-item"><h2>Activate tournament events first</h2><p>Save and activate the tournament setup before assigning players to events.</p></section>;
  if (digitalEvents.length === 0) return <section className="correction-item"><h2>No digital Standard Singles event</h2><p>Team and doubles events remain paper-scored for the October pilot.</p></section>;

  return <section className="policy-settings">
    <section className="correction-item">
      <h2>Choose Event</h2>
      <label>Event<select className="check-in-control" value={eventId} disabled={!ready || busy || !!pending} onChange={(event) => { setEventId(event.target.value); setSelected([]); }}>
        {digitalEvents.map((event) => <option key={event.eventId} value={event.eventId}>{event.name} · {event.participantCount} enrolled</option>)}
      </select></label>
      <p>{workspace.registrationClosed ? "Registration closed" : "Registration open"} · {workspace.seatingPublished ? "Verification IDs assigned" : "Initial seating not yet published"}</p>
    </section>
    <section className="correction-item">
      <div className="participant-selection-heading"><div><h2>Checked-in Players</h2><p>Select the players joining {activeEvent?.name ?? "this event"}. Existing participants remain selected in the event record.</p></div><button className="secondary" type="button" disabled={!ready || busy || !!pending || unenrolled.length === 0} onClick={() => setSelected(unenrolled.map((entry) => entry.rosterEntryId))}>Select all not enrolled</button></div>
      <ul className="participant-selection-list">
        {eligible.map((entry) => {
          const enrolled = entry.enrolledEventIds.includes(eventId);
          return <li key={entry.rosterEntryId}><label><input type="checkbox" checked={enrolled || selected.includes(entry.rosterEntryId)} disabled={enrolled || !ready || busy || !!pending} onChange={(event) => setSelected((current) => event.target.checked ? [...current, entry.rosterEntryId] : current.filter((id) => id !== entry.rosterEntryId))} /><span><strong>{entry.displayName}</strong><small>{entry.scorecardType === "digital" ? "Digital scorecard" : "Paper scorecard"} · {entry.profileLinked ? "App account linked" : "No app account linked"}{entry.verificationId ? ` · ID # ${entry.verificationId}` : " · ID assigned with seating"}</small></span><b>{enrolled ? "Enrolled" : "Available"}</b></label></li>;
        })}
        {eligible.length === 0 ? <li>No checked-in players are available yet.</li> : null}
      </ul>
      {pending ? <button className="primary" type="button" disabled={busy} onClick={() => void submit(pending)}>{busy ? "Enrolling…" : "Retry exact saved enrollment"}</button> : <button className="primary" type="button" disabled={!ready || busy || selected.length === 0} onClick={startEnrollment}>Enroll selected players</button>}
      {message ? <p className="live-status" role="status">{message}</p> : null}
    </section>
  </section>;
}
