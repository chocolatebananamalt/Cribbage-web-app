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
    // The service worker may replace this true transient server failure with
    // an exact, unexpired, prepared copy of the same assigned game.
    throw new Error("game_workspace_temporarily_unavailable");
  }
  return <div data-offline-score-binding={`${result.context.actorId}:${gameId}`}><LiveScoreEntry context={result.context} /></div>;
}
