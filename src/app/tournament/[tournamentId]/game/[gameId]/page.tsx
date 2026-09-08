import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../../lib/auth/require-tournament-access";
import { getAssignedGameContext } from "../../../../../lib/games/assigned-game-context";
import { isUuid } from "../../../../../lib/api/validation";
import { LiveScoreEntry } from "./score-entry";

export default async function GamePage({ params }: { params: Promise<{ tournamentId: string; gameId: string }> }) {
  const { tournamentId, gameId } = await params;
  if (!isUuid(tournamentId) || !isUuid(gameId)) notFound();
  await requireTournamentAccess(tournamentId);
  const context = await getAssignedGameContext(gameId, tournamentId);
  return <LiveScoreEntry context={context} />;
}
