import { isUuid } from "./validation.ts";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export type PlayoffOutcomeSeries = { winnerId: string; loserId: string; evidenceNote: string };
export type PlayoffOutcomeRequest = {
  qualificationResultVersionId: string;
  expectedVersion: number;
  series: [PlayoffOutcomeSeries, PlayoffOutcomeSeries, PlayoffOutcomeSeries];
  idempotencyKey: string;
};
export type PlayoffOutcomeResult = {
  status: "playoff_outcomes_recorded";
  tournamentId: string;
  eventId: string;
  resultId: string;
  version: number;
  bracketSourceVersion: "acc-rulebook-2025-effective-2025-08-01";
  mrpSourceVersion: "acc-published-mrp-2016-08-01";
  recordedAt: string;
};
export type PlayoffOutcomeWorkspace = {
  tournamentId: string;
  eventId: string;
  qualificationResultVersionId: string;
  currentVersion: number;
  legacyConflict: boolean;
  supported: boolean;
  supportedFormat: boolean;
  canRecord: boolean;
  blocker: null | "tournament_unavailable" | "unsupported_format" | "legacy_conflict" | "qualification_unavailable";
  qualifiers: Array<{ participantId: string; displayName: string; qualificationRank: number; gamePoints: number }>;
  result: null | {
    resultId: string;
    version: number;
    bracketSourceVersion: "acc-rulebook-2025-effective-2025-08-01";
    mrpSourceVersion: "acc-published-mrp-2016-08-01";
    series: [PlayoffOutcomeSeries, PlayoffOutcomeSeries, PlayoffOutcomeSeries];
    outcomes: Array<{
      participantId: string;
      playedMatchWins: number;
      byeWins: number;
      eliminatedInRound: number | null;
      champion: boolean;
      bandStart: number;
      bandEnd: number;
      qualifyingMrp: number;
      playoffMrp: number;
      totalMrp: number;
    }>;
    recordedAt: string;
  };
  capabilities: { settlement: false };
};
export type RejectedPlayoffOutcome = { status: "rejected"; code: string; eventId: string };

const rejectionCodes = new Set([
  "not_director", "tournament_unavailable", "unsupported_format", "qualification_unavailable",
  "stale_version", "legacy_conflict", "invalid_series", "idempotency_conflict",
]);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const whole = (value: unknown, min = 0) => Number.isSafeInteger(value) && (value as number) >= min;
const timestamp = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const note = (value: unknown) => typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= 200;

function series(value: unknown): value is PlayoffOutcomeSeries {
  return record(value) && exact(value, ["winnerId", "loserId", "evidenceNote"])
    && isUuid(value.winnerId) && isUuid(value.loserId) && value.winnerId !== value.loserId && note(value.evidenceNote);
}

function seriesList(value: unknown): value is [PlayoffOutcomeSeries, PlayoffOutcomeSeries, PlayoffOutcomeSeries] {
  return Array.isArray(value) && value.length === 3 && value.every(series);
}

export function isPlayoffOutcomeRequest(value: unknown): value is PlayoffOutcomeRequest {
  return record(value) && exact(value, ["qualificationResultVersionId", "expectedVersion", "series", "idempotencyKey"])
    && isUuid(value.qualificationResultVersionId) && whole(value.expectedVersion)
    && isUuid(value.idempotencyKey) && seriesList(value.series);
}

export function isPlayoffOutcomeResult(value: unknown, tournamentId: string, eventId: string): value is PlayoffOutcomeResult {
  return record(value) && exact(value, ["status", "tournamentId", "eventId", "resultId", "version", "bracketSourceVersion", "mrpSourceVersion", "recordedAt"])
    && value.status === "playoff_outcomes_recorded" && value.tournamentId === tournamentId && value.eventId === eventId
    && isUuid(value.resultId) && whole(value.version, 1)
    && value.bracketSourceVersion === "acc-rulebook-2025-effective-2025-08-01"
    && value.mrpSourceVersion === "acc-published-mrp-2016-08-01" && timestamp(value.recordedAt);
}

export function isRejectedPlayoffOutcome(value: unknown, eventId: string): value is RejectedPlayoffOutcome {
  return record(value) && exact(value, ["status", "code", "eventId"]) && value.status === "rejected"
    && value.eventId === eventId && typeof value.code === "string" && rejectionCodes.has(value.code);
}

function qualifier(value: unknown) {
  return record(value) && exact(value, ["participantId", "displayName", "qualificationRank", "gamePoints"])
    && isUuid(value.participantId) && typeof value.displayName === "string" && value.displayName.trim().length > 0
    && whole(value.qualificationRank, 1) && (value.qualificationRank as number) <= 36 && whole(value.gamePoints);
}

function outcome(value: unknown) {
  return record(value) && exact(value, ["participantId", "playedMatchWins", "byeWins", "eliminatedInRound", "champion", "bandStart", "bandEnd", "qualifyingMrp", "playoffMrp", "totalMrp"])
    && isUuid(value.participantId) && whole(value.playedMatchWins) && whole(value.byeWins)
    && (value.eliminatedInRound === null || whole(value.eliminatedInRound, 1)) && typeof value.champion === "boolean"
    && whole(value.bandStart) && whole(value.bandEnd) && whole(value.qualifyingMrp) && whole(value.playoffMrp) && whole(value.totalMrp);
}

function samePair(left: PlayoffOutcomeSeries, first: string, second: string) {
  return new Set([left.winnerId, left.loserId]).size === 2 && new Set([left.winnerId, left.loserId]).has(first) && new Set([left.winnerId, left.loserId]).has(second);
}

