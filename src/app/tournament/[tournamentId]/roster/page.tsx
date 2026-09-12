import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getRosterWorkspace } from "../../../../lib/roster/workspace";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import RosterClient from "./roster-client";

export const dynamic = "force-dynamic";

export default async function RosterPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const workspace = await getRosterWorkspace(tournamentId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="roster-title"><p className="eyebrow">OPERATIONS</p><h1 id="roster-title">Players and Registration</h1><p className="auth-note">Add players directly or promote approved online registrations. A roster identity is not an account, payment, check-in, event enrollment, Table/Seat, or verification-ID assignment.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><RosterClient actorId={access.user.id} tournamentId={tournamentId} {...workspace} /><SharedDeviceSignOut /></section></main>;
}
