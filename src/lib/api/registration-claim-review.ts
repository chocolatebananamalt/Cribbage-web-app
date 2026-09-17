import { isUuid } from "./validation.ts";

const decisions = ["approved_for_roster", "rejected"] as const;
const exact = (value: object, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);

export type RegistrationClaimReviewRequest = {
  claimId: string;
  decision: typeof decisions[number];
  duplicateResolution: "confirmed_distinct_person" | null;
  duplicateOfClaimId: null;
  reason: string;
  idempotencyKey: string;
};

export function isRegistrationClaimReviewRequest(value: unknown): value is RegistrationClaimReviewRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["claimId", "decision", "duplicateResolution", "duplicateOfClaimId", "reason", "idempotencyKey"])
    && isUuid(item.claimId) && decisions.includes(item.decision as typeof decisions[number])
    && (item.duplicateResolution === null || item.duplicateResolution === "confirmed_distinct_person")
    && item.duplicateOfClaimId === null
    && typeof item.reason === "string" && item.reason.length <= 500
    && isUuid(item.idempotencyKey)
    && !(item.decision === "rejected" && item.duplicateResolution !== null);
}

export function isAcceptedRegistrationClaimReview(value: unknown, claimId: string, decision: RegistrationClaimReviewRequest["decision"]) {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["status", "claimId", "decisionId", "rosterCreated", "paymentRecorded", "checkedIn"])
    && item.status === decision && item.claimId === claimId
    && isUuid(item.decisionId) && item.rosterCreated === false && item.paymentRecorded === false && item.checkedIn === false;
}

export function isRejectedRegistrationClaimReview(value: unknown, claimId: string) {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["status", "code", "claimId"])
    && item.status === "rejected" && item.claimId === claimId
    && ["authentication_required", "not_director", "collision_unresolved", "hard_duplicate_match", "invalid_duplicate_reference", "claim_already_decided", "idempotency_conflict", "review_rejected"].includes(item.code as string);
}
