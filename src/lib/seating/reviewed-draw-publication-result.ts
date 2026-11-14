import { isUuid } from "../api/validation.ts";
import { sameDrawRequest } from "../api/roster-random-draw.ts";
import { isReviewedDrawPublicationRequest, type ReviewedDrawPublicationRequest } from "./reviewed-draw-publication.ts";

type Accepted = {
  kind: "reviewed-initial-seating-receipt-v1"; status: "initial_seating_published";
  actorId: string; tournamentId: string; operationId: string; publicationId: string; nativeReceiptId: string;
  planId: string; planRevision: number; drawActorId: string; drawOperationId: string; sourceHash: string;
  assignmentCount: 18; idsWritten: true; schedulePublished: false; distributionSent: false;
  request: ReviewedDrawPublicationRequest;
};
type Scope = { actorId: string; tournamentId: string; request: ReviewedDrawPublicationRequest };
export type ReviewedPublicationOutcome = { kind: "accepted"; receipt: Accepted; canClearExactRetainedRequest: true }
  | { kind: "rejected"; code: string; canClearExactRetainedRequest: true }
  | { kind: "retry-exact" | "unknown"; canClearExactRetainedRequest: false };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
const rejected = ["invalid_request", "unsupported_isolation", "source_not_ready", "operation_conflict", "native_binding_unavailable", "source_or_plan_changed", "draw_changed", "unsupported_candidate", "fixed_ids_readonly", "native_postcondition_failed"];
const unknown = (): ReviewedPublicationOutcome => ({ kind: "unknown", canClearExactRetainedRequest: false });
const validScope = (s: Scope) => !!s && uuid(s.actorId) && uuid(s.tournamentId) && isReviewedDrawPublicationRequest(s.request);

/** Strict proposed transport codec only. It does not call, authorize, persist,
 * clear storage, redraw, rewrite IDs or prove an actual database publication. */
export function readReviewedDrawPublicationResult(value: unknown, scope: Scope): ReviewedPublicationOutcome {
  if (!validScope(scope) || !object(value) || value.kind !== "reviewed-initial-seating-receipt-v1" || value.actorId !== scope.actorId
    || value.tournamentId !== scope.tournamentId || value.operationId !== scope.request.idempotencyKey
    || !isReviewedDrawPublicationRequest(value.request) || !sameDrawRequest(value.request, scope.request)) return unknown();
  if (value.status === "initial_seating_published") {
    const request = scope.request;
    if (!exact(value, ["kind", "status", "actorId", "tournamentId", "operationId", "publicationId", "nativeReceiptId", "planId", "planRevision", "drawActorId", "drawOperationId", "sourceHash", "assignmentCount", "idsWritten", "schedulePublished", "distributionSent", "request"])
      || !uuid(value.publicationId) || !uuid(value.nativeReceiptId) || value.planId !== request.planId || value.planRevision !== request.expectedPlanRevision
      || value.drawActorId !== request.drawActorId || value.drawOperationId !== request.drawOperationId || value.sourceHash !== request.expectedSourceHash
      || value.assignmentCount !== 18 || value.idsWritten !== true || value.schedulePublished !== false || value.distributionSent !== false) return unknown();
    return { kind: "accepted", receipt: structuredClone(value) as Accepted, canClearExactRetainedRequest: true };
  }
  if (!exact(value, ["kind", "status", "code", "actorId", "tournamentId", "operationId", "request"])) return unknown();
  if (value.status === "retry_exact" && value.code === "source_busy") return { kind: "retry-exact", canClearExactRetainedRequest: false };
  if (value.status === "rejected" && typeof value.code === "string" && rejected.includes(value.code)) return { kind: "rejected", code: value.code, canClearExactRetainedRequest: true };
  return unknown();
}

/** Null/absent/foreign readback is UNKNOWN, never evidence that it is safe to
 * issue another operation. Only the exact owner/request/native binding clears. */
export function readReviewedDrawPublicationOperation(value: unknown, scope: Scope): ReviewedPublicationOutcome {
  if (!validScope(scope) || !object(value) || !exact(value, ["kind", "actorId", "tournamentId", "operationId", "request", "receipt"])
    || value.kind !== "reviewed-initial-seating-operation-v1" || value.actorId !== scope.actorId || value.tournamentId !== scope.tournamentId
    || value.operationId !== scope.request.idempotencyKey || !isReviewedDrawPublicationRequest(value.request) || !sameDrawRequest(value.request, scope.request)) return unknown();
  const result = readReviewedDrawPublicationResult(value.receipt, scope);
  return result.kind === "accepted" ? result : unknown();
}

/** Hard-disabled until a separately tested authenticated wrapper/transport is
 * reviewed. Environment or client flags do not turn this proposal on. */
export function reviewedDrawNativePublicationEnabled(): false { return false; }
