import {observeNativeMixedAttendanceV1, type NativeMixedAttendanceExpectedV1} from "./native-mixed-attendance-observation-v1.ts";
import {validateLocalRandomPlanInput, type LocalRandomPlanInput} from "./local-random-plan.ts";
import {projectOneTableMovement} from "./one-table-movement.ts";
import type {NativeMixedSeatingConfigV1} from "./native-mixed-seating-plan-v1.ts";

type Publication = {contextId: string; seatingReceiptId: string; seatingPublicationId: string; scheduleReceiptId: string;
  schedulePublicationId: string; sourceMethod: "native_mixed_simulation_v1"; assignmentCount: 18; roundCount: 12; matchCount: 108};
type Candidate = {algorithmVersion: "local-circle-18-v1"; anchor: {seatId: string; participantId: string; selection: "blind-draw" | "approved-person"};
  assignments: {participantId: string; tournamentId: string; logicalSlot: number}[];
  matches: {round: number; pairId: string; sides: {participantId: string; seatId: string}[]}[];
  attempts: number; physicalReviewRequired: true; publishable: false};
type Game = {gameId: string; importRowNumber: number; round: number; sideAParticipantId: string; sideBParticipantId: string; sideATableSeat: string; sideBTableSeat: string};
type Assignment = {assignmentId: string; rosterEntryId: string; participantId: string; fixedId: string};
export type NativeMixedPublishedExpectedV1 = {attendance: {value: unknown; expected: NativeMixedAttendanceExpectedV1};
  planInput: LocalRandomPlanInput; plan: {planId: string; sourceDigest: string; config: NativeMixedSeatingConfigV1};
  draw: {drawId: string; sourceDigest: string; candidate: Candidate};
  review: {reviewId: string; sourceDigest: string; decision: "accepted-test-simulation-only"}; publication: Publication};
