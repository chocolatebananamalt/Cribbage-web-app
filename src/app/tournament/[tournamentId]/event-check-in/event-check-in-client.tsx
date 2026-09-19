"use client";

import QRCode from "qrcode";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { appAccessFailureMessage, checkInRejectionMessage, isCheckInAndSendAppAccessResult } from "../../../../lib/api/check-in-and-send-app-access";
import { formatUtcDateTime } from "../../../../lib/date-time";
import type { EventCheckInAppAccess, EventCheckInWorkspace } from "./page";

type LiveCode = { eventId: string; url: string; expiresAt: string; image: string };
type AppAccessLink = { displayName: string; url: string; expiresAt: string };

// The standalone activation screen uses the same thirty minutes. The server
// requires more than five and at most sixty, so a desk that hands the link
// over immediately has room and a desk that gets interrupted still does.
function appAccessExpiry() { return new Date(Date.now() + 30 * 60 * 1000).toISOString(); }

export default function EventCheckInClient({ tournamentId, workspace, appAccess }: { tournamentId: string; workspace: EventCheckInWorkspace; appAccess: EventCheckInAppAccess }) {
  const router = useRouter();
  const [eventId, setEventId] = useState(workspace.events[0]?.eventId ?? "");
  const [liveCode, setLiveCode] = useState<LiveCode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [appAccessLink, setAppAccessLink] = useState<AppAccessLink | null>(null);
  const [busy, setBusy] = useState(false);
  const event = workspace.events.find((item) => item.eventId === eventId);
  const eventNames = useMemo(() => new Map(workspace.events.map((item) => [item.eventId, item.name])), [workspace.events]);
  const rosterForEvent = useMemo(() => workspace.roster.flatMap((row) => {
    const enrollment = row.events?.find((item) => item.eventId === eventId) ?? (row.eventIds?.includes(eventId) ? { eventId, participantStatus: 'checked_in', attendanceState: row.checkedInEventIds?.includes(eventId) ? 'checked_in' as const : 'unresolved' as const } : undefined);
    return enrollment ? [{ ...row, attendanceState: enrollment.attendanceState }] : [];
  }), [eventId, workspace.roster]);
  const unresolvedCount = event?.unresolvedCount ?? rosterForEvent.filter((row) => row.attendanceState !== 'checked_in' && row.attendanceState !== 'no_show').length;
  // Only roster entries with no linked account reach this map, so an entry
  // that is missing from it already has an account and is never offered the
  // control. An issued or pending link is hidden too: the server would reject
  // a second one as activation_unavailable, and a control that fails after the
  // click is worse at a busy desk than a control that is not there.
  const appAccessOffers = useMemo(() => new Set((appAccess?.unlinked ?? [])
    .filter((entry) => entry.activationState === null || entry.activationState === 'expired')
    .map((entry) => entry.rosterEntryId)), [appAccess]);

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
    setMessage('Event check-in recorded.'); router.refresh();
  }
  /**
   * One desk action: check the player in, then issue their private activation
   * link. No email is sent. The link is shown here to be handed over or read
   * out in person, and the player still has to redeem it and be approved by a
   * different signed-in director on the Player Account Activation screen.
   *
   * Each step is reported on its own, because the outcome that matters is the
   * partial one: a player who is checked in but has no link must not be sent
   * back through check-in.
   */
  async function sendAppAccess(rosterEntryId: string, displayName: string) {
    setBusy(true); setMessage(null); setAppAccessLink(null);
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/event-check-in-app-access`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', cache: 'no-store',
        // Two operation ids, because desk check-in and link issuance write
        // separate idempotency receipts keyed on the same actor. One id shared
        // between them makes the second step collide with the first.
        body: JSON.stringify({ eventId, rosterEntryId, expiresAt: appAccessExpiry(), checkInOperationId: crypto.randomUUID(), activationOperationId: crypto.randomUUID() }),
      });
      const data = await response.json().catch(() => null) as unknown;
      if (!isCheckInAndSendAppAccessResult(data)) {
        // 503 is the one case where the check-in step itself could not be
        // reported on, so it is the only one that should send a director back
        // to look. A refused request recorded nothing and can just be retried.
        setMessage(response.status === 503
          ? 'The desk did not get a result back. Refresh and check whether this player is already checked in before trying again.'
          : 'The request was refused and nothing was recorded. Refresh and try again.');
        router.refresh(); return;
      }
      if (data.checkIn.status === 'rejected') { setMessage(`${checkInRejectionMessage(data.checkIn.code)} No link was created.`); router.refresh(); return; }
      if (data.appAccess.status !== 'issued') { setMessage(appAccessFailureMessage(data.appAccess)); router.refresh(); return; }
      setAppAccessLink({ displayName, url: `${window.location.origin}/activate#${data.appAccess.credential}`, expiresAt: data.appAccess.expiresAt });
      setMessage(`${data.checkIn.status === 'already_checked_in' ? 'This player was already checked in.' : 'The player is checked in.'} Give the private link below directly to them now. The secret cannot be shown again once it is dismissed.`);
      router.refresh();
    } catch {
      setMessage('The desk did not get a result back. Refresh and check whether this player is already checked in before trying again.');
    } finally { setBusy(false); }
  }
  async function copyAppAccessLink() {
    if (!appAccessLink) return;
    try { await navigator.clipboard.writeText(appAccessLink.url); setMessage('Private activation link copied.'); }
    catch { setMessage('This browser could not copy the link. Read it out or select it manually before leaving this screen.'); }
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
    <label className="event-check-in-selector"><span>Event</span><select className="check-in-control" value={eventId} disabled={busy} onChange={(e) => { setEventId(e.target.value); setLiveCode(null); setMessage(null); }}>
      {workspace.events.map((item) => <option key={item.eventId} value={item.eventId}>{item.eventType}: {item.name} · {item.windowState === 'open' ? 'Check-in open' : 'Check-in closed'}</option>)}
    </select></label>
    {event ? <section className="correction-item"><h2>{event.name}</h2><p>{event.checkedInCount} checked in · {event.noShowCount ?? 0} no-show · {unresolvedCount} unresolved · {event.pendingDeskCount} desk request{event.pendingDeskCount === 1 ? '' : 's'}.</p>
      {event.windowState === 'open' ? <button className="secondary" type="button" disabled={busy || unresolvedCount > 0} onClick={() => void toggleWindow('close')}>Close event check-in</button> : <button className="primary" type="button" disabled={busy || ['in_progress','completed','finalized'].includes(event.playState ?? '')} onClick={() => void toggleWindow('open')}>{event.checkedInCount || event.noShowCount ? 'Reopen event check-in' : 'Begin event check-in'}</button>}
      {event.windowState === 'open' && unresolvedCount > 0 ? <p className="auth-note">Close becomes available after every enrolled player is checked in or marked as a no-show.</p> : null}
      {/* Measured on the 2026-09-19 walkthrough: on an event whose play was
          already completed, this button sat greyed with nothing said, and the
          desk buttons below it were greyed too. Pressing it did nothing and
          printed nothing, which reads as a broken screen rather than a closed
          one. The condition is the same list the button's disabled test uses. */}
      {event.windowState !== 'open' && ['in_progress','completed','finalized'].includes(event.playState ?? '')
        ? <p className="auth-note">Check-in cannot be opened because play for this event has already started. The desk buttons below stay unavailable while check-in is closed.</p>
        : null}
    </section> : null}
    {event?.windowState === 'open' ? <section className="correction-item"><h2>Live event QR code</h2><p>Keep this page open on the physical event display. It refreshes automatically every 60 seconds.</p>{liveCode?.image ? <Image unoptimized src={liveCode.image} alt={`Live check-in QR code for ${event.name}`} width={320} height={320} /> : <p>Preparing live code…</p>}<button className="secondary" type="button" disabled={busy} onClick={() => void refreshCode()}>Refresh QR now</button></section> : null}
    <section className="correction-item"><h2>Desk requests</h2><p>Requests that cannot safely be checked in automatically stay here. Record cash/check payment and approve event enrollment first. Then select the matching paid, enrolled player below to check them in.</p><ul>{workspace.requests.map((request) => <li key={request.requestId}><strong>{request.firstName} {request.lastName}</strong> · {eventNames.get(request.eventId) ?? 'Event'} · awaiting desk review</li>)}{workspace.requests.length === 0 ? <li>No desk review requests are waiting.</li> : null}</ul></section>
    {appAccessLink ? <section className="correction-item" aria-label="One-time player activation link"><h2>Private app access link for {appAccessLink.displayName}</h2>
      <label>Activation URL<input readOnly value={appAccessLink.url} aria-label="Activation URL" /></label>
      <p>Expires {formatUtcDateTime(appAccessLink.expiresAt)}. Hand it to this player in person or read it out. Nothing is emailed.</p>
      <p className="auth-note">No account is linked yet. The player opens the link, then a different signed-in director confirms their request in person on the Player Account Activation screen.</p>
      <button className="secondary" type="button" onClick={() => void copyAppAccessLink()}>Copy Link</button>
      <button className="secondary" type="button" onClick={() => setAppAccessLink(null)}>I Have Shared It</button>
      <Link className="guide-link" href={`/tournament/${tournamentId}/account-activations`}>Player Account Activation</Link>
    </section> : null}
    <section className="correction-item"><h2>Event attendance desk</h2><p>Review every enrolled player. Payment details are shown for desk reference; checking in cannot create a receipt or bypass enrollment.</p>
      {appAccess === null ? <p className="auth-note">App access cannot be offered from this screen right now. Issue a player link on the Player Account Activation screen instead.</p> : null}
      {appAccessOffers.size > 0 ? <p className="auth-note">Check in and send app access does both in one step for a player who has no account yet. It issues a private link on this screen to hand over in person. No email is sent.</p> : null}<ul className="attendance-list">{rosterForEvent.map((row) => {
      const attendance = row.attendanceState;
      const payment = row.paid ? `paid${row.paymentMethod ? ` by ${row.paymentMethod}` : ''}` : `$${((row.amountReceivedMinor ?? 0) / 100).toFixed(2)} received of $${((row.amountOwedMinor ?? 0) / 100).toFixed(2)}`;
      return <li key={row.rosterEntryId}><span><strong>{row.displayName}</strong>{row.accNumber ? ` · ${row.accNumber}` : ''}<br />{payment} · {attendance === 'checked_in' ? 'checked in' : attendance === 'no_show' ? 'no-show' : 'not resolved'}</span><span className="attendance-actions">{attendance !== 'checked_in' ? <button className="secondary" type="button" disabled={busy || !row.paid || event?.windowState !== 'open'} onClick={() => void deskCheckIn(row.rosterEntryId)}>Check in at desk</button> : null}{appAccessOffers.has(row.rosterEntryId) ? <button className="secondary" type="button" disabled={busy || !row.paid || event?.windowState !== 'open'} onClick={() => void sendAppAccess(row.rosterEntryId, row.displayName)}>{attendance === 'checked_in' ? 'Send app access' : 'Check in and send app access'}</button> : null}{attendance === 'unresolved' || attendance === 'cancelled' ? <button className="secondary" type="button" disabled={busy || event?.windowState !== 'open'} onClick={() => void setAttendance(row.rosterEntryId, 'mark_no_show')}>Mark no-show</button> : <button className="secondary" type="button" disabled={busy || ['in_progress','completed','finalized'].includes(event?.playState ?? '')} onClick={() => void setAttendance(row.rosterEntryId, 'reset_attendance')}>Reset attendance</button>}</span></li>;
    })}{rosterForEvent.length === 0 ? <li>No enrolled players are available for this event.</li> : null}</ul></section>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </section>;
}