function derivedResult(result: Record<string, unknown>, qualifiers: Array<{ participantId: string; qualificationRank: number; gamePoints: number }>) {
  if (qualifiers.length !== 4 || qualifiers.some((item) => item.gamePoints < 0)) return false;
  const matches = result.series as [PlayoffOutcomeSeries, PlayoffOutcomeSeries, PlayoffOutcomeSeries];
  const [a, b, final] = matches;
  if (!samePair(a, qualifiers[0].participantId, qualifiers[3].participantId) || !samePair(b, qualifiers[1].participantId, qualifiers[2].participantId)
    || !samePair(final, a.winnerId, b.winnerId)) return false;
  const ids = qualifiers.map((item) => item.participantId);
  const rows = result.outcomes as Array<Record<string, unknown>>;
  if (new Set(rows.map((row) => row.participantId)).size !== 4 || !ids.every((id) => rows.some((row) => row.participantId === id))) return false;
  const wins = new Map(ids.map((id) => [id, matches.filter((match) => match.winnerId === id).length]));
  return rows.every((row) => {
    const id = row.participantId as string;
    const index = ids.indexOf(id);
    const matchWins = wins.get(id) ?? 0;
    const champion = final.winnerId === id;
    const eliminated = champion ? null : final.loserId === id ? 2 : 1;
    const bandStart = champion ? 1 : final.loserId === id ? 2 : 3;
    const bandEnd = champion ? 1 : final.loserId === id ? 2 : 4;
    const qualifyingMrp = index < 2 ? 5 * (qualifiers[index].gamePoints - 13) : 5;
    const playoffMrp = 7 * (matchWins + 1) * (matchWins + 2) / 2;
    return row.playedMatchWins === matchWins && row.byeWins === 0 && row.eliminatedInRound === eliminated
      && row.champion === champion && row.bandStart === bandStart && row.bandEnd === bandEnd
      && row.qualifyingMrp === qualifyingMrp && row.playoffMrp === playoffMrp && row.totalMrp === qualifyingMrp + playoffMrp;
  });
}

export function isPlayoffOutcomeWorkspace(value: unknown, tournamentId: string, eventId: string): value is PlayoffOutcomeWorkspace {
  if (!record(value) || !exact(value, ["tournamentId", "eventId", "qualificationResultVersionId", "currentVersion", "legacyConflict", "supported", "supportedFormat", "canRecord", "blocker", "qualifiers", "result", "capabilities"])
    || value.tournamentId !== tournamentId || value.eventId !== eventId || !isUuid(value.qualificationResultVersionId)
    || !whole(value.currentVersion) || typeof value.legacyConflict !== "boolean" || typeof value.supported !== "boolean"
    || typeof value.supportedFormat !== "boolean" || typeof value.canRecord !== "boolean"
    || ![null, "tournament_unavailable", "unsupported_format", "legacy_conflict", "qualification_unavailable"].includes(value.blocker as never)
    || !Array.isArray(value.qualifiers) || !value.qualifiers.every(qualifier)
    || !record(value.capabilities) || !exact(value.capabilities, ["settlement"]) || value.capabilities.settlement !== false) return false;
  const qualifierIds = value.qualifiers.map((item) => item.participantId);
  const ranks = value.qualifiers.map((item) => item.qualificationRank);
  const canRecordShape = value.qualifiers.length === 4 && new Set(qualifierIds).size === 4
    && new Set(ranks).size === 4 && ranks.every((rank, index) => rank === index + 1)
    && (value.qualifiers[0].gamePoints as number) >= 14 && (value.qualifiers[1].gamePoints as number) >= 14
    && (value.qualifiers[0].gamePoints as number) <= 36 && (value.qualifiers[1].gamePoints as number) <= 36;
  if (value.supported !== value.canRecord || value.canRecord !== (value.supportedFormat && !value.legacyConflict && value.blocker === null && canRecordShape)) return false;
  if (!value.canRecord && value.blocker === null) return false;
  if (value.result === null) return value.currentVersion === 0;
  if (!record(value.result) || !exact(value.result, ["resultId", "version", "series", "outcomes", "bracketSourceVersion", "mrpSourceVersion", "recordedAt"])
    || !isUuid(value.result.resultId) || value.result.version !== value.currentVersion || !seriesList(value.result.series)
    || value.result.bracketSourceVersion !== "acc-rulebook-2025-effective-2025-08-01"
    || value.result.mrpSourceVersion !== "acc-published-mrp-2016-08-01"
    || !Array.isArray(value.result.outcomes) || value.result.outcomes.length !== 4 || !value.result.outcomes.every(outcome) || !timestamp(value.result.recordedAt)) return false;
  return derivedResult(value.result, value.qualifiers as Array<{ participantId: string; qualificationRank: number; gamePoints: number }>);
}

export async function getPlayoffOutcomeWorkspace(admin: RpcClient, actorId: string, tournamentId: string, eventId: string) {
  if (![actorId, tournamentId, eventId].every(isUuid)) throw new Error("Playoff outcome workspace is unavailable.");
  const { data, error } = await admin.rpc("get_standard_singles_playoff_outcome_workspace_v3", { p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId });
  return error || !isPlayoffOutcomeWorkspace(data, tournamentId, eventId) ? null : data;
}

export function recordPlayoffOutcomes(admin: RpcClient, actorId: string, tournamentId: string, eventId: string, request: PlayoffOutcomeRequest) {
  return admin.rpc("record_standard_singles_playoff_outcomes_v3", {
    p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId,
    p_qualification_result_version_id: request.qualificationResultVersionId,
    p_expected_version: request.expectedVersion, p_series: request.series, p_operation_id: request.idempotencyKey,
  });
}

export function isPlayoffOutcomeReconciliation(value: unknown): value is { authorized: true; result: unknown } {
  return record(value) && exact(value, ["authorized", "result"]) && value.authorized === true;
}
