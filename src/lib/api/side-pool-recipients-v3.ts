import { isUuid } from "./validation.ts";
import { calculateGraduatedPoolAmountsV2 } from "../results/graduated-pool-amounts-v2.ts";

export const sidePoolRecipientMethodV3 = "paid-qualifying-cards-no-cutoff-v3" as const;

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: RecordValue, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const minor = (value: unknown, max = 100_000_000) => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max;
const safeMinor = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const positive = (value: unknown, max = 100_000) => Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= max;
const text = (value: unknown, max = 500) => typeof value === "string" && value.length > 0 && value.length <= max && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
const digest = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export type SidePoolRecipientPublishRequestV3 = {
  amountPolicyId: string;
  method: typeof sidePoolRecipientMethodV3;
  disclosureReference: string;
  disclosed: true;
};
export type SidePoolRecipientReviewRequestV3 = {
  expectedVersion: number;
  sourceDigest: string;
  reason: string;
  reviewed: true;
};
export type SidePoolRecipientMutationV3 = { eventId: string; poolId: string } & (
  | { action: "publish_policy"; request: SidePoolRecipientPublishRequestV3 }
  | { action: "review"; request: SidePoolRecipientReviewRequestV3 }
);

export function isSidePoolRecipientMutationV3(value: unknown): value is SidePoolRecipientMutationV3 {
  if (!record(value) || !exact(value, ["eventId", "poolId", "action", "request"]) || !isUuid(value.eventId) || !isUuid(value.poolId) || !record(value.request)) return false;
  const request = value.request;
  if (value.action === "publish_policy") return exact(request, ["amountPolicyId", "method", "disclosureReference", "disclosed"])
    && isUuid(request.amountPolicyId) && request.method === sidePoolRecipientMethodV3 && text(request.disclosureReference) && request.disclosed === true;
  return value.action === "review" && exact(request, ["expectedVersion", "sourceDigest", "reason", "reviewed"])
    && Number.isSafeInteger(request.expectedVersion) && (request.expectedVersion as number) >= 0 && (request.expectedVersion as number) <= 255
    && digest(request.sourceDigest) && text(request.reason) && request.reviewed === true;
}

export type SidePoolRecipientObligationV3 = {
  participantId: string;
  displayName: string;
  poolRank: number;
  qualified: boolean;
  amountMinor: number;
  status: "unpaid";
};
export type SidePoolRecipientPolicyV3 = {
  id: string;
  method: typeof sidePoolRecipientMethodV3;
  amountPolicyId: string;
  disclosureReference: string;
  publishedAt: string;
};
export type SidePoolRecipientHistoryV3 = {
  id: string;
  version: number;
  sourceDigest: string;
  current: boolean;
  obligations: SidePoolRecipientObligationV3[];
  status: "unpaid";
  reason: string;
  recordedAt: string;
};
export type SidePoolRecipientWorkspaceV3 = {
  tournamentId: string;
  eventId: string;
  poolId: string;
  policyId: string | null;
  recipientPolicyId: string | null;
  feeMinor: number;
  ratio: number | null;
  recipientPolicy: SidePoolRecipientPolicyV3 | null;
  qualificationId: string | null;
  sourceDigest: string;
  blockers: string[];
  fundMinor: number | null;
  obligations: SidePoolRecipientObligationV3[];
  moneyMoved: false;
  history: SidePoolRecipientHistoryV3[];
};

