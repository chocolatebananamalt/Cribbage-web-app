/** Director-approved app rounding, not an ACC-mandated prize allocation.
 * Pure arithmetic only: no receipts, funding certification or finalization.
 */
export const regularPrizeRoundingVersionV3 = 'regular-prize-cohort-5usd-v3' as const;
export const regularPrizeRoundingMaximumMinorV3 = 10_000_000;
export type RegularPrizeCohortV3 = { bandStart: number; bandEnd: number; weight: number };
export type RegularPrizeFractionV3 = { numeratorMinor: string; denominator: string };
export type RegularPrizeRoundingInputV3 = {
 grossBaseIncomeMinor: number; expenseTotalMinor: number; benefitExpenseMinor: number;
 expectedQualifierCount: 4 | 5; cohorts: RegularPrizeCohortV3[];
};
export type RegularPrizeRoundingResultV3 = { status: 'blocked'; code: 'invalid_input' | 'invalid_financial_basis' | 'unsupported_scope' | 'unsupported_computational_domain' | 'insufficient_award_budget' | 'minimum_return_unmet' | 'unsafe_result' } | {
 status: 'calculated'; policyVersion: typeof regularPrizeRoundingVersionV3; currency: 'USD'; amountBasis: 'total_award';
 expectedQualifierCount: 4 | 5; grossBaseIncomeMinor: number; expenseTotalMinor: number; benefitExpenseMinor: number;
 originalBudgetMinor: number; roundedBudgetMinor: number; roundingUnitMinor: 500; direction: 'up' | 'down' | 'unchanged';
 adjustmentMinor: number; requiredFundingMinor: number; restrictedBalanceMinor: number;
 minimumReturnMinor: number; participantReturnMinor: number; awardsMinor: number[];
 cohorts: Array<RegularPrizeCohortV3 & { recipientCount: number; awardMinor: number; rawAward: RegularPrizeFractionV3; absoluteDeviation: RegularPrizeFractionV3 }>;
 objective: RegularPrizeFractionV3;
};
const zero = BigInt(0), one = BigInt(1), unit = BigInt(500), maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: string[]) => Reflect.ownKeys(v).length === expected.length && expected.every(k => Object.hasOwn(v, k));
const integer = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const abs = (n: bigint) => n < zero ? -n : n;
function fraction(n: bigint, d: bigint): RegularPrizeFractionV3 { let a = n, b = d; while (b !== zero) { const r = a % b; a = b; b = r; } const g = a || one; return { numeratorMinor: String(n / g), denominator: String(d / g) }; }
/** Mathematical floor, including negative breakpoints. */
function floor(n: bigint, d: bigint) { const q = n / d; return n < zero && n % d !== zero ? q - one : q; }

/** Exact global minimization on a documented bounded computational domain.
 * Let c be the common 3rd/4th award in $5 units, and d the optional 5th.
 * For fixed c,d, S=x1+x2 and x2 is in [c,floor(S/2)]. Its objective is
 * |D*x2-(D*S-T*w1)|+|D*x2-T*w2|, so a best integer x2 occurs at a bound or
 * adjacent integer to either root. For five places, each such candidate family
 * leaves a convex sum of absolute affine functions in d; the upper x2 bound
 * splits into two parities. Endpoints and integers within two of its roots
 * cover every branch minimum and the lexicographic extreme of a flat minimum.
 * Thus only c is enumerated (at most 5,000 values for a $100,000 target), not
 * the quadratic c,d lattice. Larger targets fail closed, never approximate.
 */
