import { isUuid } from "./validation.ts";

export type ScorecardPreferenceRequest = {
  rosterEntryId: string;
  expectedVersion: number;
  scorecardType: "digital" | "paper";
  reason: string;
  idempotencyKey: string;
};

const exact = (value: object, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);

export function isScorecardPreferenceRequest(value: unknown): value is ScorecardPreferenceRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["rosterEntryId", "expectedVersion", "scorecardType", "reason", "idempotencyKey"])
    && isUuid(item.rosterEntryId) && isUuid(item.idempotencyKey)
    && Number.isSafeInteger(item.expectedVersion) && (item.expectedVersion as number) >= 1
    && (item.scorecardType === "digital" || item.scorecardType === "paper")
    && typeof item.reason === "string" && item.reason.length <= 500;
}

export function isAcceptedScorecardPreference(value: unknown, request: ScorecardPreferenceRequest) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["status", "rosterEntryId", "scorecardType", "version"])
    && item.status === "scorecard_preference_updated"
    && item.rosterEntryId === request.rosterEntryId
    && item.scorecardType === request.scorecardType
    && item.version === request.expectedVersion + 1;
}

export function isRejectedScorecardPreference(value: unknown, rosterEntryId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["status", "code", "rosterEntryId"])
    && item.status === "rejected" && item.rosterEntryId === rosterEntryId
    && ["not_director", "invalid_request", "registration_closed", "initial_seating_already_published", "roster_entry_unavailable", "stale_preference_version", "idempotency_conflict", "scorecard_preference_rejected"].includes(item.code as string);
}
