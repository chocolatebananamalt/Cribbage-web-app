import { isEventSettingsSetupV3, type EventSettingsSetupEnvelopeV3 } from './event-settings-setup-v3.ts';
import type { SetupCustomPayoutsBaseV2 } from './custom-payout-setup-v2.ts';
import { isEventPlayoffParametersDraftV1, type EventPlayoffParametersDraftV1 } from '../playoffs/event-playoff-parameters-v1.ts';
import { isUuid } from './validation.ts';
export type EventSettingsSnapshotV3 = { kind: 'event-settings-snapshot-v3'; tournamentId: string; setupRevisionId: string; setupVersion: number; settings: Array<
  { eventClientRowId: string; mode: 'configured'; draft: EventPlayoffParametersDraftV1 }
  | { eventClientRowId: string; mode: 'legacy_checks_required' }> };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => obj(v) && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
export function isEventSettingsSnapshotV3(v: unknown): v is EventSettingsSnapshotV3 {
  if (!exact(v, ['kind', 'tournamentId', 'setupRevisionId', 'setupVersion', 'settings']) || v.kind !== 'event-settings-snapshot-v3'
    || !uuid(v.tournamentId) || !uuid(v.setupRevisionId) || !Number.isInteger(v.setupVersion) || (v.setupVersion as number) < 1 || (v.setupVersion as number) > 2147483647
    || !Array.isArray(v.settings) || v.settings.length > 32 || Reflect.ownKeys(v.settings).length !== v.settings.length + 1) return false;
  const seen = new Set<string>();
  for (const s of v.settings) {
    if (!obj(s) || !uuid(s.eventClientRowId) || seen.has(s.eventClientRowId)) return false;
    seen.add(s.eventClientRowId);
    if (s.mode === 'configured') { if (!exact(s, ['eventClientRowId', 'mode', 'draft']) || !isEventPlayoffParametersDraftV1(s.draft)) return false; }
    else if (s.mode !== 'legacy_checks_required' || !exact(s, ['eventClientRowId', 'mode'])) return false;
  }
  return true;
}
/** Pure transaction plan, not a write or acknowledgement. previous must be
 * loaded under the same DB lock as base. A missing snapshot must be established
 * by that reader, not accepted from a client to erase configured settings. */
export function planEventSettingsSnapshotV3(envelope: unknown, base: SetupCustomPayoutsBaseV2, previous: unknown) {
  if (!isEventSettingsSetupV3(envelope, base)) return { status: 'blocked' as const, code: 'invalid_envelope' };
  if (previous !== null && (!isEventSettingsSnapshotV3(previous) || previous.tournamentId !== base.tournamentId || previous.setupRevisionId !== base.setupRevisionId || previous.setupVersion !== base.setupVersion))
    return { status: 'blocked' as const, code: 'snapshot_source_changed' };
  const prior = previous as EventSettingsSnapshotV3 | null;
  const settings = envelope.eventSettings.map(s => {
    if (s.mode === 'configured') return structuredClone(s);
    const retained = prior?.settings.find(p => p.eventClientRowId === s.eventClientRowId);
    return retained ? structuredClone(retained) : { eventClientRowId: s.eventClientRowId, mode: 'legacy_checks_required' as const };
  });
  return { status: 'planned' as const, settings, expectedVersion: envelope.setup.request.expectedVersion,
    databaseReadRequired: true as const, persisted: false as const, activationAllowed: false as const };
}
export type EventSettingsSnapshotPlanEnvelopeV3 = EventSettingsSetupEnvelopeV3;
