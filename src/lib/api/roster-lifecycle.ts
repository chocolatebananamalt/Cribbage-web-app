export type EventEnrollmentRequest = { eventId: string; rosterEntryId: string; idempotencyKey: string };
const enrollmentCodes = ["authentication_required", "not_director", "idempotency_conflict", "enrollment_closed_after_seating", "event_not_approved", "linked_roster_identity_required", "not_checked_in", "participant_already_enrolled", "event_enrollment_rejected"];
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function isEventEnrollmentRequest(value: unknown): value is EventEnrollmentRequest {
  return record(value) && exact(value, ["eventId", "rosterEntryId", "idempotencyKey"]) && isUuid(value.eventId) && isUuid(value.rosterEntryId) && isUuid(value.idempotencyKey);
}

export function isAcceptedEventEnrollment(value: unknown, tournamentId: string, request: EventEnrollmentRequest) {
  return record(value) && exact(value, ["status", "eventId", "rosterEntryId", "participantId", "participantStatus", "gameCreated", "seatAssigned", "tournamentId", "operationId"]) && value.status === "event_participant_enrolled" && value.eventId === request.eventId && value.rosterEntryId === request.rosterEntryId && isUuid(value.participantId) && value.participantStatus === "checked_in" && value.gameCreated === false && value.seatAssigned === false && value.tournamentId === tournamentId && value.operationId === request.idempotencyKey;
}

export function isRejectedEventEnrollment(value: unknown, tournamentId: string, request: EventEnrollmentRequest) {
  return record(value) && exact(value, ["status", "code", "eventId", "rosterEntryId", "tournamentId", "operationId"]) && value.status === "rejected" && typeof value.code === "string" && enrollmentCodes.includes(value.code) && value.eventId === request.eventId && value.rosterEntryId === request.rosterEntryId && value.tournamentId === tournamentId && value.operationId === request.idempotencyKey;
}
