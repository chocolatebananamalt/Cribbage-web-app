import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isEventControlWorkspace } from "../../../../lib/api/event-control";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import EventControlClient from "./event-control-client";

export const dynamic = "force-dynamic";

export default async function EventControlPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  // Pausing the room and ending an event's play are director decisions. A
  // cross-checker or judge holding this URL gets the same 404 a player does.
  if (!["director", "co_director"].includes(access.role)) notFound();
  const { data, error } = await createServerOnlyAdminClient().rpc("get_event_control_workspace_v1", {
    p_actor_id: access.user.id,
    p_tournament_id: tournamentId,
  });
  if (error || !isEventControlWorkspace(data)) notFound();

  return <main className="auth-shell"><section className="auth-card schedule-card" aria-labelledby="event-control-title">
    <p className="eyebrow">OPERATIONS</p>
    <h1 id="event-control-title">Event Play Control</h1>
    <p className="card-context">{data.tournamentName}</p>
    <p className="auth-note">Pause stops new score entry across an event while play is halted, and resuming puts it back. Close Event ends play for good and hands the event to cross-checking, so it refuses while any scheduled game is still unrecorded or unverified.</p>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <EventControlClient tournamentId={tournamentId} workspace={data} />
    <SharedDeviceSignOut />
  </section></main>;
}
