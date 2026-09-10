import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../../lib/auth/require-tournament-access";
import { getAssignedGameContext } from "../../../../../lib/games/assigned-game-context";
import { isUuid } from "../../../../../lib/api/validation";
import { LiveScoreEntry } from "./score-entry";

export default async function GamePage({ params }: { params: Promise<{ tournamentId: string; gameId: string }> }) {
  const { tournamentId, gameId } = await params;
  if (!isUuid(tournamentId) || !isUuid(gameId)) notFound();
  await requireTournamentAccess(tournamentId);
  const result = await getAssignedGameContext(gameId, tournamentId);
  if (result.status === "unavailable") {
    return <main className="auth-shell"><section className="auth-card" aria-labelledby="game-unavailable-title">
      <p className="eyebrow">SCORE ENTRY</p>
      <h1 id="game-unavailable-title">Game workspace temporarily unavailable</h1>
      <p className="auth-note">No result can be recorded until the tournament system is current. Please ask a director to verify the system before trying again.</p>
      <Link className="primary-action" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    </section></main>;
  }
  return <LiveScoreEntry context={result.context} />;
}
