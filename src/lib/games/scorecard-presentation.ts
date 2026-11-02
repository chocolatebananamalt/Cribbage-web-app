import type { PlayerScorecard } from './player-scorecard';
import type { AssignedGameSummary } from './my-games-decision';
import { isAccNumber } from '../acc-number.ts';

export type ScorecardPresentationRow = {
  key: string;
  roundNumber: number;
  matchInstance: number;
  gamePoints: number | null;
  plusPoints: number | null;
  minusPoints: number | null;
  opponentName: string | null;
  opponentVerificationId: string | null;
  resultStatus: string;
};

const rowKey = (roundNumber: number, matchInstance: number) => `${roundNumber}-${matchInstance}`;
const cardNumber = (game: AssignedGameSummary) => game.cardNumbers
  ? game.playerSide === 'a' ? game.cardNumbers.sideACardGameNumber : game.cardNumbers.sideBCardGameNumber
  : game.gameNumber;
const pendingStatus = (state: string) => state === 'mismatch' ? 'Result needs review'
  : state === 'confirmation_pending' ? 'Waiting for player confirmation'
    : state === 'submitted' ? 'Waiting for the other entry' : 'No verified result';

/** Reader lines/pending rows alone determine the card; assignments only enrich matching identities. */
export function scorecardPresentationRows(card: PlayerScorecard, assignments: readonly AssignedGameSummary[] = []): ScorecardPresentationRow[] {
  const rows: ScorecardPresentationRow[] = card.lines.map((line, index) => ({
    ...line, key: `result-${rowKey(line.roundNumber, line.matchInstance)}-${index}`, resultStatus: 'Verified scorecard result',
  }));
  const represented = new Set(rows.map(row => rowKey(row.roundNumber, row.matchInstance)));
  for (const game of card.pendingGames) {
    const key = rowKey(game.roundNumber, game.matchInstance);
    if (represented.has(key)) continue;
    const matchingAssignments = assignments.filter(assignment => assignment.eventId === card.eventId
      && assignment.playerVerificationId === card.player.verificationId
      && rowKey(cardNumber(assignment), assignment.matchInstance) === key);
    // Ambiguous schedules and old makeup payloads without a card-line mapping
    // leave the identity blank; they never manufacture a Game 13 card row.
    const assignment = matchingAssignments.length === 1 ? matchingAssignments[0] : null;
    rows.push({ key: `pending-${key}`, roundNumber: game.roundNumber, matchInstance: game.matchInstance,
      gamePoints: null, plusPoints: null, minusPoints: null,
      opponentName: assignment?.opponentName ?? null,
      opponentVerificationId: assignment?.opponentVerificationId ?? null,
      resultStatus: pendingStatus(game.state) });
    represented.add(key);
  }
  return rows.sort((a, b) => a.roundNumber - b.roundNumber || a.matchInstance - b.matchInstance);
}

/** Optional metadata is displayed only when it is actually provided and valid. */
export function scorecardPlayerName(player: PlayerScorecard['player'] & { accNumber?: unknown }) {
  return typeof player.accNumber === 'string' && isAccNumber(player.accNumber)
    ? `${player.displayName} (${player.accNumber})` : player.displayName;
}

export function currentScorecardAssignment(card: PlayerScorecard, assignments: readonly AssignedGameSummary[]) {
  const current = assignments.filter(game => game.eventId === card.eventId
    && game.playerVerificationId === card.player.verificationId
    && game.progressionStatus === 'current' && game.nextAction !== 'view_scorecard');
  // Ambiguous or completed schedules do not manufacture an unlocked next-game link.
  return current.length === 1 ? current[0] : null;
}
