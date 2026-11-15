import { isUuid } from '../api/validation.ts';
import { assessEventSeriesSettingsV1, isEventSeriesSettingsV1, type EventSeriesSettingsV1, type SeriesRuleContextV1 } from './series-settings-v1.ts';
import { playoffSeriesProgressV1, type SeriesProgressV1 } from './series-progress-v1.ts';
export type SeriesMatchSourceV2 = {
  tournamentId: string; eventId: string; matchId: string; matchGenerationId: string; settingsSnapshotId: string;
  sourceDigest: string; round: 'regular' | 'semifinal' | 'final';
  participants: [string, string]; evidence: 'verified-play' | 'synthetic-rehearsal';
  settings: EventSeriesSettingsV1; ruleContext: SeriesRuleContextV1;
};
export type SeriesMatchGameV2 = { eventId: string; matchId: string; matchGenerationId: string; participants: [string, string]; settingsSnapshotId: string; gameNumber: number; resultId: string; winnerParticipantId: string; verification: 'verified'; evidence: 'verified-play' | 'synthetic-rehearsal' };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => obj(v) && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
function source(v: unknown): v is SeriesMatchSourceV2 {
  return exact(v, ['tournamentId', 'eventId', 'matchId', 'matchGenerationId', 'settingsSnapshotId', 'sourceDigest', 'round', 'participants', 'evidence', 'settings', 'ruleContext'])
    && [v.tournamentId, v.eventId, v.matchId, v.matchGenerationId, v.settingsSnapshotId].every(uuid)
    && typeof v.sourceDigest === 'string' && /^[a-f0-9]{64}$/.test(v.sourceDigest)
    && typeof v.round === 'string' && ['regular', 'semifinal', 'final'].includes(v.round)
    && Array.isArray(v.participants) && Reflect.ownKeys(v.participants).length === 3 && v.participants.length === 2
    && v.participants.every(uuid) && v.participants[0] !== v.participants[1]
    && typeof v.evidence === 'string' && ['verified-play', 'synthetic-rehearsal'].includes(v.evidence)
    && isEventSeriesSettingsV1(v.settings) && assessEventSeriesSettingsV1(v.settings, v.ruleContext).status !== 'invalid';
}
function canonical(v: unknown): string { return JSON.stringify(v, (_key, value) => obj(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value); }
export type SeriesMatchProgressV2 = { status: 'projected'; progress: SeriesProgressV1; settingsSnapshotId: string;
  usedFormat: 'regular' | 'final'; formatReview: ReturnType<typeof assessEventSeriesSettingsV1>;
  advancementAllowed: false; officialApprovalClaimed: false }
  | { status: 'blocked'; code: 'invalid_input' | 'source_changed' | 'foreign_game' | 'technical_batch_bound' | 'series_format_requires_review' | 'game_progress_invalid' };
/** Pure source-bound read projection. Both sources and game records must come
 * from an authorized consistent reader, not client assertions. It grants no
 * entry/verification/approval/advance authority or legacy game reconstruction. */
export function projectSeriesMatchProgressV2(input: unknown): SeriesMatchProgressV2 {
  if (!exact(input, ['currentSource', 'retainedSource', 'games']) || !source(input.currentSource) || !source(input.retainedSource) || !Array.isArray(input.games)) return { status: 'blocked', code: 'invalid_input' };
  const current = input.currentSource;
  if (canonical(current) !== canonical(input.retainedSource)) return { status: 'blocked', code: 'source_changed' };
  // Processing bound, not an ACC match-format rule. No partial-history inference.
  if (input.games.length > 10000 || Reflect.ownKeys(input.games).length !== input.games.length + 1) return { status: 'blocked', code: 'technical_batch_bound' };
  const assessment = assessEventSeriesSettingsV1(current.settings, current.ruleContext);
  if (!['known_rules_satisfied', 'informal_settings'].includes(assessment.status)) return { status: 'blocked', code: 'series_format_requires_review' };
  for (const g of input.games) {
    if (!exact(g, ['eventId', 'matchId', 'matchGenerationId', 'participants', 'settingsSnapshotId', 'gameNumber', 'resultId', 'winnerParticipantId', 'verification', 'evidence'])) return { status: 'blocked', code: 'invalid_input' };
    if (g.eventId !== current.eventId || g.matchId !== current.matchId || g.matchGenerationId !== current.matchGenerationId || g.settingsSnapshotId !== current.settingsSnapshotId
      || !Array.isArray(g.participants) || g.participants.length !== 2 || Reflect.ownKeys(g.participants).length !== 3
      || g.participants.some((p, i) => p !== current.participants[i])) return { status: 'blocked', code: 'foreign_game' };
  }
  const usedFormat = current.round === 'final' ? 'final' : 'regular';
  const progress = playoffSeriesProgressV1({ format: current.settings[usedFormat], participants: current.participants, evidence: current.evidence,
    games: input.games.map(g => { const { gameNumber, resultId, winnerParticipantId, verification, evidence } = g as SeriesMatchGameV2; return { gameNumber, resultId, winnerParticipantId, verification, evidence }; }) });
  if (progress.status === 'blocked') return { status: 'blocked', code: 'game_progress_invalid' };
  return { status: 'projected', progress, settingsSnapshotId: current.settingsSnapshotId, usedFormat, formatReview: assessment, advancementAllowed: false, officialApprovalClaimed: false };
}
