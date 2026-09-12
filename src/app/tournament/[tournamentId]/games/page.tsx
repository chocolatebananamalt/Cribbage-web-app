import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getMyGames, type AssignedGameSummary } from "../../../../lib/games/my-games";

export const dynamic = "force-dynamic";

const actionLabel: Record<AssignedGameSummary["nextAction"], string> = {
  enter_result: "Enter result",
  wait_opponent_entry: "Waiting for opponent entry",
  review_confirm: "Review and confirm",
  wait_opponent_confirmation: "Waiting for opponent confirmation",
  mismatch_review: "Entries do not match",
  view_scorecard: "Verified",
};

function GameList({ games, tournamentId }: { games: AssignedGameSummary[]; tournamentId: string }) {
  return <ul className="my-games-list">{games.map((game) => <li key={game.gameId}>
    <div><strong>{game.eventName} · Game {game.gameNumber}</strong><span>You: {game.playerTableSeat} · ID # {game.playerVerificationId}</span><span>{game.opponentName}: {game.opponentTableSeat} · ID # {game.opponentVerificationId}</span></div>
    <div><span className={`game-state game-state-${game.state}`}>{game.state === "corrected" ? "Verified correction" : game.state === "recovered" ? "Verified recovery" : actionLabel[game.nextAction]}</span><Link className="secondary" href={game.nextAction === "view_scorecard" ? `/tournament/${tournamentId}/scorecard?event=${game.eventId}` : `/tournament/${tournamentId}/game/${game.gameId}`}>{game.nextAction === "view_scorecard" ? "View Scorecard" : "Open Game"}</Link></div>
  </li>)}</ul>;
}

export default async function MyGamesPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  await requireTournamentAccess(tournamentId);
  const result = await getMyGames(tournamentId);
  if (result.status === "unavailable") return <main className="auth-shell"><section className="auth-card" aria-labelledby="games-unavailable-title"><p className="eyebrow">SCORE ENTRY</p><h1 id="games-unavailable-title">Games temporarily unavailable</h1><p className="auth-note">No game can be opened until the tournament system is current. Please ask a director to verify the system before trying again.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link></section></main>;

  const active = result.workspace.games.filter((game) => !["verified", "corrected", "recovered"].includes(game.state));
  const completed = result.workspace.games.filter((game) => ["verified", "corrected", "recovered"].includes(game.state));
  const eventIds = [...new Set(result.workspace.games.map((game) => game.eventId))];
  const tournamentLabel = [result.workspace.tournamentName, result.workspace.tournamentDate].filter(Boolean).join(" ");

  return <main className="auth-shell"><section className="auth-card games-card" aria-labelledby="my-games-title">
    <p className="eyebrow">SCORE ENTRY</p><h1 id="my-games-title">My Games</h1><p className="card-context">{tournamentLabel}</p>
    <h2>Current Games</h2>{active.length ? <GameList games={active} tournamentId={tournamentId} /> : <p className="auth-note">No current game is waiting for your entry or confirmation.</p>}
    <h2>Completed Games</h2>{completed.length ? <GameList games={completed} tournamentId={tournamentId} /> : <p className="auth-note">No verified games yet.</p>}
    {eventIds.map((eventId) => <Link className="guide-link" href={`/tournament/${tournamentId}/scorecard?event=${eventId}`} key={eventId}>View {result.workspace.games.find((game) => game.eventId === eventId)?.eventName} Scorecard</Link>)}
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><SharedDeviceSignOut />
  </section></main>;
}
