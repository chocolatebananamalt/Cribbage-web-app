import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../../../components/shared-device-sign-out";
import { getEventDisputeWorkspace } from "../../../../../../lib/api/event-disputes";
import { isUuid } from "../../../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import DisputeClient from "./dispute-client";

export const dynamic = "force-dynamic";

export default async function EventDisputesPage({ params }: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  if (!isUuid(tournamentId) || !isUuid(eventId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director", "cross_checker", "judge"].includes(access.role)) notFound();
  const workspace = await getEventDisputeWorkspace(
    createServerOnlyAdminClient(), access.user.id, tournamentId, eventId,
  );
  if (!workspace) notFound();

  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="disputes-title">
    <p className="eyebrow">PRIVATE EVENT REVIEW</p>
    <h1 id="disputes-title">Event dispute register</h1>
    <p className="registration-note">Record a concern against the published game. A different authorized official who is not either player must resolve it. This register never changes a score; any open dispute blocks qualification finalization.</p>
    <DisputeClient key={`${workspace.games.filter((game) => game.canOpen).map((game) => game.gameId).join(":")}:${workspace.openDisputes.map((dispute) => dispute.disputeId).join(":")}`} actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} workspace={workspace} />
    <Link className="guide-link" href={`/tournament/${tournamentId}/results?event=${eventId}`}>Back to event results</Link>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;
}
