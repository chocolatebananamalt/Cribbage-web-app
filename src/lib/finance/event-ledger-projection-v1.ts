/** Source-bound event ledger read projection. The server must supply a complete
 * consistent current ledger snapshot; posted facts are never receipt authority.
 * This does not write a receipt, approve ACC benefits or record disbursements. */
import { isUuid } from '../api/validation.ts';
export type EventLedgerAllocationV1 = { eventId: string; bucket: 'regular_entry' | 'player_benefit' | 'operating_expense' | 'unrestricted_income' | 'restricted_income' | 'q' | 'side'; poolId: string | null; amountMinor: number; classificationReviewed: boolean };
export type EventLedgerSourceV1 = { sourceId: string; physicalEvidenceId: string; kind: 'entry_receipt' | 'expense' | 'additional_income'; amountMinor: number; state: 'active' | 'voided'; allocations: EventLedgerAllocationV1[] };
export type EventLedgerSnapshotV1 = { kind: 'event-ledger-snapshot-v1'; tournamentId: string; sourceDigest: string; sourceVersion: number; complete: true; mode: 'documented_actual' | 'simulation'; eventIds: string[]; pools: Array<{poolId: string; eventId: string; kind: 'q' | 'side'}>; sources: EventLedgerSourceV1[] };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const canonical = (v: unknown) => JSON.stringify(v, (_k, x) => object(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const buckets = ['regular_entry', 'player_benefit', 'operating_expense', 'unrestricted_income', 'restricted_income', 'q', 'side'] as const;
function snapshot(v: unknown): v is EventLedgerSnapshotV1 {
  if (!exact(v, ['kind', 'tournamentId', 'sourceDigest', 'sourceVersion', 'complete', 'mode', 'eventIds', 'pools', 'sources']) || v.kind !== 'event-ledger-snapshot-v1' || !uuid(v.tournamentId)
    || typeof v.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(v.sourceDigest) || typeof v.sourceVersion !== 'number' || !Number.isSafeInteger(v.sourceVersion) || v.sourceVersion < 0
    || v.complete !== true || (v.mode !== 'documented_actual' && v.mode !== 'simulation') || !Array.isArray(v.sources) || v.sources.length > 10000 || Reflect.ownKeys(v.sources).length !== v.sources.length + 1) return false;
  if (!Array.isArray(v.eventIds) || v.eventIds.length > 10000 || Reflect.ownKeys(v.eventIds).length !== v.eventIds.length + 1 || !v.eventIds.every(uuid) || new Set(v.eventIds).size !== v.eventIds.length
    || !Array.isArray(v.pools) || v.pools.length > 10000 || Reflect.ownKeys(v.pools).length !== v.pools.length + 1) return false;
  const pools = new Map<string, {eventId: string; kind: 'q' | 'side'}>();
  for (const p of v.pools) {
    if (!exact(p, ['poolId', 'eventId', 'kind']) || !uuid(p.poolId) || !uuid(p.eventId) || !v.eventIds.includes(p.eventId) || (p.kind !== 'q' && p.kind !== 'side') || pools.has(p.poolId)) return false;
    pools.set(p.poolId, {eventId: p.eventId, kind: p.kind});
  }
  const sources = new Set<string>(), evidence = new Set<string>(); let allocations = 0;
  for (const s of v.sources) {
    if (!exact(s, ['sourceId', 'physicalEvidenceId', 'kind', 'amountMinor', 'state', 'allocations']) || !uuid(s.sourceId) || !uuid(s.physicalEvidenceId)
      || sources.has(s.sourceId) || evidence.has(s.physicalEvidenceId) || typeof s.kind !== 'string' || !['entry_receipt', 'expense', 'additional_income'].includes(s.kind)
      || !positive(s.amountMinor) || (s.state !== 'active' && s.state !== 'voided') || !Array.isArray(s.allocations) || Reflect.ownKeys(s.allocations).length !== s.allocations.length + 1) return false;
    sources.add(s.sourceId); evidence.add(s.physicalEvidenceId); allocations += s.allocations.length;
    if (allocations > 50000 || (s.state === 'voided' && s.allocations.length !== 0)) return false;
    const seen = new Set<string>(); let sum = BigInt(0);
    for (const a of s.allocations) {
      if (!exact(a, ['eventId', 'bucket', 'poolId', 'amountMinor', 'classificationReviewed']) || !uuid(a.eventId) || !v.eventIds.includes(a.eventId) || typeof a.bucket !== 'string' || !buckets.includes(a.bucket as typeof buckets[number])
        || !positive(a.amountMinor) || typeof a.classificationReviewed !== 'boolean' || ((a.bucket === 'q' || a.bucket === 'side') ? !uuid(a.poolId) : a.poolId !== null)) return false;
      if (s.kind === 'entry_receipt' ? !['regular_entry', 'q', 'side'].includes(a.bucket) : s.kind === 'expense' ? !['player_benefit', 'operating_expense'].includes(a.bucket) : !['unrestricted_income', 'restricted_income'].includes(a.bucket)) return false;
      if (a.bucket === 'q' || a.bucket === 'side') { const pool = pools.get(a.poolId as string); if (!pool || pool.eventId !== a.eventId || pool.kind !== a.bucket) return false; }
      const key = `${a.eventId}:${a.bucket}:${a.poolId}`; if (seen.has(key)) return false; seen.add(key); sum += BigInt(a.amountMinor);
    }
    if (s.state === 'active' && sum !== BigInt(s.amountMinor)) return false;
  }
  return true;
}
export function projectEventLedgerV1(input: unknown) {
  if (!exact(input, ['eventId', 'current', 'retained']) || !uuid(input.eventId) || !snapshot(input.current) || !snapshot(input.retained)) return { status: 'blocked' as const, code: 'invalid_or_incomplete_ledger' };
  if (canonical(input.current) !== canonical(input.retained)) return { status: 'blocked' as const, code: 'source_changed' };
  if (!input.current.eventIds.includes(input.eventId)) return { status: 'blocked' as const, code: 'event_not_in_ledger_scope' };
  const totals = Object.fromEntries(buckets.map(b => [b, BigInt(0)])) as Record<typeof buckets[number], bigint>;
  const sourceIds: string[] = [], poolTotals = new Map<string, { kind: 'q' | 'side'; poolId: string; amountMinor: bigint }>();
  let reviewRequired = false;
  for (const s of input.current.sources) {
    if (s.state === 'voided') continue;
    let included = false;
    for (const a of s.allocations) if (a.eventId === input.eventId) {
      included = true; totals[a.bucket] += BigInt(a.amountMinor);
      if (!a.classificationReviewed || a.bucket === 'restricted_income') reviewRequired = true;
      if (a.bucket === 'q' || a.bucket === 'side') {
        const key = `${a.bucket}:${a.poolId}`, existing = poolTotals.get(key);
        poolTotals.set(key, { kind: a.bucket, poolId: a.poolId!, amountMinor: (existing?.amountMinor ?? BigInt(0)) + BigInt(a.amountMinor) });
      }
    }
    if (included) sourceIds.push(s.sourceId);
  }
  const fund = totals.regular_entry - totals.player_benefit - totals.operating_expense + totals.unrestricted_income;
  if ([...Object.values(totals), fund].some(n => n > BigInt(Number.MAX_SAFE_INTEGER) || n < -BigInt(Number.MAX_SAFE_INTEGER))) return { status: 'blocked' as const, code: 'unsafe_total' };
  if (fund < BigInt(0)) reviewRequired = true;
  return { status: 'projected' as const, eventId: input.eventId, tournamentId: input.current.tournamentId, sourceDigest: input.current.sourceDigest,
    sourceVersion: input.current.sourceVersion, mode: input.current.mode, totals: Object.fromEntries(Object.entries(totals).map(([k, n]) => [k, Number(n)])), regularFundMinor: Number(fund),
    poolTotals: [...poolTotals.values()].map(p => ({ ...p, amountMinor: Number(p.amountMinor) })), sourceIds, reviewRequired,
    awardCalculationAllowed: !reviewRequired, receiptAuthority: false as const, accBenefitApprovalClaimed: false as const, finalizationAllowed: false as const, moneyMoved: false as const };
}
