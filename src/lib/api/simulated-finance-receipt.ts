import { isUuid } from "./validation.ts";

export type ReceiptSelectorEvent = {
  eventId: string; baseFeeMinor: number; eventStarted: boolean; financialClosed: boolean;
  pools: { kind: "q" | "side"; feeMinor: number; policyId: string | null }[];
  participants: { participantId: string; rosterEntryId: string; receiptRecorded: boolean; elections: { policyId: string; electionId: string; elected: boolean }[] }[];
};

/** Build one conserved receipt only from current server-provided selections.
 * Actual eligibility and freshness remain independently enforced by the RPC. */
export function buildSimulatedPoolReceipt(events: ReceiptSelectorEvent[], rosterEntryId: string, reason: string) {
  if (!isUuid(rosterEntryId) || !Array.isArray(events) || events.length < 1 || events.length > 32
    || new Set(events.map(e => e.eventId)).size !== events.length) return null;
  const lines = [];
  let amountMinor = 0;
  for (const event of events) {
    if (!isUuid(event.eventId) || event.eventStarted !== false || event.financialClosed !== false || !Number.isSafeInteger(event.baseFeeMinor) || event.baseFeeMinor < 1
      || event.baseFeeMinor > 99_999_999 || !Array.isArray(event.pools) || event.pools.length > 8
      || !Array.isArray(event.participants)) return null;
    const matches = event.participants.filter(p => p.rosterEntryId === rosterEntryId);
    if (matches.length !== 1 || !isUuid(matches[0].participantId) || matches[0].receiptRecorded !== false) return null;
    const votes = matches[0].elections;
    if (!Array.isArray(votes) || votes.length !== event.pools.length) return null;
    const q: { policyId: string; electionId: string; amountMinor: number }[] = [];
    const side: typeof q = [];
    const used = new Set<string>();
    for (const pool of event.pools) {
      if (!isUuid(pool.policyId) || used.has(pool.policyId) || !["q", "side"].includes(pool.kind)
        || !Number.isSafeInteger(pool.feeMinor) || pool.feeMinor < 500 || pool.feeMinor % 500 !== 0) return null;
      used.add(pool.policyId);
      const vote = votes.filter(v => v.policyId === pool.policyId);
      if (vote.length !== 1 || !isUuid(vote[0].electionId) || typeof vote[0].elected !== "boolean") return null;
      if (vote[0].elected) (pool.kind === "q" ? q : side).push({ policyId: pool.policyId, electionId: vote[0].electionId, amountMinor: pool.feeMinor });
    }
    if (q.length > 2 || side.length > 6) return null;
    amountMinor += event.baseFeeMinor + [...q, ...side].reduce((sum, p) => sum + p.amountMinor, 0);
    lines.push({ eventId: event.eventId, baseMinor: event.baseFeeMinor, q, side });
  }
  if (!Number.isSafeInteger(amountMinor) || amountMinor > 99_999_999 || !reason.startsWith("TEST ONLY SYNTHETIC:")
    || reason !== reason.trim() || !reason.slice(20).trim() || reason.length > 500 || /[\u0000-\u001f\u007f]/.test(reason)) return null;
  return { rosterEntryId, amountMinor, events: lines, reason, reviewed: true as const };
}
