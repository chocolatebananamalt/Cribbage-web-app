import { isUuid } from "./validation.ts";
import { Q_POLICY_METHOD } from "../results/q-pool-preview.ts";
export type QPolicyRequest = { poolVersionId: string; method: typeof Q_POLICY_METHOD; disclosureReference: string; disclosed: true };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const rejections = new Set(["invalid_request", "unsupported_scope", "entries_locked", "pool_version_mismatch", "policy_frozen", "collection_or_consent_already_started", "setup_method_conflict", "idempotency_conflict"]);
export function isQPolicyRequest(v: unknown): v is QPolicyRequest {
  return obj(v) && Object.keys(v).sort().join(",") === "disclosed,disclosureReference,method,poolVersionId"
    && isUuid(v.poolVersionId) && v.method === Q_POLICY_METHOD && v.disclosed === true
    && typeof v.disclosureReference === "string" && v.disclosureReference.trim().length > 0 && v.disclosureReference.length <= 500 && !/[\u0000-\u001f\u007f]/.test(v.disclosureReference);
}
export function isQPolicyResult(v: unknown): v is { status: "q_policy_published"; policyId: string; poolVersionId: string; version: 1 } | { status: "rejected"; code: string } {
  return obj(v) && (v.status === "rejected" ? Object.keys(v).sort().join(",") === "code,status" && typeof v.code === "string" && rejections.has(v.code)
    : Object.keys(v).sort().join(",") === "policyId,poolVersionId,status,version" && v.status === "q_policy_published" && isUuid(v.policyId) && isUuid(v.poolVersionId) && v.version === 1);
}
