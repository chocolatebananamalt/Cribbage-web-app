import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../../lib/auth/require-tournament-access";
import { getAssignedGameContext } from "../../../../../lib/games/assigned-game-context";
import { isUuid } from "../../../../../lib/api/validation";
import { LiveScoreEntry } from "./score-entry";
import Link from "next/link";

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
  if (result.context.progressionStatus === "not_started") return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">SCORE ENTRY</p><h1>Event Not Started</h1><p className="auth-note">The schedule is published, but an authorized official has not started this event. Score entry and offline scoring remain locked.</p><Link className="guide-link" href={`/tournament/${tournamentId}/games`}>Back to My Games</Link></section></main>;
  if (result.context.progressionStatus === "upcoming") return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">SCORE ENTRY</p><h1>Upcoming Game</h1><p className="auth-note">Game {result.context.roundNumber} is locked until your earlier scheduled game is authoritatively verified or corrected.</p><Link className="guide-link" href={`/tournament/${tournamentId}/games`}>Back to My Games</Link></section></main>;
  if (result.context.progressionStatus === "completed") return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">SCORE ENTRY</p><h1>Game Complete</h1><p className="auth-note">This game is already authoritative and cannot accept another entry.</p><Link className="guide-link" href={`/tournament/${tournamentId}/scorecard?event=${result.context.eventId}`}>View Scorecard</Link></section></main>;
  return <div data-offline-score-binding={`${result.context.actorId}:${gameId}`}><LiveScoreEntry context={result.context} /></div>;
}
