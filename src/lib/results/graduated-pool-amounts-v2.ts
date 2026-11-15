/**
 * Shared amount-only policy for newly disclosed graduated Q and Side Pools.
 * Observed ACC raw weights plus application-owned exact largest-remainder $5
 * rounding. This is not ACC endorsement and never selects eligible recipients.
 * Historical v1 remains independent and unchanged.
 */
export const graduatedPoolAmountsVersionV2 = 'graduated-acc-weighted-largest-remainder-5usd-v2' as const;
export const graduatedPoolMaximumPaidCountV2 = 10_000;
export const graduatedPoolMaximumFeeMinorV2 = 100_000_000;
export type GraduatedPoolAmountsInputV2 = { paidCount: number; feeMinor: number; ratio: number };
export type GraduatedPoolAmountsCalculationV2 = {
  status: 'calculated'; policyVersion: typeof graduatedPoolAmountsVersionV2; currency: 'USD';
  paidCount: number; feeMinor: number; ratio: number; recipientCount: number; fundMinor: number;
  roundingUnitMinor: 500; branch: 'single_recipient' | 'descending_linear' | 'entry_fee_floor';
  moneyMoved: false;
  /** Total awards in recipient order, never incremental amounts. */
  awardsMinor: number[];
  unroundedAwards: Array<{ numeratorMinor: string; denominator: string }>;
};
export type GraduatedPoolAmountsResultV2 = GraduatedPoolAmountsCalculationV2 | {
  status: 'blocked'; code: 'invalid_input' | 'unsupported_paid_count' | 'unsupported_fee'
    | 'unsupported_ratio' | 'unsupported_lattice' | 'fund_below_fee_floor';
};
const zero = BigInt(0), one = BigInt(1), unit = BigInt(500);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function fraction(n: bigint, d: bigint) {
  let a = n, b = d;
  while (b !== zero) { const remainder = a % b; a = b; b = remainder; }
  return { numeratorMinor: String(n / a), denominator: String(d / a) };
}

/** Fee/count determine the complete fund; external funds and adjustments are
 * not accepted. Exact-remainder ties favor higher place, not a sporting tie.
 */
export function calculateGraduatedPoolAmountsV2(input: unknown): GraduatedPoolAmountsResultV2 {
  if (!object(input) || Reflect.ownKeys(input).length !== 3
    || !['paidCount', 'feeMinor', 'ratio'].every(k => Object.hasOwn(input, k))
    || ![input.paidCount, input.feeMinor, input.ratio].every(n => typeof n === 'number' && Number.isSafeInteger(n)))
    return { status: 'blocked', code: 'invalid_input' };
  const { paidCount, feeMinor, ratio } = input as GraduatedPoolAmountsInputV2;
  if (paidCount < 1 || paidCount > graduatedPoolMaximumPaidCountV2) return { status: 'blocked', code: 'unsupported_paid_count' };
  if (feeMinor < 500 || feeMinor > graduatedPoolMaximumFeeMinorV2) return { status: 'blocked', code: 'unsupported_fee' };
  if (ratio < 2 || ratio > 100) return { status: 'blocked', code: 'unsupported_ratio' };
  if (feeMinor % 500 !== 0) return { status: 'blocked', code: 'unsupported_lattice' };
  const n = BigInt(paidCount), fee = BigInt(feeMinor), r = BigInt(ratio);
  const fund = n * fee, count = (n + r - one) / r;
  if (fund < count * fee) return { status: 'blocked', code: 'fund_below_fee_floor' };
  const divisor = count * (count + one) / BigInt(2);
  const branch = count === one ? 'single_recipient' : fund > divisor * fee ? 'descending_linear' : 'entry_fee_floor';
  const raw = Array.from({ length: Number(count) }, (_, index) => {
    const place = BigInt(index + 1);
    if (branch === 'single_recipient') return { numerator: fund, denominator: one };
    if (branch === 'descending_linear') return { numerator: fund * (count - place + one), denominator: divisor };
    const denominator = divisor - count;
    return { numerator: fee * denominator + (fund - fee * count) * (count - place), denominator };
  });
  const rounded = raw.map((a, index) => {
    const floorUnits = a.numerator / (a.denominator * unit);
    return { index, amount: floorUnits * unit, remainder: a.numerator % (a.denominator * unit), denominator: a.denominator };
  });
  const floorSum = rounded.reduce((sum, a) => sum + a.amount, zero);
  const missingUnits = (fund - floorSum) / unit;
  if (floorSum > fund || (fund - floorSum) % unit !== zero || missingUnits < zero || missingUnits >= count)
    throw new Error('Graduated pool balanced-rounding invariant failed.');
  const priority = [...rounded].sort((a, b) => {
    const difference = a.remainder * b.denominator - b.remainder * a.denominator;
    return difference > zero ? -1 : difference < zero ? 1 : a.index - b.index;
  });
  for (let i = 0; i < Number(missingUnits); i++) rounded[priority[i].index].amount += unit;
  if (rounded.reduce((sum, a) => sum + a.amount, zero) !== fund
    || rounded.some((a, i) => a.amount < fee || a.amount % unit !== zero || (i > 0 && a.amount > rounded[i - 1].amount)))
    throw new Error('Graduated pool conservation, order or fee-floor invariant failed.');
  return {
    status: 'calculated', policyVersion: graduatedPoolAmountsVersionV2, currency: 'USD',
    paidCount, feeMinor, ratio, recipientCount: Number(count), fundMinor: Number(fund), roundingUnitMinor: 500, branch,
    moneyMoved: false,
    awardsMinor: rounded.map(a => Number(a.amount)), unroundedAwards: raw.map(a => fraction(a.numerator, a.denominator)),
  };
}
