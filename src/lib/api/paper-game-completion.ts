import { isUuid } from "./validation.ts";

export type PaperCardClaim = {
  winnerSide: "a" | "b";
  margin: number;
  evidenceReference: string;
};

export type CompletePaperGameRequest = {
  completionId: string;
  eventId: string;
  gameId: string;
  expectedGameVersion: number;
  sideAClaim: PaperCardClaim;
  sideBClaim: PaperCardClaim;
  idempotencyKey: string;
};

export type ReviewPaperGameRequest = {
  decision: "approve" | "reject";
  expectedGameVersion: number;
  sideAClaim: PaperCardClaim;
  sideBClaim: PaperCardClaim;
  idempotencyKey: string;
};

export type BindPaperOfficialIdentityRequest = {
  bindingId: string;
  officialProfileId: string;
  bindingKind: "roster_entry" | "nonparticipant";
  rosterEntryId: string | null;
  expectedBindingVersion: number;
  idempotencyKey: string;
};

export type PaperGameOperationKind =
  | "complete_paper_vs_paper_game_v1"
  | "review_paper_vs_paper_game_v1"
  | "bind_paper_official_identity_v1";

export type PaperGameOperationReconciliationRequest = {
  operationType: PaperGameOperationKind;
  targetId: string;
  idempotencyKey: string;
};

const exactKeys = (value: object, keys: string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
};

export function isPaperCardClaim(value: unknown): value is PaperCardClaim {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["winnerSide", "margin", "evidenceReference"])) return false;
  const item = value as Record<string, unknown>;
  return (item.winnerSide === "a" || item.winnerSide === "b")
    && Number.isInteger(item.margin) && Number(item.margin) >= 1 && Number(item.margin) <= 121
    && typeof item.evidenceReference === "string"
    && item.evidenceReference.trim().length >= 1 && item.evidenceReference.length <= 200
    && !/[\u0000-\u001f\u007f]/.test(item.evidenceReference);
}

export function isCompletePaperGameRequest(value: unknown): value is CompletePaperGameRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["completionId", "eventId", "gameId", "expectedGameVersion", "sideAClaim", "sideBClaim", "idempotencyKey"])) return false;
  const item = value as Record<string, unknown>;
  return isUuid(item.completionId) && isUuid(item.eventId) && isUuid(item.gameId)
    && isUuid(item.idempotencyKey) && Number.isInteger(item.expectedGameVersion)
    && Number(item.expectedGameVersion) > 0
    && isPaperCardClaim(item.sideAClaim) && isPaperCardClaim(item.sideBClaim);
}

export function isReviewPaperGameRequest(value: unknown): value is ReviewPaperGameRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["decision", "expectedGameVersion", "sideAClaim", "sideBClaim", "idempotencyKey"])) return false;
  const item = value as Record<string, unknown>;
  return (item.decision === "approve" || item.decision === "reject")
    && Number.isInteger(item.expectedGameVersion) && Number(item.expectedGameVersion) > 0
    && isPaperCardClaim(item.sideAClaim) && isPaperCardClaim(item.sideBClaim)
    && isUuid(item.idempotencyKey);
}

export function isBindPaperOfficialIdentityRequest(value: unknown): value is BindPaperOfficialIdentityRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["bindingId", "officialProfileId", "bindingKind", "rosterEntryId", "expectedBindingVersion", "idempotencyKey"])) return false;
  const item = value as Record<string, unknown>;
  return isUuid(item.bindingId) && isUuid(item.officialProfileId) && isUuid(item.idempotencyKey)
    && Number.isInteger(item.expectedBindingVersion) && Number(item.expectedBindingVersion)>=0
    && (item.bindingKind === "roster_entry" || item.bindingKind === "nonparticipant")
    && ((item.bindingKind === "roster_entry" && isUuid(item.rosterEntryId))
      || (item.bindingKind === "nonparticipant" && item.rosterEntryId === null));
}

export function isPaperGameOperationReconciliationRequest(value: unknown): value is PaperGameOperationReconciliationRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["operationType", "targetId", "idempotencyKey"])) return false;
  const item = value as Record<string, unknown>;
  return ["complete_paper_vs_paper_game_v1", "review_paper_vs_paper_game_v1", "bind_paper_official_identity_v1"].includes(item.operationType as string)
    && isUuid(item.targetId) && isUuid(item.idempotencyKey);
}

export function isAcceptedPaperOfficialIdentity(value: unknown, request: BindPaperOfficialIdentityRequest, tournamentId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["status", "bindingId", "tournamentId", "officialProfileId", "bindingKind", "rosterEntryId", "bindingVersion"])) return false;
  const item = value as Record<string, unknown>;
  return item.status === "bound" && item.bindingId === request.bindingId && item.tournamentId === tournamentId
    && item.officialProfileId === request.officialProfileId && item.bindingKind === request.bindingKind
    && item.rosterEntryId === request.rosterEntryId && item.bindingVersion === request.expectedBindingVersion+1;
}

const bindingRejectionCodes = new Set(["invalid_request", "tournament_unavailable", "director_required", "idempotency_conflict", "self_confirmation_denied", "official_unavailable", "roster_entry_unavailable", "profile_is_tournament_participant", "stale_binding_version"]);
export function isRejectedPaperOfficialIdentity(value: unknown, bindingId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["status", "code", "bindingId"])) return false;
  const item = value as Record<string, unknown>;
  return item.status === "rejected" && item.bindingId === bindingId && bindingRejectionCodes.has(item.code as string);
}

const rejectionCodes = new Set([
  "invalid_request", "not_cross_checker", "tournament_unavailable", "event_unavailable",
  "game_unavailable", "game_not_scheduled", "stale_game_version", "game_already_authoritative", "device_recovery_case_exists", "not_paper_pair",
  "self_cross_check_denied", "card_identity_unavailable",
  "nonreciprocal_card_claims", "idempotency_conflict", "completion_unavailable",
  "not_eligible_reviewer", "reviewer_not_independent", "review_closed", "review_claims_mismatch",
  "official_identity_unconfirmed",
  "first_official_identity_changed",
]);

export function isAcceptedPaperGameCompletion(value: unknown, request: CompletePaperGameRequest) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["status", "completionId", "tournamentId", "eventId", "gameId", "gameVersion", "winnerSide", "margin", "evidenceCount", "authoritative"])) return false;
  const item = value as Record<string, unknown>;
  return item.status === "pending_review" && item.completionId === request.completionId
    && item.eventId === request.eventId && item.gameId === request.gameId
    && isUuid(item.tournamentId) && item.gameVersion === request.expectedGameVersion
    && item.winnerSide === request.sideAClaim.winnerSide && item.margin === request.sideAClaim.margin
    && item.evidenceCount === 2 && item.authoritative === false;
}

export function isAcceptedPaperGameReview(value: unknown, completionId: string, request: ReviewPaperGameRequest) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["status", "decision", "completionId", "gameId", "gameVersion", "authoritative", "scorelinesCreated"])) return false;
  const item = value as Record<string, unknown>;
  return item.status === (request.decision === "approve" ? "approved" : "rejected")
    && item.decision === request.decision && item.completionId === completionId && isUuid(item.gameId)
    && item.gameVersion === request.expectedGameVersion + (request.decision === "approve" ? 1 : 0)
    && item.authoritative === (request.decision === "approve")
    && item.scorelinesCreated === (request.decision === "approve");
}

export function isRejectedPaperGameCompletion(value: unknown, completionId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["status", "code", "completionId"])) return false;
  const item = value as Record<string, unknown>;
  return item.status === "rejected" && item.completionId === completionId
    && rejectionCodes.has(item.code as string);
}
