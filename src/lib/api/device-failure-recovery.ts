import { isUuid } from "./validation.ts";

export type RecoveryEvidence = {
  sourceType: "opponent_device" | "paper_card";
  sourceReference: string;
  winnerSide: "a" | "b";
  margin: number;
};

export type CreateDeviceRecoveryRequest = {
  recoveryId: string;
  gameId: string;
  winnerSide: "a" | "b";
  margin: number;
  evidence: RecoveryEvidence[];
  idempotencyKey: string;
};

const exactKeys = (value: object, keys: string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
};

export function isRecoveryEvidence(value: unknown): value is RecoveryEvidence {
  if (!value || typeof value !== "object" || !exactKeys(value, ["sourceType", "sourceReference", "winnerSide", "margin"])) return false;
  const item = value as Record<string, unknown>;
  return ["opponent_device", "paper_card"].includes(item.sourceType as string)
    && typeof item.sourceReference === "string"
    && item.sourceReference.trim().length >= 1
    && item.sourceReference.length <= 200
    && !/[\u0000-\u001f\u007f]/.test(item.sourceReference)
    && ["a", "b"].includes(item.winnerSide as string)
    && Number.isInteger(item.margin)
    && (item.margin as number) >= 1
    && (item.margin as number) <= 121;
}

export function isCreateDeviceRecoveryRequest(value: unknown): value is CreateDeviceRecoveryRequest {
  if (!value || typeof value !== "object" || !exactKeys(value, ["recoveryId", "gameId", "winnerSide", "margin", "evidence", "idempotencyKey"])) return false;
  const item = value as Record<string, unknown>;
  if (!isUuid(item.recoveryId) || !isUuid(item.gameId) || !isUuid(item.idempotencyKey)
    || !["a", "b"].includes(item.winnerSide as string)
    || !Number.isInteger(item.margin) || (item.margin as number) < 1 || (item.margin as number) > 121
    || !Array.isArray(item.evidence) || item.evidence.length < 1 || item.evidence.length > 4
    || !item.evidence.every(isRecoveryEvidence)) return false;
  const identities = item.evidence.map((entry) => `${entry.sourceType}\u0000${entry.sourceReference.trim()}`);
  return new Set(identities).size === identities.length;
}

export function isReviewDeviceRecoveryRequest(value: unknown): value is { decision: "approve" | "reject"; idempotencyKey: string } {
  if (!value || typeof value !== "object" || !exactKeys(value, ["decision", "idempotencyKey"])) return false;
  const item = value as Record<string, unknown>;
  return ["approve", "reject"].includes(item.decision as string) && isUuid(item.idempotencyKey);
}

const createRejectionCodes = new Set(["invalid_request", "invalid_evidence", "not_cross_checker", "game_unavailable", "lifecycle_unavailable", "game_already_authoritative", "self_recovery_denied", "recovery_case_exists", "idempotency_conflict", "recovery_unavailable"]);
const reviewRejectionCodes = new Set(["invalid_request", "recovery_unavailable", "scope_invalid", "not_eligible_reviewer", "reviewer_not_independent", "review_closed", "evidence_disputed", "lifecycle_unavailable", "evidence_stale_or_conflicting", "idempotency_conflict", "review_unavailable"]);

export function isAcceptedDeviceRecovery(value: unknown, request: CreateDeviceRecoveryRequest) {
  if (!value || typeof value !== "object" || !exactKeys(value, ["status", "recoveryId", "gameId", "winnerSide", "margin", "evidenceCount", "authoritative", "playerSubmissionsCreated", "playerConfirmationsCreated"])) return false;
  const item = value as Record<string, unknown>;
  return ["pending_review", "disputed"].includes(item.status as string)
    && item.recoveryId === request.recoveryId && item.gameId === request.gameId
    && item.winnerSide === request.winnerSide && item.margin === request.margin
    && item.evidenceCount === request.evidence.length && item.authoritative === false
    && item.playerSubmissionsCreated === false && item.playerConfirmationsCreated === false;
}

export function isAcceptedDeviceRecoveryReview(value: unknown, recoveryId: string, decision: "approve" | "reject") {
  if (!value || typeof value !== "object" || !exactKeys(value, ["status", "decision", "recoveryId", "gameId", "authoritative", "playerSubmissionsCreated", "playerConfirmationsCreated"])) return false;
  const item = value as Record<string, unknown>;
  return item.status === (decision === "approve" ? "approved" : "rejected")
    && item.decision === decision && item.recoveryId === recoveryId
    && isUuid(item.gameId) && item.authoritative === (decision === "approve")
    && item.playerSubmissionsCreated === false && item.playerConfirmationsCreated === false;
}

export function isRejectedDeviceRecovery(value: unknown, recoveryId: string, review = false) {
  if (!value || typeof value !== "object" || !exactKeys(value, ["status", "code", "recoveryId"])) return false;
  const item = value as Record<string, unknown>;
  return item.status === "rejected" && item.recoveryId === recoveryId
    && (review ? reviewRejectionCodes : createRejectionCodes).has(item.code as string);
}
