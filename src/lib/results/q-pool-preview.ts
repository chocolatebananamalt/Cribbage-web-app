import { isQPoolMembershipWorkspace, type QPoolMembershipWorkspace } from "../api/q-pool-membership.ts";
import { isUuid } from "../api/validation.ts";

export const Q_POLICY_METHOD = "equal-paid-qualifiers-v1" as const;
export const Q_POLICY_TEXT = "Equal shares of 100% of valid fully allocated Q fees to finalized playoff qualifiers who fully paid into this named pool. Remainder cents follow finalized qualifying order. If nobody is eligible, each contributor is owed their Q allocation back. Partial, stale or unresolved contributions block the preview. These rounding and refund conventions are app policies, not ACC mandates. No payment or refund is executed.";
export const qPolicyPrefix = (id: string) => `Q policy ${id}: `;
export type QPolicy = { id: string; poolVersionId: string; version: 1; method: typeof Q_POLICY_METHOD; disclosureReference: string; publishedAt: string };
export type QPreviewSources = {
  tournamentId: string; membership: QPoolMembershipWorkspace | null; canPublish: boolean;
  policies: QPolicy[]; sourceDigest: string; blockers: string[];
  qualification: null | { id: string; version: number; qualifiers: Array<{ participantId: string; qualificationRank: number; tied: boolean }> };
};
type Award = { participantId: string; displayName: string; amountMinor: number; qualificationRank: number | null };
export type QPreview = { poolVersionId: string; name: string; policyId: string | null; status: "blocked" | "awards_preview" | "refund_obligations_preview"; blockers: string[]; fundMinor: number; awards: Award[]; refundObligations: Award[]; sourceDigest: string };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join(",") === [...keys].sort().join(",");
const safe = (v: unknown, min = 0) => Number.isSafeInteger(v) && (v as number) >= min;
export function isQPolicy(v: unknown): v is QPolicy {
  return obj(v) && exact(v, ["id", "poolVersionId", "version", "method", "disclosureReference", "publishedAt"])
    && isUuid(v.id) && isUuid(v.poolVersionId) && v.version === 1 && v.method === Q_POLICY_METHOD
    && typeof v.disclosureReference === "string" && v.disclosureReference.trim().length > 0 && v.disclosureReference.length <= 500
    && typeof v.publishedAt === "string" && Number.isFinite(Date.parse(v.publishedAt));
}
export function isQPreviewSources(v: unknown, tournamentId: string): v is QPreviewSources {
  if (!obj(v) || !exact(v, ["tournamentId", "membership", "canPublish", "policies", "sourceDigest", "blockers", "qualification"])
    || v.tournamentId !== tournamentId || !isUuid(tournamentId) || typeof v.canPublish !== "boolean"
    || !(v.membership === null || isQPoolMembershipWorkspace(v.membership, tournamentId))
    || !Array.isArray(v.policies) || v.policies.length > 2 || !v.policies.every(isQPolicy)
    || new Set(v.policies.map((p) => p.poolVersionId)).size !== v.policies.length
    || new Set(v.policies.map((p) => p.id)).size !== v.policies.length
    || typeof v.sourceDigest !== "string" || !/^[a-f0-9]{64}$/.test(v.sourceDigest)
    || !Array.isArray(v.blockers) || v.blockers.length > 32 || !v.blockers.every((b) => typeof b === "string" && /^[a-z_]{1,100}$/.test(b))) return false;
  const w = v.membership as QPoolMembershipWorkspace | null;
  if (w && (new Set(w.entries.map((e) => e.participantId)).size !== w.entries.length || new Set(w.entries.map((e) => e.rosterEntryId)).size !== w.entries.length
    || !(v.policies as QPolicy[]).every((p) => w.pools.some((pool) => pool.poolVersionId === p.poolVersionId)))) return false;
  const q = v.qualification;
  return q === null || (obj(q) && exact(q, ["id", "version", "qualifiers"]) && isUuid(q.id) && safe(q.version, 1)
    && Array.isArray(q.qualifiers) && q.qualifiers.length > 0 && q.qualifiers.length <= 256
    && q.qualifiers.every((r) => obj(r) && exact(r, ["participantId", "qualificationRank", "tied"]) && isUuid(r.participantId) && safe(r.qualificationRank, 1) && typeof r.tied === "boolean")
    && new Set(q.qualifiers.map((r) => r.participantId)).size === q.qualifiers.length
    && new Set(q.qualifiers.map((r) => r.qualificationRank)).size === q.qualifiers.length
    && q.qualifiers.map((r) => r.qualificationRank as number).sort((a,b) => a-b).every((rank,i) => rank === i+1));
}
/** Read-only, deterministic preview. Current server sources must be reloaded before any future review. */
export function previewQPools(source: QPreviewSources): QPreview[] {
  const w = source.membership;
  if (!w) return [];
  return w.pools.map((pool) => {
    const policy = source.policies.find((p) => p.poolVersionId === pool.poolVersionId);
    const blockers = [...source.blockers];
    if (!w.supported) blockers.push("unsupported_scope");
    if (!policy) blockers.push("disclosed_policy_required");
    if (!source.qualification) blockers.push("finalized_qualification_required");
    if (source.qualification?.qualifiers.some((q) => q.tied)) blockers.push("qualifying_order_unresolved");
    const contributors: Award[] = [];
    for (const entry of w.entries) {
      if (entry.receivedMinor > 0 && !entry.allocationCurrent) blockers.push("unresolved_receipt_allocation");
      const elected = entry.pools.find((p) => p.poolVersionId === pool.poolVersionId);
      if (!elected) { blockers.push("pool_membership_unavailable"); continue; }
      if (!elected.elected) {
        if (elected.amountAllocatedMinor > 0) blockers.push("refund_resolution_required");
        continue;
      }
      const prefix = policy ? qPolicyPrefix(policy.id) : "";
      if (!policy || !elected.consentReference.startsWith(prefix) || !elected.consentReference.slice(prefix.length).trim()) blockers.push("policy_acknowledgment_required");
      if (!entry.allocationCurrent || !elected.paidEntryEligible || elected.amountAllocatedMinor !== pool.feeMinor) { blockers.push("partial_or_stale_contribution"); continue; }
      contributors.push({ participantId: entry.participantId, displayName: entry.displayName, amountMinor: elected.amountAllocatedMinor, qualificationRank: null });
    }
    const fund = contributors.reduce((n, row) => n + BigInt(row.amountMinor), BigInt(0));
    if (fund > BigInt(Number.MAX_SAFE_INTEGER)) blockers.push("fund_overflow");
    const fundMinor = fund > BigInt(Number.MAX_SAFE_INTEGER) ? 0 : Number(fund);
    const result: QPreview = { poolVersionId: pool.poolVersionId, name: pool.name, policyId: policy?.id ?? null,
      status: "blocked", blockers: [...new Set(blockers)], fundMinor, awards: [], refundObligations: [], sourceDigest: source.sourceDigest };
    if (result.blockers.length) return result;
    const recipients = contributors.flatMap((c) => {
      const rank = source.qualification!.qualifiers.find((q) => q.participantId === c.participantId)?.qualificationRank;
      return rank === undefined ? [] : [{ ...c, qualificationRank: rank }];
    }).sort((a, b) => a.qualificationRank - b.qualificationRank);
    if (!recipients.length) {
      result.status = "refund_obligations_preview";
      result.refundObligations = contributors;
    } else {
      result.status = "awards_preview";
      const share = Math.floor(fundMinor / recipients.length), pennies = fundMinor % recipients.length;
      result.awards = recipients.map((c, i) => ({ ...c, amountMinor: share + (i < pennies ? 1 : 0) }));
    }
    return result;
  });
}
