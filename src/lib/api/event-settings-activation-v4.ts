import { isUuid } from './validation.ts';
import { isSetupActivationRequest, type SetupActivationRequest, type DeclarationActivationPin } from './setup-activation.ts';
import { isEventSettingsSnapshotV3, type EventSettingsSnapshotV3 } from './event-settings-snapshot-v3.ts';
import { resolveEventPlayoffParametersDraftV1, isEventPlayoffParametersDraftV1, type EventPlayoffParametersDraftV1 } from '../playoffs/event-playoff-parameters-v1.ts';
import type { SeriesRuleContextV1 } from '../playoffs/series-settings-v1.ts';
import { assessSeriesForSetupReviewV2 } from '../playoffs/series-activation-review-v2.ts';
export type EventSettingsActivationRequestV4 = { kind: 'event-settings-activation-v4'; request: SetupActivationRequest;
  associationHash: string; settingsSnapshotId: string; settingsDigest: string;
  settingsPins: Array<{ eventClientRowId: string; reviewId: string; draftDigest: string }> };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => obj(v) && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function isEventSettingsActivationRequestV4(v: unknown): v is EventSettingsActivationRequestV4 {
  if (!exact(v, ['kind', 'request', 'associationHash', 'settingsSnapshotId', 'settingsDigest', 'settingsPins']) || v.kind !== 'event-settings-activation-v4'
    || !isSetupActivationRequest(v.request) || !uuid(v.request.idempotencyKey) || !uuid(v.request.setupRevisionId) || !digest(v.associationHash) || !uuid(v.settingsSnapshotId) || !digest(v.settingsDigest)
    || !Array.isArray(v.settingsPins) || v.settingsPins.length > 32 || Reflect.ownKeys(v.settingsPins).length !== v.settingsPins.length + 1) return false;
  const seen = new Set<string>();
  for (const p of v.settingsPins) {
    if (!exact(p, ['eventClientRowId', 'reviewId', 'draftDigest']) || !uuid(p.eventClientRowId) || !uuid(p.reviewId) || !digest(p.draftDigest) || seen.has(p.eventClientRowId)) return false;
    seen.add(p.eventClientRowId);
  }
  return true;
}
export type EventSettingsActivationFactsV4 = {
  tournamentId: string; settingsSnapshotId: string; settingsDigest: string; associationHash: string;
  snapshot: EventSettingsSnapshotV3;
  configuredReviews: Array<{ eventClientRowId: string; reviewId: string; draftDigest: string; reviewedDraft: EventPlayoffParametersDraftV1; current: true; context: SeriesRuleContextV1 }>;
  legacyDeclarationRequiredRows: string[];
  legacyDeclarationPins: DeclarationActivationPin[];
};
const equal = (a: unknown, b: unknown) => JSON.stringify(a, (_k, x) => obj(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x) === JSON.stringify(b, (_k, x) => obj(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
/** Internal review plan only. Facts must be loaded/recomputed by the future
 * guarded DB reader; posted review IDs or context cannot establish approval.
 * Historical declaration pins stay on the old checked path. No fake legacy
 * weights are generated from a factor to bypass that path. */
export function planEventSettingsActivationV4(request: unknown, facts: unknown) {
  const fail = (code: string) => ({ status: 'blocked' as const, code, activationAllowed: false as const });
  if (!isEventSettingsActivationRequestV4(request) || !exact(facts, ['tournamentId', 'settingsSnapshotId', 'settingsDigest', 'associationHash', 'snapshot', 'configuredReviews', 'legacyDeclarationRequiredRows', 'legacyDeclarationPins'])
    || !uuid(facts.tournamentId) || !uuid(facts.settingsSnapshotId) || !digest(facts.settingsDigest) || !digest(facts.associationHash) || !isEventSettingsSnapshotV3(facts.snapshot)
    || !Array.isArray(facts.configuredReviews) || !Array.isArray(facts.legacyDeclarationPins) || !Array.isArray(facts.legacyDeclarationRequiredRows)
    || !facts.legacyDeclarationRequiredRows.every(uuid) || new Set(facts.legacyDeclarationRequiredRows).size !== facts.legacyDeclarationRequiredRows.length) return fail('invalid_input');
  if (facts.snapshot.tournamentId !== facts.tournamentId || facts.snapshot.setupRevisionId !== request.request.setupRevisionId || facts.snapshot.setupVersion !== request.request.expectedVersion
    || facts.settingsSnapshotId !== request.settingsSnapshotId || facts.settingsDigest !== request.settingsDigest || facts.associationHash !== request.associationHash) return fail('source_changed');
  const configured = facts.snapshot.settings.filter(s => s.mode === 'configured'), legacy = facts.snapshot.settings.filter(s => s.mode === 'legacy_checks_required');
  // Required legacy declarations are derived by the locked server reader from
  // paid event rows. Free historical events must not acquire a new requirement.
  const requiredLegacy = facts.legacyDeclarationRequiredRows as string[];
  if (facts.configuredReviews.length !== configured.length || request.settingsPins.length !== configured.length || facts.legacyDeclarationPins.length !== requiredLegacy.length
    || requiredLegacy.some(id => !legacy.some(s => s.eventClientRowId === id))) return fail('review_coverage_incomplete');
  const seen = new Set<string>(), plans: Array<{ eventClientRowId: string; series: unknown; payout: unknown; deferredRequirements: ReturnType<typeof assessSeriesForSetupReviewV2>['deferredRequirements'] }> = [];
  for (const review of facts.configuredReviews) {
    if (!exact(review, ['eventClientRowId', 'reviewId', 'draftDigest', 'reviewedDraft', 'current', 'context']) || !uuid(review.eventClientRowId) || !uuid(review.reviewId) || !digest(review.draftDigest) || !isEventPlayoffParametersDraftV1(review.reviewedDraft) || review.current !== true || seen.has(review.eventClientRowId)) return fail('invalid_review');
    seen.add(review.eventClientRowId); const setting = configured.find(s => s.eventClientRowId === review.eventClientRowId);
    if (!setting || setting.mode !== 'configured' || !equal(setting.draft, review.reviewedDraft) || !request.settingsPins.some(p => p.eventClientRowId === review.eventClientRowId && p.reviewId === review.reviewId && p.draftDigest === review.draftDigest)) return fail('review_changed');
    const resolved = resolveEventPlayoffParametersDraftV1(setting.draft); if (!resolved) return fail('incomplete_settings');
    const assessment = assessSeriesForSetupReviewV2(resolved.series, review.context);
    if (!assessment.setupReviewEligible) return fail('series_context_or_approval_required');
    if (resolved.payout.method === 'custom_paid_ratio') return fail('custom_ratio_paid_count_policy_unresolved');
    plans.push({ eventClientRowId: setting.eventClientRowId, series: resolved.series, payout: resolved.payout, deferredRequirements:assessment.deferredRequirements });
  }
  const expectedLegacy = facts.legacyDeclarationPins;
  if (expectedLegacy.some(p => !obj(p) || !uuid(p.clientRowId) || !uuid(p.declarationId) || !digest(p.settingsFingerprint) || !requiredLegacy.includes(p.clientRowId))
    || new Set(expectedLegacy.map(p => (p as DeclarationActivationPin).clientRowId)).size !== expectedLegacy.length
    || !equal(request.request.declarationPins ?? [], expectedLegacy)) return fail('legacy_declaration_checks_required');
  return { status: 'planned' as const, plans, legacyDeclarationPins: structuredClone(expectedLegacy), settingsSnapshotId: request.settingsSnapshotId,
    activationAllowed: false as const, backendActivationContractRequired: true as const, qualificationChanged: false as const,
    finalPaidPlacesRecomputedAfterPlay: true as const, moneyMoved: false as const };
}
