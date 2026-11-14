import Link from "next/link";
import { notFound } from "next/navigation";
import MixedRehearsalClient from "../../../../../../components/mixed-rehearsal-client";
import { isSyntheticMixedLocalDeployment } from "../../../../../../lib/api/synthetic-mixed-evidence";
import { isUuid } from "../../../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { getMyGames } from "../../../../../../lib/games/my-games";

export default async function MixedRehearsalPage({ params, searchParams }: {
  params: Promise<{ tournamentId: string; eventId: string }>;
  searchParams: Promise<{ game?: string }>;
}) {
  // Fail before this page creates a client when an existing .env points at staging.
  // The existing global authenticated layout remains unchanged.
  if (!isSyntheticMixedLocalDeployment(process.env)) notFound();
  const { tournamentId, eventId } = await params;
  const query = await searchParams;
  if (!isUuid(tournamentId) || !isUuid(eventId) || (query.game !== undefined && !isUuid(query.game))) notFound();
  const access = await requireTournamentAccess(tournamentId);
  const assigned = await getMyGames(tournamentId);
  const games = assigned.status === "available" ? assigned.workspace.games.filter(game => game.eventId === eventId) : [];
  if (query.game && !games.some(game => game.gameId === query.game)) notFound();
  return <main className="auth-shell"><section className="auth-card corrections-card">
    <p className="eyebrow">LOCAL TEST ONLY</p><h1>Mixed-card rehearsal</h1>
    <MixedRehearsalClient actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} games={games} initialGameId={query.game} />
    <Link className="guide-link" href={`/tournament/${tournamentId}/games`}>Back to My Games</Link>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
  </section></main>;
}
