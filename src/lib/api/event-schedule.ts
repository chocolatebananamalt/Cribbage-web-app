import { isUuid } from "./validation.ts";

export type EventScheduleMatch = {
  gameNumber: number;
  sideAVerificationId: string;
  sideBVerificationId: string;
  sideATableSeat: string;
  sideBTableSeat: string;
};

export type EventScheduleRequest = {
  eventId: string;
  matches: EventScheduleMatch[];
  reviewedAndApproved: true;
  idempotencyKey: string;
};

export type EventScheduleResult = {
  status: "event_schedule_published";
  eventId: string;
  gameCount: number;
  participantCount: number;
  matchCount: number;
  publicationId: string;
};

export type EventPlayState = "preparing" | "ready_to_start" | "in_progress" | "completed" | "finalized";

export type EventStartRequest = {
  eventId: string;
  schedulePublicationId: string;
  participantSnapshotDigest: string;
  expectedParticipantCount: number;
  expectedGameCount: number;
  confirmed: true;
  idempotencyKey: string;
};

export type EventStartResult = {
  status: "event_started";
  eventId: string;
  startId: string;
  participantCount: number;
  gameCount: number;
  scheduleMatchCount: number;
  playState: "in_progress";
};

export type EventScheduleWorkspace = {
  tournamentName: string;
  registrationClosed: boolean;
  tableCount: number | null;
  seatsPerTable: number | null;
  events: Array<{
    eventId: string;
    name: string;
    format: "standard_singles" | "team" | "doubles" | "canadian_doubles" | "custom";
    scoringMethod: "digital" | "manual" | "imported";
    gameCount: number;
    participantCount: number;
    schedulePublished: boolean;
    schedulePublicationId: string | null;
    participantSnapshotDigest: string | null;
    publishedMatchCount: number;
    playState: EventPlayState;
    startedAt: string | null;
    startedBy: string | null;
  }>;
  participants: Array<{
    eventId: string;
    participantId: string;
    displayName: string;
    verificationId: string;
    profileLinked: boolean;
  }>;
  matches: Array<EventScheduleMatch & {
    eventId: string;
    canonicalGameId: string;
    sideADisplayName: string;
    sideBDisplayName: string;
    state: "pending" | "submitted" | "mismatch" | "confirmation_pending" | "verified" | "corrected";
  }>;
};

const seatPattern = /^[A-Z]-[1-9][0-9]*$/;
const formats = new Set(["standard_singles", "team", "doubles", "canadian_doubles", "custom"]);
const methods = new Set(["digital", "manual", "imported"]);
const states = new Set(["pending", "submitted", "mismatch", "confirmation_pending", "verified", "corrected"]);
const playStates = new Set(["preparing", "ready_to_start", "in_progress", "completed", "finalized"]);
const digestPattern = /^[0-9a-f]{64}$/;
const rejectedCodes = new Set([
  "tournament_unavailable", "not_director", "idempotency_conflict", "event_not_approved",
  "participants_unavailable", "schedule_already_published", "invalid_schedule",
]);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
function positiveInt(value: unknown, max: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= max;
}
function nonnegativeInt(value: unknown, max: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max;
}
function isSeat(value: unknown): value is string { return typeof value === "string" && seatPattern.test(value); }

export function isEventScheduleMatch(value: unknown): value is EventScheduleMatch {
  return record(value) && exact(value, ["gameNumber", "sideAVerificationId", "sideBVerificationId", "sideATableSeat", "sideBTableSeat"])
    && positiveInt(value.gameNumber, 99) && isSeat(value.sideAVerificationId) && isSeat(value.sideBVerificationId)
    && value.sideAVerificationId !== value.sideBVerificationId
    && isSeat(value.sideATableSeat) && isSeat(value.sideBTableSeat)
    && value.sideATableSeat !== value.sideBTableSeat;
}

export function isEventScheduleRequest(value: unknown): value is EventScheduleRequest {
  return record(value) && exact(value, ["eventId", "matches", "reviewedAndApproved", "idempotencyKey"])
    && isUuid(value.eventId) && isUuid(value.idempotencyKey) && Array.isArray(value.matches)
    && value.reviewedAndApproved === true && value.matches.length >= 1 && value.matches.length <= 5000 && value.matches.every(isEventScheduleMatch);
}

export function isEventScheduleResult(value: unknown, request: EventScheduleRequest): value is EventScheduleResult {
  return record(value) && exact(value, ["status", "eventId", "gameCount", "participantCount", "matchCount", "publicationId"])
    && value.status === "event_schedule_published" && value.eventId === request.eventId
    && positiveInt(value.gameCount, 99) && positiveInt(value.participantCount, 10000)
    && value.matchCount === request.matches.length && isUuid(value.publicationId);
}

