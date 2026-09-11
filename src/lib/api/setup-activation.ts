import { isUuid } from "./validation.ts";

export type SetupActivationRequest = {
  setupRevisionId: string;
  expectedVersion: number;
  idempotencyKey: string;
};

const requestKeys = ["setupRevisionId", "expectedVersion", "idempotencyKey"];
const acceptedKeys = [
  "status",
  "activationId",
  "setupRevisionId",
  "setupVersion",
  "rulesetVersionId",
  "eventId",
  "eventType",
  "format",
  "scoringMethod",
  "roundsCreated",
  "participantsEnrolled",
  "seatingUpdated",
  "financeUpdated",
  "resultsUpdated",
  "payoutsCalculated",
  "qualifiersCalculated",
  "accSubmissionCreated",
];
const rejectedCodes = new Set([
  "tournament_unavailable",
  "not_director",
  "idempotency_conflict",
  "already_activated",
  "activation_lifecycle_closed",
  "stale_setup_revision",
  "unsupported_setup",
  "setup_officials_stale",
  "invalid_request",
]);

function hasExactKeys(value: object, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
}

export function tournamentSetupActivationEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.ACC_TOURNAMENT_SETUP_ACTIVATION_ENABLED === "enabled";
}

export function isSetupActivationRequest(value: unknown): value is SetupActivationRequest {
  if (!value || typeof value !== "object" || !hasExactKeys(value, requestKeys)) return false;
  const request = value as Record<string, unknown>;
  return isUuid(request.setupRevisionId)
    && Number.isSafeInteger(request.expectedVersion)
    && (request.expectedVersion as number) >= 1
    && isUuid(request.idempotencyKey);
}

export function isSetupActivationResult(value: unknown, request: SetupActivationRequest) {
  if (!value || typeof value !== "object" || !hasExactKeys(value, acceptedKeys)) return false;
  const result = value as Record<string, unknown>;
  return result.status === "standard_singles_activated"
    && isUuid(result.activationId)
    && result.setupRevisionId === request.setupRevisionId
    && result.setupVersion === request.expectedVersion
    && isUuid(result.rulesetVersionId)
    && isUuid(result.eventId)
    && ["main", "consolation", "satellite", "custom"].includes(result.eventType as string)
    && result.format === "standard_singles"
    && result.scoringMethod === "digital"
    && [
      "roundsCreated",
      "participantsEnrolled",
      "seatingUpdated",
      "financeUpdated",
      "resultsUpdated",
      "payoutsCalculated",
      "qualifiersCalculated",
      "accSubmissionCreated",
    ].every((key) => result[key] === false);
}

export function isRejectedSetupActivation(value: unknown) {
  if (!value || typeof value !== "object" || !hasExactKeys(value, ["status", "code"])) return false;
  const result = value as Record<string, unknown>;
  return result.status === "rejected"
    && typeof result.code === "string"
    && rejectedCodes.has(result.code);
}