type Result = {status: "blocked"; code: string} | {status: "simulation-schedule-observation";
  tournamentId: string; eventId: string; publication: Publication; sourceDigest: string; fixedAssignments: Assignment[]; canonicalGames: Game[];
  nativePublicationClaimed: true; databaseProvenanceVerified: false; ordinaryAttendanceUsed: false; humanPresenceVerified: false;
  paymentVerified: false; moneyMoved: false; normalStartAuthorized: false; publicationWriteAuthorized: false; payoutAuthorized: false;
  physicalRoomVerified: false; sourceObservation: "provided-models-not-atomic"};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const canonical = (v: unknown): string => JSON.stringify(v, (_k, x) => x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const flags = ["ordinaryAttendanceUsed", "ordinaryInitialSeatingWriterUsed", "ordinaryScheduleWriterUsed", "humanPresenceVerified",
  "paymentVerified", "moneyMoved", "normalStartAuthorized", "payoutAuthorized", "finalizationAuthorized"];
function validPublication(p: unknown): p is Publication {
  return exact(p, ["contextId", "seatingReceiptId", "seatingPublicationId", "scheduleReceiptId", "schedulePublicationId", "sourceMethod", "assignmentCount", "roundCount", "matchCount"])
    && [p.contextId, p.seatingReceiptId, p.seatingPublicationId, p.scheduleReceiptId, p.schedulePublicationId].every(uuid)
    && p.seatingReceiptId !== p.scheduleReceiptId && p.sourceMethod === "native_mixed_simulation_v1"
    && p.assignmentCount === 18 && p.roundCount === 12 && p.matchCount === 108;
}

/** Validates provided publication claims against the retained reviewed draw;
 * never generates IDs, publishes, or treats UUID/hash shape as DB proof. The
 * normal schedule DTO's two source methods are deliberately not broadened. */
export function observeNativeMixedPublishedScheduleV1(value: unknown, e: NativeMixedPublishedExpectedV1): Result {
  const blocked = (code: string): Result => ({status: "blocked", code});
  try {
    const a = observeNativeMixedAttendanceV1(e.attendance.value, e.attendance.expected);
    if (a.status === "blocked") return blocked(a.code);
    if (!validPublication(e.publication) || !uuid(e.plan.planId) || !digest(e.plan.sourceDigest) || !uuid(e.draw.drawId)
      || !digest(e.draw.sourceDigest) || !uuid(e.review.reviewId) || !digest(e.review.sourceDigest)
      || e.review.decision !== "accepted-test-simulation-only" || validateLocalRandomPlanInput(e.planInput).length)
      return blocked("retained_simulation_publication_invalid");
    const requested = e.planInput.participants.filter(p => p.stationaryPreference === "requested").map(p => p.participantId);
    const localConfig = {tables: e.planInput.tables, activePairIds: e.planInput.activePairIds, anchor: e.planInput.anchor,
      stationaryRequests: e.plan.config.stationaryRequests,
      stationaryDecisions: e.planInput.stationaryDecisions, constraints: e.planInput.constraints, maxAttempts: e.planInput.maxAttempts};
    if (!same(localConfig, e.plan.config) || !same(e.plan.config.tables, [{tableId: "A", seatCount: 18}])
      || !same(e.plan.config.activePairIds, Array.from({length: 9}, (_, i) => `A:${i * 2 + 1}-${i * 2 + 2}`))
      || !Array.isArray(e.plan.config.stationaryRequests) || e.plan.config.stationaryRequests.length !== requested.length
      || new Set(e.plan.config.stationaryRequests).size !== requested.length || e.plan.config.stationaryRequests.some(p => !requested.includes(p))
      || e.planInput.source.sha256 !== a.attendanceSourceDigest || e.planInput.source.version !== a.scope.version
      || e.planInput.participants.length !== 18 || e.planInput.participants.some(p => !e.attendance.expected.roster.some(r => r.rosterEntryId === p.participantId)))
      return blocked("retained_plan_scope_changed");
    const c = e.draw.candidate;
    if (!exact(c, ["algorithmVersion", "anchor", "assignments", "matches", "attempts", "physicalReviewRequired", "publishable"])
      || c.algorithmVersion !== "local-circle-18-v1" || c.physicalReviewRequired !== true || c.publishable !== false
      || !Number.isInteger(c.attempts) || c.attempts < 1 || c.attempts > (e.planInput.maxAttempts ?? 1)
      || !exact(c.anchor, ["seatId", "participantId", "selection"]) || c.anchor.selection !== (e.planInput.anchor.participantId === null ? "blind-draw" : "approved-person")
      || (e.planInput.anchor.participantId !== null && c.anchor.participantId !== e.planInput.anchor.participantId)
      || !Array.isArray(c.assignments) || c.assignments.some(x => !exact(x, ["participantId", "tournamentId", "logicalSlot"])
        || !Number.isInteger(x.logicalSlot) || x.logicalSlot < 0 || x.logicalSlot > 17
        || !e.attendance.expected.roster.some(r => r.rosterEntryId === x.participantId))
      || new Set(c.assignments.map(x => x.logicalSlot)).size !== 18 || projectOneTableMovement(e.plan.config, c).status !== "verified"
      || c.matches.some(m => !exact(m, ["round", "pairId", "sides"]) || m.sides.length !== 2
        || m.sides.some(s => !exact(s, ["participantId", "seatId"])))
      || e.planInput.constraints.some(rule => c.matches.some(m => m.round === rule.round && rule.participantIds.every(p => m.sides.some(s => s.participantId === p)))))
      return blocked("retained_draw_invalid");
    if (!exact(value, ["status", "kind", "actorId", "tournamentId", "eventId", "attendance", "plan", "draw", "review", "publication", "fixedAssignments", "canonicalGames", "sourceDigest",
      "simulationRosterProjected", "nativeInitialSeatingPublished", "nativeCanonicalSchedulePublished", ...flags])
      || value.status !== "source_available" || value.kind !== "native-mixed-simulation-schedule-source-v1" || !digest(value.sourceDigest)
      || flags.some(k => value[k] !== false) || value.simulationRosterProjected !== true || value.nativeInitialSeatingPublished !== true || value.nativeCanonicalSchedulePublished !== true)
      return blocked("simulation_schedule_source_unavailable");
    if (value.actorId !== a.actorId || value.tournamentId !== a.tournamentId || value.eventId !== a.eventId
      || !same(value.attendance, {sealId: a.sealId, sourceDigest: a.attendanceSourceDigest}) || !same(value.plan, e.plan)
      || !same(value.draw, e.draw) || !same(value.review, e.review) || !same(value.publication, e.publication)) return blocked("simulation_publication_changed");
    if (!Array.isArray(value.fixedAssignments) || value.fixedAssignments.length !== 18 || !Array.isArray(value.canonicalGames) || value.canonicalGames.length !== 108)
      return blocked("complete_native_graph_required");
    const assignments = value.fixedAssignments;
    for (const x of assignments) {
      if (!exact(x, ["assignmentId", "rosterEntryId", "participantId", "fixedId"]) || !uuid(x.assignmentId)
        || !e.attendance.expected.roster.some(r => r.rosterEntryId === x.rosterEntryId && r.participantId === x.participantId)
        || !c.assignments.some(r => r.participantId === x.rosterEntryId && r.tournamentId === x.fixedId)) return blocked("fixed_identity_changed");
    }
    for (const key of ["assignmentId", "rosterEntryId", "participantId", "fixedId"])
      if (new Set(assignments.map(x => x[key])).size !== 18) return blocked("fixed_identity_ambiguous");
    const gameIds = new Set<string>(), rows = new Set<number>();
    for (const g of value.canonicalGames) {
      if (!exact(g, ["gameId", "importRowNumber", "round", "sideAParticipantId", "sideBParticipantId", "sideATableSeat", "sideBTableSeat"])
        || !uuid(g.gameId) || typeof g.importRowNumber !== "number" || !Number.isInteger(g.importRowNumber)
        || g.importRowNumber < 1 || g.importRowNumber > 108 || gameIds.has(g.gameId) || rows.has(g.importRowNumber)) return blocked("canonical_game_ambiguous");
      const m = c.matches[g.importRowNumber - 1];
      const sideA = assignments.find(x => x.rosterEntryId === m.sides[0].participantId), sideB = assignments.find(x => x.rosterEntryId === m.sides[1].participantId);
      if (!sideA || !sideB || g.round !== m.round || g.sideAParticipantId !== sideA.participantId || g.sideBParticipantId !== sideB.participantId
        || g.sideATableSeat !== m.sides[0].seatId || g.sideBTableSeat !== m.sides[1].seatId) return blocked("canonical_graph_changed");
      gameIds.add(g.gameId); rows.add(g.importRowNumber);
    }
    return {status: "simulation-schedule-observation", tournamentId: a.tournamentId, eventId: a.eventId, publication: copy(e.publication),
      sourceDigest: value.sourceDigest, fixedAssignments: copy(assignments) as Assignment[], canonicalGames: (copy(value.canonicalGames) as Game[]).sort((x, y) => x.importRowNumber - y.importRowNumber),
      nativePublicationClaimed: true, databaseProvenanceVerified: false, ordinaryAttendanceUsed: false, humanPresenceVerified: false,
      paymentVerified: false, moneyMoved: false, normalStartAuthorized: false, publicationWriteAuthorized: false, payoutAuthorized: false,
      physicalRoomVerified: false, sourceObservation: "provided-models-not-atomic"};
  } catch { return blocked("simulation_schedule_invalid"); }
}
