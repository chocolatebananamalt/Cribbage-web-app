type JsonRecord = Record<string, unknown>;

function record(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isAcceptedSubmission(value: unknown, gameId: string, submissionId: string): value is JsonRecord {
  return record(value)
    && Object.keys(value).length === 3
    && value.game_id === gameId
    && value.submission_id === submissionId
    && ["submitted", "confirmation_pending", "mismatch"].includes(value.status as string)
    && !Object.hasOwn(value, "code");
}

export function isAcceptedConfirmation(value: unknown, gameId: string): value is JsonRecord {
  return record(value)
    && Object.keys(value).length === 2
    && value.game_id === gameId
    && ["confirmation_pending", "verified"].includes(value.status as string)
    && !Object.hasOwn(value, "code");
}

export function isRejectedGameOperation(value: unknown, gameId: string): value is JsonRecord {
  const allowedCodes = ["authentication_required", "invalid_request", "invalid_submission", "game_not_found", "idempotency_conflict", "tournament_closed", "event_not_approved", "not_assigned", "submission_conflict", "submission_rejected", "submission_not_found", "not_submission_owner", "not_checked_in", "invalid_game_state", "confirmation_rejected"];
  return record(value)
    && Object.keys(value).length === 3
    && value.status === "rejected"
    && value.game_id === gameId
    && allowedCodes.includes(value.code as string);
}
