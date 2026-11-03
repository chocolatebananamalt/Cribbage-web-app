import { isUuid } from "./validation.ts";

export function simulatedDollars(input: string): number | null {
  const m = /^(0|[1-9]\d{0,5})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const amount = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= 99_999_999 ? amount : null;
}
export function buildSimulatedExpense(allocations: {eventId: string; amountMinor: number}[], reason: string) {
  if (!allocations.length || allocations.length > 32 || !allocations.every(x => isUuid(x.eventId) && Number.isSafeInteger(x.amountMinor) && x.amountMinor > 0 && x.amountMinor <= 99_999_999)
    || new Set(allocations.map(x => x.eventId)).size !== allocations.length) return null;
  const amountMinor = allocations.reduce((a,x) => a + x.amountMinor, 0);
  if (amountMinor > 99_999_999 || !reason.startsWith("TEST ONLY SYNTHETIC:") || !reason.slice(20).trim()) return null;
  return { kind: "expense" as const, rosterEntryId: null, amountMinor, allocations, reason, reviewed: true as const };
}
export type ExpenseSplit = { sourceId: string; sourceMinor: number; operating: number; player_benefit: number; sanctioning: number };
export function buildSimulatedClassification(splits: ExpenseSplit[], assessment: number, sourceDigest: string, expectedVersion: number, reason: string) {
  if (!Array.isArray(splits) || splits.length > 256 || !Number.isSafeInteger(assessment) || assessment < 0
    || !/^[a-f0-9]{64}$/.test(sourceDigest) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || expectedVersion > 255
    || !reason.startsWith("TEST ONLY SYNTHETIC:") || !reason.slice(20).trim() || new Set(splits.map(x => x.sourceId)).size !== splits.length) return null;
  const classifications: {sourceId:string;category:string;amountMinor:number}[] = [];
  let sanction = 0;
  for (const row of splits) {
    if (!isUuid(row.sourceId) || !Number.isSafeInteger(row.sourceMinor) || row.sourceMinor <= 0
      || ![row.operating,row.player_benefit,row.sanctioning].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 99_999_999)
      || row.operating + row.player_benefit + row.sanctioning !== row.sourceMinor) return null;
    sanction += row.sanctioning;
    for (const category of ["operating", "player_benefit", "sanctioning"] as const) if (row[category]) classifications.push({ sourceId: row.sourceId, category, amountMinor: row[category] });
  }
  if (sanction !== assessment) return null;
  return { expectedVersion, sourceDigest, classifications, reason, reviewed: true as const };
}
