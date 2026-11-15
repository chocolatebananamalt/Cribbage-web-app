/** Pure v2 read-only calculator. Does not reinterpret historical v1 review RPCs.
 * Friend-supplied operating policies, approved 2026-10-29; not an ACC mandate.
 * Chart cells must be visually verified before a caller may offer a schedule.
 */
export type QCardV2 = {
  participantId: string;
  gamePoints: number;
  gamesWon: number;
  /** Sum of positive winning margins; never net spread. */
  plusPoints: number;
  qualified: boolean;
  /** Existing finalized playoff order, separate from the Q card tie order. */
  qualificationRank: number | null;
};
export type QCutV2 = {
  /** Exact numerically tied group, ordered by observed physical cut, low first. */
  participantIdsLowFirst: string[];
  recordedBy: string;
  reason: string;
};
export type QContributionV2 = { participantId: string; amountMinor: number };
export type QChartCellV2 = {
  scheduleId: string;
  sourceReference: string;
  feeMinor: number;
  ratio: 4 | 6;
  paidCount: number;
  /** Exact chart dollars converted once to integer cents, not derived weights. */
  awardsMinor: number[];
};
export type QOperatingPolicyV2 =
  | { method: "equal-paid-playoff-qualifiers-v2"; feeMinor: number }
  | { method: "graduated-paid-card-rank-v2"; feeMinor: number; ratio: 4 | 6; scheduleId: string };
type QAmountV2 = { participantId: string; amountMinor: number };
export type QOperatingResultV2 =
  | { status: "blocked"; code: "invalid_input" | "cut_review_required" | "chart_review_required" | "unbalanced_chart" }
  | { status: "preview"; fundMinor: number; awards: QAmountV2[]; refunds: QAmountV2[]; moneyMoved: false };
const whole = (n: number, minimum = 0) => Number.isSafeInteger(n) && n >= minimum;
const text = (s: string) => typeof s === "string" && s.trim().length > 0;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function validCards(cards: QCardV2[]): boolean {
  return Array.isArray(cards) && cards.every(c => object(c) && text(c.participantId) && whole(c.gamePoints) && whole(c.gamesWon) && whole(c.plusPoints)
    && typeof c.qualified === "boolean" && (c.qualified ? whole(c.qualificationRank as number, 1) : c.qualificationRank === null)
    && c.gamePoints >= c.gamesWon * 2 && c.gamePoints <= c.gamesWon * 3)
    && new Set(cards.map(c => c.participantId)).size === cards.length
    && new Set(cards.filter(c => c.qualified).map(c => c.qualificationRank)).size === cards.filter(c => c.qualified).length;
}
const compareCard = (a: QCardV2, b: QCardV2) => b.gamePoints - a.gamePoints || b.gamesWon - a.gamesWon || b.plusPoints - a.plusPoints;

/** Never uses identifier, net spread, input order or random values as a tie break. */
export function orderQCardsV2(cards: QCardV2[], cuts: QCutV2[]): QCardV2[] | null {
  if (!validCards(cards) || !Array.isArray(cuts) || cuts.some(c => !object(c) || !Array.isArray(c.participantIdsLowFirst)
    || !c.participantIdsLowFirst.every(text) || !text(c.recordedBy) || !text(c.reason))) return null;
  const sorted = [...cards].sort(compareCard), result: QCardV2[] = [];
  const usedCuts = new Set<QCutV2>();
  for (let i = 0; i < sorted.length;) {
    let end = i + 1;
    while (end < sorted.length && compareCard(sorted[i], sorted[end]) === 0) end++;
    const group = sorted.slice(i, end);
    if (group.length > 1) {
      const members = new Set(group.map(c => c.participantId));
      const matches = cuts.filter(c => Array.isArray(c.participantIdsLowFirst) && c.participantIdsLowFirst.length === group.length
        && new Set(c.participantIdsLowFirst).size === group.length && c.participantIdsLowFirst.every(id => members.has(id)));
      if (matches.length !== 1 || !text(matches[0].recordedBy) || !text(matches[0].reason)) return null;
      const cut = matches[0]; usedCuts.add(cut);
      result.push(...cut.participantIdsLowFirst.map(id => group.find(c => c.participantId === id)!));
    } else result.push(group[0]);
    i = end;
  }
  // Extra or stale cut evidence is not silently applied to a different group.
  return usedCuts.size === cuts.length ? result : null;
}

