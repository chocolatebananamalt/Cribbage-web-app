/** Local amount-only comparison, not an operating payout method or recipient
 * selector. No existing method, disclosure, accounting or history is changed. */
export const workbookSatelliteComparisonVersionV1 = "sheet-satellite-125pct-threshold50-lr5-comparison-v1" as const;
export const workbookSatelliteEvidenceV1 = Object.freeze({
  sourceUrl: "https://docs.google.com/spreadsheets/d/1HlDFQxNEWjm_oG62ocq4XYCvwa6xgy0U0OsE515vXrc/edit",
  sourceTab: "Satellite", sourceInputs: "I15 entrants; I16 fee; I17 ratio; I18 ROUNDUP; I28 net event fund",
  source: "Parent-verified native Sheet formula mapping; reference unchanged",
  localLiveRecalculation: false, fullObservedInputOutputArraysReceived: false,
  sourceAwardRows: 30, thresholdMinor: 5000, baselineNumerator: 5, baselineDenominator: 4,
  ratioMinimumPolicyEstablished: false, operationalPolicyAdopted: false,
});
export type WorkbookSatelliteInputV1 = {
  entrantCount: number; feeMinor: number; ratio: number; fundMinor: number;
  rankingState: "individual_ranks" | "unresolved_ties";
};
type Fraction = { numeratorMinor: string; denominator: string };
export type WorkbookSatelliteModelV1 = {
  recipientCount: number; fundMinor: number; branch: "descending_linear" | "entry_125pct_baseline";
  baselineMinor: Fraction; rawAwards: Fraction[];
  reconstructedNearestAwardsMinor: number[]; reconstructedNearestDifferenceMinor: number;
};
type Notice = { testOnly: true; operationalPolicyAdopted: false; recipientSelectionPerformed: false; moneyMoved: false };
export type WorkbookSatelliteComparisonV1 = Notice & (
  { status: "blocked"; code: "invalid_input" | "unresolved_ties" | "one_recipient_undefined" | "source_row_limit"
    | "fund_below_source_baseline" | "fund_not_multiple_of_5" | "zero_rounded_award_unresolved"
    | "rounded_baseline_unresolved" | "unsafe_result"; sourceModel?: WorkbookSatelliteModelV1 }
  | { status: "comparison"; comparisonVersion: typeof workbookSatelliteComparisonVersionV1; currency: "USD";
    entrantCount: number; feeMinor: number; ratio: number; rankingState: "individual_ranks";
    sourceModel: WorkbookSatelliteModelV1; roundingUnitMinor: 500; awardsMinor: number[] }
);
const zero = BigInt(0), one = BigInt(1), two = BigInt(2), four = BigInt(4), five = BigInt(5);
const unit = BigInt(500), threshold = BigInt(5000), safe = BigInt(Number.MAX_SAFE_INTEGER);
const notice: Notice = { testOnly: true, operationalPolicyAdopted: false, recipientSelectionPerformed: false, moneyMoved: false };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min: number): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min;
function fraction(n: bigint, d: bigint): Fraction {
  let a = n, b = d; while (b !== zero) { const r = a % b; a = b; b = r; }
  const divisor = a || one; return { numeratorMinor: String(n / divisor), denominator: String(d / divisor) };
}

/** The ratio is a mathematical input, not an ACC minimum or permission to use
 * that ratio in an event. F is the caller's separate Satellite net fund, never
 * an optional Q/Side fund. Unknown sporting ties cannot be allocated here.
 * Remainder ties favor higher rank; they are not sporting tie-breakers. */
