type JsonRecord = Record<string, unknown>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function record(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasExpectedIds(value: JsonRecord, correctionId: string, gameId?: string) {
  return value.correction_id === correctionId
    && typeof value.game_id === "string"
    && isUuid(value.game_id)
    && (gameId === undefined || value.game_id === gameId);
}

function isPositiveSafeVersion(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function isAcceptedCorrectionProposal(value: unknown, correctionId: string, gameId: string, expectedGameVersion: number): value is JsonRecord {
  return record(value)
    && Object.keys(value).length === 5
    && (value.status === "applied" || value.status === "pending")
    && !Object.hasOwn(value, "code")
    && hasExpectedIds(value, correctionId, gameId)
    && isPositiveSafeVersion(value.version)
    && isPositiveSafeVersion(value.policy_version)
    && ((value.status === "pending" && value.version === expectedGameVersion)
      || (value.status === "applied" && value.version === expectedGameVersion + 1));
}

export function isAcceptedCorrectionReview(value: unknown, correctionId: string, expectedDecision: "approve" | "reject"): value is JsonRecord {
  return record(value)
    && Object.keys(value).length === 5
    && ((expectedDecision === "approve" && value.status === "approved" && value.decision === "approve")
      || (expectedDecision === "reject" && value.status === "rejected" && value.decision === "reject"))
    && !Object.hasOwn(value, "code")
    && hasExpectedIds(value, correctionId)
    && isPositiveSafeVersion(value.version);
}

const proposalRejectionCodes = ["authentication_required", "invalid_request", "game_not_found", "tournament_closed", "result_publication_guarded", "idempotency_conflict", "not_cross_checker", "self_correction_denied", "invalid_game_state", "stale_game_version", "unchanged_correction", "policy_unavailable", "reason_required", "pending_correction_exists", "correction_rejected"];
const reviewRejectionCodes = ["authentication_required", "invalid_request", "correction_not_found", "correction_scope_invalid", "idempotency_conflict", "tournament_closed", "result_publication_guarded", "review_not_required", "policy_snapshot_invalid", "not_pending_review", "reviewer_not_independent", "not_eligible_reviewer", "stale_correction_source", "event_not_eligible", "correction_review_rejected"];

export function isRejectedCorrectionProposal(value: unknown, gameId: string): value is JsonRecord {
  return record(value)
    && Object.keys(value).length === 3
    && value.status === "rejected"
    && value.game_id === gameId
    && proposalRejectionCodes.includes(value.code as string);
}

export function isRejectedCorrectionReview(value: unknown, correctionId: string): value is JsonRecord {
  return record(value)
    && Object.keys(value).length === 3
    && value.status === "rejected"
    && value.correction_id === correctionId
    && reviewRejectionCodes.includes(value.code as string);
}

export function correctionRejectionStatus(code: unknown) {
  if (code === "authentication_required") return 401;
  if (code === "invalid_request") return 400;
  return 409;
}
