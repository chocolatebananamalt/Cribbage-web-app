const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export type CheckInState = "checked_in" | "withdrawn" | "late" | "absent" | "not_checked_in";
export type SeatingCheckIn = { rosterEntryId: string; displayName: string; state: CheckInState };
export type SeatingAssignment = { rosterEntryId: string; displayName: string; initialTableSeat: string; verificationId: string };
export type SeatingPublication = { publicationId: string; tableCount: number; seatsPerTable: number; publishedAt: string; assignments: SeatingAssignment[] };
export type SeatingWorkspace = { publication: SeatingPublication | null; checkIn: SeatingCheckIn[] };

const tableSeat = (value: unknown) => typeof value === "string" && /^[A-Z]-[1-9][0-9]*$/.test(value);
const text = (value: unknown) => typeof value === "string" && value.length > 0;
const state = (value: unknown): value is CheckInState => ["checked_in", "withdrawn", "late", "absent", "not_checked_in"].includes(value as CheckInState);

function checkIn(value: unknown): value is SeatingCheckIn {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 3 && isUuid(item.rosterEntryId) && text(item.displayName) && state(item.state);
}

function assignment(value: unknown): value is SeatingAssignment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 4 && isUuid(item.rosterEntryId) && text(item.displayName) && tableSeat(item.initialTableSeat) && tableSeat(item.verificationId) && item.initialTableSeat === item.verificationId;
}

function publication(value: unknown): value is SeatingPublication {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 5
    && isUuid(item.publicationId)
    && Number.isSafeInteger(item.tableCount) && (item.tableCount as number) >= 1 && (item.tableCount as number) <= 26
    && Number.isSafeInteger(item.seatsPerTable) && (item.seatsPerTable as number) >= 2 && (item.seatsPerTable as number) <= 20
    && text(item.publishedAt)
    && Array.isArray(item.assignments) && item.assignments.every(assignment);
}

export function isSeatingWorkspace(value: unknown): value is SeatingWorkspace {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 2 || !Array.isArray(item.checkIn) || !item.checkIn.every(checkIn) || !(item.publication === null || publication(item.publication))) return false;
  const checkInIds = item.checkIn.map((entry) => entry.rosterEntryId);
  if (new Set(checkInIds).size !== checkInIds.length) return false;
  if (item.publication === null) return true;
  const assigned = item.publication.assignments;
  return new Set(assigned.map((entry) => entry.rosterEntryId)).size === assigned.length
    && new Set(assigned.map((entry) => entry.initialTableSeat)).size === assigned.length;
}