function isObligation(value: unknown, rank?: number): value is SidePoolRecipientObligationV3 {
  return record(value) && exact(value, ["participantId", "displayName", "poolRank", "qualified", "amountMinor", "status"])
    && isUuid(value.participantId) && text(value.displayName, 200) && positive(value.poolRank)
    && (rank === undefined || value.poolRank === rank) && typeof value.qualified === "boolean" && safeMinor(value.amountMinor) && value.status === "unpaid";
}
function isObligationList(value: unknown): value is SidePoolRecipientObligationV3[] {
  return Array.isArray(value) && value.length <= 10_000 && value.every((item, index) => isObligation(item, index + 1))
    && new Set(value.map((item) => item.participantId)).size === value.length;
}
function isRecipientPolicy(value: unknown): value is SidePoolRecipientPolicyV3 {
  return record(value) && exact(value, ["id", "method", "amountPolicyId", "disclosureReference", "publishedAt"])
    && isUuid(value.id) && value.method === sidePoolRecipientMethodV3 && isUuid(value.amountPolicyId)
    && text(value.disclosureReference) && typeof value.publishedAt === "string" && Number.isFinite(Date.parse(value.publishedAt));
}
function isHistory(value: unknown): value is SidePoolRecipientHistoryV3 {
  return record(value) && exact(value, ["id", "version", "sourceDigest", "current", "obligations", "status", "reason", "recordedAt"])
    && isUuid(value.id) && positive(value.version, 256) && digest(value.sourceDigest) && typeof value.current === "boolean"
    && isObligationList(value.obligations) && value.status === "unpaid" && text(value.reason)
    && typeof value.recordedAt === "string" && Number.isFinite(Date.parse(value.recordedAt));
}

export function isSidePoolRecipientWorkspaceV3(value: unknown, tournamentId: string, eventId: string, poolId: string): value is SidePoolRecipientWorkspaceV3 {
  if (!record(value) || !exact(value, ["tournamentId", "eventId", "poolId", "policyId", "recipientPolicyId", "feeMinor", "ratio", "recipientPolicy", "qualificationId", "sourceDigest", "blockers", "fundMinor", "obligations", "moneyMoved", "history"])) return false;
  const ratio = value.ratio, blockers = value.blockers, fundMinor = value.fundMinor;
  if (value.tournamentId !== tournamentId || value.eventId !== eventId || value.poolId !== poolId || ![tournamentId, eventId, poolId].every(isUuid)
    || !(value.policyId === null || isUuid(value.policyId)) || !(value.recipientPolicyId === null || isUuid(value.recipientPolicyId))
    || !minor(value.feeMinor) || !(ratio === null || typeof ratio === "number" && positive(ratio, 100) && ratio >= 2) || !(value.recipientPolicy === null || isRecipientPolicy(value.recipientPolicy))
    || !(value.qualificationId === null || isUuid(value.qualificationId)) || !digest(value.sourceDigest)
    || !Array.isArray(blockers) || blockers.some((item) => typeof item !== "string" || !/^[a-z_]+$/.test(item))
    || !(fundMinor === null ? value.policyId === null || Array.isArray(blockers) && blockers.includes("unsupported_payout_domain") : safeMinor(fundMinor))
    || !isObligationList(value.obligations) || value.moneyMoved !== false || !Array.isArray(value.history)
    || value.history.length > 256 || !value.history.every(isHistory)) return false;
  if ((value.recipientPolicy === null) !== (value.recipientPolicyId === null)) return false;
  if ((value.policyId === null) !== (value.ratio === null)) return false;
  if (value.recipientPolicy && (value.recipientPolicy.id !== value.recipientPolicyId || value.recipientPolicy.amountPolicyId !== value.policyId)) return false;
  const checkedBlockers = blockers as string[], checkedFundMinor = fundMinor as number | null;
  const checkedObligations = value.obligations as SidePoolRecipientObligationV3[], checkedHistory = value.history as SidePoolRecipientHistoryV3[];
  if (checkedBlockers.length === 0) {
    if (checkedFundMinor === null || !positive(value.feeMinor, 100_000_000) || !positive(ratio, 100)) return false;
    const fee = value.feeMinor as number, checkedRatio = ratio as number;
    const paidCount = checkedFundMinor / fee;
    if (!Number.isSafeInteger(paidCount)) return false;
    const calculation = calculateGraduatedPoolAmountsV2({ paidCount, feeMinor: fee, ratio: checkedRatio });
    if (calculation.status !== "calculated" || calculation.fundMinor !== checkedFundMinor || checkedObligations.length !== calculation.recipientCount
      || checkedObligations.some((item, index) => item.poolRank !== index + 1 || item.amountMinor !== calculation.awardsMinor[index])
      || checkedObligations.reduce((sum, item) => sum + BigInt(item.amountMinor), BigInt(0)) !== BigInt(checkedFundMinor)) return false;
  }
  for (let i = 1; i < checkedHistory.length; i++) if (checkedHistory[i - 1].version !== checkedHistory[i].version + 1) return false;
  if (checkedHistory.some(item => item.current !== (item.sourceDigest === value.sourceDigest && checkedBlockers.length === 0))) return false;
  const current = checkedHistory.find(item => item.current);
  if (current && (current.version !== checkedHistory[0]?.version || current.obligations.length !== checkedObligations.length
    || current.obligations.some((item, index) => {
      const sourceItem = checkedObligations[index];
      return !sourceItem || item.participantId !== sourceItem.participantId || item.displayName !== sourceItem.displayName
        || item.poolRank !== sourceItem.poolRank || item.qualified !== sourceItem.qualified || item.amountMinor !== sourceItem.amountMinor || item.status !== sourceItem.status;
    }))) return false;
  return true;
}