export function calculateRegularPrizeRoundingV3(input: unknown): RegularPrizeRoundingResultV3 {
 const blocked = (code: Extract<RegularPrizeRoundingResultV3, { status: 'blocked' }>['code']): RegularPrizeRoundingResultV3 => ({ status: 'blocked', code });
 if (!object(input) || !keys(input, ['grossBaseIncomeMinor', 'expenseTotalMinor', 'benefitExpenseMinor', 'expectedQualifierCount', 'cohorts'])
  || !integer(input.grossBaseIncomeMinor, 1) || !integer(input.expenseTotalMinor) || !integer(input.benefitExpenseMinor)) return blocked('invalid_input');
 if (input.expectedQualifierCount !== 4 && input.expectedQualifierCount !== 5) return blocked('unsupported_scope');
 const expected = input.expectedQualifierCount, bands = expected === 4 ? [[1, 1], [2, 2], [3, 4]] : [[1, 1], [2, 2], [3, 4], [5, 5]];
 if (!Array.isArray(input.cohorts) || input.cohorts.length !== bands.length || !input.cohorts.every((c, i) => object(c) && keys(c, ['bandStart', 'bandEnd', 'weight']) && c.bandStart === bands[i][0] && c.bandEnd === bands[i][1] && integer(c.weight, 1))) return blocked('unsupported_scope');
 const cohorts = input.cohorts as RegularPrizeCohortV3[], gross = BigInt(input.grossBaseIncomeMinor), expense = BigInt(input.expenseTotalMinor), benefit = BigInt(input.benefitExpenseMinor);
 if (expense > gross || benefit > expense) return blocked('invalid_financial_basis');
 const budget = gross - expense, minimum = (BigInt(85) * gross + BigInt(99)) / BigInt(100), down = budget / unit * unit;
 const target = down + benefit >= minimum ? down : (budget + unit - one) / unit * unit;
 if (target > BigInt(regularPrizeRoundingMaximumMinorV3)) return blocked('unsupported_computational_domain');
 if (target < BigInt(expected) * unit) return blocked('insufficient_award_budget');
 if (target + benefit < minimum) return blocked('minimum_return_unmet');
 if (target + benefit > maxSafe) return blocked('unsafe_result');
 const total = Number(target / unit), multiplicities = expected === 4 ? [1, 1, 2] : [1, 1, 2, 1], weights = cohorts.map(c => BigInt(c.weight));
 const divisor = weights.reduce((sum, w, i) => sum + w * BigInt(multiplicities[i]), zero), raw = weights.map(w => BigInt(total) * w);
 let best: number[] | null = null, bestCost: bigint | null = null;
 const consider = (values: number[]) => {
  if (values.some((n, i) => !Number.isInteger(n) || n < 1 || (i > 0 && n > values[i - 1])) || values.reduce((sum, n, i) => sum + n * multiplicities[i], 0) !== total) return;
  const cost = values.reduce((sum, n, i) => sum + BigInt(multiplicities[i]) * abs(BigInt(n) * divisor - raw[i]), zero);
  if (bestCost === null || cost < bestCost || (cost === bestCost && best && values.some((n, i) => n !== best![i] && values.slice(0, i).every((v, j) => v === best![j]) && n > best![i]))) { best = values; bestCost = cost; }
 };
 const near = (n: bigint, d: bigint) => { const f = floor(n, d); return [Number(f), Number(f + one)]; };
 const pair = (c: number, d?: number) => {
  const sum = total - 2 * c - (d ?? 0), options = new Set([c, Math.floor(sum / 2), ...near(raw[1], divisor), ...near(BigInt(sum) * divisor - raw[0], divisor)]);
  for (const second of options) consider(d === undefined ? [sum - second, second, c] : [sum - second, second, c, d]);
 };
 for (let c = 1; c <= Math.floor((total - (expected === 5 ? 1 : 0)) / 4); c++) {
  if (expected === 4) { pair(c); continue; }
  const maximum = Math.min(c, total - 4 * c), candidates = new Set<number>();
  const add = (n: bigint, d = one) => { const f = floor(n, d); for (let k = -2; k <= 2; k++) { const value = Number(f) + k; if (value >= 1 && value <= maximum) candidates.add(value); } };
  add(one); add(BigInt(maximum)); add(raw[3], divisor);
  // x2=c; x2=floor(S/2), with both S parities.
  add(BigInt(total - 3 * c) * divisor - raw[0], divisor);
  for (const parity of [0, 1]) { add(BigInt(total - 2 * c + parity) * divisor - BigInt(2) * raw[0], divisor); add(BigInt(total - 2 * c - parity) * divisor - BigInt(2) * raw[1], divisor); }
  // Constant x2 adjacent to its raw share; constant x1 adjacent to its raw share.
  for (const second of near(raw[1], divisor)) { add(BigInt(total - 2 * c - 2 * second)); add(BigInt(total - 2 * c - second) * divisor - raw[0], divisor); }
  for (const first of near(raw[0], divisor)) { add(BigInt(total - 2 * c - 2 * first)); add(BigInt(total - 3 * c - first)); add(BigInt(total - 2 * c - first) * divisor - raw[1], divisor); }
  for (const d of candidates) pair(c, d);
 }
 if (!best || bestCost === null) return blocked('insufficient_award_budget');
 const selected: number[] = best, delta = target - budget;
 return { status: 'calculated', policyVersion: regularPrizeRoundingVersionV3, currency: 'USD', amountBasis: 'total_award', expectedQualifierCount: expected,
  grossBaseIncomeMinor: input.grossBaseIncomeMinor, expenseTotalMinor: input.expenseTotalMinor, benefitExpenseMinor: input.benefitExpenseMinor,
  originalBudgetMinor: Number(budget), roundedBudgetMinor: Number(target), roundingUnitMinor: 500, direction: delta > zero ? 'up' : delta < zero ? 'down' : 'unchanged',
  adjustmentMinor: Number(delta), requiredFundingMinor: Number(delta > zero ? delta : zero), restrictedBalanceMinor: Number(delta < zero ? -delta : zero),
  minimumReturnMinor: Number(minimum), participantReturnMinor: Number(target + benefit), awardsMinor: selected.flatMap((n, i) => Array(multiplicities[i]).fill(n * 500)),
  cohorts: cohorts.map((c, i) => ({ ...c, recipientCount: multiplicities[i], awardMinor: selected[i] * 500, rawAward: fraction(target * weights[i], divisor), absoluteDeviation: fraction(abs(BigInt(selected[i]) * unit * divisor - target * weights[i]), divisor) })),
  objective: fraction(bestCost * unit, divisor) };
}

/** A calculated audit is accepted only if every field equals recomputation.
 * Object key order is irrelevant; extra fields, changed funding or awards fail.
 */
export function isRegularPrizeRoundingV3(value: unknown): value is Extract<RegularPrizeRoundingResultV3, { status: 'calculated' }> {
 if (!object(value) || value.status !== 'calculated' || !Array.isArray(value.cohorts) || value.cohorts.length > 4 || !value.cohorts.every(object)) return false;
 try {
  const result = calculateRegularPrizeRoundingV3({ grossBaseIncomeMinor: value.grossBaseIncomeMinor, expenseTotalMinor: value.expenseTotalMinor, benefitExpenseMinor: value.benefitExpenseMinor, expectedQualifierCount: value.expectedQualifierCount,
   cohorts: value.cohorts.map(c => ({ bandStart: c.bandStart, bandEnd: c.bandEnd, weight: c.weight })) });
  if (result.status !== 'calculated') return false;
  const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : object(v) ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v);
  return canonical(value) === canonical(result);
 } catch { return false; }
}
