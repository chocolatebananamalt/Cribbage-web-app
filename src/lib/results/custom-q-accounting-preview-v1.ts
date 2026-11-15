import { isUuid } from '../api/validation.ts';
import { previewCustomQPlanV5, verifyRetainedCustomQPlanV5, type CustomQPlanV5 } from './q-custom-operating-preview-v5.ts';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (object(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
type Blocked = { status: 'blocked'; code: 'invalid_input' | 'stale_or_changed_plan' | 'fund_scope_mismatch' | 'fund_mismatch' };
export type CustomQAccountingPreviewV1 = {
  status: 'unpaid_accounting_preview'; version: 'custom-q-accounting-preview-v1';
  tournamentId: string; eventId: string; totalAllocatedMinor: number; totalAwardsMinor: number;
  pools: CustomQPlanV5[]; reviewRequired: true; paymentsRecorded: false; moneyMoved: false;
};

/** Bridge to a future immutable accounting review, never a ledger writer.
 * Each funding bucket must come from the current authorized allocation reader,
 * separately from the retained award plan. No caller hash proves authority.
 * Event/Q-source pins and exact funding must agree; no top-up or adjustment is
 * invented to make a schedule balance. Existing accounting remains unchanged. */
export function previewCustomQAccountingV1(input: unknown): CustomQAccountingPreviewV1 | Blocked {
  if (!object(input) || !exact(input, ['tournamentId', 'eventId', 'pools']) || !isUuid(input.tournamentId)
    || input.tournamentId !== input.tournamentId.toLowerCase() || !isUuid(input.eventId)
    || input.eventId !== input.eventId.toLowerCase() || !Array.isArray(input.pools)
    || input.pools.length < 1 || input.pools.length > 2) return { status: 'blocked', code: 'invalid_input' };
  const plans: CustomQPlanV5[] = [], seen = new Set<string>(), policies = new Set<string>();
  let total = BigInt(0);
  let eventSource: string | null = null, eventWorkspace: string | null = null;
  for (const item of input.pools) {
    if (!object(item) || !exact(item, ['retainedPlan', 'currentInput', 'funding']) || !object(item.funding)
      || !exact(item.funding, ['tournamentId', 'eventId', 'poolVersionId', 'sourceDigest', 'allocatedMinor', 'currency'])
      || item.funding.currency !== 'USD' || typeof item.funding.allocatedMinor !== 'number'
      || !Number.isSafeInteger(item.funding.allocatedMinor) || item.funding.allocatedMinor < 0)
      return { status: 'blocked', code: 'invalid_input' };
    if (!verifyRetainedCustomQPlanV5(item.retainedPlan, item.currentInput))
      return { status: 'blocked', code: 'stale_or_changed_plan' };
    const plan = previewCustomQPlanV5(item.currentInput);
    if (plan.status !== 'preview') return { status: 'blocked', code: 'stale_or_changed_plan' };
    if (!object(item.currentInput)) return { status: 'blocked', code: 'invalid_input' };
    const workspace = canonical(item.currentInput.workspace);
    if (eventSource !== null && (eventSource !== plan.sourceDigest || eventWorkspace !== workspace))
      return { status: 'blocked', code: 'stale_or_changed_plan' };
    eventSource = plan.sourceDigest; eventWorkspace = workspace;
    if (plan.tournamentId !== input.tournamentId || plan.eventId !== input.eventId
      || item.funding.tournamentId !== plan.tournamentId || item.funding.eventId !== plan.eventId
      || item.funding.poolVersionId !== plan.poolVersionId || item.funding.sourceDigest !== plan.sourceDigest
      || seen.has(plan.poolVersionId) || policies.has(plan.policyId)) return { status: 'blocked', code: 'fund_scope_mismatch' };
    const awardTotal = plan.awards.reduce((sum, a) => sum + BigInt(a.amountMinor), BigInt(0));
    if (awardTotal !== BigInt(plan.fundMinor) || item.funding.allocatedMinor !== plan.fundMinor)
      return { status: 'blocked', code: 'fund_mismatch' };
    seen.add(plan.poolVersionId); policies.add(plan.policyId); total += awardTotal;
    if (total > BigInt(Number.MAX_SAFE_INTEGER)) return { status: 'blocked', code: 'fund_mismatch' };
    // Fresh recomputed objects: editing a returned preview cannot change its
    // input or the separately retained source/review snapshot.
    plans.push(plan);
  }
  return { status: 'unpaid_accounting_preview', version: 'custom-q-accounting-preview-v1',
    tournamentId: input.tournamentId, eventId: input.eventId, totalAllocatedMinor: Number(total), totalAwardsMinor: Number(total),
    pools: plans, reviewRequired: true, paymentsRecorded: false, moneyMoved: false };
}
