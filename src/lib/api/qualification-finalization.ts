import "server-only";

import { isUuid } from "./validation.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

const rejectedCodes = new Set([
  "tournament_unavailable", "not_director", "event_unavailable", "already_finalized",
  "schedule_incomplete", "scorecards_unresolved", "recovery_pending", "correction_pending",
  "qualification_notice_pending", "ranking_tie_unresolved", "cutoff_tied", "high_non_qualifier_tied", "idempotency_conflict",
  "invalid_request",
]);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

const whole = (value: unknown, minimum = 0) => Number.isSafeInteger(value) && (value as number) >= minimum;
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const timestamp = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));

export type QualificationFinalizationRequest = { idempotencyKey: string };

export type QualificationFinalizationOutcome = {
  status: "qualification_finalized";
  tournamentId: string;
  eventId: string;
  resultVersionId: string;
  version: number;
  participantCount: number;
  qualifierCount: number;
  finalizedAt: string;
};

export type QualificationResultRow = {
  participantId: string;
  displayName: string;
  numericRank: number;
  tied?: boolean;
  qualificationRank?: number;
  verifiedGames: number;
  gamePoints: number;
  gamesWon: number;
  plusPoints: number;
  minusPoints: number;
  netSpreadPoints: number;
};

export type QualificationResult = {
  status: "qualification_finalized";
  tournamentId: string;
  eventId: string;
  resultVersionId: string;
  version: number;
  tournamentName: string;
  eventName: string;
  participantCount: number;
  qualifierCount: number;
  finalizedAt: string;
  finalizedBy: string;
  qualifiers: Array<QualificationResultRow & { qualificationRank: number; tied: boolean }>;
  highNonQualifier: QualificationResultRow;
  playoffResultsAvailable: false;
  financialAwardsCalculated: false;
  officialAccExportAvailable: false;
};

export function isQualificationFinalizationRequest(value: unknown): value is QualificationFinalizationRequest {
  return record(value) && exact(value, ["idempotencyKey"]) && isUuid(value.idempotencyKey);
}

export function isQualificationFinalizationOutcome(
  value: unknown, tournamentId: string, eventId: string,
): value is QualificationFinalizationOutcome {
  return record(value) && exact(value, ["status", "tournamentId", "eventId", "resultVersionId", "version", "participantCount", "qualifierCount", "finalizedAt"])
    && value.status === "qualification_finalized" && value.tournamentId === tournamentId && value.eventId === eventId
    && isUuid(value.resultVersionId) && value.version === 1 && whole(value.participantCount, 2)
    && whole(value.qualifierCount, 1) && (value.qualifierCount as number) === Math.ceil((value.participantCount as number) / 4)
    && timestamp(value.finalizedAt);
}

export function isRejectedQualificationFinalization(value: unknown, eventId: string) {
  return record(value) && exact(value, ["status", "code", "eventId"])
    && value.status === "rejected" && value.eventId === eventId
    && typeof value.code === "string" && rejectedCodes.has(value.code);
}

function resultRow(value: unknown, qualifier: boolean): value is QualificationResultRow {
  if (!record(value)) return false;
  const keys = ["participantId", "displayName", "numericRank", "verifiedGames", "gamePoints", "gamesWon", "plusPoints", "minusPoints", "netSpreadPoints"];
  if (qualifier) keys.push("qualificationRank", "tied");
  return exact(value, keys) && isUuid(value.participantId) && text(value.displayName)
    && whole(value.numericRank, 1) && whole(value.verifiedGames, 1) && whole(value.gamePoints)
    && whole(value.gamesWon) && (value.gamesWon as number) <= (value.verifiedGames as number)
    && (value.gamePoints as number) >= 2 * (value.gamesWon as number)
    && (value.gamePoints as number) <= 3 * (value.gamesWon as number)
    && whole(value.plusPoints) && whole(value.minusPoints)
    && Number.isSafeInteger(value.netSpreadPoints)
    && value.netSpreadPoints === (value.plusPoints as number) - (value.minusPoints as number)
    && (!qualifier || (whole(value.qualificationRank, 1) && typeof value.tied === "boolean"));
}

export function isQualificationResult(value: unknown, tournamentId: string, eventId: string): value is QualificationResult {
  if (!record(value) || !exact(value, ["status", "tournamentId", "eventId", "resultVersionId", "version", "tournamentName", "eventName", "participantCount", "qualifierCount", "finalizedAt", "finalizedBy", "qualifiers", "highNonQualifier", "playoffResultsAvailable", "financialAwardsCalculated", "officialAccExportAvailable"])
      || value.status !== "qualification_finalized" || value.tournamentId !== tournamentId || value.eventId !== eventId
      || !isUuid(value.resultVersionId) || !whole(value.version, 1) || !text(value.tournamentName) || !text(value.eventName)
      || !whole(value.participantCount, 2) || !whole(value.qualifierCount, 1)
      || value.qualifierCount !== Math.ceil((value.participantCount as number) / 4)
      || !timestamp(value.finalizedAt) || !text(value.finalizedBy) || !Array.isArray(value.qualifiers)
      || value.qualifiers.length !== value.qualifierCount || !value.qualifiers.every((row) => resultRow(row, true))
      || !resultRow(value.highNonQualifier, false) || value.playoffResultsAvailable !== false
      || value.financialAwardsCalculated !== false || value.officialAccExportAvailable !== false) return false;
  const qualifiers = value.qualifiers as Array<QualificationResultRow & { qualificationRank: number }>;
  return qualifiers.every((row, index) => row.qualificationRank === index + 1)
    && new Set([...qualifiers.map((row) => row.participantId), (value.highNonQualifier as QualificationResultRow).participantId]).size === qualifiers.length + 1;
}

export async function finalizeQualification(admin: RpcClient, actorId: string, tournamentId: string, eventId: string, idempotencyKey: string) {
  if (![actorId, tournamentId, eventId, idempotencyKey].every(isUuid)) throw new Error("Qualification finalization is unavailable.");
  return admin.rpc("finalize_standard_singles_qualification_v1", {
    p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId, p_operation_id: idempotencyKey,
  });
}

export async function getQualificationResult(admin: RpcClient, actorId: string, tournamentId: string, eventId: string) {
  if (![actorId, tournamentId, eventId].every(isUuid)) throw new Error("Qualification result is unavailable.");
  const { data, error } = await admin.rpc("get_standard_singles_qualification_result_v1", {
    p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId,
  });
  if (error) throw new Error("Qualification result is unavailable.");
  if (data === null) return null;
  if (!isQualificationResult(data, tournamentId, eventId)) throw new Error("Qualification result is unavailable.");
  return data;
}
