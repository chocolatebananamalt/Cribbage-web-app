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
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="event-check-in-title">
    <p className="eyebrow">DAY OF PLAY</p>
    <h1 id="event-check-in-title">Event QR Check-In</h1>
    <p className="auth-note">Open one event at a time, then display its live QR code on an iPad, laptop, or monitor. The displayed code changes every 60 seconds and is not for printing.</p>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <EventCheckInClient tournamentId={tournamentId} workspace={data as EventCheckInWorkspace} />
    <SharedDeviceSignOut />
  </section></main>;
}

export type EventCheckInWorkspace = { events: Array<{ eventId: string; name: string; eventType: string; format: string; windowState: 'open' | 'closed'; checkedInCount: number; pendingDeskCount: number }>; requests: Array<{ requestId: string; eventId: string; rosterEntryId: string | null; firstName: string; lastName: string; email: string; accNumber: string | null; createdAt: string }>; roster: Array<{ rosterEntryId: string; displayName: string; accNumber: string | null; eventIds: string[]; paid: boolean; checkedInEventIds: string[] }> };
