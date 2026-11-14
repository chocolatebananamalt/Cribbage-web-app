import { customQPolicyVersionV5, isQCustomWorkspaceV5 } from '../api/q-custom-policy-v5.ts';
import { isUuid } from '../api/validation.ts';
import { calculateCustomGraduatedAmountsV3, type CustomGraduatedAmountsCalculationV3 } from './custom-graduated-amounts-v3.ts';
import { orderQCardsV2 } from './q-operating-schedule.ts';

/** Local candidate only: no endpoint, publication, payment or review authority. */
export type CustomQPlanV5 = {
  status: 'preview'; contract: typeof customQPolicyVersionV5;
  tournamentId: string; eventId: string; poolVersionId: string; policyId: string;
  sourceDigest: string; fundMinor: number;
  awards: Array<{ participantId: string; amountMinor: number }>;
  refunds: []; calculation: CustomGraduatedAmountsCalculationV3; moneyMoved: false;
};
type Result = CustomQPlanV5 | { status: 'blocked'; code: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);

/** Preserves the graduated Q paid-card ranking/backfill rule. Qualification is
 * not a prerequisite; a noncontributor never receives a Q award. Cash ties
 * remain blocked rather than resolved using IDs, input order or a new rule. */
export function previewCustomQPlanV5(input: unknown): Result {
  if (!object(input) || !exact(input, ['workspace', 'tournamentId', 'eventId', 'poolVersionId', 'expectedSourceDigest'])
    || !isUuid(input.tournamentId) || !isUuid(input.eventId) || !isUuid(input.poolVersionId)
    || !digest(input.expectedSourceDigest) || !isQCustomWorkspaceV5(input.workspace, input.tournamentId))
    return { status: 'blocked', code: 'invalid_input' };
  const source = input.workspace;
  if (source.sourceDigest !== input.expectedSourceDigest || source.membership?.eventId !== input.eventId)
    return { status: 'blocked', code: 'source_changed' };
  const policy = source.policies.find(p => p.poolVersionId === input.poolVersionId);
  if (!policy || policy.method !== customQPolicyVersionV5)
    return { status: 'blocked', code: 'custom_policy_required' };
  if (!source.membership.supported || !source.membership.started || source.blockers.length || !source.cards.length)
    return { status: 'blocked', code: 'current_finalized_sources_required' };
  const pool = source.membership.pools.find(p => p.poolVersionId === input.poolVersionId);
  if (!pool) return { status: 'blocked', code: 'pool_unavailable' };
  const paid = new Set<string>();
  for (const entry of source.membership.entries) {
    if (entry.receivedMinor > 0 && !entry.allocationCurrent)
      return { status: 'blocked', code: 'unresolved_receipt_allocation' };
    const contribution = entry.pools.find(p => p.poolVersionId === pool.poolVersionId);
    if (!contribution) return { status: 'blocked', code: 'pool_membership_unavailable' };
    if (!contribution.elected) {
      if (contribution.amountAllocatedMinor > 0) return { status: 'blocked', code: 'refund_resolution_required' };
      continue;
    }
    const prefix = `Q policy ${policy.id}: `;
    if (!contribution.prePlayElected || !contribution.consentReference.startsWith(prefix)
      || !contribution.consentReference.slice(prefix.length).trim())
      return { status: 'blocked', code: 'policy_acknowledgment_required' };
    if (!entry.allocationCurrent || !contribution.paidEntryEligible || contribution.amountAllocatedMinor !== pool.feeMinor)
      return { status: 'blocked', code: 'partial_or_stale_contribution' };
    paid.add(entry.participantId);
  }
  const calculation = calculateCustomGraduatedAmountsV3({ paidCount: paid.size, feeMinor: pool.feeMinor, ratio: policy.ratio });
  if (calculation.status !== 'calculated') return calculation;
  const cards = source.cards.filter(c => paid.has(c.participantId));
  if (cards.length !== paid.size) return { status: 'blocked', code: 'current_finalized_sources_required' };
  const ranked = orderQCardsV2(cards, []);
  if (!ranked) return { status: 'blocked', code: 'cash_tie_policy_unresolved' };
  return {
    status: 'preview', contract: customQPolicyVersionV5, tournamentId: input.tournamentId,
    eventId: input.eventId, poolVersionId: pool.poolVersionId, policyId: policy.id,
    sourceDigest: source.sourceDigest, fundMinor: calculation.fundMinor,
    awards: ranked.slice(0, calculation.recipientCount).map((card, i) => ({ participantId: card.participantId, amountMinor: calculation.awardsMinor[i] })),
    refunds: [], calculation, moneyMoved: false,
  };
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (object(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
/** Recompute against current server-source input before unpaid accounting can
 * consume a retained snapshot. The digest is a pin, not proof of authorization. */
export function verifyRetainedCustomQPlanV5(snapshot: unknown, currentInput: unknown): boolean {
  const current = previewCustomQPlanV5(currentInput);
  return current.status === 'preview' && object(snapshot) && canonical(snapshot) === canonical(current);
}
