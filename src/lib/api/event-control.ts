import { isUuid } from "./validation.ts";

// Hand-written predicates, in the shape src/lib/api/tournament-archive.ts uses.
// Every accepted body is exact: an unexpected extra key is a different request
// than the one this route was reviewed for, and the route rejects it rather
// than forwarding it to an RPC that would ignore it.

export type EventPlayPauseRequest = { action: "pause" | "resume"; reason: string; idempotencyKey: string };

export type EventPlayCloseRequest =
  | { action: "close"; reason: string; confirmed: true; idempotencyKey: string }
  | { action: "reopen"; reason: string; idempotencyKey: string };

export type EventPlayPauseResult =
  | { status: "event_play_paused" | "event_play_resumed"; eventId: string; pauseState: "paused" | "open" }
  | { status: "already_paused" | "not_paused"; eventId: string }
  | EventControlRejection;

export type EventPlayCloseResult =
  | { status: "event_play_closed"; eventId: string; closeState: "closed"; scheduledGames: number; resolvedGames: number; unresolvedGames: number }
  | { status: "event_play_reopened"; eventId: string; closeState: "open" }
  | { status: "already_closed" | "not_closed"; eventId: string }
  | EventControlRejection;

export type EventControlRejection = {
  status: "rejected";
  code: string;
  scheduledGames?: number;
  resolvedGames?: number;
  unresolvedGames?: number;
};

export type EventControlReadiness = { scheduledGames: number; resolvedGames: number; unresolvedGames: number };

export type EventControlEvent = {
  eventId: string;
  name: string;
  format: string;
  scoringMethod: string;
  playState: string;
  started: boolean;
  teamEvent: boolean;
  pauseState: "paused" | "open";
  pausedAt: string | null;
  pauseAction: string | null;
  pauseReason: string | null;
  pauseActor: string | null;
  closeState: "closed" | "open";
  closedAt: string | null;
  closeAction: string | null;
  closeReason: string | null;
  closeActor: string | null;
  canReopen: boolean;
  readiness: EventControlReadiness;
};

export type EventControlWorkspace = {
  tournamentName: string;
  tournamentStatus: string;
  events: EventControlEvent[];
};

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const nullableText = (value: unknown): value is string | null => value === null || typeof value === "string";

const wholeCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

// A reason is required on all four actions, pause included. A pause with no
// reason is the one an official finds an hour later with nobody able to say
// whether play may resume.
const usableReason = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= 1000;

export function isEventPlayPauseRequest(value: unknown): value is EventPlayPauseRequest {
  return record(value)
    && Object.keys(value).length === 3
    && (value.action === "pause" || value.action === "resume")
    && usableReason(value.reason)
    && isUuid(value.idempotencyKey);
}

export function isEventPlayCloseRequest(value: unknown): value is EventPlayCloseRequest {
  if (!record(value) || !usableReason(value.reason) || !isUuid(value.idempotencyKey)) return false;
  // Closing carries its own explicit confirmation, which close_event_play_v1
  // checks again server side. Reopening does not: it is the undo, and the guard
  // that matters there is the downstream-activity check, not a tick.
  if (value.action === "close") return Object.keys(value).length === 4 && value.confirmed === true;
  return value.action === "reopen" && Object.keys(value).length === 3;
}

function isRejection(value: Record<string, unknown>): value is EventControlRejection {
  if (value.status !== "rejected" || typeof value.code !== "string") return false;
  // games_unresolved carries the counts the director needs to act on. Any other
  // rejection carries none, and a partial set of counts is a payload this route
  // did not produce.
  const counts = [value.scheduledGames, value.resolvedGames, value.unresolvedGames];
  if (counts.every((count) => count === undefined)) return Object.keys(value).length === 2;
  return Object.keys(value).length === 5 && counts.every(wholeCount);
}

