import { isUuid } from '../api/validation.ts';
import { isSeriesFormatV1 } from './series-settings-v1.ts';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
export type SeriesProgressV1 = {
  status: 'in_progress' | 'complete'; wins: [number, number]; nextGameNumber: number | null;
  winnerParticipantId: string | null; advancingAuthority: false; evidence: 'verified-play' | 'synthetic-rehearsal';
} | { status: 'blocked'; code: 'invalid_input' | 'unverified_game' | 'games_after_series_complete' };

/** Consumes already verified per-game outcomes. This is not an entry,
 * confirmation or bracket-advancement writer; provenance and current settings
 * must be checked transactionally by the future result authority. */
export function playoffSeriesProgressV1(input: unknown): SeriesProgressV1 {
  if (!object(input) || !exact(input, ['format', 'participants', 'evidence', 'games']) || !isSeriesFormatV1(input.format)
    || !Array.isArray(input.participants) || input.participants.length !== 2 || !input.participants.every(uuid)
    || input.participants[0] === input.participants[1] || typeof input.evidence !== 'string' || !['verified-play', 'synthetic-rehearsal'].includes(input.evidence)
    || !Array.isArray(input.games) || input.games.length > input.format.maximumGames)
    return { status: 'blocked', code: 'invalid_input' };
  const evidence = input.evidence as 'verified-play' | 'synthetic-rehearsal', wins: [number, number] = [0, 0];
  const results = new Set<string>(); let winner: string | null = null;
  for (const [index, game] of input.games.entries()) {
    if (winner !== null) return { status: 'blocked', code: 'games_after_series_complete' };
    if (!object(game) || !exact(game, ['gameNumber', 'resultId', 'winnerParticipantId', 'verification', 'evidence'])
      || game.gameNumber !== index + 1 || !uuid(game.resultId) || results.has(game.resultId)
      || !uuid(game.winnerParticipantId) || !input.participants.includes(game.winnerParticipantId))
      return { status: 'blocked', code: 'invalid_input' };
    if (game.verification !== 'verified' || game.evidence !== evidence)
      return { status: 'blocked', code: 'unverified_game' };
    results.add(game.resultId);
    const side = input.participants.indexOf(game.winnerParticipantId) as 0 | 1; wins[side]++;
    if (wins[side] === input.format.winsRequired) winner = game.winnerParticipantId;
  }
  return { status: winner ? 'complete' : 'in_progress', wins,
    nextGameNumber: winner ? null : input.games.length + 1, winnerParticipantId: winner,
    advancingAuthority: false, evidence };
}