export function calculateWorkbookSatelliteComparisonV1(input: unknown): WorkbookSatelliteComparisonV1 {
  type Code = Extract<WorkbookSatelliteComparisonV1, { status: "blocked" }> ["code"];
  const blocked = (code: Code, sourceModel?: WorkbookSatelliteModelV1): WorkbookSatelliteComparisonV1 =>
    ({ ...notice, status: "blocked", code, ...(sourceModel ? { sourceModel } : {}) });
  const keys = ["entrantCount", "feeMinor", "ratio", "fundMinor", "rankingState"];
  if (!object(input) || Reflect.ownKeys(input).length !== keys.length || !keys.every(k => Object.hasOwn(input, k))
    || !integer(input.entrantCount, 1) || !integer(input.feeMinor, 1) || !integer(input.ratio, 1) || !integer(input.fundMinor, 0)
    || input.rankingState !== "individual_ranks" && input.rankingState !== "unresolved_ties") return blocked("invalid_input");
  if (input.rankingState === "unresolved_ties") return blocked("unresolved_ties");
  const { entrantCount, feeMinor, ratio, fundMinor } = input as WorkbookSatelliteInputV1;
  const n = BigInt(entrantCount), fee = BigInt(feeMinor), divisor = BigInt(ratio), fund = BigInt(fundMinor);
  const count = (n + divisor - one) / divisor;
  if (count === one) return blocked("one_recipient_undefined");
  // Coverage of the actual Sheet award table, not an ACC field-size limit.
  if (count > BigInt(workbookSatelliteEvidenceV1.sourceAwardRows)) return blocked("source_row_limit");
  const triangular = count * (count + one) / two;
  const linear = fund > triangular * threshold;
  if (!linear && fund * four < five * fee * count) return blocked("fund_below_source_baseline");
  // Common denominator allows exact rational baseline, including fractional cents.
  const denominator = linear ? triangular : four * (triangular - count);
  const raw = Array.from({ length: Number(count) }, (_, index) => {
    const position = BigInt(index + 1);
    return linear ? (count + one - position) * fund
      : five * fee * (triangular - count) + (four * fund - five * fee * count) * (count - position);
  });
  const nearest = raw.map(v => (two * v + denominator * unit) / (two * denominator * unit) * unit);
  const nearestTotal = nearest.reduce((a, b) => a + b, zero);
  if (nearestTotal > safe || nearest.some(v => v > safe)) return blocked("unsafe_result");
  const sourceModel: WorkbookSatelliteModelV1 = {
    recipientCount: Number(count), fundMinor, branch: linear ? "descending_linear" : "entry_125pct_baseline",
    baselineMinor: fraction(five * fee, four), rawAwards: raw.map(v => fraction(v, denominator)),
    reconstructedNearestAwardsMinor: nearest.map(Number), reconstructedNearestDifferenceMinor: Number(nearestTotal - fund),
  };
  // Do not invent a residual account, borrow from another pool or silently
  // change F. The raw/nearest reference is diagnostic, not an awarded schedule.
  if (fund % unit !== zero) return blocked("fund_not_multiple_of_5", sourceModel);
  const awards = raw.map(v => v / (denominator * unit) * unit);
  const missing = (fund - awards.reduce((a, b) => a + b, zero)) / unit;
  const priority = raw.map((v, index) => ({ index, remainder: v % (denominator * unit) }))
    .sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.index - b.index);
  for (let i = 0; i < Number(missing); i++) awards[priority[i].index] += unit;
  if (awards.some(v => v === zero)) return blocked("zero_rounded_award_unresolved", sourceModel);
  // Is 125% only an unrounded baseline or a post-round minimum? Do not decide
  // this by letting conservation silently push an award below the baseline.
  if (!linear && awards.some(v => v * four < five * fee)) return blocked("rounded_baseline_unresolved", sourceModel);
  if (awards.reduce((a, b) => a + b, zero) !== fund || awards.some((v, i) => v < zero || v % unit !== zero || i > 0 && v > awards[i - 1]))
    throw new Error("Satellite comparison conservation/order invariant failed");
  return { ...notice, status: "comparison", comparisonVersion: workbookSatelliteComparisonVersionV1, currency: "USD",
    entrantCount, feeMinor, ratio, rankingState: "individual_ranks", sourceModel, roundingUnitMinor: 500, awardsMinor: awards.map(Number) };
}
