"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
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

  const call = useCallback(async (body: unknown) => {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/event-check-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify(body) });
      return { response, data: await response.json().catch(() => null) as Record<string, unknown> | null };
    } finally { setBusy(false); }
  }, [tournamentId]);
  async function toggleWindow(action: 'open' | 'close') {
    const { response, data } = await call({ action, eventId, idempotencyKey: crypto.randomUUID() });
    if (!response.ok || data?.status === 'rejected') { setMessage('The check-in window was not changed. Refresh and try again.'); return; }
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
    if (!response.ok || data?.status === 'rejected') { setMessage('The player is not ready for event check-in. Confirm their event enrollment and paid-in-full payment record at the desk.'); return; }
    setMessage('Event check-in recorded. Send app access only after the email delivery configuration has passed its live test.'); router.refresh();
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
    {event ? <section className="correction-item"><h2>{event.name}</h2><p>{event.checkedInCount} checked in · {event.pendingDeskCount} request{event.pendingDeskCount === 1 ? '' : 's'} waiting at the desk.</p>
      {event.windowState === 'open' ? <button className="secondary" type="button" disabled={busy} onClick={() => void toggleWindow('close')}>Close event check-in</button> : <button className="primary" type="button" disabled={busy} onClick={() => void toggleWindow('open')}>Open event check-in</button>}
    </section> : null}
    {event?.windowState === 'open' ? <section className="correction-item"><h2>Live event QR code</h2><p>Keep this page open on the physical event display. It refreshes automatically every 60 seconds.</p>{liveCode?.image ? <Image unoptimized src={liveCode.image} alt={`Live check-in QR code for ${event.name}`} width={320} height={320} /> : <p>Preparing live code…</p>}<button className="secondary" type="button" disabled={busy} onClick={() => void refreshCode()}>Refresh QR now</button></section> : null}
    <section className="correction-item"><h2>Desk requests</h2><p>Requests that cannot safely be checked in automatically stay here. Record cash/check payment and approve event enrollment first. Then select the matching paid, enrolled player below to check them in.</p><ul>{workspace.requests.map((request) => <li key={request.requestId}><strong>{request.firstName} {request.lastName}</strong> · {workspace.events.find((item) => item.eventId === request.eventId)?.name ?? 'Event'} · awaiting desk review</li>)}{workspace.requests.length === 0 ? <li>No desk review requests are waiting.</li> : null}</ul></section>
    <section className="correction-item"><h2>Check in at desk</h2><p>Only paid, enrolled players for the selected event can be checked in here. This action cannot create a payment receipt or bypass event enrollment.</p><ul>{workspace.roster.filter((row) => row.eventIds.includes(eventId) && !row.checkedInEventIds.includes(eventId)).map((row) => <li key={row.rosterEntryId}><strong>{row.displayName}</strong>{row.accNumber ? ` · ${row.accNumber}` : ''} · {row.paid ? 'paid' : 'payment due'} <button className="secondary" type="button" disabled={busy || !row.paid || event?.windowState !== 'open'} onClick={() => void deskCheckIn(row.rosterEntryId)}>Check in and send app access</button></li>)}{workspace.roster.filter((row) => row.eventIds.includes(eventId) && !row.checkedInEventIds.includes(eventId)).length === 0 ? <li>No un-checked-in enrolled players are available for this event.</li> : null}</ul></section>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </section>;
}
