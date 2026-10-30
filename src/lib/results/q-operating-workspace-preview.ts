import type { QOperatingWorkspaceV3 } from '../api/q-operating-schedules.ts';
import { balancedQMethodV3, equalQMethodV2, graduatedQMethodV2 } from '../api/q-operating-schedules.ts';
import { calculateAccWeightedPool, type AccWeightedPoolCalculation } from './acc-weighted-pool.ts';
import { lookupQChart } from './q-chart-catalog.ts';
import { orderQCardsV2, previewQOperatingScheduleV2, type QOperatingPolicyV2 } from './q-operating-schedule.ts';

export type OperatingWorkspacePreview = { status: 'blocked'; code: string } | { status: 'preview'; fundMinor: number; awards: Array<{ participantId: string; amountMinor: number }>; refunds: Array<{ participantId: string; amountMinor: number }>; moneyMoved: false; calculation?: AccWeightedPoolCalculation };
/** Local read-only rendering. Server recomputation and immutable source binding
 * remain authoritative for reviews and unpaid accounting. No cash tie policy
 * is introduced by the rounding remainder's higher-place convention.
 */
export function operatingWorkspacePoolPreview(source: QOperatingWorkspaceV3, poolVersionId: string): OperatingWorkspacePreview {
 if (!source.membership?.supported || source.blockers.length || !source.cards.length) return { status: 'blocked', code: source.blockers.join(', ') || 'current_finalized_sources_required' };
 const pool = source.membership.pools.find(p => p.poolVersionId === poolVersionId), policy = source.policies.find(p => p.poolVersionId === poolVersionId);
 if (!pool || !policy) return { status: 'blocked', code: 'disclosed_policy_required' };
 const contributions: Array<{ participantId: string; amountMinor: number }> = [];
 for (const entry of source.membership.entries) {
  if (entry.receivedMinor > 0 && !entry.allocationCurrent) return { status: 'blocked', code: 'unresolved_receipt_allocation' };
  const elected = entry.pools.find(p => p.poolVersionId === poolVersionId);
  if (!elected) return { status: 'blocked', code: 'pool_membership_unavailable' };
  if (!elected.elected) { if (elected.amountAllocatedMinor > 0) return { status: 'blocked', code: 'refund_resolution_required' }; continue; }
  if (!elected.prePlayElected) return { status: 'blocked', code: 'preplay_election_required' };
  const prefix = `Q policy ${policy.id}: `;
  if (!elected.consentReference.startsWith(prefix) || !elected.consentReference.slice(prefix.length).trim()) return { status: 'blocked', code: 'policy_acknowledgment_required' };
  if (!entry.allocationCurrent || !elected.paidEntryEligible || elected.amountAllocatedMinor !== pool.feeMinor) return { status: 'blocked', code: 'partial_or_stale_contribution' };
  contributions.push({ participantId: entry.participantId, amountMinor: elected.amountAllocatedMinor });
 }
 if (policy.method === balancedQMethodV3) {
  const calculation = calculateAccWeightedPool({ paidCount: contributions.length, feeMinor: pool.feeMinor, ratio: policy.ratio });
  if (calculation.status === 'blocked') return calculation;
  const paid = new Set(contributions.map(c => c.participantId));
  const candidates = source.cards.filter(c => paid.has(c.participantId));
  if (candidates.length !== contributions.length) return { status: 'blocked', code: 'current_finalized_sources_required' };
  // Existing card ordering is reused; no cut, net-spread substitution, UUID or
  // random fallback resolves a Q-only cash tie for the new method.
  const ranked = orderQCardsV2(candidates, []);
  if (!ranked) return { status: 'blocked', code: 'cash_tie_policy_unresolved' };
  return { status: 'preview', fundMinor: calculation.fundMinor, awards: ranked.slice(0, calculation.recipientCount).map((c, i) => ({ participantId: c.participantId, amountMinor: calculation.awardsMinor[i] })), refunds: [], moneyMoved: false, calculation };
 }
 const operatingPolicy: QOperatingPolicyV2 = policy.method === equalQMethodV2 ? { method: equalQMethodV2, feeMinor: pool.feeMinor }
  : { method: graduatedQMethodV2, feeMinor: pool.feeMinor, ratio: policy.ratio!, scheduleId: policy.scheduleId! };
 const preview = previewQOperatingScheduleV2({ policy: operatingPolicy, cards: source.cards, contributions,
  // Historical cut records remain visible, but do not supply a current cash
  // tiebreak policy. Match the server's fail-closed current review behavior.
  cuts: [], chart: policy.scheduleId ? lookupQChart(policy.scheduleId, contributions.length) : null });
 return preview.status === 'blocked' && preview.code === 'cut_review_required' ? { status: 'blocked', code: 'cash_tie_policy_unresolved' } : preview;
}