export function isRejectedEventSchedule(value: unknown): value is { status: "rejected"; code: string } {
  return record(value) && exact(value, ["status", "code"]) && value.status === "rejected"
    && typeof value.code === "string" && rejectedCodes.has(value.code);
}

export function isEventStartRequest(value: unknown): value is EventStartRequest {
  return record(value) && exact(value, ["eventId", "schedulePublicationId", "participantSnapshotDigest", "expectedParticipantCount", "expectedGameCount", "confirmed", "idempotencyKey"])
    && isUuid(value.eventId) && isUuid(value.schedulePublicationId) && typeof value.participantSnapshotDigest === "string"
    && digestPattern.test(value.participantSnapshotDigest) && positiveInt(value.expectedParticipantCount, 10000)
    && positiveInt(value.expectedGameCount, 99) && value.confirmed === true && isUuid(value.idempotencyKey);
}

export function isEventStartResult(value: unknown, request: EventStartRequest): value is EventStartResult {
  return record(value) && exact(value, ["status", "eventId", "startId", "participantCount", "gameCount", "scheduleMatchCount", "playState"])
    && value.status === "event_started" && value.eventId === request.eventId && isUuid(value.startId)
    && value.participantCount === request.expectedParticipantCount && value.gameCount === request.expectedGameCount
    && positiveInt(value.scheduleMatchCount, 5000) && value.playState === "in_progress";
}

const eventStartRejectedCodes = new Set(["invalid_start_request", "tournament_unavailable", "not_director", "idempotency_conflict",
  "event_already_started", "registration_open", "schedule_unavailable", "stale_roster_or_schedule",
  "attendance_or_seating_incomplete", "unexpected_scoring_activity"]);
export function isRejectedEventStart(value: unknown): value is { status: "rejected"; code: string } {
  return record(value) && exact(value, ["status", "code"]) && value.status === "rejected"
    && typeof value.code === "string" && eventStartRejectedCodes.has(value.code);
}

export function isEventScheduleWorkspace(value: unknown): value is EventScheduleWorkspace {
  if (!record(value) || !exact(value, ["tournamentName", "registrationClosed", "tableCount", "seatsPerTable", "events", "participants", "matches"])
    || typeof value.tournamentName !== "string" || !value.tournamentName.trim()
    || typeof value.registrationClosed !== "boolean"
    || !((value.tableCount === null && value.seatsPerTable === null)
      || (positiveInt(value.tableCount, 26) && positiveInt(value.seatsPerTable, 20)))
    || !Array.isArray(value.events) || !Array.isArray(value.participants) || !Array.isArray(value.matches)) return false;
  if (!value.events.every((item) => record(item)
    && exact(item, ["eventId", "name", "format", "scoringMethod", "gameCount", "participantCount", "schedulePublished", "schedulePublicationId", "participantSnapshotDigest", "publishedMatchCount", "playState", "startedAt", "startedBy"])
    && isUuid(item.eventId) && typeof item.name === "string" && !!item.name.trim()
    && formats.has(item.format as string) && methods.has(item.scoringMethod as string)
    && positiveInt(item.gameCount, 99) && nonnegativeInt(item.participantCount, 10000)
    && typeof item.schedulePublished === "boolean"
    && ((item.schedulePublished === false && item.schedulePublicationId === null && item.participantSnapshotDigest === null)
      || (item.schedulePublished === true && isUuid(item.schedulePublicationId) && typeof item.participantSnapshotDigest === "string" && digestPattern.test(item.participantSnapshotDigest)))
    && nonnegativeInt(item.publishedMatchCount, 5000) && typeof item.playState === "string" && playStates.has(item.playState)
    && (item.startedAt === null || (typeof item.startedAt === "string" && !Number.isNaN(Date.parse(item.startedAt))))
    && (item.startedBy === null || (typeof item.startedBy === "string" && !!item.startedBy.trim())))) return false;
  if (!value.participants.every((item) => record(item)
    && exact(item, ["eventId", "participantId", "displayName", "verificationId", "profileLinked"])
    && isUuid(item.eventId) && isUuid(item.participantId) && typeof item.displayName === "string" && !!item.displayName.trim()
    && isSeat(item.verificationId) && typeof item.profileLinked === "boolean")) return false;
  return value.matches.every((item) => record(item)
    && exact(item, ["eventId", "canonicalGameId", "gameNumber", "sideAVerificationId", "sideBVerificationId", "sideATableSeat", "sideBTableSeat", "sideADisplayName", "sideBDisplayName", "state"])
    && isUuid(item.eventId) && isUuid(item.canonicalGameId) && isEventScheduleMatch({ gameNumber: item.gameNumber, sideAVerificationId: item.sideAVerificationId,
      sideBVerificationId: item.sideBVerificationId, sideATableSeat: item.sideATableSeat, sideBTableSeat: item.sideBTableSeat })
    && typeof item.sideADisplayName === "string" && !!item.sideADisplayName.trim()
    && typeof item.sideBDisplayName === "string" && !!item.sideBDisplayName.trim()
    && typeof item.state === "string" && states.has(item.state));
}

