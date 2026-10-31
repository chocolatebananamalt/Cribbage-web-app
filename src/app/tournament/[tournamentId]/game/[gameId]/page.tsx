import { notFound } from "next/navigation";
import { cache } from 'react';
import type { Metadata } from 'next';
import { requireTournamentAccess } from "../../../../../lib/auth/require-tournament-access";
import { getAssignedGameContext } from "../../../../../lib/games/assigned-game-context";
import { isUuid } from "../../../../../lib/api/validation";
import { LiveScoreEntry } from "./score-entry";
import Link from "next/link";
import {MakeupCardLines} from '../../../../../components/makeup-card-lines';
import { assignedOfflinePageMetadata } from '../../../../../lib/offline-score-page-binding';

// React cache is request-scoped. Metadata and page must use the same protected
// assignment, never independently infer ownership from a URL or browser state.
const protectedGameContext = cache(async (tournamentId: string, gameId: string) => {
  if (!isUuid(tournamentId) || !isUuid(gameId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  const result = await getAssignedGameContext(gameId, tournamentId);
  if (result.status === "unavailable") {
    // The service worker may replace this true transient server failure with
    // an exact, unexpired, prepared copy of the same assigned game.
    throw new Error("game_workspace_temporarily_unavailable");
  }
  if (result.context.actorId !== access.user.id) notFound();
  return result;
});

type GamePageProps = { params: Promise<{ tournamentId: string; gameId: string }> };
export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { tournamentId, gameId } = await params;
  return assignedOfflinePageMetadata((await protectedGameContext(tournamentId, gameId)).context);
}

export default async function GamePage({ params }: GamePageProps) {
  const { tournamentId, gameId } = await params;
  const result = await protectedGameContext(tournamentId, gameId);
  const numbers=result.context.cardNumbers??null;
  if (result.context.progressionStatus === "not_started") return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">SCORE ENTRY</p><h1>Event Not Started</h1><p className="auth-note">The schedule is published, but an authorized official has not started this event. Score entry and offline scoring remain locked.</p><Link className="guide-link" href={`/tournament/${tournamentId}/games`}>Back to My Games</Link></section></main>;
  if (result.context.progressionStatus === "upcoming") return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">SCORE ENTRY</p><h1>Upcoming Game</h1><p className="auth-note">{numbers?.isMakeup?'Your qualifying makeup':'Game '+result.context.roundNumber} is locked until your earlier scheduled game is authoritatively verified or corrected.</p><MakeupCardLines numbers={numbers} sideAName={result.context.player.side==='a'?result.context.player.displayName:result.context.opponent.displayName} sideBName={result.context.player.side==='b'?result.context.player.displayName:result.context.opponent.displayName}/><Link className="guide-link" href={`/tournament/${tournamentId}/games`}>Back to My Games</Link></section></main>;
  if (result.context.progressionStatus === "completed") return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">SCORE ENTRY</p><h1>Game Complete</h1><p className="auth-note">This game is already authoritative and cannot accept another entry.</p><Link className="guide-link" href={`/tournament/${tournamentId}/scorecard?event=${result.context.eventId}`}>View Scorecard</Link></section></main>;
  return <div data-offline-score-binding={`${result.context.actorId}:${result.context.gameId}`}><LiveScoreEntry context={result.context} cardNumbers={numbers}/></div>;
}
