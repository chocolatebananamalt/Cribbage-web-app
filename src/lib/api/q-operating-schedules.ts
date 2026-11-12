import { isUuid } from "./validation.ts";
import { isQPoolMembershipWorkspace, type QPoolMembershipWorkspace } from "./q-pool-membership.ts";
import type { QCardV2 } from "../results/q-operating-schedule.ts";
import { accWeightedPoolVersion } from "../results/acc-weighted-pool.ts";

export const equalQMethodV2 = "equal-paid-playoff-qualifiers-v2" as const;
export const graduatedQMethodV2 = "graduated-paid-card-rank-v2" as const;
export type QOperatingMethodV2 = typeof equalQMethodV2 | typeof graduatedQMethodV2;
export type QOperatingPolicyRecordV2 = {
  id: string; poolVersionId: string; method: QOperatingMethodV2; ratio: 4 | 6 | null;
  scheduleId: string | null; disclosureReference: string; publishedAt: string;
};
export type QOperatingCutRecordV2 = {
  poolVersionId: string; sourceDigest: string; participantIdsLowFirst: string[]; recordedBy: string; reason: string;
};
export type QOperatingWorkspaceV2 = {
  tournamentId: string; membership: QPoolMembershipWorkspace | null; canPublish: boolean;
  policies: QOperatingPolicyRecordV2[]; cards: QCardV2[]; cuts: QOperatingCutRecordV2[];
  sourceDigest: string; blockers: string[];
};
export type QOperatingRequestV2 = {
  action: "publish"; poolVersionId: string; method: QOperatingMethodV2; ratio: 4 | 6 | null;
  scheduleId: string | null; disclosureReference: string; disclosed: true;
} | {
  action: "cut"; poolVersionId: string; expectedSourceDigest: string; participantIdsLowFirst: string[]; reason: string;
};
export type QOperatingResultV2 =
  | { status: "q_policy_published"; policyId: string; poolVersionId: string }
  | { status: "q_cut_recorded"; cutId: string; poolVersionId: string }
  | { status: "rejected"; code: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const whole = (v: unknown, minimum = 0): v is number => Number.isSafeInteger(v) && (v as number) >= minimum;
const text = (v: unknown, max = 500): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.length >= 2 && v.length <= 256 && v.every(isUuid) && new Set(v).size === v.length;
function policyFields(v: Record<string, unknown>, allowBalanced = false) {
  if (allowBalanced && v.method === accWeightedPoolVersion) return (v.ratio === 4 || v.ratio === 6) && v.scheduleId === accWeightedPoolVersion;
  return v.method === equalQMethodV2 ? v.ratio === null && v.scheduleId === null
    : v.method === graduatedQMethodV2 && (v.ratio === 4 || v.ratio === 6)
      && typeof v.scheduleId === "string" && /^[a-z0-9][a-z0-9-]{0,99}$/.test(v.scheduleId);
}
export function isQOperatingRequestV2(v: unknown): v is QOperatingRequestV2 {
  if (!object(v) || !isUuid(v.poolVersionId)) return false;
  if (v.action === "publish") return exact(v, ["action", "poolVersionId", "method", "ratio", "scheduleId", "disclosureReference", "disclosed"])
    && policyFields(v) && text(v.disclosureReference) && v.disclosed === true;
  return v.action === "cut" && exact(v, ["action", "poolVersionId", "expectedSourceDigest", "participantIdsLowFirst", "reason"])
    && digest(v.expectedSourceDigest) && ids(v.participantIdsLowFirst) && text(v.reason);
}
const rejectionCodes = new Set(["invalid_request", "unsupported_scope", "entries_locked", "pool_version_mismatch", "policy_frozen", "collection_or_consent_already_started",
  "setup_method_conflict", "idempotency_conflict", "stale_source", "qualification_required", "cut_not_required", "invalid_cut", "policy_required", "chart_review_required",
  "sources_blocked", "cut_group_mismatch", "cut_already_recorded"]);
export function isQOperatingResultV2(v: unknown): v is QOperatingResultV2 {
  if (!object(v)) return false;
  if (v.status === "rejected") return exact(v, ["status", "code"]) && typeof v.code === "string" && rejectionCodes.has(v.code);
  return v.status === "q_policy_published" ? exact(v, ["status", "policyId", "poolVersionId"]) && isUuid(v.policyId) && isUuid(v.poolVersionId)
    : v.status === "q_cut_recorded" && exact(v, ["status", "cutId", "poolVersionId"]) && isUuid(v.cutId) && isUuid(v.poolVersionId);
}
export function qOperatingResultMatchesV2(v: QOperatingResultV2, r: QOperatingRequestV2): boolean {
  return v.status === "rejected" || (v.poolVersionId === r.poolVersionId && (r.action === "publish" ? v.status === "q_policy_published" : v.status === "q_cut_recorded"));
}
function workspaceFields(v: unknown, tournamentId: string, allowBalanced = false): boolean {
  if (!object(v) || !exact(v, ["tournamentId", "membership", "canPublish", "policies", "cards", "cuts", "sourceDigest", "blockers"])
    || v.tournamentId !== tournamentId || !isUuid(tournamentId) || typeof v.canPublish !== "boolean" || !digest(v.sourceDigest)
    || !(v.membership === null || isQPoolMembershipWorkspace(v.membership, tournamentId))
    || !Array.isArray(v.policies) || v.policies.length > 2 || !v.policies.every(p => object(p)
      && exact(p, ["id", "poolVersionId", "method", "ratio", "scheduleId", "disclosureReference", "publishedAt"])
      && isUuid(p.id) && isUuid(p.poolVersionId) && policyFields(p, allowBalanced) && text(p.disclosureReference)
      && typeof p.publishedAt === "string" && Number.isFinite(Date.parse(p.publishedAt)))
    || new Set(v.policies.map(p => p.id)).size !== v.policies.length || new Set(v.policies.map(p => p.poolVersionId)).size !== v.policies.length
    || !Array.isArray(v.cards) || v.cards.length > 256 || !v.cards.every(c => object(c)
      && exact(c, ["participantId", "gamePoints", "gamesWon", "plusPoints", "qualified", "qualificationRank"])
      && isUuid(c.participantId) && whole(c.gamePoints) && whole(c.gamesWon) && whole(c.plusPoints)
      && c.gamePoints >= 2 * c.gamesWon && c.gamePoints <= 3 * c.gamesWon && typeof c.qualified === "boolean"
      && (c.qualified ? whole(c.qualificationRank, 1) : c.qualificationRank === null))
    || new Set(v.cards.map(c => c.participantId)).size !== v.cards.length
    || new Set(v.cards.filter(c => c.qualified).map(c => c.qualificationRank)).size !== v.cards.filter(c => c.qualified).length
    || !Array.isArray(v.cuts) || v.cuts.length > 256 || !v.cuts.every(c => object(c)
      && exact(c, ["poolVersionId", "sourceDigest", "participantIdsLowFirst", "recordedBy", "reason"])
      && isUuid(c.poolVersionId) && digest(c.sourceDigest) && ids(c.participantIdsLowFirst) && isUuid(c.recordedBy) && text(c.reason))
    || !Array.isArray(v.blockers) || v.blockers.length > 64 || !v.blockers.every(b => typeof b === "string" && /^[a-z_]{1,100}$/.test(b))) return false;
  const w = v.membership as QPoolMembershipWorkspace | null;
  return !w || ((v.policies as QOperatingPolicyRecordV2[]).every(p => w.pools.some(pool => pool.poolVersionId === p.poolVersionId))
    && (v.cuts as QOperatingCutRecordV2[]).every(c => w.pools.some(pool => pool.poolVersionId === c.poolVersionId)
      && c.participantIdsLowFirst.every(id => (v.cards as QCardV2[]).some(card => card.participantId === id))));
}
export function isQOperatingWorkspaceV2(v: unknown, tournamentId: string): v is QOperatingWorkspaceV2 { return workspaceFields(v, tournamentId); }

export const balancedQMethodV3 = accWeightedPoolVersion;
export type QOperatingMethodV3 = QOperatingMethodV2 | typeof balancedQMethodV3;
export type QOperatingPolicyRecordV3 = Omit<QOperatingPolicyRecordV2, 'method'> & { method: QOperatingMethodV3 };
export type QOperatingWorkspaceV3 = Omit<QOperatingWorkspaceV2, 'policies'> & { policies: QOperatingPolicyRecordV3[] };
export type QOperatingRequestV3 = { action: 'publish'; poolVersionId: string; method: typeof balancedQMethodV3; ratio: 4 | 6; scheduleId: typeof balancedQMethodV3; disclosureReference: string; disclosed: true };
export type QOperatingResultV3 = { status: 'q_policy_published'; policyId: string; poolVersionId: string } | { status: 'rejected'; code: string };
const rejectionCodesV3 = new Set(['invalid_request', 'pool_version_mismatch', 'policy_frozen', 'entries_locked', 'collection_or_consent_already_started', 'setup_method_conflict', 'unsupported_payout_domain', 'idempotency_conflict']);
export function isQOperatingRequestV3(v: unknown): v is QOperatingRequestV3 { return object(v) && exact(v, ['action', 'poolVersionId', 'method', 'ratio', 'scheduleId', 'disclosureReference', 'disclosed']) && v.action === 'publish' && isUuid(v.poolVersionId) && v.method === balancedQMethodV3 && v.scheduleId === balancedQMethodV3 && (v.ratio === 4 || v.ratio === 6) && text(v.disclosureReference) && v.disclosureReference === v.disclosureReference.trim() && v.disclosed === true; }
export function isQOperatingWorkspaceV3(v: unknown, tournamentId: string): v is QOperatingWorkspaceV3 { return workspaceFields(v, tournamentId, true); }
export function isQOperatingResultV3(v: unknown): v is QOperatingResultV3 { return object(v) && (v.status === 'rejected' ? exact(v, ['status', 'code']) && typeof v.code === 'string' && rejectionCodesV3.has(v.code) : v.status === 'q_policy_published' && exact(v, ['status', 'policyId', 'poolVersionId']) && isUuid(v.policyId) && isUuid(v.poolVersionId)); }
export function qOperatingResultMatchesV3(v: QOperatingResultV3, r: QOperatingRequestV3) { return v.status === 'rejected' || v.poolVersionId.toLowerCase() === r.poolVersionId.toLowerCase(); }
export function isQOperatingReconciliationRequestV3(v: unknown): v is { operationId: string; request: QOperatingRequestV3 } { return object(v) && exact(v, ['operationId', 'request']) && isUuid(v.operationId) && isQOperatingRequestV3(v.request); }
