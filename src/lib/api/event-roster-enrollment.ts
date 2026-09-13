import { isUuid } from "./validation.ts";

export type EventRosterEnrollmentRequest = {
  eventId: string;
  rosterEntryIds: string[];
  idempotencyKey: string;
};

export type EventRosterEnrollmentResult = {
  status: "event_participants_enrolled";
  eventId: string;
  requestedCount: number;
  createdCount: number;
  existingCount: number;
  participants: Array<{
    rosterEntryId: string;
    participantId: string;
    profileLinked: boolean;
    verificationId: string | null;
  }>;
};

export type EventRosterEnrollmentWorkspace = {
  tournamentName: string;
  registrationClosed: boolean;
  seatingPublished: boolean;
  events: Array<{
    eventId: string;
    name: string;
    eventType: "main" | "consolation" | "satellite" | "custom";
    format: "standard_singles" | "team" | "doubles" | "canadian_doubles" | "custom";
    scoringMethod: "digital" | "manual" | "imported";
    participantCount: number;
  }>;
  roster: Array<{
    rosterEntryId: string;
    displayName: string;
    checkInState: "checked_in" | "withdrawn" | "late" | "absent" | "not_checked_in";
    profileLinked: boolean;
    scorecardType: "digital" | "paper";
    verificationId: string | null;
    enrolledEventIds: string[];
  }>;
};

const rejectedCodes = new Set([
  "tournament_unavailable",
  "not_director",
  "idempotency_conflict",
  "event_not_approved",
  "roster_entry_unavailable",
  "not_checked_in",
  "duplicate_roster_entry",
  "profile_already_enrolled",
  "invalid_request",
]);
const eventTypes = new Set(["main", "consolation", "satellite", "custom"]);
const formats = new Set(["standard_singles", "team", "doubles", "canadian_doubles", "custom"]);
const methods = new Set(["digital", "manual", "imported"]);
const checkInStates = new Set(["checked_in", "withdrawn", "late", "absent", "not_checked_in"]);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
function boundedCount(value: unknown, max = 500): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max;
}

export function isEventRosterEnrollmentRequest(value: unknown): value is EventRosterEnrollmentRequest {
  if (!record(value) || !exact(value, ["eventId", "rosterEntryIds", "idempotencyKey"])) return false;
  return isUuid(value.eventId)
    && isUuid(value.idempotencyKey)
    && Array.isArray(value.rosterEntryIds)
    && value.rosterEntryIds.length >= 1
    && value.rosterEntryIds.length <= 500
    && value.rosterEntryIds.every(isUuid)
    && new Set(value.rosterEntryIds).size === value.rosterEntryIds.length;
}

export function isEventRosterEnrollmentResult(
  value: unknown,
  request: EventRosterEnrollmentRequest,
): value is EventRosterEnrollmentResult {
  if (!record(value) || !exact(value, ["status", "eventId", "requestedCount", "createdCount", "existingCount", "participants"])) return false;
  if (value.status !== "event_participants_enrolled" || value.eventId !== request.eventId
    || value.requestedCount !== request.rosterEntryIds.length
    || !boundedCount(value.createdCount) || !boundedCount(value.existingCount)
    || (value.createdCount as number) + (value.existingCount as number) !== value.requestedCount
    || !Array.isArray(value.participants) || value.participants.length !== value.requestedCount) return false;
  const requested = new Set(request.rosterEntryIds);
  const seen = new Set<string>();
  return value.participants.every((item) => {
    if (!record(item) || !exact(item, ["rosterEntryId", "participantId", "profileLinked", "verificationId"])) return false;
    if (!isUuid(item.rosterEntryId) || !requested.has(item.rosterEntryId) || seen.has(item.rosterEntryId)
      || !isUuid(item.participantId) || typeof item.profileLinked !== "boolean"
      || !(item.verificationId === null || (typeof item.verificationId === "string" && /^[A-Z]-[1-9][0-9]*$/.test(item.verificationId)))) return false;
    seen.add(item.rosterEntryId);
    return true;
  });
}

export function isRejectedEventRosterEnrollment(value: unknown): value is { status: "rejected"; code: string } {
  return record(value) && exact(value, ["status", "code"])
    && value.status === "rejected" && typeof value.code === "string" && rejectedCodes.has(value.code);
}

export function isEventRosterEnrollmentWorkspace(value: unknown): value is EventRosterEnrollmentWorkspace {
  if (!record(value) || !exact(value, ["tournamentName", "registrationClosed", "seatingPublished", "events", "roster"])
    || typeof value.tournamentName !== "string" || value.tournamentName.trim().length === 0
    || typeof value.registrationClosed !== "boolean" || typeof value.seatingPublished !== "boolean"
    || !Array.isArray(value.events) || !Array.isArray(value.roster)) return false;
  if (!value.events.every((item) => record(item)
    && exact(item, ["eventId", "name", "eventType", "format", "scoringMethod", "participantCount"])
    && isUuid(item.eventId) && typeof item.name === "string" && item.name.trim().length > 0
    && eventTypes.has(item.eventType as string) && formats.has(item.format as string)
    && methods.has(item.scoringMethod as string) && boundedCount(item.participantCount, 10000))) return false;
  return value.roster.every((item) => record(item)
    && exact(item, ["rosterEntryId", "displayName", "checkInState", "profileLinked", "scorecardType", "verificationId", "enrolledEventIds"])
    && isUuid(item.rosterEntryId) && typeof item.displayName === "string" && item.displayName.trim().length > 0
    && checkInStates.has(item.checkInState as string) && typeof item.profileLinked === "boolean"
    && (item.scorecardType === "digital" || item.scorecardType === "paper")
    && (item.verificationId === null || (typeof item.verificationId === "string" && /^[A-Z]-[1-9][0-9]*$/.test(item.verificationId)))
    && Array.isArray(item.enrolledEventIds) && item.enrolledEventIds.every(isUuid)
    && new Set(item.enrolledEventIds).size === item.enrolledEventIds.length);
}
