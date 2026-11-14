import { isUuid } from './validation.ts';
import { isLinkedSetupSaveResult, type LinkedSetupSaveResult } from './setup-event-links.ts';
import { isSetupCustomPayoutsV2, serializeSetupCustomPayoutsV2, type SetupCustomPayoutsEnvelopeV2, type SetupCustomPayoutsBaseV2 } from './custom-payout-setup-v2.ts';
import { customGraduatedMaximumRatioV3 } from '../results/custom-graduated-amounts-v3.ts';
export type CustomQDraftSavedV2 = {
  status: 'custom_q_setup_draft_saved'; scope: 'draft-q-only'; batchId: string;
  fullRequestHash: string; envelope: SetupCustomPayoutsEnvelopeV2; linked: LinkedSetupSaveResult;
  operatingPolicyPublished: false; moneyMoved: false;
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
/** Exact acknowledgement only. The hash is an opaque DB pin, not a client-side
 * signature. Future recovery must reconcile persisted/current rows before
 * clearing local work; this codec itself performs no cleanup or authorization. */
export function isCustomQDraftSavedV2(v: unknown, envelope: unknown, base: unknown): v is CustomQDraftSavedV2 {
  if (!isSetupCustomPayoutsV2(envelope, base) || envelope.customPayouts.some(i => i.scope !== 'q' || i.ratioDenominator > customGraduatedMaximumRatioV3)
    || !object(v) || !exact(v, ['status', 'scope', 'batchId', 'fullRequestHash', 'envelope', 'linked', 'operatingPolicyPublished', 'moneyMoved'])
    || v.status !== 'custom_q_setup_draft_saved' || v.scope !== 'draft-q-only'
    || !isUuid(v.batchId) || v.batchId !== v.batchId.toLowerCase() || typeof v.fullRequestHash !== 'string'
    || !/^[a-f0-9]{64}$/.test(v.fullRequestHash) || v.operatingPolicyPublished !== false || v.moneyMoved !== false)
    return false;
  return serializeSetupCustomPayoutsV2(v.envelope, base) === serializeSetupCustomPayoutsV2(envelope, base)
    && isLinkedSetupSaveResult(v.linked, { kind: 'setup-event-links-v1', request: envelope.request, choices: envelope.choices });
}
/** Lock contention and unsupported transaction isolation are nonterminal. They
 * must not become a definitive rejection or release the original operation. */
export function isCustomQDraftRetryV2(v: unknown): v is { status: 'retry_exact'; code: 'operation_busy' | 'source_busy' | 'isolation_not_supported' } {
  return object(v) && exact(v, ['status', 'code']) && v.status === 'retry_exact'
    && typeof v.code === 'string' && ['operation_busy', 'source_busy', 'isolation_not_supported'].includes(v.code);
}
export type CustomQDraftReceiptContextV2 = { envelope: SetupCustomPayoutsEnvelopeV2; base: SetupCustomPayoutsBaseV2 };
