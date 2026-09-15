"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { isEventScheduleRequest, isEventScheduleResult, isEventStartRequest, isEventStartResult, isRejectedEventSchedule, isRejectedEventStart, parseScheduleCsv, validateScheduleForEvent, type EventScheduleRequest, type EventScheduleWorkspace, type EventStartRequest } from "../../../../lib/api/event-schedule";

type SavedRequest = { kind: "event-schedule-publication"; request: EventScheduleRequest };
const header = "Game,Player A ID,Player B ID,Player A Table/Seat,Player B Table/Seat";

function readSaved(key: string): EventScheduleRequest | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const saved = value as Record<string, unknown>;
    return saved.kind === "event-schedule-publication" && isEventScheduleRequest(saved.request) ? saved.request : null;
  } catch { return null; }
}
function writeSaved(key: string, request: EventScheduleRequest) {
  try { window.sessionStorage.setItem(key, JSON.stringify({ kind: "event-schedule-publication", request } satisfies SavedRequest)); return true; }
  catch { return false; }
}
function clearSaved(key: string) { try { window.sessionStorage.removeItem(key); } catch { /* receipt is authoritative */ } }

export default function ScheduleClient({ actorId, tournamentId, workspace }: { actorId: string; tournamentId: string; workspace: EventScheduleWorkspace }) {
  const router = useRouter();
  const digitalEvents = useMemo(() => workspace.events.filter((event) => event.format === "standard_singles" && event.scoringMethod === "digital"), [workspace.events]);
  const [eventId, setEventId] = useState(digitalEvents[0]?.eventId ?? "");
  const [csv, setCsv] = useState(header + "\n");
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState<EventScheduleRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState(1);
  const [startConfirmed, setStartConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const flight = useRef(false);
  const storageKey = `event-schedule:${actorId}:${tournamentId}`;
  const activeEvent = digitalEvents.find((event) => event.eventId === eventId);
  const participants = workspace.participants.filter((participant) => participant.eventId === eventId);
  const publishedMatches = workspace.matches.filter((match) => match.eventId === eventId && activeEvent?.schedulePublished && match.gameNumber === selectedGame);
  const parsed = useMemo(() => parseScheduleCsv(csv), [csv]);
  const validationErrors = activeEvent && parsed.errors.length === 0 ? validateScheduleForEvent(
    parsed.matches,
    activeEvent.gameCount,
    participants.map((participant) => participant.verificationId),
    workspace.tableCount ?? undefined,
    workspace.seatsPerTable ?? undefined,
  ) : parsed.errors;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readSaved(storageKey);
      if (saved) {
        setPending(saved); setEventId(saved.eventId);
        setCsv([header, ...saved.matches.map((match) => [match.gameNumber, match.sideAVerificationId, match.sideBVerificationId, match.sideATableSeat, match.sideBTableSeat].join(","))].join("\n"));
        setReviewed(true); setMessage("A prior publication request is unresolved. Retry this exact saved schedule.");
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  async function submit(request: EventScheduleRequest) {
    if (busy || flight.current) return;
    flight.current = true; setBusy(true); setPending(request); setMessage(null);
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/event-schedule`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(request) });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && isEventScheduleResult(data, request)) {
        clearSaved(storageKey); setPending(null); setMessage(`${data.gameCount} games and ${data.matchCount} matchups published.`); router.refresh();
      } else if (response.status === 409 && isRejectedEventSchedule(data)) {
        clearSaved(storageKey); setPending(null); setMessage(data.code === "schedule_already_published" ? "This event already has a published schedule. No changes were made." : "The schedule was not published. Review the event participants and every imported row.");
      } else setMessage("The request is unresolved. Retry the exact saved schedule.");
    } catch { setMessage("The request is unresolved. Retry the exact saved schedule."); }
    finally { flight.current = false; setBusy(false); }
  }

  function publish() {
    if (!activeEvent || activeEvent.schedulePublished || !reviewed || validationErrors.length || pending) return;
    const request = { eventId, matches: parsed.matches, reviewedAndApproved: true as const, idempotencyKey: crypto.randomUUID() };
    if (!isEventScheduleRequest(request) || !writeSaved(storageKey, request)) { setMessage("This browser cannot safely retain the publication request for retry."); return; }
    void submit(request);
  }
  function downloadTemplate() {
    const blob = new Blob([header + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `${activeEvent?.name ?? "event"}-schedule-template.csv`; link.click(); URL.revokeObjectURL(url);
  }

  async function startEvent() {
    if (!activeEvent || activeEvent.playState !== "ready_to_start" || !activeEvent.schedulePublicationId
      || !activeEvent.participantSnapshotDigest || !startConfirmed || starting) return;
    const request: EventStartRequest = { eventId: activeEvent.eventId, schedulePublicationId: activeEvent.schedulePublicationId,
      participantSnapshotDigest: activeEvent.participantSnapshotDigest, expectedParticipantCount: activeEvent.participantCount,
      expectedGameCount: activeEvent.gameCount, confirmed: true, idempotencyKey: crypto.randomUUID() };
    if (!isEventStartRequest(request)) { setMessage("The event start request could not be prepared safely."); return; }
    setStarting(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/event-start`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(request) });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && isEventStartResult(data, request)) {
        setStartConfirmed(false); setMessage(`${activeEvent.name} is now In Progress. Score entry is unlocked.`); router.refresh();
      } else if (response.status === 409 && isRejectedEventStart(data)) {
        const explanation: Record<string, string> = {
          registration_open: "Close registration before starting this event.",
          attendance_or_seating_incomplete: "Attendance and every Verification ID/seat must be complete before starting.",
          stale_roster_or_schedule: "The roster or schedule changed. Review the current event details and confirm again.",
          event_already_started: "This event has already started.",
          unexpected_scoring_activity: "Unexpected scoring activity needs official review before this event can start.",
        };
        setMessage(explanation[data.code] ?? "The event did not start. Recheck registration, attendance, seating, and the schedule.");
        router.refresh();
      } else setMessage("The event start request is unresolved. Refresh the event before trying again.");
    } catch { setMessage("The event start request is unresolved. Refresh the event before trying again."); }
    finally { setStarting(false); }
  }

  if (digitalEvents.length === 0) return <section className="correction-item"><h2>Activate a Standard Singles event first</h2><p>Only activated digital Standard Singles events can publish a game schedule for this pilot.</p></section>;
  return <section className="policy-settings">
    <section className="correction-item"><h2>Choose Event</h2><label>Event<select className="check-in-control" value={eventId} disabled={!ready || busy || !!pending} onChange={(event) => { setEventId(event.target.value); setReviewed(false); setSelectedGame(1); }}>
      {digitalEvents.map((event) => <option key={event.eventId} value={event.eventId}>{event.name} · {event.gameCount} games · {event.participantCount} players</option>)}</select></label>
      {activeEvent?.schedulePublished ? <p className="success-text">Published · {activeEvent.publishedMatchCount} matchups · {activeEvent.playState.replaceAll("_", " ")}</p> : <p>Not published. Publishing creates the games, but an official must separately start this event before anyone can score.</p>}
    </section>
    {activeEvent?.schedulePublished ? <section className="correction-item"><h2>Published Schedule</h2><label>Game<select className="check-in-control" value={selectedGame} onChange={(event) => setSelectedGame(Number(event.target.value))}>
      {Array.from({ length: activeEvent.gameCount }, (_, index) => <option key={index + 1} value={index + 1}>Game {index + 1}</option>)}</select></label>
      <ul className="schedule-match-list">{publishedMatches.map((match) => <li key={match.canonicalGameId}><span><strong>{match.sideADisplayName}</strong><small>ID # {match.sideAVerificationId} · {match.sideATableSeat}</small></span><b>vs.</b><span><strong>{match.sideBDisplayName}</strong><small>ID # {match.sideBVerificationId} · {match.sideBTableSeat}</small></span></li>)}</ul>
      {activeEvent.playState === "ready_to_start" ? <section className="event-start-confirmation" aria-labelledby="event-start-title"><h3 id="event-start-title">Final Start Confirmation</h3>
        <p><strong>{activeEvent.name}</strong> · {activeEvent.participantCount} players · {activeEvent.gameCount} games</p>
        <label className="publication-confirmation"><input type="checkbox" checked={startConfirmed} disabled={starting} onChange={(event) => setStartConfirmed(event.target.checked)} />I confirm registration is closed and this event roster, attendance, seating, and schedule are ready for play.</label>
        <button className="primary" type="button" disabled={!startConfirmed || starting} onClick={() => void startEvent()}>{starting ? "Starting…" : `Start ${activeEvent.name}`}</button>
      </section> : activeEvent.playState === "preparing" ? <p className="auth-note">Start Play will become available after registration is closed and the event roster, attendance, seating, and schedule are complete.</p>
        : <p className="success-text">{activeEvent.playState === "in_progress" ? "Play is in progress." : activeEvent.playState === "completed" ? "All scheduled games are complete." : "This event is finalized."}{activeEvent.startedAt ? ` Started by ${activeEvent.startedBy ?? "an official"}.` : ""}</p>}
    </section> : <>
      <section className="correction-item"><div className="participant-selection-heading"><div><h2>Enrolled Players</h2><p>Use these permanent IDs in the schedule file.</p></div><button className="secondary" type="button" onClick={downloadTemplate}>Download CSV template</button></div>
        <ul className="schedule-roster-list">{participants.map((participant) => <li key={participant.participantId}><strong>{participant.verificationId}</strong><span>{participant.displayName}</span><small>{participant.profileLinked ? "Digital" : "Paper"}</small></li>)}</ul></section>
      <section className="correction-item"><h2>Import Reviewed Schedule</h2><label>Choose CSV file<input className="check-in-control" type="file" accept=".csv,text/csv,text/plain" disabled={!ready || busy || !!pending} onChange={(event) => {
        const file = event.target.files?.[0]; if (!file) return; if (file.size > 750_000) { setMessage("The schedule file is too large."); return; }
        void file.text().then((text) => { setCsv(text); setReviewed(false); setMessage(null); }).catch(() => setMessage("The schedule file could not be read. Choose the file again or paste its rows."));
      }} /></label><label>Or paste CSV<textarea className="schedule-csv" value={csv} disabled={!ready || busy || !!pending} onChange={(event) => { setCsv(event.target.value); setReviewed(false); }} /></label>
        <p>{parsed.matches.length} matchup rows found.</p>{validationErrors.length ? <ul className="schedule-errors" role="alert">{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul> : <p className="success-text">Complete schedule ready for final review.</p>}
        <label className="publication-confirmation"><input type="checkbox" checked={reviewed} disabled={validationErrors.length > 0 || busy || !!pending} onChange={(event) => setReviewed(event.target.checked)} />I reviewed the complete schedule and approve these pairings and Table/Seat assignments.</label>
        {pending ? <button className="primary" type="button" disabled={busy} onClick={() => void submit(pending)}>{busy ? "Publishing…" : "Retry exact saved publication"}</button> : <button className="primary" type="button" disabled={!ready || busy || !reviewed || validationErrors.length > 0} onClick={publish}>Publish Game Schedule</button>}
      </section></>}
    {message ? <p className="live-status" role="status">{message}</p> : null}
  </section>;
}
