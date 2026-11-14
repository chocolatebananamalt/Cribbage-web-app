/** Test-only workbook distribution comparison. Never an operating policy or
 * recipient selector. Existing disclosed methods/history remain untouched. */
export const workbookSideComparisonVersion = "sheet-side-floor20-threshold40-lr5-comparison-v1" as const;
export const workbookSideComparisonEvidence = Object.freeze({
  source: "Parent-verified native Sheet recalculation, separate private test copy; reference unchanged",
  sourceUrl: "https://docs.google.com/spreadsheets/d/1HlDFQxNEWjm_oG62ocq4XYCvwa6xgy0U0OsE515vXrc/edit",
  verifiedSummary: "Counts 12-30, $10, 1-in-6: 19 balanced schedules; 10 differ from current app; conserving rounding reproduces all 19",
  localLiveRecalculation: false, fullObservedOutputArraysReceived: false,
  minimumCount: 12, maximumCount: 30, feeMinor: 1000, ratio: 6,
  fixedLastPlaceBaselineMinor: 2000, strictLinearBranchThresholdMinor: 4000,
});
type Fraction = { numeratorMinor: string; denominator: string };
export type WorkbookSideComparison = { status: "blocked"; code: "invalid_input" | "unverified_count" | "unverified_fee" | "unverified_ratio" | "unverified_source_branch" } | {
  status: "comparison"; comparisonVersion: typeof workbookSideComparisonVersion; currency: "USD";
  paidCount: number; feeMinor: 1000; ratio: 6; recipientCount: number; fundMinor: number;
  branch: "fixed_20_dollar_baseline"; baselineMinor: 2000; roundingUnitMinor: 500;
  rawAwards: Fraction[]; awardsMinor: number[];
  reconstructedNearestAwardsMinor: number[]; reconstructedNearestDifferenceMinor: number;
  testOnly: true; operationalPolicyAdopted: false; recipientSelectionPerformed: false; moneyMoved: false;
};
const zero = BigInt(0), one = BigInt(1), unit = BigInt(500), baseline = BigInt(2000), threshold = BigInt(4000);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function reduced(n: bigint, d: bigint): Fraction { let a = n, b = d; while (b !== zero) { const x = a % b; a = b; b = x; } return { numeratorMinor: String(n / a), denominator: String(d / a) }; }

/** Only the independently reported 19-case domain is offered. In particular a
 * $5 pool is NOT rescaled or silently given an entry-fee floor instead of $20. */
export function calculateWorkbookSideComparisonV1(value: unknown): WorkbookSideComparison {
  if (!object(value) || Reflect.ownKeys(value).length !== 3 || !["paidCount", "feeMinor", "ratio"].every(k => Object.hasOwn(value, k))
    || ![value.paidCount, value.feeMinor, value.ratio].every(n => typeof n === "number" && Number.isSafeInteger(n))) return { status: "blocked", code: "invalid_input" };
  if (Number(value.paidCount) < 12 || Number(value.paidCount) > 30) return { status: "blocked", code: "unverified_count" };
  if (value.feeMinor !== 1000) return { status: "blocked", code: "unverified_fee" };
  if (value.ratio !== 6) return { status: "blocked", code: "unverified_ratio" };
  const count = Number(value.paidCount), n = BigInt(count), fund = n * BigInt(1000), k = (n + BigInt(5)) / BigInt(6), triangular = k * (k + one) / BigInt(2);
  // Strictly greater is the Sheet's linear branch. None of the verified19
  // cases enter it; do not claim coverage of an untested alternative branch.
  if (fund > triangular * threshold || k < BigInt(2) || fund < k * baseline) return { status: "blocked", code: "unverified_source_branch" };
  const denominator = triangular - k, surplus = fund - k * baseline;
  const raw = Array.from({ length: Number(k) }, (_, i) => baseline * denominator + surplus * (k - BigInt(i) - one));
  const amounts = raw.map(n => n / (denominator * unit) * unit);
  const missing = (fund - amounts.reduce((a, b) => a + b, zero)) / unit;
  const priority = raw.map((n, index) => ({ index, remainder: n % (denominator * unit) })).sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.index - b.index);
  for (let i = 0; i < Number(missing); i++) amounts[priority[i].index] += unit;
  if (amounts.reduce((a, b) => a + b, zero) !== fund || amounts.some((a, i) => a < baseline || a % unit !== zero || i > 0 && a > amounts[i - 1])) throw new Error("Workbook comparison invariants failed");
  const nearest = raw.map(n => (BigInt(2) * n + denominator * unit) / (BigInt(2) * denominator * unit) * unit);
  return { status: "comparison", comparisonVersion: workbookSideComparisonVersion, currency: "USD", paidCount: count, feeMinor: 1000, ratio: 6,
    recipientCount: Number(k), fundMinor: Number(fund), branch: "fixed_20_dollar_baseline", baselineMinor: 2000, roundingUnitMinor: 500,
    rawAwards: raw.map(n => reduced(n, denominator)), awardsMinor: amounts.map(Number), reconstructedNearestAwardsMinor: nearest.map(Number),
    reconstructedNearestDifferenceMinor: Number(nearest.reduce((a, b) => a + b, zero) - fund),
    testOnly: true, operationalPolicyAdopted: false, recipientSelectionPerformed: false, moneyMoved: false };
}
