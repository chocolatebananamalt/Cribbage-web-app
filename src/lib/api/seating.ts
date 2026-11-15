export type CheckInState = "checked_in" | "withdrawn" | "late" | "absent";
export type CheckInRequest = { rosterEntryId: string; checkInState: CheckInState; reason: string; idempotencyKey: string };
export type InitialSeatingAssignment = { rosterEntryId: string; tableSeat: string };
export type InitialSeatingRequest = { tableCount: number; seatsPerTable: number; assignments: InitialSeatingAssignment[]; idempotencyKey: string };

const checkInStates: CheckInState[] = ["checked_in", "withdrawn", "late", "absent"];
const checkInRejectionCodes = ["authentication_required", "not_director", "registration_closed", "roster_entry_unavailable", "unassigned_check_in_after_seating", "idempotency_conflict", "invalid_request", "check_in_rejected"];
const seatingRejectionCodes = ["authentication_required", "not_director", "registration_open", "checked_in_roster_required", "seating_capacity_exceeded", "duplicate_seating_assignment", "initial_seating_already_published", "idempotency_conflict", "invalid_request", "initial_seating_rejected"];
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasExactly(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isBoundedReason(value: unknown): value is string {
  return typeof value === "string" && value.length <= 500 && new TextEncoder().encode(value).length <= 2000;
}

function tableSeatPosition(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^([A-Z])-([1-9][0-9]*)$/.exec(value);
  if (!match) return null;
  return { table: match[1].charCodeAt(0) - "A".charCodeAt(0) + 1, seat: Number(match[2]) };
}

export function isCheckInRequest(value: unknown): value is CheckInRequest {
  if (!isRecord(value) || !hasExactly(value, ["rosterEntryId", "checkInState", "reason", "idempotencyKey"])) return false;
  return isUuid(value.rosterEntryId) && checkInStates.includes(value.checkInState as CheckInState) && isBoundedReason(value.reason) && isUuid(value.idempotencyKey);
}

function isAssignment(value: unknown, tableCount: number, seatsPerTable: number): value is InitialSeatingAssignment {
  if (!isRecord(value) || !hasExactly(value, ["rosterEntryId", "tableSeat"]) || !isUuid(value.rosterEntryId)) return false;
  const position = tableSeatPosition(value.tableSeat);
  return !!position && position.table >= 1 && position.table <= tableCount && position.seat >= 1 && position.seat <= seatsPerTable;
}

export function isInitialSeatingRequest(value: unknown): value is InitialSeatingRequest {
  if (!isRecord(value) || !hasExactly(value, ["tableCount", "seatsPerTable", "assignments", "idempotencyKey"])) return false;
  const { tableCount, seatsPerTable, assignments, idempotencyKey } = value;
  if (typeof tableCount !== "number" || !Number.isSafeInteger(tableCount) || tableCount < 1 || tableCount > 26 || typeof seatsPerTable !== "number" || !Number.isSafeInteger(seatsPerTable) || seatsPerTable < 2 || seatsPerTable > 20 || !Array.isArray(assignments) || assignments.length === 0 || assignments.length > tableCount * seatsPerTable || !isUuid(idempotencyKey)) return false;
  if (!assignments.every((assignment) => isAssignment(assignment, tableCount, seatsPerTable))) return false;
  const typedAssignments = assignments as InitialSeatingAssignment[];
  return new Set(typedAssignments.map((assignment) => assignment.rosterEntryId)).size === typedAssignments.length && new Set(typedAssignments.map((assignment) => assignment.tableSeat)).size === typedAssignments.length;
}

export function isAcceptedCheckIn(value: unknown, tournamentId: string, request: CheckInRequest) {
  if (!isRecord(value) || !hasExactly(value, ["status", "checkInEventId", "rosterEntryId", "checkInState", "eventEnrolled", "seatAssigned", "verificationIdAssigned", "tournamentId", "operationId"])) return false;
  return value.status === "check_in_recorded" && isUuid(value.checkInEventId) && value.rosterEntryId === request.rosterEntryId && value.checkInState === request.checkInState && value.eventEnrolled === false && value.seatAssigned === false && value.verificationIdAssigned === false && value.tournamentId === tournamentId && value.operationId === request.idempotencyKey;
}

export function isRejectedCheckIn(value: unknown, tournamentId: string, request: CheckInRequest) {
  return isRecord(value) && hasExactly(value, ["status", "code", "rosterEntryId", "tournamentId", "operationId"]) && value.status === "rejected" && typeof value.code === "string" && checkInRejectionCodes.includes(value.code) && value.rosterEntryId === request.rosterEntryId && value.tournamentId === tournamentId && value.operationId === request.idempotencyKey;
}

export function isAcceptedInitialSeating(value: unknown, tournamentId: string, request: InitialSeatingRequest) {
  if (!isRecord(value) || !hasExactly(value, ["status", "publicationId", "assignmentCount", "registrationClosed", "roundRotationGenerated", "tournamentId", "operationId"])) return false;
  return value.status === "initial_seating_published" && isUuid(value.publicationId) && value.assignmentCount === request.assignments.length && value.registrationClosed === true && value.roundRotationGenerated === false && value.tournamentId === tournamentId && value.operationId === request.idempotencyKey;
}

export function isRejectedInitialSeating(value: unknown, tournamentId: string, request: InitialSeatingRequest) {
  return isRecord(value) && hasExactly(value, ["status", "code", "tournamentId", "operationId"]) && value.status === "rejected" && typeof value.code === "string" && seatingRejectionCodes.includes(value.code) && value.tournamentId === tournamentId && value.operationId === request.idempotencyKey;
}