const rejectedCodes = [
  "idempotency_conflict", "invalid_request", "amount_policy_required", "policy_frozen", "collection_or_play_started",
  "accounting_already_finalized", "source_blocked", "source_changed", "stale_version", "already_reviewed",
];
export type SidePoolRecipientResultV3 =
  | { status: "rejected"; code: (typeof rejectedCodes)[number] }
  | { status: "side_pool_recipient_policy_frozen"; policyId: string; poolId: string; moneyMoved: false }
  | { status: "side_pool_recipients_reviewed_unpaid"; reviewId: string; poolId: string; version: number; sourceDigest: string; obligations: SidePoolRecipientObligationV3[]; moneyMoved: false };

export function isSidePoolRecipientResultV3(value: unknown): value is SidePoolRecipientResultV3 {
  if (!record(value)) return false;
  if (value.status === "rejected") return exact(value, ["status", "code"]) && rejectedCodes.includes(value.code as string);
  if (value.moneyMoved !== false || !isUuid(value.poolId)) return false;
  if (value.status === "side_pool_recipient_policy_frozen") return exact(value, ["status", "policyId", "poolId", "moneyMoved"]) && isUuid(value.policyId);
  return value.status === "side_pool_recipients_reviewed_unpaid" && exact(value, ["status", "reviewId", "poolId", "version", "sourceDigest", "obligations", "moneyMoved"])
    && isUuid(value.reviewId) && positive(value.version, 256) && digest(value.sourceDigest) && isObligationList(value.obligations);
}

export function sidePoolRecipientResultMatchesV3(result: SidePoolRecipientResultV3, mutation: SidePoolRecipientMutationV3) {
  if (result.status === "rejected") return true;
  if (result.poolId !== mutation.poolId) return false;
  return mutation.action === "publish_policy"
    ? result.status === "side_pool_recipient_policy_frozen"
    : result.status === "side_pool_recipients_reviewed_unpaid" && result.version === mutation.request.expectedVersion + 1 && result.sourceDigest === mutation.request.sourceDigest;
}

export function isSidePoolRecipientReconciliationV3(value: unknown, mutation: SidePoolRecipientMutationV3): value is { authorized: true; result: SidePoolRecipientResultV3 | null } {
  return record(value) && exact(value, ["authorized", "result"]) && value.authorized === true
    && (value.result === null || isSidePoolRecipientResultV3(value.result) && sidePoolRecipientResultMatchesV3(value.result, mutation));
}
