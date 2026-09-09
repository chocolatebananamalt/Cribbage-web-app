import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getSeatingWorkspace } from "../../../../lib/seating/workspace";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import SeatingClient from "./seating-client";

export default async function SeatingPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const workspace = await getSeatingWorkspace(tournamentId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="seating-title"><p className="eyebrow">OPERATIONS</p><h1 id="seating-title">Check-in and Seating</h1><p className="auth-note">Record each roster member’s check-in before registration closes. After closure, publish one permanent starting Table/Seat list. That starting assignment becomes the player’s verification ID; it is not a round-by-round seating plan.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><SeatingClient actorId={access.user.id} tournamentId={tournamentId} {...workspace} /><SharedDeviceSignOut /></section></main>;
}
