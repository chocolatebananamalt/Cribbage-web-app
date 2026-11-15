import { isUuid } from '../api/validation.ts';
import { calculateMainConSourceModelV1, type MainConSourceInputV1 } from './maincon-source-model-v1.ts';
export type MainConProposalSourceV1 = { tournamentId: string; eventId: string; sourceDigest: string; input: MainConSourceInputV1 };
export type MainConProposedAdjustmentV1 = { firstPlace: number; lastPlace: number; perPersonMinor: number; reason: string };
export type MainConProposalV1 = { status: 'proposed_payouts'; fundMinor: number; proposedTotalMinor: number; discrepancyMinor: number;
  qualifierCount: number; paidPlaces: number; balanced: boolean; changedFromSource: boolean;
  issues: Array<'unbalanced_fund' | 'zero_paid_band' | 'rank_order_violation'>;
  bands: Array<{ firstPlace: number; lastPlace: number; people: number; sourcePerPersonMinor: number; proposedPerPersonMinor: number; bandTotalMinor: number; reason: string | null }>;
  reviewRequired: true; authoritative: false; finalizationAllowed: false; paymentsRecorded: false; moneyMoved: false;
} | { status: 'blocked'; code: 'invalid_input' | 'source_changed' | 'source_model_unavailable' | 'invalid_adjustment' | 'technical_resource_bound' };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && !Object.is(v, -0);
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
function source(v: unknown): v is MainConProposalSourceV1 {
  return object(v) && exact(v, ['tournamentId', 'eventId', 'sourceDigest', 'input']) && uuid(v.tournamentId) && uuid(v.eventId)
    && typeof v.sourceDigest === 'string' && /^[a-f0-9]{64}$/.test(v.sourceDigest);
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (object(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
/** Comparison/proposal bridge only. Current source must eventually be loaded
 * by an authorized ledger/result reader; a posted digest is not proof. No
 * actual payout, financial finalization or qualification mutation occurs here.
 * Per-band changes preserve equal treatment inside shared finishing bands. */
export function previewMainConProposedPayoutsV1(input: unknown): MainConProposalV1 {
  if (!object(input) || !exact(input, ['currentSource', 'retainedSource', 'adjustments'])
    || !source(input.currentSource) || !source(input.retainedSource) || !Array.isArray(input.adjustments))
    return { status: 'blocked', code: 'invalid_input' };
  const model = calculateMainConSourceModelV1(input.currentSource.input);
  if (model.status !== 'calculated' || calculateMainConSourceModelV1(input.retainedSource.input).status !== 'calculated')
    return { status: 'blocked', code: 'source_model_unavailable' };
  if (canonical(input.currentSource) !== canonical(input.retainedSource)) return { status: 'blocked', code: 'source_changed' };
  if (input.adjustments.length > model.bands.length) return { status: 'blocked', code: 'invalid_adjustment' };
  const adjustments = new Map<number, MainConProposedAdjustmentV1>();
  for (const a of input.adjustments) {
    if (!object(a) || !exact(a, ['firstPlace', 'lastPlace', 'perPersonMinor', 'reason']) || !whole(a.firstPlace) || !whole(a.lastPlace)
      || !whole(a.perPersonMinor) || a.perPersonMinor % 500 !== 0 || typeof a.reason !== 'string' || a.reason !== a.reason.trim()
      || !a.reason || a.reason.length > 500 || /[\u0000-\u001f\u007f]/.test(a.reason) || adjustments.has(a.firstPlace)
      || !model.bands.some(b => b.firstPlace === a.firstPlace && b.lastPlace === a.lastPlace))
      return { status: 'blocked', code: 'invalid_adjustment' };
    adjustments.set(a.firstPlace, a as MainConProposedAdjustmentV1);
  }
  const issues = new Set<'unbalanced_fund' | 'zero_paid_band' | 'rank_order_violation'>();
  let sum = BigInt(0), previous: number | null = null, changedFromSource = false, paidPlaces = 0;
  const bands = [];
  for (const b of model.bands) {
    const adjustment = adjustments.get(b.firstPlace), perPerson = adjustment?.perPersonMinor ?? b.perPersonMinor;
    const total = BigInt(perPerson) * BigInt(b.people); sum += total;
    if (sum > BigInt(Number.MAX_SAFE_INTEGER)) return { status: 'blocked', code: 'technical_resource_bound' };
    if (perPerson === 0) issues.add('zero_paid_band'); else paidPlaces += b.people;
    if (previous !== null && perPerson > previous) issues.add('rank_order_violation');
    previous = perPerson; changedFromSource ||= perPerson !== b.perPersonMinor;
    bands.push({ firstPlace: b.firstPlace, lastPlace: b.lastPlace, people: b.people, sourcePerPersonMinor: b.perPersonMinor,
      proposedPerPersonMinor: perPerson, bandTotalMinor: Number(total), reason: adjustment?.reason ?? null });
  }
  if (sum !== BigInt(model.fundMinor)) issues.add('unbalanced_fund');
  return { status: 'proposed_payouts', fundMinor: model.fundMinor, proposedTotalMinor: Number(sum),
    discrepancyMinor: Number(sum - BigInt(model.fundMinor)), qualifierCount: model.qualifierCount, paidPlaces,
    balanced: sum === BigInt(model.fundMinor), changedFromSource, issues: [...issues], bands,
    reviewRequired: true, authoritative: false, finalizationAllowed: false, paymentsRecorded: false, moneyMoved: false };
}
