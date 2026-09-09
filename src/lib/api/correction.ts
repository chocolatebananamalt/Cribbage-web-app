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
    && (value.status === "applied" || value.status === "pending")
    && !Object.hasOwn(value, "code")
    && hasExpectedIds(value, correctionId, gameId)
    && isPositiveSafeVersion(value.version)
    && ((value.status === "pending" && value.version === expectedGameVersion)
      || (value.status === "applied" && value.version === expectedGameVersion + 1));
}

export function isAcceptedCorrectionReview(value: unknown, correctionId: string, expectedDecision: "approve" | "reject"): value is JsonRecord {
  return record(value)
    && ((expectedDecision === "approve" && value.status === "approved" && value.decision === "approve")
      || (expectedDecision === "reject" && value.status === "rejected" && value.decision === "reject"))
    && !Object.hasOwn(value, "code")
    && hasExpectedIds(value, correctionId)
    && isPositiveSafeVersion(value.version);
}

export function isRejectedCorrectionOperation(value: unknown): value is JsonRecord {
  return record(value) && value.status === "rejected" && typeof value.code === "string" && !Object.hasOwn(value, "decision");
}

export function correctionRejectionStatus(code: unknown) {
  if (code === "authentication_required") return 401;
  if (code === "invalid_request") return 400;
  return 409;
}
