import { isUuid } from './validation.ts';
import { customGraduatedAmountsVersionV3, customGraduatedMaximumRatioV3 } from '../results/custom-graduated-amounts-v3.ts';

/** Unconnected versioned intent. This codec grants no role, establishes no
 * membership/payment eligibility and does not publish a payout policy.
 */
export const customPayoutIntentVersionV1 = 'custom-payout-intent-v1' as const;
export const customPayoutRecoveryVersionV1 = 'custom-payout-intent-recovery-v1' as const;
export const customPayoutTechnicalRatioDomainV1 = Object.freeze({ minimum: 1, maximum: customGraduatedMaximumRatioV3, basis: 'postgres-integer-storage-not-acc-rule' as const, amountPolicyVersion: customGraduatedAmountsVersionV3 });
export type CustomPayoutScopeV1 = 'q' | 'side' | 'satellite';
export type CustomPayoutSourceV1 = Readonly<{
  tournamentId: string; eventClientRowId: string; setupRevisionId: string | null;
  setupVersion: number; poolSlot: number | null; sourceDigest: string;
}>;
export type CustomPayoutContextV1 = Readonly<{ scope: CustomPayoutScopeV1; source: CustomPayoutSourceV1 }>;
export type CustomPayoutIntentV1 = Readonly<{
  kind: typeof customPayoutIntentVersionV1; scope: CustomPayoutScopeV1;
  ratioDenominator: number; source: CustomPayoutSourceV1;
}>;
export type CustomPayoutRecoveryV1 = Readonly<{
  kind: typeof customPayoutRecoveryVersionV1; actorId: string; operationId: string;
  intent: CustomPayoutIntentV1;
}>;
export type CustomPayoutClassificationV1 =
  | { status: 'ratio-in-technical-domain'; ratioDenominator: number; amountPolicyVersion: typeof customGraduatedAmountsVersionV3 }
  | { status: 'blocked'; code: 'invalid_intent' | 'ratio_outside_calculator_domain' | 'satellite_allocation_policy_undecided' };

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]) => Reflect.ownKeys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const canonicalUuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
const scope = (v: unknown): v is CustomPayoutScopeV1 => v === 'q' || v === 'side' || v === 'satellite';
const whole = (v: unknown, minimum: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= minimum;
const sourceKeys = ['tournamentId', 'eventClientRowId', 'setupRevisionId', 'setupVersion', 'poolSlot', 'sourceDigest'] as const;
const maximumEncodedCharacters = 2048; // Fixed-field transport size, not a tournament/payout rule.

/** Syntax only. No trimming, leading-zero normalization, exponent/decimal
 * conversion or coercion of a numeric/boolean value into a director's string.
 * Syntax can represent safe integers beyond the candidate engine's separate
 * PostgreSQL integer storage domain; this parser does not authorize calculation.
 */
export function parseCustomPayoutRatioDraftV1(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw) || raw.length > 16) return null;
  const value = BigInt(raw);
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}
function isSource(value: unknown, kind: CustomPayoutScopeV1): value is CustomPayoutSourceV1 {
  if (!object(value) || !exact(value, sourceKeys) || !canonicalUuid(value.tournamentId) || !canonicalUuid(value.eventClientRowId)
    || !whole(value.setupVersion, 0) || value.setupVersion > 2147483647
    || !(value.setupVersion === 0 ? value.setupRevisionId === null : canonicalUuid(value.setupRevisionId))
    || typeof value.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceDigest)) return false;
  // Slot bounds come from the existing setup schema, not an ACC pool limit.
  return kind === 'satellite' ? value.poolSlot === null
    : whole(value.poolSlot, 1) && value.poolSlot <= (kind === 'q' ? 2 : 6);
}
function isContext(value: unknown): value is CustomPayoutContextV1 {
  return object(value) && exact(value, ['scope', 'source']) && scope(value.scope) && isSource(value.source, value.scope);
}
function copySource(value: CustomPayoutSourceV1): CustomPayoutSourceV1 {
  return Object.freeze({ tournamentId: value.tournamentId, eventClientRowId: value.eventClientRowId, setupRevisionId: value.setupRevisionId,
    setupVersion: value.setupVersion, poolSlot: value.poolSlot, sourceDigest: value.sourceDigest });
}
function copyIntent(value: CustomPayoutIntentV1): CustomPayoutIntentV1 {
  return Object.freeze({ kind: customPayoutIntentVersionV1, scope: value.scope, ratioDenominator: value.ratioDenominator, source: copySource(value.source) });
}
export function isCustomPayoutIntentV1(value: unknown): value is CustomPayoutIntentV1 {
  return object(value) && exact(value, ['kind', 'scope', 'ratioDenominator', 'source']) && value.kind === customPayoutIntentVersionV1
    && scope(value.scope) && whole(value.ratioDenominator, 1) && isSource(value.source, value.scope);
}
export function createCustomPayoutIntentV1(kind: unknown, ratioDenominator: unknown, source: unknown): CustomPayoutIntentV1 | null {
  const value = { kind: customPayoutIntentVersionV1, scope: kind, ratioDenominator, source };
  return isCustomPayoutIntentV1(value) ? copyIntent(value) : null;
}
/** Stable field order gives a complete request identity to a future server
 * receipt/hash adapter. Serialization alone does not verify current DB sources.
 */
export function serializeCustomPayoutIntentV1(value: unknown): string | null {
  return isCustomPayoutIntentV1(value) ? JSON.stringify(copyIntent(value)) : null;
}
export function readCustomPayoutIntentV1(value: unknown, expectedContext: unknown): CustomPayoutIntentV1 | null {
  if (!isCustomPayoutIntentV1(value) || !isContext(expectedContext) || value.scope !== expectedContext.scope
    || JSON.stringify(copySource(value.source)) !== JSON.stringify(copySource(expectedContext.source))) return null;
  return copyIntent(value);
}
/** A rejected/stale decode must leave its caller's saved raw request intact.
 * JSONB objects can use readCustomPayoutIntentV1; retained text uses this exact
 * canonical parser so a replay is never silently re-encoded or normalized.
 */
