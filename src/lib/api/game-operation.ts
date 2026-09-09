type JsonRecord = Record<string, unknown>;

function record(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isAcceptedSubmission(value: unknown, gameId: string, submissionId: string): value is JsonRecord {
  return record(value)
    && value.game_id === gameId
    && value.submission_id === submissionId
    && ["submitted", "confirmation_pending", "mismatch"].includes(value.status as string)
    && !Object.hasOwn(value, "code");
}

export function isAcceptedConfirmation(value: unknown, gameId: string): value is JsonRecord {
  return record(value)
    && value.game_id === gameId
    && ["confirmation_pending", "verified"].includes(value.status as string)
    && !Object.hasOwn(value, "code");
}

export function isRejectedGameOperation(value: unknown, gameId: string): value is JsonRecord {
  return record(value)
    && value.status === "rejected"
    && typeof value.code === "string"
    && value.game_id === gameId;
}