export function previewQOperatingScheduleV2(input: {
  policy: QOperatingPolicyV2; cards: QCardV2[]; contributions: QContributionV2[];
  cuts: QCutV2[]; chart: QChartCellV2 | null;
}): QOperatingResultV2 {
  if (!object(input)) return { status: "blocked", code: "invalid_input" };
  const { policy, cards, contributions, cuts, chart } = input;
  if (!object(policy) || !whole(policy.feeMinor, 1) || !validCards(cards) || !Array.isArray(contributions) || !Array.isArray(cuts)
    || !["equal-paid-playoff-qualifiers-v2", "graduated-paid-card-rank-v2"].includes(policy.method)
    || (policy.method === "graduated-paid-card-rank-v2" && (![4, 6].includes(policy.ratio) || !text(policy.scheduleId)))
    || contributions.some(c => !object(c) || !text(c.participantId) || c.amountMinor !== policy.feeMinor || !cards.some(r => r.participantId === c.participantId))
    || new Set(contributions.map(c => c.participantId)).size !== contributions.length) return { status: "blocked", code: "invalid_input" };
  const fund = BigInt(contributions.length) * BigInt(policy.feeMinor);
  if (fund > BigInt(Number.MAX_SAFE_INTEGER)) return { status: "blocked", code: "invalid_input" };
  const paid = new Set(contributions.map(c => c.participantId));
  // A different pool's/unpaid card never creates a tie-resolution prerequisite.
  const candidates = cards.filter(c => paid.has(c.participantId) && (policy.method !== "equal-paid-playoff-qualifiers-v2" || c.qualified));
  const rankedPaid = policy.method === "equal-paid-playoff-qualifiers-v2"
    ? (cuts.length ? null : [...candidates].sort((a, b) => a.qualificationRank! - b.qualificationRank!))
    : orderQCardsV2(candidates, cuts);
  if (!rankedPaid) return { status: "blocked", code: "cut_review_required" };
  const fundMinor = Number(fund);
  if (policy.method === "equal-paid-playoff-qualifiers-v2") {
    const eligible = rankedPaid.filter(c => c.qualified);
    if (!eligible.length) return { status: "preview", fundMinor, awards: [], refunds: contributions.map(c => ({ ...c })), moneyMoved: false };
    const each = Math.floor(fundMinor / eligible.length), remainder = fundMinor % eligible.length;
    return { status: "preview", fundMinor, awards: eligible.map((c, i) => ({ participantId: c.participantId, amountMinor: each + (i < remainder ? 1 : 0) })), refunds: [], moneyMoved: false };
  }
  const count = Math.ceil(contributions.length / policy.ratio);
  if (!object(chart) || chart.scheduleId !== policy.scheduleId || !text(chart.sourceReference) || chart.feeMinor !== policy.feeMinor
    || chart.ratio !== policy.ratio || chart.paidCount !== contributions.length || !Array.isArray(chart.awardsMinor) || chart.awardsMinor.length !== count)
    return { status: "blocked", code: "chart_review_required" };
  if (chart.awardsMinor.some((n, i) => !whole(n, 1) || (i > 0 && n > chart.awardsMinor[i - 1]))
    || chart.awardsMinor.reduce((sum, n) => sum + BigInt(n), BigInt(0)) !== fund)
    return { status: "blocked", code: "unbalanced_chart" };
  return { status: "preview", fundMinor, awards: rankedPaid.slice(0, count).map((c, i) => ({ participantId: c.participantId, amountMinor: chart.awardsMinor[i] })), refunds: [], moneyMoved: false };
}
