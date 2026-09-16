import { isUuid } from "./validation.ts";

export type SetupActivationRequest = {
  setupRevisionId: string;
  expectedVersion: number;
  confirmed: true;
  idempotencyKey: string;
};
export type SetupActivationResult = {
  status: "tournament_setup_activated";
  setupRevisionId: string;
  setupVersion: number;
  eventCount: number;
  events: Array<Record<string, unknown>>;
  roundsCreated: false;
  participantsEnrolled: false;
  seatingUpdated: false;
  financeUpdated: false;
  resultsUpdated: false;
  payoutsCalculated: false;
  qualifiersCalculated: false;
  accSubmissionCreated: false;
  registrationState: "open";
};
export type RejectedSetupActivation = { status: "rejected"; code: string };

const requestKeys = ["setupRevisionId", "expectedVersion", "confirmed", "idempotencyKey"];
const acceptedKeys = [
  "status",
  "setupRevisionId",
  "setupVersion",
  "eventCount",
  "events",
  "roundsCreated",
  "participantsEnrolled",
  "seatingUpdated",
  "financeUpdated",
  "resultsUpdated",
  "payoutsCalculated",
  "qualifiersCalculated",
  "accSubmissionCreated",
  "registrationState",
];
const activationEventKeys = ["activationId", "setupEventVersionId", "rulesetVersionId", "eventId", "eventType", "name", "format", "scoringMethod", "gameCount"];
const activationStateEventKeys = ["eventId", "eventType", "name", "format", "scoringMethod", "gameCount"];
const rejectedCodes = new Set([
  "tournament_unavailable",
  "not_director",
  "idempotency_conflict",
  "already_activated",
  "activation_lifecycle_closed",
  "stale_setup_revision",
  "unsupported_setup",
  "setup_officials_stale",
  "missing_tournament_contact",
  "confirmation_required",
  "invalid_request",
]);

function hasExactKeys(value: object, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
}

export function isSetupActivationRequest(value: unknown): value is SetupActivationRequest {
  if (!value || typeof value !== "object" || !hasExactKeys(value, requestKeys)) return false;
  const request = value as Record<string, unknown>;
  return isUuid(request.setupRevisionId)
    && Number.isSafeInteger(request.expectedVersion)
    && (request.expectedVersion as number) >= 1
    && request.confirmed === true
    && isUuid(request.idempotencyKey);
}

export function isSetupActivationResult(value: unknown, request: SetupActivationRequest): value is SetupActivationResult {
  if (!value || typeof value !== "object" || !hasExactKeys(value, acceptedKeys)) return false;
  const result = value as Record<string, unknown>;
  return result.status === "tournament_setup_activated"
    && result.setupRevisionId === request.setupRevisionId
    && result.setupVersion === request.expectedVersion
    && Number.isSafeInteger(result.eventCount)
    && (result.eventCount as number) >= 1
    && (result.eventCount as number) <= 32
    && Array.isArray(result.events)
    && result.events.length === result.eventCount
    && result.events.every((item) => isActivationEvent(item, activationEventKeys, true))
    && [
      "roundsCreated",
      "participantsEnrolled",
      "seatingUpdated",
      "financeUpdated",
      "resultsUpdated",
      "payoutsCalculated",
      "qualifiersCalculated",
      "accSubmissionCreated",
    ].every((key) => result[key] === false)
    && result.registrationState === "open";
}

function isActivationEvent(value: unknown, keys: string[], includeActivationIds: boolean, allowLegacyManualTeamScoring = false) {
  if (!value || typeof value !== "object" || !hasExactKeys(value, keys)) return false;
  const event = value as Record<string, unknown>;
  const format = event.format as string;
  const method = event.scoringMethod;
  return (!includeActivationIds || (isUuid(event.activationId) && isUuid(event.setupEventVersionId) && isUuid(event.rulesetVersionId)))
    && isUuid(event.eventId)
    && ["main", "consolation", "satellite", "custom"].includes(event.eventType as string)
    && typeof event.name === "string" && event.name.trim().length > 0 && event.name.length <= 200
    && ["standard_singles", "team", "doubles", "canadian_doubles", "custom"].includes(format)
    && (format === "standard_singles"
      ? method === "digital"
      : ["doubles", "canadian_doubles"].includes(format)
        ? (allowLegacyManualTeamScoring ? ["digital", "manual"].includes(String(method)) : method === "digital")
        : method === "manual")
    && Number.isSafeInteger(event.gameCount) && (event.gameCount as number) >= 1 && (event.gameCount as number) <= 99;
}

export type SetupActivationState =
  | { status: "not_activated" }
  | { status: "activated"; setupRevisionId: string; setupVersion: number; eventCount: number; events: Array<{ eventId: string; eventType: string; name: string; format: string; scoringMethod: string; gameCount: number }> };

export function isSetupActivationState(value: unknown): value is SetupActivationState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  if (state.status === "not_activated") return hasExactKeys(value, ["status"]);
  return state.status === "activated"
    && hasExactKeys(value, ["status", "setupRevisionId", "setupVersion", "eventCount", "events"])
    && isUuid(state.setupRevisionId)
    && Number.isSafeInteger(state.setupVersion) && (state.setupVersion as number) >= 1
    && Number.isSafeInteger(state.eventCount) && (state.eventCount as number) >= 1 && (state.eventCount as number) <= 32
    && Array.isArray(state.events) && state.events.length === state.eventCount
    // Legacy scoreless paper team events remain valid historical active events.
    // New activation replies still require supported doubles to be digital-capable.
    && state.events.every((item) => isActivationEvent(item, activationStateEventKeys, false, true));
}

export function isRejectedSetupActivation(value: unknown): value is RejectedSetupActivation {
  if (!value || typeof value !== "object" || !hasExactKeys(value, ["status", "code"])) return false;
  const result = value as Record<string, unknown>;
  return result.status === "rejected"
    && typeof result.code === "string"
    && rejectedCodes.has(result.code);
}
