"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { EventCheckInWorkspace } from "./page";

type LiveCode = { eventId: string; url: string; expiresAt: string; image: string };

export default function EventCheckInClient({ tournamentId, workspace }: { tournamentId: string; workspace: EventCheckInWorkspace }) {
  const router = useRouter();
  const [eventId, setEventId] = useState(workspace.events[0]?.eventId ?? "");
  const [liveCode, setLiveCode] = useState<LiveCode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const event = workspace.events.find((item) => item.eventId === eventId);
  const eventNames = useMemo(() => new Map(workspace.events.map((item) => [item.eventId, item.name])), [workspace.events]);
  const rosterForEvent = useMemo(() => workspace.roster.flatMap((row) => {
    const enrollment = row.events?.find((item) => item.eventId === eventId) ?? (row.eventIds?.includes(eventId) ? { eventId, participantStatus: 'checked_in', attendanceState: row.checkedInEventIds?.includes(eventId) ? 'checked_in' as const : 'unresolved' as const } : undefined);
    return enrollment ? [{ ...row, attendanceState: enrollment.attendanceState }] : [];
  }), [eventId, workspace.roster]);
  const unresolvedCount = event?.unresolvedCount ?? rosterForEvent.filter((row) => row.attendanceState !== 'checked_in' && row.attendanceState !== 'no_show').length;

  const call = useCallback(async (body: unknown) => {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/event-check-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify(body) });
      return { response, data: await response.json().catch(() => null) as Record<string, unknown> | null };
    } finally { setBusy(false); }
  }, [tournamentId]);
  async function toggleWindow(action: 'open' | 'close') {
    const { response, data } = await call({ action, eventId, idempotencyKey: crypto.randomUUID() });
    if (!response.ok || data?.status === 'rejected') {
      if (data?.code === 'attendance_incomplete') setMessage(`Check-in cannot close yet. ${String(data.unresolvedCount ?? unresolvedCount)} enrolled player${Number(data.unresolvedCount ?? unresolvedCount) === 1 ? '' : 's'} still need to be checked in or marked as a no-show.`);
      else setMessage('The check-in window was not changed. Refresh and try again.');
      return;
    }
    setLiveCode(null); router.refresh();
  }
  const refreshCode = useCallback(async () => {
    if (!eventId || event?.windowState !== 'open') return;
    const { response, data } = await call({ eventId, idempotencyKey: crypto.randomUUID() });
    if (!response.ok || data?.status !== 'issued' || typeof data.url !== 'string' || typeof data.expiresAt !== 'string') { setMessage('The live QR code could not be refreshed. Keep the prior code displayed until it expires, then refresh this page.'); return; }
    try { setLiveCode({ eventId, url: data.url, expiresAt: data.expiresAt, image: await QRCode.toDataURL(data.url, { errorCorrectionLevel: 'M', margin: 1, width: 320 }) }); }
    catch { setMessage('The check-in window is open, but this device could not draw its QR image.'); }
  }, [call, event?.windowState, eventId]);
  async function deskCheckIn(rosterEntryId: string) {
    const { response, data } = await call({ action: 'desk_check_in', eventId, rosterEntryId, idempotencyKey: crypto.randomUUID() });
    if (!response.ok || data?.status === 'rejected') {
      setMessage(data?.code === 'already_checked_in_to_another_event' ? 'This player is already checked into another event that has not finished.' : 'The player is not ready for event check-in. Confirm their event enrollment and paid-in-full payment record at the desk.'); return;
    }
    setMessage('Event check-in recorded. Send app access only after the email delivery configuration has passed its live test.'); router.refresh();
  }
  async function setAttendance(rosterEntryId: string, action: 'mark_no_show' | 'reset_attendance') {
    const promptText = action === 'mark_no_show' ? 'Why is this player being marked as a no-show?' : 'Why is this attendance record being reset?';
    const reason = window.prompt(promptText)?.trim();
    if (!reason) { setMessage('A reason is required. Nothing was changed.'); return; }
    const { response, data } = await call({ action, eventId, rosterEntryId, reason, idempotencyKey: crypto.randomUUID() });
    if (!response.ok || data?.status === 'rejected') { setMessage('Attendance was not changed. The event may already have started; refresh and review the current status.'); return; }
    setMessage(action === 'mark_no_show' ? 'No-show recorded.' : 'Attendance reset. The player must now check in again or be marked as a no-show.'); router.refresh();
  }
  useEffect(() => {
    if (event?.windowState !== 'open' || (liveCode && liveCode.eventId === eventId)) return;
    const timer = window.setTimeout(() => void refreshCode(), 0);
    return () => window.clearTimeout(timer);
  }, [event?.windowState, eventId, liveCode, refreshCode]);
  useEffect(() => {
    if (!liveCode) return;
    const delay = Math.max(1_000, new Date(liveCode.expiresAt).valueOf() - Date.now() - 1_000);
    const timer = window.setTimeout(() => void refreshCode(), delay);
    return () => window.clearTimeout(timer);
  }, [liveCode, eventId, refreshCode]);

  return <section className="policy-settings">
    <label>Event<select className="check-in-control" value={eventId} disabled={busy} onChange={(e) => { setEventId(e.target.value); setLiveCode(null); setMessage(null); }}>
      {workspace.events.map((item) => <option key={item.eventId} value={item.eventId}>{item.eventType}: {item.name} · {item.windowState === 'open' ? 'Check-in open' : 'Check-in closed'}</option>)}
    </select></label>
    {event ? <section className="correction-item"><h2>{event.name}</h2><p>{event.checkedInCount} checked in · {event.noShowCount ?? 0} no-show · {unresolvedCount} unresolved · {event.pendingDeskCount} desk request{event.pendingDeskCount === 1 ? '' : 's'}.</p>
      {event.windowState === 'open' ? <button className="secondary" type="button" disabled={busy || unresolvedCount > 0} onClick={() => void toggleWindow('close')}>Close event check-in</button> : <button className="primary" type="button" disabled={busy || ['in_progress','completed','finalized'].includes(event.playState ?? '')} onClick={() => void toggleWindow('open')}>{event.checkedInCount || event.noShowCount ? 'Reopen event check-in' : 'Begin event check-in'}</button>}
      {event.windowState === 'open' && unresolvedCount > 0 ? <p className="auth-note">Close becomes available after every enrolled player is checked in or marked as a no-show.</p> : null}
    </section> : null}
    {event?.windowState === 'open' ? <section className="correction-item"><h2>Live event QR code</h2><p>Keep this page open on the physical event display. It refreshes automatically every 60 seconds.</p>{liveCode?.image ? <Image unoptimized src={liveCode.image} alt={`Live check-in QR code for ${event.name}`} width={320} height={320} /> : <p>Preparing live code…</p>}<button className="secondary" type="button" disabled={busy} onClick={() => void refreshCode()}>Refresh QR now</button></section> : null}
    <section className="correction-item"><h2>Desk requests</h2><p>Requests that cannot safely be checked in automatically stay here. Record cash/check payment and approve event enrollment first. Then select the matching paid, enrolled player below to check them in.</p><ul>{workspace.requests.map((request) => <li key={request.requestId}><strong>{request.firstName} {request.lastName}</strong> · {eventNames.get(request.eventId) ?? 'Event'} · awaiting desk review</li>)}{workspace.requests.length === 0 ? <li>No desk review requests are waiting.</li> : null}</ul></section>
    <section className="correction-item"><h2>Event attendance desk</h2><p>Review every enrolled player. Payment details are shown for desk reference; checking in cannot create a receipt or bypass enrollment.</p><ul className="attendance-list">{rosterForEvent.map((row) => {
      const attendance = row.attendanceState;
      const payment = row.paid ? `paid${row.paymentMethod ? ` by ${row.paymentMethod}` : ''}` : `$${((row.amountReceivedMinor ?? 0) / 100).toFixed(2)} received of $${((row.amountOwedMinor ?? 0) / 100).toFixed(2)}`;
      return <li key={row.rosterEntryId}><span><strong>{row.displayName}</strong>{row.accNumber ? ` · ${row.accNumber}` : ''}<br />{payment} · {attendance === 'checked_in' ? 'checked in' : attendance === 'no_show' ? 'no-show' : 'not resolved'}</span><span className="attendance-actions">{attendance !== 'checked_in' ? <button className="secondary" type="button" disabled={busy || !row.paid || event?.windowState !== 'open'} onClick={() => void deskCheckIn(row.rosterEntryId)}>Check in at desk</button> : null}{attendance === 'unresolved' || attendance === 'cancelled' ? <button className="secondary" type="button" disabled={busy || event?.windowState !== 'open'} onClick={() => void setAttendance(row.rosterEntryId, 'mark_no_show')}>Mark no-show</button> : <button className="secondary" type="button" disabled={busy || ['in_progress','completed','finalized'].includes(event?.playState ?? '')} onClick={() => void setAttendance(row.rosterEntryId, 'reset_attendance')}>Reset attendance</button>}</span></li>;
    })}{rosterForEvent.length === 0 ? <li>No enrolled players are available for this event.</li> : null}</ul></section>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </section>;
}
