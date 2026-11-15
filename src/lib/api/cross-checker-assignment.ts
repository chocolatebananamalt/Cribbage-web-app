import { isUuid } from "./validation.ts";

type RecordValue = Record<string, unknown>;
function isRecord(value: unknown): value is RecordValue { return !!value && typeof value === "object" && !Array.isArray(value); }
function exact(value: RecordValue, keys: string[]) { return Object.keys(value).length === keys.length && keys.every((key) => key in value); }
function nonEmptyText(value: unknown) { return typeof value === "string" && value.trim().length > 0; }
function timestampOrNull(value: unknown) { return value === null || (typeof value === "string" && Number.isFinite(new Date(value).valueOf())); }

export type CrossCheckerAssignmentRequest = { rosterEntryId: string; operationId: string };
export type CrossCheckerAssignmentResult = {
  status: "cross_checker_assigned";
  tournamentId: string;
  rosterEntryId: string;
};
export type CrossCheckerAssignmentWorkspace = {
  tournamentName: string;
  assignments: Array<{ assignmentId: string; displayName: string; assignedAt: string | null }>;
  candidates: Array<{ rosterEntryId: string; displayName: string; identityHint: string }>;
};

export function isCrossCheckerAssignmentRequest(value: unknown): value is CrossCheckerAssignmentRequest {
  return isRecord(value) && exact(value, ["rosterEntryId", "operationId"])
    && isUuid(value.rosterEntryId) && isUuid(value.operationId);
}

export function isCrossCheckerAssignmentResult(
  value: unknown,
  tournamentId: string,
  rosterEntryId: string,
): value is CrossCheckerAssignmentResult {
  return isRecord(value) && exact(value, ["status", "tournamentId", "rosterEntryId"])
    && value.status === "cross_checker_assigned"
    && value.tournamentId === tournamentId && value.rosterEntryId === rosterEntryId;
}

export function isCrossCheckerAssignmentRejection(value: unknown): value is { status: "rejected"; code: string } {
  return isRecord(value) && exact(value, ["status", "code"])
    && value.status === "rejected" && typeof value.code === "string"
    && ["invalid_request", "not_director", "idempotency_conflict", "tournament_unavailable",
      "linked_account_required", "self_assignment_forbidden", "official_role_conflict", "already_assigned"].includes(value.code);
}

export function isCrossCheckerAssignmentWorkspace(value: unknown): value is CrossCheckerAssignmentWorkspace {
  if (!isRecord(value) || !exact(value, ["tournamentName", "assignments", "candidates"])
    || !nonEmptyText(value.tournamentName) || !Array.isArray(value.assignments) || !Array.isArray(value.candidates)) return false;
  if (!value.assignments.every((item) => isRecord(item) && exact(item, ["assignmentId", "displayName", "assignedAt"])
    && isUuid(item.assignmentId) && nonEmptyText(item.displayName) && timestampOrNull(item.assignedAt))) return false;
  if (!value.candidates.every((item) => isRecord(item) && exact(item, ["rosterEntryId", "displayName", "identityHint"])
    && isUuid(item.rosterEntryId) && nonEmptyText(item.displayName) && nonEmptyText(item.identityHint))) return false;
  return new Set(value.assignments.map((item) => item.assignmentId)).size === value.assignments.length
    && new Set(value.candidates.map((item) => item.rosterEntryId)).size === value.candidates.length;
}
