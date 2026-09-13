import "server-only";

import { isUuid } from "./validation.ts";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export type FinalizedEventReport = {
  status: "finalized_event_report";
  tournamentId: string;
  eventId: string;
  tournamentName: string;
  tournamentDate: string;
  eventName: string;
  qualificationResultVersionId: string;
  playoffResultVersionId: string;
  settlementDraftId: string;
  finalizationId: string;
  finalizationVersion: number;
  participantCount: number;
  qualifierCount: number;
  currencyCode: "USD";
  finalizedAt: string;
  finalizedBy: string;
  officialSourceReference: string;
  playoffPlacements: Array<{ participantId: string; displayName: string; placement: number; prizeAmountMinor: number }>;
  qualifiers: Array<{
    participantId: string; displayName: string; qualificationRank: number; gamePoints: number; gamesWon: number;
    plusPoints: number; minusPoints: number; netSpreadPoints: number; mrpPoints: number;
    qPoolAwardMinor: number; otherAwardMinor: number;
  }>;
  highNonQualifier: {
    participantId: string; displayName: string; gamePoints: number; gamesWon: number;
    plusPoints: number; minusPoints: number; netSpreadPoints: number;
  };
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const whole = (value: unknown, minimum = 0) => Number.isSafeInteger(value) && (value as number) >= minimum;
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const timestamp = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));

function scoreRow(value: unknown, qualifier: boolean) {
  if (!record(value)) return false;
  const keys = ["participantId", "displayName", "gamePoints", "gamesWon", "plusPoints", "minusPoints", "netSpreadPoints"];
  if (qualifier) keys.push("qualificationRank", "mrpPoints", "qPoolAwardMinor", "otherAwardMinor");
  return exact(value, keys) && isUuid(value.participantId) && text(value.displayName)
    && whole(value.gamePoints) && whole(value.gamesWon) && whole(value.plusPoints) && whole(value.minusPoints)
    && Number.isSafeInteger(value.netSpreadPoints) && value.netSpreadPoints === (value.plusPoints as number) - (value.minusPoints as number)
    && (!qualifier || (whole(value.qualificationRank, 1) && whole(value.mrpPoints)
      && whole(value.qPoolAwardMinor) && whole(value.otherAwardMinor)));
}

export function isFinalizedEventReport(value: unknown, tournamentId: string, eventId: string): value is FinalizedEventReport {
  if (!record(value) || !exact(value, ["status", "tournamentId", "eventId", "tournamentName", "tournamentDate", "eventName",
    "qualificationResultVersionId", "playoffResultVersionId", "settlementDraftId", "finalizationId", "finalizationVersion",
    "participantCount", "qualifierCount", "currencyCode", "finalizedAt", "finalizedBy", "officialSourceReference",
    "playoffPlacements", "qualifiers", "highNonQualifier"]) || value.status !== "finalized_event_report"
    || value.tournamentId !== tournamentId || value.eventId !== eventId || !text(value.tournamentName)
    || typeof value.tournamentDate !== "string" || !text(value.eventName)
    || ![value.qualificationResultVersionId, value.playoffResultVersionId, value.settlementDraftId, value.finalizationId].every(isUuid)
    || !whole(value.finalizationVersion, 1) || !whole(value.participantCount, 2) || !whole(value.qualifierCount, 1)
    || value.currencyCode !== "USD" || !timestamp(value.finalizedAt) || !text(value.finalizedBy)
    || !text(value.officialSourceReference) || !Array.isArray(value.playoffPlacements)
    || value.playoffPlacements.length < 2 || !value.playoffPlacements.every((item, index) => record(item)
      && exact(item, ["participantId", "displayName", "placement", "prizeAmountMinor"])
      && isUuid(item.participantId) && text(item.displayName) && item.placement === index + 1 && whole(item.prizeAmountMinor))
    || !Array.isArray(value.qualifiers) || value.qualifiers.length !== value.qualifierCount
    || !value.qualifiers.every((item, index) => scoreRow(item, true) && item.qualificationRank === index + 1)
    || !scoreRow(value.highNonQualifier, false)) return false;
  const qualifierIds = new Set(value.qualifiers.map((item) => (item as { participantId: string }).participantId));
  const ids = [...qualifierIds, (value.highNonQualifier as { participantId: string }).participantId];
  const placementIds = value.playoffPlacements.map((item) => (item as { participantId: string }).participantId);
  return new Set(ids).size === ids.length && new Set(placementIds).size === placementIds.length
    && placementIds.every((participantId) => qualifierIds.has(participantId));
}

export async function getFinalizedEventReport(admin: RpcClient, actorId: string, tournamentId: string, eventId: string) {
  if (![actorId, tournamentId, eventId].every(isUuid)) throw new Error("Finalized event report is unavailable.");
  const { data, error } = await admin.rpc("get_finalized_standard_singles_event_report_v1", {
    p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId,
  });
  if (error) throw new Error("Finalized event report is unavailable.");
  if (data === null) return null;
  if (!isFinalizedEventReport(data, tournamentId, eventId)) throw new Error("Finalized event report is unavailable.");
  return data;
}
