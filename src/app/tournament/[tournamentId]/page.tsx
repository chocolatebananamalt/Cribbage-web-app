import { requireTournamentAccess } from "../../../lib/auth/require-tournament-access";
import { SharedDeviceSignOut } from "../../../components/shared-device-sign-out";
import Link from "next/link";
import { publicRegistrationEnabled } from "../../../lib/api/public-registration-v2";

export default async function ProtectedTournamentPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  const access = await requireTournamentAccess(tournamentId);
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="tournament-title">
        <p className="eyebrow">AUTHORIZED TOURNAMENT</p>
        <h1 id="tournament-title">Tournament workspace</h1>
        <p className="lede">Access granted for role: {access.role}.</p>
        <Link className="guide-link" href={`/tournament/${tournamentId}/how-to`}>Start Here / How To</Link>
        <Link className="guide-link" href={`/tournament/${tournamentId}/rulebook`}>ACC Rulebook</Link>
        {["director", "co_director"].includes(access.role) ? <Link className="guide-link" href={`/tournament/${tournamentId}/roster`}>Registration roster review</Link> : null}
        {["director", "co_director"].includes(access.role) && publicRegistrationEnabled() ? <Link className="guide-link" href={`/tournament/${tournamentId}/registration`}>Registration link and QR code</Link> : null}
        {["director", "co_director"].includes(access.role) ? <Link className="guide-link" href={`/tournament/${tournamentId}/seating`}>Check-in and seating</Link> : null}
        {["director", "co_director"].includes(access.role) ? <Link className="guide-link" href={`/tournament/${tournamentId}/payments`}>Manual payment evidence</Link> : null}
        <SharedDeviceSignOut />
      </section>
    </main>
  );
}
