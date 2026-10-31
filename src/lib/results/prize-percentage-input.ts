import { combineSemifinalChartShares } from "./prize-schedule.ts";

/** Exact percentage text to basis points; no scientific notation or rounding. */
export function parsePrizePercentBasisPoints(value: string): number | null {
  if (typeof value !== "string") return null;
  const match = /^(0|[1-9]\d{0,2})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const basisPoints = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(basisPoints) && basisPoints > 0 && basisPoints <= 10000 ? basisPoints : null;
}

export function semifinalWeightsFromPercentText(values: readonly string[]): [number, number, number] | null {
  if (!Array.isArray(values) || values.length !== 4) return null;
  const shares = values.map(parsePrizePercentBasisPoints);
  return shares.every((share): share is number => share !== null) ? combineSemifinalChartShares(shares) : null;
}