export function parseCustomPayoutIntentV1(raw: unknown, expectedContext: unknown): CustomPayoutIntentV1 | null {
  if (typeof raw !== 'string' || raw.length > maximumEncodedCharacters) return null;
  try { const parsed: unknown = JSON.parse(raw); return serializeCustomPayoutIntentV1(parsed) === raw ? readCustomPayoutIntentV1(parsed, expectedContext) : null; }
  catch { return null; }
}
export function classifyCustomPayoutIntentV1(value: unknown): CustomPayoutClassificationV1 {
  if (!isCustomPayoutIntentV1(value)) return { status: 'blocked', code: 'invalid_intent' };
  // A placement ratio is not a Satellite tier/allocation rule. Never borrow Q
  // eligibility or payout arithmetic to fill that unresolved operating policy.
  if (value.scope === 'satellite') return { status: 'blocked', code: 'satellite_allocation_policy_undecided' };
  if (value.ratioDenominator < customPayoutTechnicalRatioDomainV1.minimum || value.ratioDenominator > customPayoutTechnicalRatioDomainV1.maximum)
    return { status: 'blocked', code: 'ratio_outside_calculator_domain' };
  return { status: 'ratio-in-technical-domain', ratioDenominator: value.ratioDenominator, amountPolicyVersion: customGraduatedAmountsVersionV3 };
}

export function isCustomPayoutRecoveryV1(value: unknown): value is CustomPayoutRecoveryV1 {
  return object(value) && exact(value, ['kind', 'actorId', 'operationId', 'intent']) && value.kind === customPayoutRecoveryVersionV1
    && canonicalUuid(value.actorId) && canonicalUuid(value.operationId) && isCustomPayoutIntentV1(value.intent);
}
export function createCustomPayoutRecoveryV1(actorId: unknown, operationId: unknown, intent: unknown): CustomPayoutRecoveryV1 | null {
  const value = { kind: customPayoutRecoveryVersionV1, actorId, operationId, intent };
  return isCustomPayoutRecoveryV1(value) ? Object.freeze({ kind: customPayoutRecoveryVersionV1, actorId: value.actorId, operationId: value.operationId, intent: copyIntent(value.intent) }) : null;
}
export function serializeCustomPayoutRecoveryV1(value: unknown): string | null {
  if (!isCustomPayoutRecoveryV1(value)) return null;
  return JSON.stringify({ kind: customPayoutRecoveryVersionV1, actorId: value.actorId, operationId: value.operationId, intent: copyIntent(value.intent) });
}
export function parseCustomPayoutRecoveryV1(raw: unknown, expectedActorId: unknown, expectedContext: unknown, expectedOperationId?: unknown): CustomPayoutRecoveryV1 | null {
  if (typeof raw !== 'string' || raw.length > maximumEncodedCharacters || !canonicalUuid(expectedActorId)
    || (expectedOperationId !== undefined && !canonicalUuid(expectedOperationId))) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isCustomPayoutRecoveryV1(value) || serializeCustomPayoutRecoveryV1(value) !== raw || value.actorId !== expectedActorId
      || (expectedOperationId !== undefined && value.operationId !== expectedOperationId)) return null;
    const intent = readCustomPayoutIntentV1(value.intent, expectedContext);
    return intent ? createCustomPayoutRecoveryV1(value.actorId, value.operationId, intent) : null;
  } catch { return null; }
}
/** Same operation key with changed ratio/source/actor is a conflict, never an
 * equivalent replay. A future server must also enforce this under its lock.
 */
export function customPayoutRecoveryMatchesV1(value: unknown, expected: unknown): boolean {
  const actual = serializeCustomPayoutRecoveryV1(value), original = serializeCustomPayoutRecoveryV1(expected);
  return actual !== null && original !== null && actual === original;
}

const legacyRatioPresets: Readonly<Record<CustomPayoutScopeV1, ReadonlyArray<readonly [string, number]>>> = Object.freeze({
  q: Object.freeze([['Graduated (1-in-4)', 4], ['Graduated (1-in-6)', 6], ['Graduated (1-in-8)', 8], ['Graduated (1-in-10)', 10]] as const),
  side: Object.freeze([['graduated-1-in-4', 4], ['graduated-1-in-6', 6], ['graduated-1-in-8', 8], ['graduated-1-in-10', 10]] as const),
  satellite: Object.freeze([['1 in 4', 4], ['1 in 5', 5], ['1 in 6', 6]] as const),
});
/** Only exact existing numeric presets adapt. Equal Q, Top4, arbitrary names,
 * and unsupported legacy spellings return null and must be preserved as their
 * original separate policy; null never authorizes clearing a saved selection.
 */
export function adaptLegacyPayoutPresetV1(kind: unknown, preset: unknown, source: unknown): CustomPayoutIntentV1 | null {
  if (!scope(kind) || typeof preset !== 'string') return null;
  const selected = legacyRatioPresets[kind].find(([label]) => label === preset);
  return selected ? createCustomPayoutIntentV1(kind, selected[1], source) : null;
}
/** Custom7 has no old-schema spelling here. It must use a separately reviewed
 * versioned writer, never a fabricated string sent to the old preset writer.
 */
export function legacyPayoutPresetForIntentV1(value: unknown): string | null {
  return isCustomPayoutIntentV1(value) ? legacyRatioPresets[value.scope].find(([, ratio]) => ratio === value.ratioDenominator)?.[0] ?? null : null;
}
