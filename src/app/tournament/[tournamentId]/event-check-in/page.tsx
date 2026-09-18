import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import EventCheckInClient from "./event-check-in-client";

export const dynamic = "force-dynamic";

export default async function EventCheckInPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!['director', 'co_director'].includes(access.role)) notFound();
  const { data, error } = await createServerOnlyAdminClient().rpc('get_event_check_in_workspace_v1', { p_actor_id: access.user.id, p_tournament_id: tournamentId });
  if (error || !data || typeof data !== 'object') notFound();
  if (!isEventCheckInWorkspace(data)) {
    // Say so on the page rather than crashing or showing an empty desk. A
    // director reading "no players" would start checking people in on paper.
    return <main className="auth-shell"><section className="auth-card corrections-card">
      <p className="eyebrow">DAY OF PLAY</p>
      <h1>Event QR Check-In</h1>
      <p className="auth-note">Check-in cannot open because the tournament database returned player records this version of the app does not recognise. This is a version mismatch, not a problem with your tournament, and no check-in data has been lost. Use desk check-in on the Check-in and seating page, and report this message.</p>
      <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
      <SharedDeviceSignOut />
    </section></main>;
  }
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="event-check-in-title">
    <p className="eyebrow">DAY OF PLAY</p>
    <h1 id="event-check-in-title">Event QR Check-In</h1>
    <p className="auth-note">Open each event independently, then display that event’s live QR code on an iPad, laptop, or monitor. Multiple event windows may be open, but each displayed code is event-specific, changes every 60 seconds, and is not for printing.</p>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <EventCheckInClient tournamentId={tournamentId} workspace={data} />
    <SharedDeviceSignOut />
  </section></main>;
}

export type EventCheckInAttendanceState = 'checked_in' | 'no_show' | 'unresolved';

// Mirrors what get_event_check_in_workspace_v1 actually returns, recorded in
// migration 0217. Each roster row carries one entry per enrolled event with its
// own attendance state. It does NOT carry flat eventIds / checkedInEventIds
// arrays: this type claimed it did, nothing checked, and the page 500'd.
export type EventCheckInWorkspace = {
  events: Array<{ eventId: string; name: string; eventType: string; format: string; playState: string; windowState: 'open' | 'closed'; checkedInCount: number; noShowCount: number; unresolvedCount: number; pendingDeskCount: number }>;
  requests: Array<{ requestId: string; eventId: string; rosterEntryId: string | null; firstName: string; lastName: string; email: string; accNumber: string | null; createdAt: string }>;
  roster: Array<{ rosterEntryId: string; displayName: string; accNumber: string | null; events: Array<{ eventId: string; participantStatus: string; attendanceState: EventCheckInAttendanceState }>; paid: boolean; amountOwedMinor: number; amountReceivedMinor: number; paymentMethod: string | null }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// A cast is not a check. The previous code did `data as EventCheckInWorkspace`,
// so a database that returned a different shape produced a TypeError deep in the
// client instead of anything anyone could act on. This asserts the fields the
// page actually reads.
export function isEventCheckInWorkspace(value: unknown): value is EventCheckInWorkspace {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.events) || !Array.isArray(value.requests) || !Array.isArray(value.roster)) return false;
  if (!value.events.every((item) => isRecord(item) && typeof item.eventId === 'string' && typeof item.name === 'string')) return false;
  return value.roster.every((row) => isRecord(row)
    && typeof row.rosterEntryId === 'string'
    && typeof row.displayName === 'string'
    && Array.isArray(row.events)
    && row.events.every((entry) => isRecord(entry) && typeof entry.eventId === 'string' && typeof entry.attendanceState === 'string'));
}
