import { isSideGraduatedWorkspaceV2, type SideGraduatedWorkspaceV2 } from '../api/side-pool-graduated-v2.ts';
import { isUuid } from '../api/validation.ts';
import { calculateGraduatedPoolAmountsV2, type GraduatedPoolAmountsCalculationV2 } from './graduated-pool-amounts-v2.ts';
import { orderQCardsV2, type QCardV2 } from './q-operating-schedule.ts';

/** Server-derived, finalized qualifying scorecards for the pool's own event.
 * sourceDigest covers the current card/eligibility source; poolSourceDigest
 * binds the separately versioned definitions, policy, elections and receipts.
 * A caller-supplied manifest is never authority to create a review or payment.
 */
export type SidePoolCardV3 = Pick<QCardV2, 'participantId' | 'gamePoints' | 'gamesWon' | 'plusPoints'>;
export type SidePoolCardsSourceV3 = {
  tournamentId: string;
  eventId: string;
  sourceDigest: string;
  poolSourceDigest: string;
  finalizationId: string | null;
  blockers: string[];
  cards: SidePoolCardV3[];
};
export type SidePoolRecipientInputV3 = {
  workspace: SideGraduatedWorkspaceV2;
  poolId: string;
  cardsSource: SidePoolCardsSourceV3;
  expectedSourceDigest: string;
};
export type SidePoolRecipientResultV3 = {
  status: 'blocked';
  code: 'invalid_input' | 'pool_unavailable' | 'current_finalized_sources_required'
    | 'source_changed' | 'disclosed_policy_required' | 'entries_not_locked'
    | 'source_blocked' | 'partial_or_stale_contribution' | 'refund_resolution_required'
    | 'cash_tie_policy_unresolved';
} | {
  status: 'preview';
  poolId: string;
  eventId: string;
  finalizationId: string;
  sourceDigest: string;
  poolSourceDigest: string;
  fundMinor: number;
  awards: Array<{ participantId: string; amountMinor: number }>;
  refunds: [];
  calculation: GraduatedPoolAmountsCalculationV2;
  moneyMoved: false;
};

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const monetaryCard = (c: SidePoolCardV3): QCardV2 => ({
  participantId: c.participantId, gamePoints: c.gamePoints, gamesWon: c.gamesWon, plusPoints: c.plusPoints,
  qualified: false, qualificationRank: null,
});

/** Read-only Side recipient calculation. The existing Q monetary comparator
 * orders game points, wins, then gross positive spread. It is distinct from
 * general qualification sorting and never consumes playoff placement, numeric
 * qualification rank, a Q cut, input order or an identifier as a cash tie rule.
 * Historical amount schedules remain unchanged; a new server review must bind
 * this preview to its own immutable source before unpaid accounting can use it.
 */
export function previewSidePoolGraduatedRecipientsV3(input: unknown): SidePoolRecipientResultV3 {
  if (!object(input) || !exact(input, ['workspace', 'poolId', 'cardsSource', 'expectedSourceDigest'])
    || !object(input.workspace) || typeof input.workspace.tournamentId !== 'string'
    || !isSideGraduatedWorkspaceV2(input.workspace, input.workspace.tournamentId)
    || !isUuid(input.poolId) || !hash(input.expectedSourceDigest) || !object(input.cardsSource))
    return { status: 'blocked', code: 'invalid_input' };
  const workspace = input.workspace;
  const source = input.cardsSource;
  if (!exact(source, ['tournamentId', 'eventId', 'sourceDigest', 'poolSourceDigest', 'finalizationId', 'blockers', 'cards'])
    || !isUuid(source.tournamentId) || !isUuid(source.eventId) || !hash(source.sourceDigest) || !hash(source.poolSourceDigest)
    || !(source.finalizationId === null || isUuid(source.finalizationId))
    || !Array.isArray(source.blockers) || !source.blockers.every(b => typeof b === 'string' && /^[a-z_]+$/.test(b))
    || !Array.isArray(source.cards) || source.cards.length > 10_000
    || source.cards.some(c => !object(c) || !isUuid(c.participantId) || !orderQCardsV2([monetaryCard(c as SidePoolCardV3)], []))
    || new Set(source.cards.map(c => c.participantId)).size !== source.cards.length)
    return { status: 'blocked', code: 'invalid_input' };
  const pool = workspace.pools.find(p => p.poolId === input.poolId);
  if (!pool || source.tournamentId !== workspace.tournamentId || source.eventId !== pool.eventId)
    return { status: 'blocked', code: 'pool_unavailable' };
  if (source.sourceDigest !== input.expectedSourceDigest || source.poolSourceDigest !== pool.sourceDigest)
    return { status: 'blocked', code: 'source_changed' };
  if (!source.finalizationId || source.cards.length === 0)
    return { status: 'blocked', code: 'current_finalized_sources_required' };
  if (!pool.policy) return { status: 'blocked', code: 'disclosed_policy_required' };
  if (!pool.started) return { status: 'blocked', code: 'entries_not_locked' };
  if (pool.blockers.length || source.blockers.length || !pool.calculation)
    return { status: 'blocked', code: 'source_blocked' };

  const paid = new Set<string>();
  for (const entry of pool.entries) {
    if (!entry.elected) {
      if (entry.receivedMinor !== 0) return { status: 'blocked', code: 'refund_resolution_required' };
      continue;
    }
    if (entry.dueMinor !== pool.feeMinor || entry.receivedMinor !== pool.feeMinor)
      return { status: 'blocked', code: 'partial_or_stale_contribution' };
    paid.add(entry.participantId);
  }
  const calculation = calculateGraduatedPoolAmountsV2({ paidCount: paid.size, feeMinor: pool.feeMinor, ratio: pool.policy.ratio });
  if (calculation.status !== 'calculated') return { status: 'blocked', code: 'source_blocked' };
  const cards = (source.cards as SidePoolCardV3[]).filter(c => paid.has(c.participantId)).map(monetaryCard);
  if (cards.length !== paid.size) return { status: 'blocked', code: 'current_finalized_sources_required' };
  const ranked = orderQCardsV2(cards, []);
  if (!ranked) return { status: 'blocked', code: 'cash_tie_policy_unresolved' };
  return {
    status: 'preview', poolId: pool.poolId, eventId: pool.eventId,
    finalizationId: source.finalizationId, sourceDigest: source.sourceDigest, poolSourceDigest: source.poolSourceDigest,
    fundMinor: calculation.fundMinor,
    awards: ranked.slice(0, calculation.recipientCount).map((card, i) => ({ participantId: card.participantId, amountMinor: calculation.awardsMinor[i] })),
    refunds: [], calculation, moneyMoved: false,
  };
}
