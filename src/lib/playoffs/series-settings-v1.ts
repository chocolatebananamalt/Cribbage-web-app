/** Local settings candidate only. No existing bracket, result or format changes. */
export type SeriesFormatV1 = Readonly<{ winsRequired: number; maximumGames: number }>;
export type EventSeriesSettingsV1 = Readonly<{ version: 'event-playoff-series-v1'; regular: SeriesFormatV1; final: SeriesFormatV1 }>;
export const playoffSeriesPresetsV1 = Object.freeze([
  Object.freeze({ label: '2 wins out of 3 games', winsRequired: 2, maximumGames: 3 }),
  Object.freeze({ label: '3 wins out of 5 games', winsRequired: 3, maximumGames: 5 }),
  Object.freeze({ label: '4 wins out of 7 games', winsRequired: 4, maximumGames: 7 }),
]);
export type SeriesFormatDraftV1 = { choice: '2-of-3' | '3-of-5' | '4-of-7' | 'custom'; winsText: string; gamesText: string };
export function resolveSeriesFormatDraftV1(draft: unknown): SeriesFormatV1 | null {
  if (!object(draft) || !exact(draft, ['choice', 'winsText', 'gamesText']) || typeof draft.choice !== 'string'
    || typeof draft.winsText !== 'string' || typeof draft.gamesText !== 'string') return null;
  if (draft.choice !== 'custom') {
    const preset = draft.choice === '2-of-3' ? 2 : draft.choice === '3-of-5' ? 3 : draft.choice === '4-of-7' ? 4 : null;
    return preset ? { winsRequired: preset, maximumGames: 2 * preset - 1 } : null;
  }
  if (!/^[1-9][0-9]*$/.test(draft.winsText) || !/^[1-9][0-9]*$/.test(draft.gamesText)) return null;
  const format = { winsRequired: Number(draft.winsText), maximumGames: Number(draft.gamesText) };
  return isSeriesFormatV1(format) ? format : null;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
export function isSeriesFormatV1(v: unknown): v is SeriesFormatV1 {
  return object(v) && exact(v, ['winsRequired', 'maximumGames']) && typeof v.winsRequired === 'number'
    && typeof v.maximumGames === 'number' && Number.isSafeInteger(v.winsRequired) && Number.isSafeInteger(v.maximumGames)
    && v.winsRequired >= 1 && v.maximumGames <= 2_147_483_647
    // A best-of series must always produce a winner by its stated final game.
    && v.maximumGames === v.winsRequired * 2 - 1;
}
export function isEventSeriesSettingsV1(v: unknown): v is EventSeriesSettingsV1 {
  return object(v) && exact(v, ['version', 'regular', 'final']) && v.version === 'event-playoff-series-v1'
    && isSeriesFormatV1(v.regular) && isSeriesFormatV1(v.final);
}
export type SeriesRuleContextV1 = {
  sanctioned: boolean; eventKind: 'main' | 'consolation'; durationDays: number; originalEntrants: number | null;
};
export type SeriesRuleIssueV1 = {
  round: 'regular' | 'final'; severity: 'blocked' | 'rc_approval_required' | 'policy_review_required'; code: string; message: string;
};
export type SeriesRuleAssessmentV1 = {
  status: 'invalid' | 'informal_settings' | 'known_rules_satisfied' | 'review_required' | 'blocked';
  issues: SeriesRuleIssueV1[]; officialApprovalClaimed: false;
};
const same = (f: SeriesFormatV1, wins: number) => f.winsRequired === wins && f.maximumGames === wins * 2 - 1;
/** ACC Policy Manual Ch6 I.B–C p6-1 research. This is bounded to the sourced
 * one/two-day contexts, not a blanket ACC certification. An entered reference
 * or TD checkbox cannot waive a mandatory rule or prove RC approval. */
export function assessEventSeriesSettingsV1(settings: unknown, context: unknown): SeriesRuleAssessmentV1 {
  const result = (status: SeriesRuleAssessmentV1['status'], issues: SeriesRuleIssueV1[] = []): SeriesRuleAssessmentV1 => ({ status, issues, officialApprovalClaimed: false });
  if (!isEventSeriesSettingsV1(settings) || !object(context) || !exact(context, ['sanctioned', 'eventKind', 'durationDays', 'originalEntrants'])
    || typeof context.sanctioned !== 'boolean' || typeof context.eventKind !== 'string' || !['main', 'consolation'].includes(context.eventKind)
    || typeof context.durationDays !== 'number' || !Number.isSafeInteger(context.durationDays) || context.durationDays < 1
    || !(context.originalEntrants === null || (typeof context.originalEntrants === 'number' && Number.isSafeInteger(context.originalEntrants) && context.originalEntrants > 0))) return result('invalid');
  if (!context.sanctioned) return result('informal_settings');
  const issues: SeriesRuleIssueV1[] = [];
  const add = (round: SeriesRuleIssueV1['round'], severity: SeriesRuleIssueV1['severity'], code: string, message: string) => issues.push({ round, severity, code, message });
  if (context.durationDays !== 1 && context.durationDays !== 2) {
    add('regular', 'policy_review_required', 'duration_not_covered', 'Verify the ACC format rules for this event duration.');
    add('final', 'policy_review_required', 'duration_not_covered', 'Verify the ACC final format for this event duration.');
  } else for (const round of ['regular', 'final'] as const) {
    const format = settings[round];
    if (context.eventKind === 'main' && context.durationDays === 2) {
      if (round === 'regular') {
        if (format.winsRequired < 3) add(round, 'blocked', 'two_day_main_minimum', 'Two-day Main rounds use 3 wins out of 5 games.');
        else if (!same(format, 3)) add(round, 'policy_review_required', 'two_day_main_custom', 'A different two-day Main round format needs policy verification.');
      } else if (context.originalEntrants !== null && context.originalEntrants >= 257) {
        if (!same(format, 4)) add(round, 'blocked', 'two_day_main_large_final', 'For 257 or more original entrants, the two-day Main final must be 4 wins out of 7 games.');
      } else if (!same(format, 3) && !same(format, 4)) {
        add(round, format.winsRequired < 3 ? 'blocked' : 'policy_review_required', 'two_day_main_final_format', 'The sourced two-day Main final formats are 3 of 5 or 4 of 7; verify any different format.');
      }
      if (round === 'final' && context.originalEntrants === null && !same(format, 4))
        add(round, 'policy_review_required', 'original_field_required', 'Confirm original entrant count before approving the Main final format.');
    } else if (context.eventKind === 'main') {
      if (same(format, 2)) add(round, 'rc_approval_required', 'one_day_main_shorter', 'A shorter 2-of-3 one-day Main format requires prior Regional Commissioner approval because of facility constraints.');
      else if (format.winsRequired < 3) add(round, 'blocked', 'one_day_main_minimum', 'One-day Main requires at least 3 wins out of 5 games unless the sourced shorter-format exception applies.');
      else if (!same(format, 3)) add(round, 'policy_review_required', 'one_day_main_custom', 'This meets the known minimum, but its specific format still needs policy verification.');
      // The 257-entrant two-day final rule is deliberately not applied here.
    } else {
      if (format.winsRequired < 2) add(round, 'blocked', 'consolation_minimum', 'Consolation requires at least 2 wins out of 3 games.');
      else if (!(same(format, 2) || (context.durationDays === 2 && round === 'final' && same(format, 3))))
        add(round, 'policy_review_required', 'consolation_custom', 'This meets the known minimum; verify this particular Consolation format before use.');
    }
  }
  return result(issues.some(i => i.severity === 'blocked') ? 'blocked' : issues.length ? 'review_required' : 'known_rules_satisfied', issues);
}
