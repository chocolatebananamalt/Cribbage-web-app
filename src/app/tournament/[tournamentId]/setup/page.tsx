import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import SetupClient from "./setup-client";

export const dynamic = "force-dynamic";

export default async function TournamentSetupPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  return <main className="auth-shell"><section className="auth-card corrections-card setup-card" aria-labelledby="setup-title">
    <p className="eyebrow">OPERATIONS</p><h1 id="setup-title">Set Up Tournament</h1>
    <p className="auth-note">Configure the tournament and its Main, Consolation, and Satellite events. Saving creates a private versioned setup record; it does not publish results or charge anyone.</p>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <SetupClient actorId={access.user.id} tournamentId={tournamentId} />
    <SharedDeviceSignOut />
  </section></main>;
}
