import { isUuid } from "./validation.ts";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
type Choice = { participantId: string; displayName: string; qualificationRank: number };
export type PlayoffPlacement = { participantId: string; placement: number };
export type PlayoffPlacementRequest = {
  qualificationResultVersionId: string;
  expectedVersion: number;
  placements: PlayoffPlacement[];
  idempotencyKey: string;
};
export type PlayoffPlacementOutcome = {
  status: "playoff_placements_recorded";
  tournamentId: string;
  eventId: string;
  qualificationResultVersionId: string;
  playoffResultVersionId: string;
  version: number;
  supersedesPlayoffResultVersionId: string | null;
  placementCount: number;
  recordedAt: string;
};
export type PlayoffPlacementWorkspace = {
  tournamentId: string;
  eventId: string;
  qualificationResultVersionId: string;
  currentVersion: number;
  qualifierChoices: Choice[];
  playoffResult: null | {
    playoffResultVersionId: string;
    version: number;
    recordedAt: string;
    recordedBy: string;
    placements: Array<PlayoffPlacement & { displayName: string }>;
  };
  capabilities: { mrpCalculation: false; qPoolCalculation: false; payoutCalculation: false; publication: false };
};

const rejectionCodes = new Set(["tournament_unavailable", "not_director", "qualification_result_unavailable", "stale_version", "invalid_placements", "invalid_request", "idempotency_conflict"]);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const whole = (value: unknown, min = 0) => Number.isSafeInteger(value) && (value as number) >= min;
const timestamp = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const nullableUuid = (value: unknown) => value === null || isUuid(value);

function placement(value: unknown): value is PlayoffPlacement {
  return record(value) && exact(value, ["participantId", "placement"]) && isUuid(value.participantId) && whole(value.placement, 1);
}
function choice(value: unknown): value is Choice {
  return record(value) && exact(value, ["participantId", "displayName", "qualificationRank"])
    && isUuid(value.participantId) && text(value.displayName) && whole(value.qualificationRank, 1);
}

export function isPlayoffPlacementRequest(value: unknown): value is PlayoffPlacementRequest {
  if (!record(value) || !exact(value, ["qualificationResultVersionId", "expectedVersion", "placements", "idempotencyKey"])
    || !isUuid(value.qualificationResultVersionId) || !whole(value.expectedVersion) || !isUuid(value.idempotencyKey)
    || !Array.isArray(value.placements) || value.placements.length < 2 || value.placements.length > 128
    || !value.placements.every(placement)) return false;
  return new Set(value.placements.map((item) => item.participantId)).size === value.placements.length
    && value.placements.every((item, index) => item.placement === index + 1);
}

export function isPlayoffPlacementOutcome(value: unknown, tournamentId: string, eventId: string): value is PlayoffPlacementOutcome {
  return record(value) && exact(value, ["status", "tournamentId", "eventId", "qualificationResultVersionId", "playoffResultVersionId", "version", "supersedesPlayoffResultVersionId", "placementCount", "recordedAt"])
    && value.status === "playoff_placements_recorded" && value.tournamentId === tournamentId && value.eventId === eventId
    && isUuid(value.qualificationResultVersionId) && isUuid(value.playoffResultVersionId) && whole(value.version, 1)
    && nullableUuid(value.supersedesPlayoffResultVersionId) && whole(value.placementCount, 2) && timestamp(value.recordedAt);
}

export function isRejectedPlayoffPlacement(value: unknown, eventId: string) {
  return record(value) && exact(value, ["status", "code", "eventId"]) && value.status === "rejected"
    && value.eventId === eventId && typeof value.code === "string" && rejectionCodes.has(value.code);
}

export function isPlayoffPlacementWorkspace(value: unknown, tournamentId: string, eventId: string): value is PlayoffPlacementWorkspace {
  if (!record(value) || !exact(value, ["tournamentId", "eventId", "qualificationResultVersionId", "currentVersion", "qualifierChoices", "playoffResult", "capabilities"])
    || value.tournamentId !== tournamentId || value.eventId !== eventId || !isUuid(value.qualificationResultVersionId)
    || !whole(value.currentVersion) || !Array.isArray(value.qualifierChoices) || !value.qualifierChoices.every(choice)
    || !record(value.capabilities) || !exact(value.capabilities, ["mrpCalculation", "qPoolCalculation", "payoutCalculation", "publication"])
    || Object.values(value.capabilities).some((item) => item !== false)) return false;
  if (value.playoffResult === null) return value.currentVersion === 0;
  const result = value.playoffResult;
  return record(result) && exact(result, ["playoffResultVersionId", "version", "recordedAt", "recordedBy", "placements"])
    && isUuid(result.playoffResultVersionId) && result.version === value.currentVersion && timestamp(result.recordedAt)
    && text(result.recordedBy) && Array.isArray(result.placements) && result.placements.every((item, index) =>
      record(item) && exact(item, ["participantId", "displayName", "placement"]) && isUuid(item.participantId)
      && text(item.displayName) && item.placement === index + 1);
}

export async function getPlayoffPlacementWorkspace(admin: RpcClient, actorId: string, tournamentId: string, eventId: string) {
  if (![actorId, tournamentId, eventId].every(isUuid)) throw new Error("Playoff placement workspace is unavailable.");
  const { data, error } = await admin.rpc("get_standard_singles_playoff_placement_workspace_v1", { p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId });
  return error || !isPlayoffPlacementWorkspace(data, tournamentId, eventId) ? null : data;
}

export function recordPlayoffPlacements(admin: RpcClient, actorId: string, tournamentId: string, eventId: string, request: PlayoffPlacementRequest) {
  return admin.rpc("record_standard_singles_playoff_placements_v1", {
    p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId,
    p_qualification_result_version_id: request.qualificationResultVersionId,
    p_expected_version: request.expectedVersion, p_placements: request.placements, p_operation_id: request.idempotencyKey,
  });
}
