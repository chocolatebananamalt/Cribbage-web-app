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
    {/* resolve_event_dispute_v1 rejects only an actor who is one of the two
        players in the disputed game (0138:347-351). It does not require a
        different person from the one who opened it. This line used to promise
        "a different authorized official", which told a lone director that
        opening a dispute would deadlock the event, since an open dispute
        blocks qualification finalization and nobody else could clear it. */}
    <p className="registration-note">Record a concern against the published game. Any authorized official who is not one of the two players in that game may resolve it, including whoever opens it. This register never changes a score; any open dispute blocks qualification finalization until it is resolved.</p>
    <DisputeClient key={`${workspace.games.filter((game) => game.canOpen).map((game) => game.gameId).join(":")}:${workspace.openDisputes.map((dispute) => dispute.disputeId).join(":")}`} actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} workspace={workspace} />
    <Link className="guide-link" href={`/tournament/${tournamentId}/results?event=${eventId}`}>Back to event results</Link>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;
}
