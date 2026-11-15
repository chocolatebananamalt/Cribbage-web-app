import {isGameScorecardNumbers, type GameScorecardNumbers} from '../api/odd-field-makeup.ts';
import type {HybridGameItem} from '../hybrid-games/workspace';

/** Batch 13 is a scheduling batch, never a physical paper-card line. */
export function manualMixedPaperCardLineV1(item: HybridGameItem, numbers?: GameScorecardNumbers): number | null {
  if (numbers) {
    if (!isGameScorecardNumbers(numbers, item.gameId) || numbers.eventId !== item.eventId || numbers.schedulingBatchNumber !== item.gameNumber) return null;
    const line = item.digitalSide === 'a' ? numbers.sideBCardGameNumber : numbers.sideACardGameNumber;
    return line >= 1 && line <= 12 ? line : null;
  }
  return Number.isSafeInteger(item.gameNumber) && item.gameNumber >= 1 && item.gameNumber <= 12 ? item.gameNumber : null;
}
