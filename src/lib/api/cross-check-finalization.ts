import { isUuid } from "./validation.ts";

// The order is the server's order, from the jsonb_build_array in
// database/migrations/0230_finalize_cross_checking.sql. It is asserted rather
// than sorted, so a condition added to the RPC without being added here fails
// the guard loudly instead of silently disappearing from the director's list.
export const crossCheckConditionCodes = [
  "tournament_not_open_for_cross_check",
  "cross_checkers_not_assigned",
  "games_not_verified",
  "team_games_not_verified",
  "corrections_pending",
  "disputes_unresolved",
  "device_recoveries_awaiting_review",
  "hybrid_cases_awaiting_review",
  "paper_completions_awaiting_review",
  "cashing_placements_without_cross_check_evidence",
  "satellite_results_not_marked_cross_check_complete",
] as const;

export type CrossCheckConditionCode = (typeof crossCheckConditionCodes)[number];

export type CrossCheckCondition = {
  code: CrossCheckConditionCode;
  outstanding: boolean;
  count: number;
  sentence: string;
};

export type CrossCheckFinalizationWorkspace = {
  tournamentId: string;
  tournamentName: string;
  tournamentStatus: string;
  conditions: CrossCheckCondition[];
  outstanding: CrossCheckConditionCode[];
  finalization: { finalizedAt: string; finalizedBy: string } | null;
  canFinalize: boolean;
};

export type FinalizeCrossCheckingRequest = { idempotencyKey: string };

export type FinalizeCrossCheckingResult =
  | { status: "cross_checking_finalized"; tournamentId: string; tournamentName: string; finalizedAt: string }
  | { status: "already_finalized"; tournamentId: string; finalizedAt: string }
  | { status: "rejected"; code: string; outstanding?: string[] };

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;

const whole = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

function isCondition(value: unknown, code: CrossCheckConditionCode): value is CrossCheckCondition {
  if (!record(value) || !exactKeys(value, ["code", "outstanding", "count", "sentence"])) return false;
  // count is always the number of things still outstanding, never a total, so
  // this equality holds for every condition including the two that are really
  // yes or no questions and report 1 or 0.
  return value.code === code
    && typeof value.outstanding === "boolean"
    && whole(value.count)
    && value.outstanding === ((value.count as number) > 0)
    && text(value.sentence);
}

export function isCrossCheckFinalizationWorkspace(
  value: unknown,
  tournamentId: string,
): value is CrossCheckFinalizationWorkspace {
  if (!record(value) || !exactKeys(value, [
    "tournamentId", "tournamentName", "tournamentStatus", "conditions", "outstanding", "finalization", "canFinalize",
  ])) return false;
  if (value.tournamentId !== tournamentId || !isUuid(tournamentId)) return false;
  if (!text(value.tournamentName) || !text(value.tournamentStatus)) return false;
  const rawConditions: unknown[] = Array.isArray(value.conditions) ? value.conditions : [];
  if (rawConditions.length !== crossCheckConditionCodes.length) return false;
  if (!crossCheckConditionCodes.every((code, index) => isCondition(rawConditions[index], code))) return false;

  const conditions = rawConditions as CrossCheckCondition[];
  const expected = conditions.filter((condition) => condition.outstanding).map((condition) => condition.code);
  if (!Array.isArray(value.outstanding)) return false;
  const outstanding: unknown[] = value.outstanding;
  if (outstanding.length !== expected.length) return false;
  if (!expected.every((code, index) => outstanding[index] === code)) return false;

  if (value.finalization !== null) {
    if (!record(value.finalization) || !exactKeys(value.finalization, ["finalizedAt", "finalizedBy"])) return false;
    if (!text(value.finalization.finalizedAt) || !text(value.finalization.finalizedBy)) return false;
  }
  // The button's enabled state is the server's answer, not the client's
  // reading of the list. Asserting the two agree means a disagreement is a
  // failed guard here rather than a button that is enabled and then refuses.
  return value.canFinalize === (value.finalization === null && expected.length === 0);
}

export function isFinalizeCrossCheckingRequest(value: unknown): value is FinalizeCrossCheckingRequest {
  return record(value) && exactKeys(value, ["idempotencyKey"]) && isUuid(value.idempotencyKey);
}

export function isFinalizeCrossCheckingResult(value: unknown): value is FinalizeCrossCheckingResult {
  if (!record(value) || typeof value.status !== "string") return false;
  if (value.status === "rejected") {
    if (!text(value.code)) return false;
    if (!Object.hasOwn(value, "outstanding")) return exactKeys(value, ["status", "code"]);
    return exactKeys(value, ["status", "code", "outstanding"])
      && Array.isArray(value.outstanding)
      && value.outstanding.length > 0
      && value.outstanding.every(text);
  }
  if (value.status === "cross_checking_finalized") {
    return exactKeys(value, ["status", "tournamentId", "tournamentName", "finalizedAt"])
      && isUuid(value.tournamentId) && text(value.tournamentName) && text(value.finalizedAt);
  }
  return value.status === "already_finalized"
    && exactKeys(value, ["status", "tournamentId", "finalizedAt"])
    && isUuid(value.tournamentId) && text(value.finalizedAt);
}

export function finalizeCrossCheckingMessage(code: string) {
  if (code === "not_director") return "Only a director or co-director of this tournament can finalize cross-checking.";
  if (code === "tournament_unavailable") return "That tournament is no longer available.";
  if (code === "idempotency_conflict") return "A different operation is already using this request id. Reload and try again.";
  // Every other code the server can return is the code of a condition that is
  // still outstanding, and the screen is already showing that condition's own
  // sentence and count. Repeating it here in different words would give the
  // director two descriptions of one thing.
  if ((crossCheckConditionCodes as readonly string[]).includes(code)) {
    return "Something changed while this screen was open, so cross-checking was not finalized. Reload to see what is outstanding.";
  }
  return "Cross-checking could not be finalized. Reload and try again.";
}
