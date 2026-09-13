import "server-only";

import { isUuid } from "../api/validation.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export type Rule12bCorrectionCreate = {
  actorId: string;
  gameId: string;
  correctionId: string;
  expectedGameVersion: number;
  expectedCorrectionSequence: number;
  originalA: { isWinner: boolean; margin: number };
  originalB: { isWinner: boolean; margin: number };
  qualificationChanged: boolean;
  reason?: string;
  operationId: string;
};

export type Rule12CorrectionReview = {
  actorId: string;
  correctionId: string;
  decision: "approve" | "reject";
  operationId: string;
};

export type Rule12Claim = {
  outcome: "win" | "loss";
  margin: number | null;
  column: "plus" | "minus" | "blank";
  apparentQualifier: boolean;
};

export type Rule12CorrectionCreate = {
  actorId: string;
  gameId: string;
  correctionId: string;
  expectedGameVersion: number;
  expectedCorrectionSequence: number;
  ruleCase: "12.2a" | "12.2b" | "12.2c" | "12.2d" | "12.2e" | "12.2f" | "12.2h";
  claimA: Rule12Claim;
  claimB: Rule12Claim;
  qualificationChanged: boolean;
  affectedParticipantId: string | null;
  reason?: string;
  operationId: string;
};

const createRejectionCodes = new Set([
  "invalid_request", "fixture_not_applicable", "qualification_notice_unavailable",
  "game_not_found", "not_cross_checker", "self_correction_denied", "tournament_closed",
  "result_publication_guarded", "event_not_eligible", "game_state_unsupported",
  "stale_game_version", "correction_history_unsupported", "pending_correction_exists",
  "stale_correction_sequence", "policy_unavailable", "reason_required",
  "card_identity_unavailable", "idempotency_conflict", "correction_unavailable",
]);