export function isEventPlayPauseResult(value: unknown): value is EventPlayPauseResult {
  if (!record(value) || typeof value.status !== "string") return false;
  if (value.status === "rejected") return isRejection(value);
  if (value.status === "event_play_paused" || value.status === "event_play_resumed") {
    return Object.keys(value).length === 3 && isUuid(value.eventId)
      && (value.pauseState === "paused" || value.pauseState === "open");
  }
  return (value.status === "already_paused" || value.status === "not_paused")
    && Object.keys(value).length === 2 && isUuid(value.eventId);
}

export function isEventPlayCloseResult(value: unknown): value is EventPlayCloseResult {
  if (!record(value) || typeof value.status !== "string") return false;
  if (value.status === "rejected") return isRejection(value);
  if (value.status === "event_play_closed") {
    return Object.keys(value).length === 6 && isUuid(value.eventId) && value.closeState === "closed"
      && wholeCount(value.scheduledGames) && wholeCount(value.resolvedGames) && wholeCount(value.unresolvedGames);
  }
  if (value.status === "event_play_reopened") {
    return Object.keys(value).length === 3 && isUuid(value.eventId) && value.closeState === "open";
  }
  return (value.status === "already_closed" || value.status === "not_closed")
    && Object.keys(value).length === 2 && isUuid(value.eventId);
}

function isReadiness(value: unknown): value is EventControlReadiness {
  return record(value) && wholeCount(value.scheduledGames) && wholeCount(value.resolvedGames) && wholeCount(value.unresolvedGames);
}

function isEventControlEvent(value: unknown): value is EventControlEvent {
  return record(value)
    && isUuid(value.eventId)
    && typeof value.name === "string"
    && typeof value.format === "string"
    && typeof value.scoringMethod === "string"
    && typeof value.playState === "string"
    && typeof value.started === "boolean"
    && typeof value.teamEvent === "boolean"
    && (value.pauseState === "paused" || value.pauseState === "open")
    && nullableText(value.pausedAt) && nullableText(value.pauseAction)
    && nullableText(value.pauseReason) && nullableText(value.pauseActor)
    && (value.closeState === "closed" || value.closeState === "open")
    && nullableText(value.closedAt) && nullableText(value.closeAction)
    && nullableText(value.closeReason) && nullableText(value.closeActor)
    && typeof value.canReopen === "boolean"
    && isReadiness(value.readiness);
}

export function isEventControlWorkspace(value: unknown): value is EventControlWorkspace {
  return record(value)
    && typeof value.tournamentName === "string"
    && typeof value.tournamentStatus === "string"
    && Array.isArray(value.events)
    && value.events.every(isEventControlEvent);
}

export function eventControlRejectionMessage(result: EventControlRejection) {
  if (result.code === "games_unresolved") {
    const unresolved = result.unresolvedGames ?? 0;
    return `${unresolved} of ${result.scheduledGames ?? 0} scheduled games are still unrecorded or unverified. Close Event stays refused until every one of them is resolved.`;
  }
  if (result.code === "not_director") return "Only a director or co-director can change event play.";
  if (result.code === "tournament_unavailable") return "This tournament is no longer open.";
  if (result.code === "event_unavailable") return "That event is no longer available.";
  if (result.code === "event_not_started") return "Play has not started for this event yet, so there is nothing to pause or close.";
  if (result.code === "team_event_unsupported") return "Team events score through a separate path that these controls do not reach. Pause and Close Event are not available for them.";
  if (result.code === "event_closed") return "This event is already closed. Reopen it first if play must continue.";
  if (result.code === "no_scheduled_games") return "This event has no scheduled games, so there is no play to close.";
  if (result.code === "downstream_activity") return "Qualification, a settlement draft, a playoff result or a final settlement already exists for this event, so it can no longer be reopened.";
  if (result.code === "idempotency_conflict") return "A different operation is already using this request id. Reload and try again.";
  if (result.code === "invalid_request") return "That request was incomplete. Reload and try again.";
  return "That change could not be applied. Reload and try again.";
}
