import { requireTournamentAccess } from "../../../lib/auth/require-tournament-access";

export default async function ProtectedTournamentPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  const access = await requireTournamentAccess(tournamentId);
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="tournament-title">
        <p className="eyebrow">AUTHORIZED TOURNAMENT</p>
        <h1 id="tournament-title">Tournament workspace</h1>
        <p className="lede">Access granted for role: {access.role}.</p>
      </section>
    </main>
  );
}
