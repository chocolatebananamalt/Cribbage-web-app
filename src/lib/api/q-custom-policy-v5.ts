import { customGraduatedAmountsVersionV3, customGraduatedMaximumRatioV3 } from '../results/custom-graduated-amounts-v3.ts';
import { isUuid } from './validation.ts';
import { graduatedQMethodV4, isQOperatingWorkspaceV4, type QOperatingWorkspaceV4 } from './q-graduated-policy-v4.ts';
import { isCustomPayoutIntentV1, type CustomPayoutIntentV1 } from './custom-payout-intent-v1.ts';

/** New contract only. Existing v2–v4 requests and replay namespaces stay exact. */
export const customQPolicyVersionV5 = 'q-custom-graduated-policy-v5' as const;
export type QCustomPolicyRequestV5 = {
  action: 'publish'; poolVersionId: string; method: typeof customQPolicyVersionV5;
  ratio: number; amountMethod: typeof customGraduatedAmountsVersionV3; disclosureReference: string; disclosed: true;
  intent: CustomPayoutIntentV1;
};
type ExistingPolicy = QOperatingWorkspaceV4['policies'][number];
export type QCustomWorkspaceV5 = Omit<QOperatingWorkspaceV4, 'policies'> & {
  policies: Array<ExistingPolicy | (Omit<ExistingPolicy, 'method' | 'ratio' | 'scheduleId'> & {
    method: typeof customQPolicyVersionV5; ratio: number; scheduleId: typeof customGraduatedAmountsVersionV3;
  })>;
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
function canonicalIdentityFields(v: unknown, key = ''): boolean {
  if (Array.isArray(v)) return v.every(item => canonicalIdentityFields(item, key));
  if (object(v)) return Object.entries(v).every(([name, item]) => canonicalIdentityFields(item, name));
  const identity = key === 'id' || key.endsWith('Id') || key.endsWith('Ids') || key === 'participantIdsLowFirst';
  return !identity || !isUuid(v) || v === v.toLowerCase();
}
/** New amount engine's PostgreSQL integer technical domain, not an ACC or admission rule. */
export function isCustomQEngineRatioV5(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 1 && v <= customGraduatedMaximumRatioV3;
}
export function isQCustomPolicyRequestV5(v: unknown): v is QCustomPolicyRequestV5 {
  return object(v) && exact(v, ['action', 'poolVersionId', 'method', 'ratio', 'amountMethod', 'disclosureReference', 'disclosed', 'intent'])
    && v.action === 'publish' && isUuid(v.poolVersionId) && v.poolVersionId === v.poolVersionId.toLowerCase() && v.method === customQPolicyVersionV5
    && isCustomQEngineRatioV5(v.ratio) && v.amountMethod === customGraduatedAmountsVersionV3 && v.disclosed === true
    && isCustomPayoutIntentV1(v.intent) && v.intent.scope === 'q' && v.intent.ratioDenominator === v.ratio
    && typeof v.disclosureReference === 'string' && v.disclosureReference === v.disclosureReference.trim()
    && v.disclosureReference.length > 0 && v.disclosureReference.length <= 500
    && !/[\u0000-\u001f\u007f]/.test(v.disclosureReference);
}
export function isQCustomReconciliationRequestV5(v: unknown): v is { operationId: string; request: QCustomPolicyRequestV5 } {
  return object(v) && exact(v, ['operationId', 'request']) && isUuid(v.operationId) && v.operationId === v.operationId.toLowerCase() && isQCustomPolicyRequestV5(v.request);
}
export function isQCustomWorkspaceV5(v: unknown, tournamentId: string): v is QCustomWorkspaceV5 {
  if (!object(v) || !Array.isArray(v.policies) || !canonicalIdentityFields(v)) return false;
  for (const p of v.policies) if (object(p) && p.method === customQPolicyVersionV5
    && (!isCustomQEngineRatioV5(p.ratio) || p.scheduleId !== customGraduatedAmountsVersionV3)) return false;
  // Validate every inherited role/source/election/payment/card field with the
  // existing strict codec. Only new policies receive a structural surrogate;
  // the original numeric ratio remains untouched in the caller's snapshot.
  const normalized = { ...v, policies: v.policies.map(p => object(p) && p.method === customQPolicyVersionV5
    ? { ...p, method: graduatedQMethodV4, ratio: 4, scheduleId: graduatedQMethodV4 } : p) };
  if (!isQOperatingWorkspaceV4(normalized, tournamentId)) return false;
  const entries = normalized.membership?.entries ?? [];
  return new Set(entries.map(e => e.participantId)).size === entries.length
    && new Set(entries.map(e => e.rosterEntryId)).size === entries.length; 
}
