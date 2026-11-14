/**
 * Unpublished custom-ratio amount-only candidate for Q and Side Pools.
 * Observed ACC raw weights plus application-owned exact largest-remainder $5
 * rounding. This is not ACC endorsement and never selects eligible recipients.
 * Historical v1/v2 remain independent and unchanged. New disclosure and source-bound review are required; this file grants no operating authority.
 */
export const customGraduatedAmountsVersionV3 = 'graduated-custom-ratio-largest-remainder-5usd-v3' as const;
/** PostgreSQL integer storage limit, not an ACC or director policy maximum. */
export const customGraduatedMaximumRatioV3 = 2_147_483_647;
export const customGraduatedMaximumPaidCountV3 = 10_000;
export const customGraduatedMaximumFeeMinorV3 = 100_000_000;
export type CustomGraduatedAmountsInputV3 = { paidCount: number; feeMinor: number; ratio: number };
export type CustomGraduatedAmountsCalculationV3 = {
  status: 'calculated'; policyVersion: typeof customGraduatedAmountsVersionV3; currency: 'USD';
  paidCount: number; feeMinor: number; ratio: number; recipientCount: number; fundMinor: number;
  roundingUnitMinor: 500; branch: 'empty_pool' | 'single_recipient' | 'descending_linear' | 'entry_fee_floor';
  moneyMoved: false;
  /** Total awards in recipient order, never incremental amounts. */
  awardsMinor: number[];
  unroundedAwards: Array<{ numeratorMinor: string; denominator: string }>;
};
export type CustomGraduatedAmountsResultV3 = CustomGraduatedAmountsCalculationV3 | {
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
export function calculateCustomGraduatedAmountsV3(input: unknown): CustomGraduatedAmountsResultV3 {
  if (!object(input) || Reflect.ownKeys(input).length !== 3
    || !['paidCount', 'feeMinor', 'ratio'].every(k => Object.hasOwn(input, k))
    || ![input.paidCount, input.feeMinor, input.ratio].every(n => typeof n === 'number' && Number.isSafeInteger(n)))
    return { status: 'blocked', code: 'invalid_input' };
  const { paidCount, feeMinor, ratio } = input as CustomGraduatedAmountsInputV3;
  if (paidCount < 0 || paidCount > customGraduatedMaximumPaidCountV3) return { status: 'blocked', code: 'unsupported_paid_count' };
  if (feeMinor < 500 || feeMinor > customGraduatedMaximumFeeMinorV3) return { status: 'blocked', code: 'unsupported_fee' };
  if (ratio < 1 || ratio > customGraduatedMaximumRatioV3) return { status: 'blocked', code: 'unsupported_ratio' };
  if (feeMinor % 500 !== 0) return { status: 'blocked', code: 'unsupported_lattice' };
  if (paidCount === 0) return {
    status: 'calculated', policyVersion: customGraduatedAmountsVersionV3, currency: 'USD', paidCount, feeMinor, ratio,
    recipientCount: 0, fundMinor: 0, roundingUnitMinor: 500, branch: 'empty_pool', moneyMoved: false,
    awardsMinor: [], unroundedAwards: [],
  };
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
    status: 'calculated', policyVersion: customGraduatedAmountsVersionV3, currency: 'USD',
    paidCount, feeMinor, ratio, recipientCount: Number(count), fundMinor: Number(fund), roundingUnitMinor: 500, branch,
    moneyMoved: false,
    awardsMinor: rounded.map(a => Number(a.amount)), unroundedAwards: raw.map(a => fraction(a.numerator, a.denominator)),
  };
}
