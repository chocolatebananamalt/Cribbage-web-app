import { isUuid } from "../api/validation.ts";
import { isRosterDrawWorkspace, sameDrawRequest, type DrawCandidate } from "../api/roster-random-draw.ts";
import { isSeatingWorkspace } from "../api/seating-workspace.ts";
import { isInitialSeatingRequest, type InitialSeatingRequest } from "../api/seating.ts";
import { projectOneTableMovement } from "./one-table-movement.ts";

export type DrawPhysicalReview = {
  physicalLayoutConfirmed: true; stationaryDecisionsConfirmed: true; constraintsConfirmed: true; reason: string;
};
export type ReviewedDrawPublicationRequest = {
  planId: string; drawActorId: string; drawOperationId: string; expectedSourceHash: string;
  expectedPlanRevision: number; reviewedCandidate: DrawCandidate; review: DrawPhysicalReview; idempotencyKey: string;
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
const a18Seat = (v: unknown) => typeof v === "string" && /^A-(?:[1-9]|1[0-8])$/.test(v);
const a18Geometry = { tables: [{ tableId: "A", seatCount: 18 }], activePairIds: Array.from({ length: 9 }, (_, i) => `A:${2 * i + 1}-${2 * i + 2}`) };
export function isDrawPhysicalReview(v: unknown): v is DrawPhysicalReview {
  return object(v) && exact(v, ["physicalLayoutConfirmed", "stationaryDecisionsConfirmed", "constraintsConfirmed", "reason"])
    && v.physicalLayoutConfirmed === true && v.stationaryDecisionsConfirmed === true && v.constraintsConfirmed === true
    && typeof v.reason === "string" && v.reason.trim().length > 0 && v.reason.length <= 500 && !/[\u0000-\u001f\u007f]/.test(v.reason);
}
/** Recovery envelope shape only. Server must compare the ENTIRE candidate to its immutable draw. */
export function isReviewedDrawPublicationRequest(v: unknown): v is ReviewedDrawPublicationRequest {
  if (!object(v) || !exact(v, ["planId", "drawActorId", "drawOperationId", "expectedSourceHash", "expectedPlanRevision", "reviewedCandidate", "review", "idempotencyKey"])
    || ![v.planId, v.drawActorId, v.drawOperationId, v.idempotencyKey].every(uuid)
    || typeof v.expectedSourceHash !== "string" || !/^[a-f0-9]{64}$/.test(v.expectedSourceHash)
    || !Number.isSafeInteger(v.expectedPlanRevision) || Number(v.expectedPlanRevision) < 1 || Number(v.expectedPlanRevision) > 2147483647 || !isDrawPhysicalReview(v.review)) return false;
  const c = v.reviewedCandidate;
  return object(c) && exact(c, ["algorithmVersion", "attempts", "anchor", "assignments", "matches", "physicalReviewRequired", "publishable"])
    && c.algorithmVersion === "local-circle-18-v1" && c.publishable === false && c.physicalReviewRequired === true
    && Number.isSafeInteger(c.attempts) && Number(c.attempts) >= 1 && Number(c.attempts) <= 256
    && object(c.anchor) && exact(c.anchor, ["seatId", "participantId", "selection"]) && c.anchor.seatId === "A-1" && uuid(c.anchor.participantId)
    && ["blind-draw", "approved-person"].includes(c.anchor.selection as string)
    && Array.isArray(c.assignments) && c.assignments.length === 18
    && c.assignments.every(a => object(a) && exact(a, ["participantId", "tournamentId", "logicalSlot"]) && uuid(a.participantId)
      && a18Seat(a.tournamentId) && Number.isSafeInteger(a.logicalSlot) && Number(a.logicalSlot) >= 0 && Number(a.logicalSlot) < 18)
    && new Set(c.assignments.map(a => a.logicalSlot)).size === 18
    && Array.isArray(c.matches) && c.matches.length === 108
    && c.matches.every(m => object(m) && exact(m, ["round", "pairId", "sides"]) && Number.isSafeInteger(m.round) && Number(m.round) >= 1 && Number(m.round) <= 12
      && typeof m.pairId === "string" && a18Geometry.activePairIds.includes(m.pairId) && Array.isArray(m.sides) && m.sides.length === 2
      && m.sides.every(s => object(s) && exact(s, ["participantId", "seatId"]) && uuid(s.participantId) && a18Seat(s.seatId)))
    && projectOneTableMovement(a18Geometry, c).status === "verified"
    && JSON.stringify(v).length <= 100000;
}

export type DrawPublicationPreparation = { status: "blocked"; code: string } | {
  status: "prepared-not-authorized"; request: ReviewedDrawPublicationRequest; nativePreview: InitialSeatingRequest;
  idsWritten: false; schedulePublished: false; distributionSent: false;
};
/** Pure preflight only. Never calls an API, draws again, renames seats or grants authority. */
export function prepareReviewedDrawPublication(input: {
  actorId: string; tournamentId: string; workspace: unknown; nativeWorkspace: unknown; review: unknown; operationId: string;
}): DrawPublicationPreparation {
  const { actorId, tournamentId, workspace: w, nativeWorkspace: n } = input;
  const blocked = (code: string): DrawPublicationPreparation => ({ status: "blocked", code });
  if (![actorId, tournamentId, input.operationId].every(uuid)) return blocked("invalid_scope");
  if (!isRosterDrawWorkspace(w, actorId, tournamentId) || !isSeatingWorkspace(n)) return blocked("workspace_unavailable");
  if (n.publication !== null) return blocked("fixed_ids_readonly");
  if (!w.eligible || !n.registrationClosed || w.sourceSnapshot.status !== "open" || w.sourceSnapshot.registrationStatus !== "closed") return blocked("source_not_ready");
  if (!w.latestPlan || !w.latestDraw || w.latestDraw.receipt.status !== "accepted") return blocked("current_accepted_draw_required");
  const { plan, receipt } = w.latestDraw;
  if (w.latestPlan.planId !== plan.planId || w.latestPlan.revision !== plan.revision || w.sourceHash !== plan.sourceHash
    || w.latestPlan.sourceHash !== plan.sourceHash || !sameDrawRequest(w.latestPlan.config, plan.config)
    || !sameDrawRequest(w.sourceSnapshot, plan.sourceSnapshot)) return blocked("source_or_plan_changed");
  // Native storage supports uniform contiguous A..N geometry. Never pad/rename a Z-only or variable room.
  if (plan.config.tables.length !== 1 || plan.config.tables[0].tableId !== "A" || plan.config.tables[0].seatCount !== 18
    || !sameDrawRequest(plan.config.activePairIds, a18Geometry.activePairIds)
    || receipt.candidate.anchor.seatId !== "A-1") return blocked("native_geometry_unsupported");
  if (!isDrawPhysicalReview(input.review)) return blocked("explicit_director_review_required");
  const checked = n.checkIn.filter(p => p.state === "checked_in");
  if (checked.length !== 18 || checked.some(p => !plan.sourceSnapshot.roster.some(r => r.rosterEntryId === p.rosterEntryId && r.scorecardType === p.scorecardType && r.state === "checked_in"))) return blocked("native_roster_changed");
  // Independent existing movement projection verifies all 12 rounds rather than trusting first seats alone.
  const movement = projectOneTableMovement(plan.config, receipt.candidate);
  if (movement.status !== "verified") return blocked("movement_unsupported");
  const nativePreview = { tableCount: 1, seatsPerTable: 18, idempotencyKey: input.operationId,
    assignments: receipt.candidate.assignments.map(a => ({ rosterEntryId: a.participantId, tableSeat: a.tournamentId })).sort((a, b) => a.rosterEntryId.localeCompare(b.rosterEntryId)) };
  if (!isInitialSeatingRequest(nativePreview)) return blocked("invalid_native_projection");
  const request = structuredClone({ planId: plan.planId, drawActorId: receipt.actorId, drawOperationId: receipt.operationId,
    expectedSourceHash: plan.sourceHash, expectedPlanRevision: plan.revision, reviewedCandidate: receipt.candidate,
    review: input.review, idempotencyKey: input.operationId });
  return { status: "prepared-not-authorized", request, nativePreview, idsWritten: false, schedulePublished: false, distributionSent: false };
}
