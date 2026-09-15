import { isSetupEvent, type SetupEvent } from "./setup.ts";
import { isUuid } from "./validation.ts";

export type SetupAmendmentRequest = {
  expectedSetupRevisionId: string;
  expectedSetupVersion: number;
  events: SetupEvent[];
  operationId: string;
};

export type SetupAmendmentResult = {
  status: "tournament_setup_amended";
  amendmentId: string;
  setupRevisionId: string;
  setupVersion: number;
  addedEventCount: number;
  events: Array<{
    activationId: string;
    setupEventVersionId: string;
    rulesetVersionId: string;
    eventId: string;
    eventType: "consolation" | "satellite" | "custom";
    name: string;
    format: SetupEvent["formatCode"];
    scoringMethod: "digital" | "manual";
    gameCount: number;
  }>;
};

export type RejectedSetupAmendment = { status: "rejected"; code: string };

const requestKeys = ["expectedSetupRevisionId", "expectedSetupVersion", "events", "operationId"];
const resultKeys = ["status", "amendmentId", "setupRevisionId", "setupVersion", "addedEventCount", "events"];
const eventKeys = ["activationId", "setupEventVersionId", "rulesetVersionId", "eventId", "eventType", "name", "format", "scoringMethod", "gameCount"];
const rejectedCodes = new Set(["tournament_unavailable", "not_director", "idempotency_conflict", "setup_not_activated", "setup_officials_stale", "stale_setup_revision", "event_limit_reached", "duplicate_event", "consolation_exists", "unsupported_event", "invalid_request"]);
const exact = (value: object, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);

export function isSetupAmendmentRequest(value: unknown): value is SetupAmendmentRequest {
  if (!value || typeof value !== "object" || !exact(value, requestKeys)) return false;
  const request = value as Record<string, unknown>;
  return isUuid(request.expectedSetupRevisionId)
    && Number.isSafeInteger(request.expectedSetupVersion)
    && (request.expectedSetupVersion as number) >= 1
    && Array.isArray(request.events)
    && request.events.length >= 1
    && request.events.length <= 31
    && request.events.every((event) => isSetupEvent(event) && event.eventKind !== "main")
    && isUuid(request.operationId);
}

export function isSetupAmendmentResult(value: unknown, request: SetupAmendmentRequest): value is SetupAmendmentResult {
  if (!value || typeof value !== "object" || !exact(value, resultKeys)) return false;
  const result = value as Record<string, unknown>;
  return result.status === "tournament_setup_amended"
    && isUuid(result.amendmentId)
    && isUuid(result.setupRevisionId)
    && result.setupRevisionId !== request.expectedSetupRevisionId
    && result.setupVersion === request.expectedSetupVersion + 1
    && result.addedEventCount === request.events.length
    && Array.isArray(result.events)
    && result.events.length === request.events.length
    && result.events.every((item, index) => {
      if (!item || typeof item !== "object" || !exact(item, eventKeys)) return false;
      const event = item as Record<string, unknown>;
      const requested = request.events[index];
      return isUuid(event.activationId) && isUuid(event.setupEventVersionId)
        && isUuid(event.rulesetVersionId) && isUuid(event.eventId)
        && event.eventType === requested.eventKind && event.name === requested.displayName.trim()
        && event.format === requested.formatCode
        && event.scoringMethod === (["standard_singles", "doubles", "canadian_doubles"].includes(requested.formatCode) ? "digital" : "manual")
        && event.gameCount === requested.gameCount;
    });
}

export function isRejectedSetupAmendment(value: unknown): value is RejectedSetupAmendment {
  return !!value && typeof value === "object" && exact(value, ["status", "code"])
    && (value as Record<string, unknown>).status === "rejected"
    && typeof (value as Record<string, unknown>).code === "string"
    && rejectedCodes.has((value as Record<string, unknown>).code as string);
}