const reviewRejectionCodes = new Set([
  "invalid_request", "correction_not_found", "correction_scope_invalid", "lifecycle_unavailable",
  "reviewer_not_independent", "not_eligible_reviewer", "review_not_required",
  "policy_snapshot_invalid", "not_pending_review", "tournament_closed",
  "result_publication_guarded", "event_not_eligible", "stale_correction_source", "idempotency_conflict",
  "correction_review_unavailable",
]);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function positiveInteger(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function nonnegativeInteger(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isCreateResult(value: unknown, input: Rule12bCorrectionCreate) {
  if (!record(value)) return false;
  if (value.status === "rejected") {
    return exactKeys(value, ["status", "code", "correctionId"])
      && value.correctionId === input.correctionId
      && createRejectionCodes.has(value.code as string);
  }
  return exactKeys(value, [
    "status", "correctionId", "gameId", "gameVersion", "correctionSequence",
    "policyVersion", "reasonRequired", "requiredApprovals", "qualificationChanged",
  ])
    && (value.status === "applied" || value.status === "pending")
    && value.correctionId === input.correctionId
    && value.gameId === input.gameId
    && value.gameVersion === input.expectedGameVersion
    && value.correctionSequence === input.expectedCorrectionSequence + 1
    && nonnegativeInteger(value.policyVersion)
    && typeof value.reasonRequired === "boolean"
    && (value.requiredApprovals === 0 || value.requiredApprovals === 1)
    && value.qualificationChanged === input.qualificationChanged
    && ((value.status === "applied" && value.requiredApprovals === 0)
      || (value.status === "pending" && value.requiredApprovals === 1));
}

function isReviewResult(value: unknown, input: Rule12CorrectionReview) {
  if (!record(value)) return false;
  if (value.status === "rejected" && Object.hasOwn(value, "code")) {
    return exactKeys(value, ["status", "code", "correctionId"])
      && value.correctionId === input.correctionId
      && reviewRejectionCodes.has(value.code as string);
  }
  return exactKeys(value, ["status", "decision", "correctionId", "gameId", "gameVersion", "correctionSequence"])
    && value.correctionId === input.correctionId
    && value.decision === input.decision
    && ((input.decision === "approve" && value.status === "applied")
      || (input.decision === "reject" && value.status === "rejected"))
    && isUuid(value.gameId)
    && positiveInteger(value.gameVersion)
    && positiveInteger(value.correctionSequence);
}

function isScore(value: unknown) {
  if (!record(value) || !exactKeys(value, ["isWinner", "margin", "plusPoints", "minusPoints", "gamePoints"])) return false;
  if (typeof value.isWinner !== "boolean" || !Number.isInteger(value.margin)
      || (value.margin as number) < 1 || (value.margin as number) > 121) return false;
  const expectedPlus = value.isWinner ? value.margin : 0;
  const expectedMinus = value.isWinner ? 0 : value.margin;
  const expectedGamePoints = value.isWinner ? ((value.margin as number) >= 31 ? 3 : 2) : 0;
  return value.plusPoints === expectedPlus && value.minusPoints === expectedMinus && value.gamePoints === expectedGamePoints;
}

function isProjection(value: unknown, side: "a" | "b") {
  return record(value)
    && exactKeys(value, ["cardSide", "canonicalScorelineId", "original", "adjudicated"])
    && value.cardSide === side
    && isUuid(value.canonicalScorelineId)
    && isScore(value.original)
    && isScore(value.adjudicated);
}

export type Rule12CorrectionRecord = {
  correctionId: string;
  tournamentId: string;
  eventId: string;
  gameId: string;
  correctionSequence: number;
  baseGameVersion: number;
  editorProfileId: string;
  ruleCase: "12.2b";
  reason: string | null;
  createdAt: string;
  qualificationChanged: false;
  apparentQualifierSides: ["a", "b"];
  policyVersion: number;
  reasonRequired: boolean;
  requiredApprovals: 0 | 1;
  status: "pending" | "applied" | "rejected";
  projections: readonly unknown[];
};

function isCorrectionRecord(value: unknown, correctionId: string): value is Rule12CorrectionRecord {
  if (!record(value) || !exactKeys(value, [
    "correctionId", "tournamentId", "eventId", "gameId", "correctionSequence",
    "baseGameVersion", "editorProfileId", "ruleCase", "reason", "createdAt",
    "qualificationChanged", "apparentQualifierSides", "policyVersion", "reasonRequired",
    "requiredApprovals", "status", "projections",
  ])) return false;
  const projections = value.projections;
  const projectionA = Array.isArray(projections) ? projections[0] : null;
  const projectionB = Array.isArray(projections) ? projections[1] : null;
  const rule12bProjection = isProjection(projectionA, "a") && isProjection(projectionB, "b")
    && projectionA.original.isWinner !== projectionB.original.isWinner
    && projectionA.original.margin !== projectionB.original.margin
    && projectionA.adjudicated.isWinner === projectionA.original.isWinner
    && projectionB.adjudicated.isWinner === projectionB.original.isWinner
    && projectionA.adjudicated.margin === projectionB.original.margin
    && projectionB.adjudicated.margin === projectionA.original.margin;
  return value.correctionId === correctionId
    && isUuid(value.tournamentId) && isUuid(value.eventId) && isUuid(value.gameId)
    && positiveInteger(value.correctionSequence) && positiveInteger(value.baseGameVersion)
    && isUuid(value.editorProfileId) && value.ruleCase === "12.2b"
    && (value.reason === null || (typeof value.reason === "string" && value.reason.length <= 500))
    && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
    && value.qualificationChanged === false
    && Array.isArray(value.apparentQualifierSides)
    && value.apparentQualifierSides.length === 2
    && value.apparentQualifierSides[0] === "a" && value.apparentQualifierSides[1] === "b"
    && nonnegativeInteger(value.policyVersion)
    && typeof value.reasonRequired === "boolean"
    && (value.requiredApprovals === 0 || value.requiredApprovals === 1)
    && ["pending", "applied", "rejected"].includes(value.status as string)
    && (!value.reasonRequired || typeof value.reason === "string")
    && ((value.requiredApprovals === 0 && value.status === "applied")
      || (value.requiredApprovals === 1 && ["pending", "applied", "rejected"].includes(value.status as string)))
    && Array.isArray(projections) && projections.length === 2
    && rule12bProjection;
}

export async function createRule12bCorrection(admin: RpcClient, input: Rule12bCorrectionCreate) {
  const { data, error } = await admin.rpc("create_rule12b_correction_v1", {
    p_actor_id: input.actorId,
    p_game_id: input.gameId,
    p_correction_id: input.correctionId,
    p_expected_game_version: input.expectedGameVersion,
    p_expected_correction_sequence: input.expectedCorrectionSequence,
    p_original_a_is_winner: input.originalA.isWinner,
    p_original_a_margin: input.originalA.margin,
    p_original_b_is_winner: input.originalB.isWinner,
    p_original_b_margin: input.originalB.margin,
    p_qualification_changed: input.qualificationChanged,
    p_reason: input.reason ?? null,
    p_operation_id: input.operationId,
  });
  if (error || !isCreateResult(data, input)) throw new Error("Rule 12 correction is unavailable.");
  return data;
}

export async function createRule12Correction(admin: RpcClient, input: Rule12CorrectionCreate) {
  const { data, error } = await admin.rpc("create_rule12_correction_v2", {
    p_actor_id: input.actorId,
    p_game_id: input.gameId,
    p_correction_id: input.correctionId,
    p_expected_game_version: input.expectedGameVersion,
    p_expected_correction_sequence: input.expectedCorrectionSequence,
    p_rule_case: input.ruleCase,
    p_claim_a: input.claimA,
    p_claim_b: input.claimB,
    p_qualification_changed: input.qualificationChanged,
    p_affected_participant_id: input.affectedParticipantId,
    p_reason: input.reason ?? null,
    p_operation_id: input.operationId,
  });
  if (error || !isCreateResult(data, {
    actorId: input.actorId, gameId: input.gameId, correctionId: input.correctionId,
    expectedGameVersion: input.expectedGameVersion,
    expectedCorrectionSequence: input.expectedCorrectionSequence,
    originalA: { isWinner: input.claimA.outcome === "win", margin: input.claimA.margin ?? 1 },
    originalB: { isWinner: input.claimB.outcome === "win", margin: input.claimB.margin ?? 1 },
    qualificationChanged: input.qualificationChanged, operationId: input.operationId,
  })) throw new Error("Rule 12 correction is unavailable.");
  return data as { status: "applied" | "pending" | "rejected"; code?: string };
}

export async function reviewRule12Correction(admin: RpcClient, input: Rule12CorrectionReview) {
  const { data, error } = await admin.rpc("review_rule12_correction_v2", {
    p_actor_id: input.actorId,
    p_correction_id: input.correctionId,
    p_decision: input.decision,
    p_operation_id: input.operationId,
  });
  if (error || !isReviewResult(data, input)) throw new Error("Rule 12 correction review is unavailable.");
  return data;
}

export async function getRule12Correction(admin: RpcClient, actorId: string, correctionId: string) {
  const { data, error } = await admin.rpc("get_rule12_correction_v1", {
    p_actor_id: actorId,
    p_correction_id: correctionId,
  });
  if (error || (data !== null && !isCorrectionRecord(data, correctionId))) {
    throw new Error("Rule 12 correction record is unavailable.");
  }
  return data;
}
