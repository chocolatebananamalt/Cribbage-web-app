import { isSetupCustomPayoutsV2, serializeSetupCustomPayoutsV2, type SetupCustomPayoutsEnvelopeV2, type SetupCustomPayoutsBaseV2 } from './custom-payout-setup-v2.ts';
import { isLinkedSetupSaveResult, type LinkedSetupSaveResult } from './setup-event-links.ts';
import { isUuid } from './validation.ts';
import { isEventPlayoffParametersDraftV1, resolveEventPlayoffParametersDraftV1, type EventPlayoffParametersDraftV1 } from '../playoffs/event-playoff-parameters-v1.ts';
import { assessEventSeriesSettingsV1, type SeriesRuleContextV1 } from '../playoffs/series-settings-v1.ts';

export type EventSettingsChoiceV3 = { eventClientRowId: string; mode: 'preserve_historical' }
  | { eventClientRowId: string; mode: 'configured'; draft: EventPlayoffParametersDraftV1 };
export type EventSettingsSetupEnvelopeV3 = { kind: 'event-settings-setup-v3'; setup: SetupCustomPayoutsEnvelopeV2; eventSettings: EventSettingsChoiceV3[] };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => obj(v) && Object.getPrototypeOf(v) === Object.prototype && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
function canonical(v: unknown): string { return JSON.stringify(v, (_k, x) => obj(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x); }
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
/** A separate complete envelope. An old Q-only acknowledgement can never
 * acknowledge these settings. No writer/route is enabled by this codec. */
export function isEventSettingsSetupV3(v: unknown, base: unknown): v is EventSettingsSetupEnvelopeV3 {
  if (!exact(v, ['kind', 'setup', 'eventSettings']) || v.kind !== 'event-settings-setup-v3'
    || !isSetupCustomPayoutsV2(v.setup, base) || !Array.isArray(v.eventSettings)
    || Reflect.ownKeys(v.eventSettings).length !== v.eventSettings.length + 1) return false;
  const events = v.setup.request.payload.events.filter(e => e.eventKind === 'main' || e.eventKind === 'consolation');
  if (v.eventSettings.length !== events.length) return false;
  const seen = new Set<string>();
  for (const s of v.eventSettings) {
    if (!obj(s) || !uuid(s.eventClientRowId) || seen.has(s.eventClientRowId) || !events.some(e => e.clientRowId === s.eventClientRowId)) return false;
    seen.add(s.eventClientRowId);
    if (s.mode === 'preserve_historical') { if (!exact(s, ['eventClientRowId', 'mode'])) return false; }
    else if (s.mode !== 'configured' || !exact(s, ['eventClientRowId', 'mode', 'draft']) || !isEventPlayoffParametersDraftV1(s.draft)) return false;
  }
  return true;
}
export function serializeEventSettingsSetupV3(v: unknown, base: unknown): string | null { return isEventSettingsSetupV3(v, base) ? canonical(v) : null; }
export function parseEventSettingsSetupV3(raw: unknown, base: unknown): EventSettingsSetupEnvelopeV3 | null {
  if (typeof raw !== 'string' || raw.length > 1_000_000) return null;
  try { const v: unknown = JSON.parse(raw); return serializeEventSettingsSetupV3(v, base) === raw ? freeze(v as EventSettingsSetupEnvelopeV3) : null; } catch { return null; }
}
export type EventSettingsRecoveryV3 = { kind: 'event-settings-recovery-v3'; actorId: string; operationId: string; envelope: EventSettingsSetupEnvelopeV3 };
export function serializeEventSettingsRecoveryV3(v: unknown, base: unknown): string | null {
  return exact(v, ['kind', 'actorId', 'operationId', 'envelope']) && v.kind === 'event-settings-recovery-v3' && uuid(v.actorId) && uuid(v.operationId)
    && isEventSettingsSetupV3(v.envelope, base) && v.operationId === v.envelope.setup.request.idempotencyKey ? canonical(v) : null;
}
export function parseEventSettingsRecoveryV3(raw: unknown, actorId: unknown, operationId: unknown, base: unknown): EventSettingsRecoveryV3 | null {
  if (typeof raw !== 'string' || raw.length > 1_000_000 || !uuid(actorId) || !uuid(operationId)) return null;
  try { const v: unknown = JSON.parse(raw); return serializeEventSettingsRecoveryV3(v, base) === raw && obj(v) && v.actorId === actorId && v.operationId === operationId ? freeze(v as EventSettingsRecoveryV3) : null; } catch { return null; }
}
export type EventSettingsDraftSavedV3 = { status: 'event_settings_draft_saved'; fullRequestHash: string; envelope: EventSettingsSetupEnvelopeV3; linked: LinkedSetupSaveResult; settingsSnapshotId: string; activationAllowed: false; moneyMoved: false };
export function isEventSettingsDraftSavedV3(v: unknown, envelope: unknown, base: unknown): v is EventSettingsDraftSavedV3 {
  return isEventSettingsSetupV3(envelope, base) && exact(v, ['status', 'fullRequestHash', 'envelope', 'linked', 'settingsSnapshotId', 'activationAllowed', 'moneyMoved'])
    && v.status === 'event_settings_draft_saved' && typeof v.fullRequestHash === 'string' && /^[a-f0-9]{64}$/.test(v.fullRequestHash)
    && uuid(v.settingsSnapshotId) && v.activationAllowed === false && v.moneyMoved === false
    && serializeEventSettingsSetupV3(v.envelope, base) === serializeEventSettingsSetupV3(envelope, base)
    && isLinkedSetupSaveResult(v.linked, { kind: 'setup-event-links-v1', request: envelope.setup.request, choices: envelope.setup.choices });
}
/** Planning gate, never an activation grant. Server must reread settings,
 * legacy declarations/reviews and financial sources in one guarded transaction. */
export function assessEventSettingsActivationV3(choice: EventSettingsChoiceV3, context: SeriesRuleContextV1) {
  const issues: string[] = ['activation_contract_not_integrated'];
  if (choice.mode === 'preserve_historical') issues.push('retain_existing_declaration_checks');
  else {
    const resolved = resolveEventPlayoffParametersDraftV1(choice.draft);
    if (!resolved) issues.push('incomplete_or_invalid_settings');
    else {
      const assessment = assessEventSeriesSettingsV1(resolved.series, context);
      if (!['known_rules_satisfied', 'informal_settings'].includes(assessment.status)) issues.push(...assessment.issues.map(i => i.code), 'series_review_required');
      if (resolved.payout.method !== 'graduated_all_qualifiers') issues.push('custom_paid_places_policy_unresolved');
      issues.push('versioned_prize_disclosure_and_financial_source_required');
    }
  }
  return { activationAllowed: false as const, qualificationChanged: false as const, moneyMoved: false as const, issues };
}
// Retained for reviewers: nesting preserves the exact v2 request, not a lossy adapter.
export const serializeNestedSetupV3 = (v: EventSettingsSetupEnvelopeV3, base: SetupCustomPayoutsBaseV2) => serializeSetupCustomPayoutsV2(v.setup, base);