export type ScheduleCsvResult = { matches: EventScheduleMatch[]; errors: string[] };

export function parseScheduleCsv(input: string): ScheduleCsvResult {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { matches: [], errors: ["Choose or paste a schedule file."] };
  const expected = ["game", "player a id", "player b id", "player a table/seat", "player b table/seat"];
  const header = lines[0].split(",").map((cell) => cell.trim().toLowerCase());
  if (header.length !== expected.length || header.some((cell, index) => cell !== expected[index])) {
    return { matches: [], errors: [`Use this exact header: ${expected.map((cell) => cell.replace(/^./, (c) => c.toUpperCase())).join(",")}`] };
  }
  const matches: EventScheduleMatch[] = [];
  const errors: string[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const cells = lines[index].split(",").map((cell) => cell.trim().toUpperCase());
    const gameNumber = Number(cells[0]);
    const match = { gameNumber, sideAVerificationId: cells[1] ?? "", sideBVerificationId: cells[2] ?? "", sideATableSeat: cells[3] ?? "", sideBTableSeat: cells[4] ?? "" };
    if (cells.length !== 5 || !isEventScheduleMatch(match)) errors.push(`Line ${index + 1} has an invalid game, Verification ID, or Table/Seat.`);
    else matches.push(match);
  }
  if (matches.length > 5000) errors.push("The schedule exceeds 5,000 matches.");
  return { matches: errors.length ? [] : matches, errors };
}

export function validateScheduleForEvent(matches: EventScheduleMatch[], gameCount: number, verificationIds: string[], tableCount?: number, seatsPerTable?: number): string[] {
  const errors: string[] = [];
  if (!positiveInt(gameCount, 99) || verificationIds.length < 2 || verificationIds.length % 2 !== 0) {
    return ["This event needs an even number of enrolled players and a valid game count."];
  }
  if (new Set(verificationIds).size !== verificationIds.length || verificationIds.some((id) => !isSeat(id))) {
    return ["Every enrolled player needs one unique Verification ID before scheduling."];
  }
  const expectedMatches = (verificationIds.length / 2) * gameCount;
  if (matches.length !== expectedMatches) errors.push(`Expected ${expectedMatches} matches; found ${matches.length}.`);
  const allowed = new Set(verificationIds);
  const seatIsInPlan = (seat: string) => {
    const [table, number] = seat.split("-");
    return table.length === 1 && table.charCodeAt(0) - 64 <= (tableCount ?? 0)
      && Number(number) <= (seatsPerTable ?? 0);
  };
  for (let game = 1; game <= gameCount; game += 1) {
    const rows = matches.filter((match) => match.gameNumber === game);
    const ids = rows.flatMap((match) => [match.sideAVerificationId, match.sideBVerificationId]);
    const seats = rows.flatMap((match) => [match.sideATableSeat, match.sideBTableSeat]);
    if (rows.length !== verificationIds.length / 2) errors.push(`Game ${game} needs ${verificationIds.length / 2} matches.`);
    if (ids.some((id) => !allowed.has(id))) errors.push(`Game ${game} contains a Verification ID not enrolled in this event.`);
    if (new Set(ids).size !== verificationIds.length || ids.length !== verificationIds.length) errors.push(`Every player must appear exactly once in game ${game}.`);
    if (new Set(seats).size !== verificationIds.length || seats.length !== verificationIds.length) errors.push(`Every Table/Seat must be unique in game ${game}.`);
    if (tableCount && seatsPerTable && seats.some((seat) => !seatIsInPlan(seat))) errors.push(`Game ${game} contains a Table/Seat outside the published table plan.`);
    if (rows.some((match) => match.sideATableSeat[0] !== match.sideBTableSeat[0])) errors.push(`Every matchup in game ${game} must seat both players at the same table.`);
  }
  if (matches.some((match) => match.gameNumber > gameCount)) errors.push(`Game numbers must be between 1 and ${gameCount}.`);
  return [...new Set(errors)];
}
