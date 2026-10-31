/**
 * Observed ACC side-pool raw weights with an APP-OWNED rounding modification.
 * This version is not an ACC endorsement or a universal ACC payout mandate.
 * Source: retained public prizeWizard observation, reviewed 2026-10-29.
 *
 * Standalone amount calculation only: no recipient selection, score ties,
 * regular playoff prizes, equal Q, saved policy, obligation or payment writes.
 */
export const accWeightedPoolVersion = 'acc-weighted-largest-remainder-5usd-v1' as const;
export const accWeightedPoolMaximumPaidCount = 256;
export type AccWeightedPoolInput = { paidCount: number; feeMinor: 1000 | 2000 | 5000; ratio: 4 | 6 };
export type AccWeightedPoolFraction = { numeratorMinor: string; denominator: string };
export type AccWeightedPoolCalculation = {
  status: 'calculated'; policyVersion: typeof accWeightedPoolVersion; currency: 'USD';
  paidCount: number; feeMinor: AccWeightedPoolInput['feeMinor']; ratio: 4 | 6;
  recipientCount: number; fundMinor: number; roundingUnitMinor: 500;
  branch: 'single_recipient' | 'descending_linear' | 'entry_fee_floor';
  /** Total award by finishing place, highest first; never incremental prizes. */
  awardsMinor: number[];
  /** Reduced exact raw weights, before this app's balanced $5 rounding. */
  unroundedAwards: AccWeightedPoolFraction[];
};
export type AccWeightedPoolResult = AccWeightedPoolCalculation | {
  status: 'blocked'; code: 'invalid_input' | 'unsupported_paid_count' | 'unsupported_fee'
    | 'unsupported_ratio' | 'unsupported_lattice' | 'fund_below_fee_floor';
};

const unit = BigInt(500);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function gcd(a: bigint, b: bigint): bigint { while (b !== BigInt(0)) { const r = a % b; a = b; b = r; } return a; }
function fraction(numerator: bigint, denominator: bigint): AccWeightedPoolFraction {
  const factor = gcd(numerator, denominator);
  return { numeratorMinor: String(numerator / factor), denominator: String(denominator / factor) };
}

/**
 * Domain is deliberately bounded as an application limit, not an ACC limit.
 * Fee/count determine the fund; a caller cannot override or round away the pot.
 * Fractional-remainder ties favor the higher finishing place. This is a rounding
 * convention, not a sporting tiebreak or a rule for equal elimination cohorts.
 */
export function calculateAccWeightedPool(input: unknown): AccWeightedPoolResult {
  if (!object(input) || Reflect.ownKeys(input).length !== 3
    || !['paidCount', 'feeMinor', 'ratio'].every(k => Object.hasOwn(input, k))
    || ![input.paidCount, input.feeMinor, input.ratio].every(n => typeof n === 'number' && Number.isSafeInteger(n)))
    return { status: 'blocked', code: 'invalid_input' };
  const { paidCount, feeMinor, ratio } = input as AccWeightedPoolInput;
  if (paidCount < 1 || paidCount > accWeightedPoolMaximumPaidCount) return { status: 'blocked', code: 'unsupported_paid_count' };
  if (![1000, 2000, 5000].includes(feeMinor)) return { status: 'blocked', code: 'unsupported_fee' };
  if (ratio !== 4 && ratio !== 6) return { status: 'blocked', code: 'unsupported_ratio' };
  const n = BigInt(paidCount), fee = BigInt(feeMinor), r = BigInt(ratio);
  const fund = n * fee, count = (n + r - BigInt(1)) / r;
  // Explicit fail-closed boundaries, also protecting future domain extensions.
  if (fund % unit !== BigInt(0) || fee % unit !== BigInt(0)) return { status: 'blocked', code: 'unsupported_lattice' };
  if (fund < count * fee) return { status: 'blocked', code: 'fund_below_fee_floor' };

  const divisor = count * (count + BigInt(1)) / BigInt(2);
  const branch = count === BigInt(1) ? 'single_recipient' : fund > divisor * fee ? 'descending_linear' : 'entry_fee_floor';
  const raw = Array.from({ length: Number(count) }, (_, index) => {
    const place = BigInt(index + 1);
    if (branch === 'single_recipient') return { numerator: fund, denominator: BigInt(1) };
    if (branch === 'descending_linear') return { numerator: fund * (count - place + BigInt(1)), denominator: divisor };
    const denominator = divisor - count;
    return { numerator: fee * denominator + (fund - fee * count) * (count - place), denominator };
  });
  const rounded = raw.map((a, index) => {
    const floorUnits = a.numerator / (a.denominator * unit);
    return { index, amount: floorUnits * unit, remainder: a.numerator - floorUnits * unit * a.denominator, denominator: a.denominator };
  });
  const floorSum = rounded.reduce((s, a) => s + a.amount, BigInt(0));
  const missingUnits = (fund - floorSum) / unit;
  if (floorSum > fund || (fund - floorSum) % unit !== BigInt(0) || missingUnits < BigInt(0) || missingUnits >= count)
    throw new Error('ACC-weighted balanced-rounding invariant failed.');
  const priority = [...rounded].sort((a, b) => {
    const difference = a.remainder * b.denominator - b.remainder * a.denominator;
    return difference > BigInt(0) ? -1 : difference < BigInt(0) ? 1 : a.index - b.index;
  });
  for (let i = 0; i < Number(missingUnits); i++) rounded[priority[i].index].amount += unit;
  if (rounded.reduce((s, a) => s + a.amount, BigInt(0)) !== fund
    || rounded.some((a, i) => a.amount < fee || a.amount % unit !== BigInt(0) || (i > 0 && a.amount > rounded[i - 1].amount)))
    throw new Error('ACC-weighted award conservation, ordering or fee-floor invariant failed.');
  return {
    status: 'calculated', policyVersion: accWeightedPoolVersion, currency: 'USD', paidCount, feeMinor, ratio,
    recipientCount: Number(count), fundMinor: Number(fund), roundingUnitMinor: 500, branch,
    awardsMinor: rounded.map(a => Number(a.amount)), unroundedAwards: raw.map(a => fraction(a.numerator, a.denominator)),
  };
}
