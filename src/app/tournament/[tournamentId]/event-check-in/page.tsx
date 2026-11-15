import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { accountActivationEnabled } from "../../../../lib/api/account-activation-release";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getRosterAccountActivationWorkspace } from "../../../../lib/roster-account-activation-workspace";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import EventCheckInClient from "./event-check-in-client";

export const dynamic = "force-dynamic";

export default async function EventCheckInPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!['director', 'co_director'].includes(access.role)) notFound();
  const admin = createServerOnlyAdminClient();
  const { data, error } = await admin.rpc('get_event_check_in_workspace_v1', { p_actor_id: access.user.id, p_tournament_id: tournamentId });
  if (error || !data || typeof data !== 'object') notFound();
  const appAccess = await readAppAccess(admin, access.user.id, tournamentId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="event-check-in-title">
    <p className="eyebrow">DAY OF PLAY</p>
    <h1 id="event-check-in-title">Event QR Check-In</h1>
    <p className="auth-note">Open each event independently, then display that event’s live QR code on an iPad, laptop, or monitor. Multiple event windows may be open, but each displayed code is event-specific, changes every 60 seconds, and is not for printing.</p>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <EventCheckInClient tournamentId={tournamentId} workspace={data as EventCheckInWorkspace} appAccess={appAccess} />
    <SharedDeviceSignOut />
  </section></main>;
}

/**
 * Who already has an account is read from the activation workspace rather than
 * from a new column: that RPC already lists exactly the roster entries with no
 * app.roster_account_links row, plus any live link, and it is the same read
 * the standalone activation screen trusts.
 *
 * It is a secondary read on a screen that runs the tournament, so it fails
 * soft. It throws when the RPC errors and returns null when the tournament has
 * left draft or open status, and neither of those is a reason to take the
 * check-in desk offline. A null result hides the app access control and says
 * so, which is the honest degradation: the director can still issue a link on
 * the Player Account Activation screen.
 */
async function readAppAccess(admin: ReturnType<typeof createServerOnlyAdminClient>, actorId: string, tournamentId: string): Promise<EventCheckInAppAccess> {
  if (!accountActivationEnabled()) return null;
  try {
    const workspace = await getRosterAccountActivationWorkspace(admin, actorId, tournamentId);
    if (!workspace) return null;
    return { unlinked: workspace.rosterEntries.map((entry) => ({ rosterEntryId: entry.rosterEntryId, activationState: entry.activation === null ? null : entry.activation.state })) };
  } catch {
    return null;
  }
}

export type EventCheckInAppAccess = null | {
  unlinked: Array<{ rosterEntryId: string; activationState: null | 'issued' | 'pending' | 'expired' }>;
};

export type EventCheckInWorkspace = {
  events: Array<{ eventId: string; name: string; eventType: string; format: string; playState?: string; windowState: 'open' | 'closed'; checkedInCount: number; noShowCount?: number; unresolvedCount?: number; pendingDeskCount: number }>;
  requests: Array<{ requestId: string; eventId: string; rosterEntryId: string | null; firstName: string; lastName: string; email: string; accNumber: string | null; createdAt: string }>;
  roster: Array<{ rosterEntryId: string; displayName: string; accNumber: string | null; events?: Array<{ eventId: string; participantStatus: string; attendanceState: 'checked_in' | 'no_show' | 'cancelled' | 'unresolved' }>; eventIds?: string[]; checkedInEventIds?: string[]; paid: boolean; amountOwedMinor?: number; amountReceivedMinor?: number; paymentMethod?: string | null }>;
};
