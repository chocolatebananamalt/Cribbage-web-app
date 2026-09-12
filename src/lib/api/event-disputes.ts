import { isUuid } from "./validation.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export type OpenEventDisputeRequest = {
  disputeId: string;
  gameId: string;
  summary: string;
  idempotencyKey: string;
};

export type ResolveEventDisputeRequest = {
  resolutionNote: string;
  idempotencyKey: string;
};

export type EventDisputeWorkspace = {
  tournamentId: string;
  eventId: string;
  actorRole: "director" | "co_director" | "cross_checker" | "judge";
  games: Array<{
    gameId: string;
    roundNumber: number;
    matchInstance: number;
    sideAName: string;
    sideBName: string;
    state: "pending" | "submitted" | "mismatch" | "confirmation_pending" | "verified" | "corrected";
    canOpen: boolean;
  }>;
  openDisputes: Array<{
    disputeId: string;
    gameId: string;
    matchInstance: number;
    summary: string;
    openedAt: string;
    openedBy: string;
    sideAName: string;
    sideBName: string;
    canResolve: boolean;
  }>;
};

const openRejectionCodes = new Set([
  "invalid_request", "game_unavailable", "lifecycle_unavailable", "not_authorized",
  "qualification_finalized", "dispute_id_unavailable", "open_dispute_exists",
  "idempotency_conflict", "dispute_unavailable",
]);
const resolutionRejectionCodes = new Set([
  "invalid_request", "dispute_unavailable", "not_authorized", "resolver_not_independent",
  "already_resolved", "lifecycle_unavailable", "idempotency_conflict", "resolution_unavailable",
]);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function boundedText(value: unknown) {
  return typeof value === "string" && value === value.trim() && value.length >= 1 && value.length <= 500
    && new TextEncoder().encode(value).length <= 2000 && !/[\u0000-\u001f\u007f]/.test(value);
}

function timestamp(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function isOpenEventDisputeRequest(value: unknown): value is OpenEventDisputeRequest {
  return record(value) && exact(value, ["disputeId", "gameId", "summary", "idempotencyKey"])
    && isUuid(value.disputeId) && isUuid(value.gameId) && boundedText(value.summary)
    && isUuid(value.idempotencyKey);
}

export function isResolveEventDisputeRequest(value: unknown): value is ResolveEventDisputeRequest {
  return record(value) && exact(value, ["resolutionNote", "idempotencyKey"])
    && boundedText(value.resolutionNote) && isUuid(value.idempotencyKey);
}

export function isOpenEventDisputeOutcome(
  value: unknown,
  request: OpenEventDisputeRequest,
  tournamentId: string,
  eventId: string,
) {
  return record(value) && exact(value, ["status", "disputeId", "tournamentId", "eventId", "gameId"])
    && value.status === "open" && value.disputeId === request.disputeId
    && value.tournamentId === tournamentId && value.eventId === eventId && value.gameId === request.gameId;
}

export function isResolvedEventDisputeOutcome(value: unknown, disputeId: string) {
  return record(value) && exact(value, ["status", "disputeId", "eventId", "gameId"])
    && value.status === "resolved" && value.disputeId === disputeId
    && isUuid(value.eventId) && isUuid(value.gameId);
}

export function isRejectedEventDispute(
  value: unknown,
  disputeId: string,
  resolution = false,
) {
  if (!record(value) || value.status !== "rejected" || value.disputeId !== disputeId || typeof value.code !== "string") return false;
  if (resolution) {
    return exact(value, ["status", "code", "disputeId"]) && resolutionRejectionCodes.has(value.code);
  }
  return exact(value, ["status", "code", "disputeId", "eventId", "gameId"])
    && openRejectionCodes.has(value.code) && isUuid(value.eventId) && isUuid(value.gameId);
}

export function isEventDisputeWorkspace(value: unknown, tournamentId: string, eventId: string): value is EventDisputeWorkspace {
  if (!record(value) || !exact(value, ["tournamentId", "eventId", "actorRole", "games", "openDisputes"])
    || value.tournamentId !== tournamentId || value.eventId !== eventId
    || !["director", "co_director", "cross_checker", "judge"].includes(value.actorRole as string)
    || !Array.isArray(value.games) || !Array.isArray(value.openDisputes)) return false;
  const gameIds = new Set<string>();
  for (const game of value.games) {
    if (!record(game) || !exact(game, [
      "gameId", "roundNumber", "matchInstance", "sideAName", "sideBName", "state", "canOpen",
    ]) || !isUuid(game.gameId) || !Number.isSafeInteger(game.roundNumber) || (game.roundNumber as number) < 1
      || !Number.isSafeInteger(game.matchInstance) || (game.matchInstance as number) < 1
      || !boundedText(game.sideAName) || !boundedText(game.sideBName)
      || !["pending", "submitted", "mismatch", "confirmation_pending", "verified", "corrected"].includes(game.state as string)
      || typeof game.canOpen !== "boolean" || gameIds.has(game.gameId)) return false;
    gameIds.add(game.gameId);
  }
  const identities = new Set<string>();
  const games = new Set<string>();
  for (const dispute of value.openDisputes) {
    if (!record(dispute) || !exact(dispute, [
      "disputeId", "gameId", "matchInstance", "summary", "openedAt", "openedBy",
      "sideAName", "sideBName", "canResolve",
    ]) || !isUuid(dispute.disputeId) || !isUuid(dispute.gameId)
      || !Number.isSafeInteger(dispute.matchInstance) || (dispute.matchInstance as number) < 1
      || !boundedText(dispute.summary) || !timestamp(dispute.openedAt)
      || !boundedText(dispute.openedBy) || !boundedText(dispute.sideAName) || !boundedText(dispute.sideBName)
      || typeof dispute.canResolve !== "boolean" || identities.has(dispute.disputeId)
      || games.has(dispute.gameId) || !gameIds.has(dispute.gameId)) return false;
    identities.add(dispute.disputeId);
    games.add(dispute.gameId);
  }
  return true;
}

export function openEventDispute(
  admin: RpcClient,
  actorId: string,
  tournamentId: string,
  eventId: string,
  request: OpenEventDisputeRequest,
) {
  return admin.rpc("open_event_dispute_v1", {
    p_actor_id: actorId,
    p_tournament_id: tournamentId,
    p_event_id: eventId,
    p_game_id: request.gameId,
    p_dispute_id: request.disputeId,
    p_summary: request.summary,
    p_operation_id: request.idempotencyKey,
  });
}

export function resolveEventDispute(
  admin: RpcClient,
  actorId: string,
  disputeId: string,
  request: ResolveEventDisputeRequest,
) {
  return admin.rpc("resolve_event_dispute_v1", {
    p_actor_id: actorId,
    p_dispute_id: disputeId,
    p_resolution_note: request.resolutionNote,
    p_operation_id: request.idempotencyKey,
  });
}

export async function getEventDisputeWorkspace(
  admin: RpcClient,
  actorId: string,
  tournamentId: string,
  eventId: string,
) {
  if (![actorId, tournamentId, eventId].every(isUuid)) throw new Error("Event dispute workspace is unavailable.");
  const { data, error } = await admin.rpc("get_event_dispute_workspace_v1", {
    p_actor_id: actorId,
    p_tournament_id: tournamentId,
    p_event_id: eventId,
  });
  if (error || data === null) return null;
  if (!isEventDisputeWorkspace(data, tournamentId, eventId)) throw new Error("Event dispute workspace is unavailable.");
  return data;
}
