import { isUuid } from "./validation.ts";

function obj(x: unknown): x is Record<string, unknown> { return !!x && typeof x === "object" && !Array.isArray(x); }
const text = (x: unknown, max: number) => typeof x === "string" && x.trim().length > 0 && x.length <= max;
const count = (x: unknown, max: number) => typeof x === "number" && Number.isSafeInteger(x) && x >= 0 && x <= max;
const maybeUuid = (x: unknown) => x === null || isUuid(x);

/** Reject stale, partial, cross-event or oversized selector payloads. */
export function isSimulatedFinanceSelector(value: unknown, tournamentId: string, eventId: string): boolean {
  if (!obj(value)) return false;
  if (value.status === "blocked") return typeof value.code === "string" && /^[a-z_]{1,80}$/.test(value.code);
  if (value.status !== "available" || value.tournamentId !== tournamentId || value.eventId !== eventId
    || !text(value.eventName, 200) || !count(value.baseFeeMinor, 100_000_000)
    || value.moneyMoved !== false || value.humanConsentClaimed !== false || value.accountingAvailable !== false
    || value.writerRoleRequired !== "director" || typeof value.financialClosed !== "boolean" || typeof value.eventStarted !== "boolean" || typeof value.anyReceiptRecorded !== "boolean" || !count(value.expenseReviewVersion, 256)
    || !(value.sanctioningAssessmentMinor === null || count(value.sanctioningAssessmentMinor, 100_000_000))
    || !Array.isArray(value.pools) || value.pools.length > 8
    || !Array.isArray(value.participants) || value.participants.length > 256 || !obj(value.sources)) return false;
  const sources = value.sources;
  if (!(sources.status === "available" || sources.status === "blocked") || sources.tournamentId !== tournamentId
    || sources.eventId !== eventId || sources.moneyMoved !== false || sources.humanConsentClaimed !== false
    || sources.accountingAvailable !== false || typeof sources.sourceDigest !== "string"
    || !/^[a-f0-9]{64}$/.test(sources.sourceDigest) || !Array.isArray(sources.blockers)
    || !sources.blockers.every(x => typeof x === "string" && /^[a-z_]{1,80}$/.test(x))
    || !Array.isArray(sources.expenseEvidence) || sources.expenseEvidence.length > 256
    || !sources.expenseEvidence.every(x => obj(x) && isUuid(x.id) && x.kind === "expense" && count(x.amountMinor, 99_999_999)
      && Number(x.amountMinor) > 0 && typeof x.reason === "string" && x.reason.startsWith("TEST ONLY SYNTHETIC:") && x.reason.length <= 500)
    || new Set(sources.expenseEvidence.map(x => x.id)).size !== sources.expenseEvidence.length) return false;
  if (!value.pools.every(p => obj(p) && (p.kind === "q" || p.kind === "side") && count(p.slot, p.kind === "q" ? 2 : 6) && Number(p.slot) > 0
    && text(p.name, 160) && isUuid(p.definitionId) && (p.type === null || text(p.type, 160))
    && count(p.feeMinor, 100_000_000) && maybeUuid(p.policyId)
    && ((p.policyId === null && p.policyMethod === null && p.policyRatio === null)
      || (isUuid(p.policyId) && ((p.kind === "q" && p.policyMethod === "equal-paid-playoff-qualifiers-v2" && p.policyRatio === null)
        || (p.policyMethod === "graduated-acc-weighted-largest-remainder-5usd-v2" && typeof p.policyRatio === "number"
          && (p.kind === "q" ? [4, 6] : [4, 6, 8, 10]).includes(p.policyRatio))))))) return false;
  const policies = value.pools.flatMap(p => p.policyId === null ? [] : [p.policyId]);
  if (new Set(policies).size !== policies.length) return false;
  if (!value.participants.every(p => obj(p) && isUuid(p.participantId) && isUuid(p.rosterEntryId) && text(p.name, 160)
    && (p.status === "registered" || p.status === "checked_in") && typeof p.receiptRecorded === "boolean" && Array.isArray(p.elections) && p.elections.length <= 8
    && p.elections.every(e => obj(e) && isUuid(e.policyId) && policies.includes(e.policyId) && isUuid(e.electionId) && count(e.version, 256)
      && Number(e.version) >= 1 && typeof e.elected === "boolean")
    && new Set(p.elections.map(e => e.policyId)).size === p.elections.length
    && new Set(p.elections.map(e => e.electionId)).size === p.elections.length)) return false;
  return new Set(value.pools.map(p => p.definitionId)).size === value.pools.length
    && new Set(value.pools.map(p => `${p.kind}:${p.slot}`)).size === value.pools.length
    && new Set(value.participants.map(p => p.participantId)).size === value.participants.length
    && new Set(value.participants.map(p => p.rosterEntryId)).size === value.participants.length;
}

/** Limit the response to the independently validated selector DTO. Source
 * details need their own complete codec before they can be used or returned. */
export function projectSimulatedFinanceSelector(value: Record<string, unknown>) {
  if (value.status === "blocked") return { status: value.status, code: value.code };
  const sources = value.sources as Record<string, unknown>;
  return { status: value.status, tournamentId: value.tournamentId, eventId: value.eventId, eventName: value.eventName,
    baseFeeMinor: value.baseFeeMinor, pools: (value.pools as Record<string, unknown>[]).map(p => ({ kind: p.kind, slot: p.slot, name: p.name, definitionId: p.definitionId, type: p.type, feeMinor: p.feeMinor, policyId: p.policyId, policyMethod: p.policyMethod, policyRatio: p.policyRatio })),
    participants: (value.participants as Record<string, unknown>[]).map(p => ({ participantId: p.participantId, rosterEntryId: p.rosterEntryId, name: p.name, status: p.status, receiptRecorded: p.receiptRecorded, elections: (p.elections as Record<string, unknown>[]).map(e => ({ policyId: e.policyId, electionId: e.electionId, version: e.version, elected: e.elected })) })),
    sources: { status: sources.status, sourceDigest: sources.sourceDigest, blockers: sources.blockers,
      expenses: (sources.expenseEvidence as Record<string, unknown>[]).map(x => ({ id: x.id, amountMinor: x.amountMinor, reason: x.reason })) },
    financialClosed: value.financialClosed, eventStarted: value.eventStarted, anyReceiptRecorded: value.anyReceiptRecorded, expenseReviewVersion: value.expenseReviewVersion, sanctioningAssessmentMinor: value.sanctioningAssessmentMinor, writerRoleRequired: value.writerRoleRequired,
    moneyMoved: false, humanConsentClaimed: false, accountingAvailable: false };
}

export function isProjectedSimulatedFinanceSelector(value: unknown, tournamentId: string, eventId: string): boolean {
  if (!obj(value)) return false;
  if (value.status === "blocked") return isSimulatedFinanceSelector(value, tournamentId, eventId);
  if (!obj(value.sources)) return false;
  return isSimulatedFinanceSelector({ ...value, sources: { ...value.sources, expenseEvidence: Array.isArray(value.sources.expenses) ? value.sources.expenses.map(x => obj(x) ? { ...x, kind: "expense" } : x) : null, tournamentId, eventId,
    moneyMoved: false, humanConsentClaimed: false, accountingAvailable: false } }, tournamentId, eventId);
}
