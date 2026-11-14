import {observeNativeMixedAttendanceV1, type NativeMixedAttendanceExpectedV1} from "./native-mixed-attendance-observation-v1.ts";
import {planLocalRandomSeating, validateLocalRandomPlanInput, type LocalRandomPlanInput, type LocalRandomPlanResult, type RandomInt} from "./local-random-plan.ts";
import {projectOneTableMovement} from "./one-table-movement.ts";

export type NativeMixedSeatingConfigV1 = {
  tables: LocalRandomPlanInput["tables"]; activePairIds: string[];
  anchor: LocalRandomPlanInput["anchor"]; stationaryRequests: string[];
  stationaryDecisions: LocalRandomPlanInput["stationaryDecisions"];
  constraints: LocalRandomPlanInput["constraints"]; maxAttempts: number;
};
export type NativeMixedSeatingLifecycleV1 = {
  tournamentId: string; eventId: string; tournamentStatus: string; registrationStatus: string;
  operationalState: string; eventType: string; format: string; gameCount: number; participantCount: number;
  hasStarted: boolean; hasDraw: boolean; seatingPublicationId: string | null; schedulePublicationId: string | null;
  existingTournamentIds: string[];
};
export type NativeMixedSeatingInputV1 = {attendance: {value: unknown; expected: NativeMixedAttendanceExpectedV1};
  lifecycle: NativeMixedSeatingLifecycleV1; config: NativeMixedSeatingConfigV1};
type Pins = {attendanceSealId: string; attendanceScopeId: string; attendanceSourceDigest: string; fundingSourceDigest: string};
type Projection = {rosterEntryId: string; participantId: string; profileId: string | null; mode: "digital" | "paper";
  state: "sim_ready"; fictional: boolean; physicalPresenceVerified: false};
type Prepared = {status: "prepared-not-authorized"; pins: Pins; localInput: LocalRandomPlanInput; rosterProjection: Projection[];
  ordinaryCheckInUsed: false; databaseSourceVerified: false; normalDrawAuthorized: false; nativePublicationAuthorized: false;
  schedulePublicationAuthorized: false; normalStartAuthorized: false; physicalRoomVerified: false};
type Blocked = {status: "blocked"; code: string} | {status: "readonly"; code: string};
type Candidate = {status: "local-candidate-not-authorized"; pins: Pins; rosterProjection: Projection[];
  candidate: Extract<LocalRandomPlanResult, {status: "candidate"}>;
  sourceObservation: "provided-models-not-atomic"; rngCryptographicallyVerified: false; databaseSourceVerified: false;
  ordinaryCheckInUsed: false; normalDrawAuthorized: false; nativePublicationAuthorized: false; schedulePublicationAuthorized: false;
  normalStartAuthorized: false; physicalRoomVerified: false};
const canonical = (v: unknown): string => JSON.stringify(v, (_k, x) => x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const keys = ["activePairIds", "anchor", "constraints", "maxAttempts", "stationaryDecisions", "stationaryRequests", "tables"];
const pairs = Array.from({length: 9}, (_, i) => `A:${i * 2 + 1}-${i * 2 + 2}`);

/** Pure preparation. `sim_ready` is never converted to a checked-in record or
 * passed to the ordinary checked-in source predicate. No future IDs are made. */
export function prepareNativeMixedSeatingV1(input: NativeMixedSeatingInputV1): Prepared | Blocked {
  const blocked = (code: string): Blocked => ({status: "blocked", code});
  try {
    const observed = observeNativeMixedAttendanceV1(input.attendance.value, input.attendance.expected);
    if (observed.status === "blocked") return blocked(observed.code);
    const l = input.lifecycle;
    if (!l || l.tournamentId !== observed.tournamentId || l.eventId !== observed.eventId) return blocked("lifecycle_scope_changed");
    if (!Array.isArray(l.existingTournamentIds) || typeof l.hasDraw !== "boolean" || typeof l.hasStarted !== "boolean") return blocked("lifecycle_unavailable");
    // A retained draw/publication must be recovered through its own journal,
    // never replaced by another local RNG call after a lost response.
    if (l.hasDraw || l.seatingPublicationId !== null || l.schedulePublicationId !== null || l.existingTournamentIds.length)
      return {status: "readonly", code: "existing_draw_or_fixed_ids_immutable"};
    if (l.hasStarted || l.tournamentStatus !== "open" || l.registrationStatus !== "closed" || l.operationalState !== "active"
      || l.eventType !== "main" || l.format !== "standard_singles" || l.gameCount !== 12 || l.participantCount !== 18)
      return blocked("pre_draw_lifecycle_required");
    const c = input.config;
    if (!c || typeof c !== "object" || Array.isArray(c) || Object.keys(c).sort().join(",") !== keys.join(",")
      || canonical(c.tables) !== canonical([{tableId: "A", seatCount: 18}]) || canonical(c.activePairIds) !== canonical(pairs)
      || c.anchor?.seatId !== "A-1" || c.anchor.directorApproved !== true || !Number.isInteger(c.maxAttempts)
      || Object.keys(c.anchor).sort().join(",") !== "directorApproved,participantId,seatId"
      || c.maxAttempts < 1 || c.maxAttempts > 256 || !Array.isArray(c.stationaryRequests)
      || new Set(c.stationaryRequests).size !== c.stationaryRequests.length
      || c.stationaryRequests.some(id => !input.attendance.expected.roster.some(r => r.rosterEntryId === id))
      || !Array.isArray(c.stationaryDecisions) || c.stationaryDecisions.some(d => !d || typeof d !== "object"
        || Object.keys(d).sort().join(",") !== "decision,participantId")
      || !Array.isArray(c.constraints) || c.constraints.length > 36 || c.constraints.some(d => !d || typeof d.sourceReference !== "string"
        || d.sourceReference.trim().length > 500 || /[\u0000-\u001f\u007f]/u.test(d.sourceReference)))
      return blocked("explicit_a18_config_required");
    const localInput: LocalRandomPlanInput = {
      source: {version: observed.scope.version, sha256: observed.attendanceSourceDigest},
      registration: "closed", seating: "unpublished", existingTournamentIds: [],
      participants: input.attendance.expected.roster.map(r => ({participantId: r.rosterEntryId,
        stationaryPreference: c.stationaryRequests.includes(r.rosterEntryId) ? "requested" : "none"})),
      tables: copy(c.tables), activePairIds: copy(c.activePairIds), anchor: copy(c.anchor),
      stationaryDecisions: copy(c.stationaryDecisions), constraints: copy(c.constraints), maxAttempts: c.maxAttempts,
    };
    if (validateLocalRandomPlanInput(localInput).length) return blocked("plan_constraints_invalid");
    return {status: "prepared-not-authorized", pins: {attendanceSealId: observed.sealId, attendanceScopeId: observed.scope.scopeId,
      attendanceSourceDigest: observed.attendanceSourceDigest, fundingSourceDigest: observed.scope.fundingSourceDigest},
      localInput, rosterProjection: input.attendance.expected.roster.map(r => ({...copy(r), state: "sim_ready",
        fictional: r.mode === "paper", physicalPresenceVerified: false})),
      ordinaryCheckInUsed: false, databaseSourceVerified: false, normalDrawAuthorized: false, nativePublicationAuthorized: false,
      schedulePublicationAuthorized: false, normalStartAuthorized: false, physicalRoomVerified: false};
  } catch { return blocked("simulation_plan_invalid"); }
}

/** Local demonstration only. A provided RNG is not database entropy, durable
 * draw/replay evidence or publication. Backend one-draw enforcement is required. */
export function drawNativeMixedSeatingCandidateV1(input: NativeMixedSeatingInputV1, randomInt: RandomInt): Candidate | Blocked {
  try {
    const before = canonical(input);
    const prepared = prepareNativeMixedSeatingV1(input);
    if (prepared.status !== "prepared-not-authorized") return prepared;
    const candidate = planLocalRandomSeating(prepared.localInput, randomInt);
    if (canonical(input) !== before) return {status: "blocked", code: "simulation_plan_source_changed"};
    if (candidate.status !== "candidate") return candidate.status === "readonly"
      ? {status: "readonly", code: "existing_draw_or_fixed_ids_immutable"} : {status: "blocked", code: "no_valid_local_candidate"};
    const movement = projectOneTableMovement(prepared.localInput, candidate);
    if (movement.status !== "verified") return {status: "blocked", code: "a18_movement_mismatch"};
    return {status: "local-candidate-not-authorized", pins: copy(prepared.pins), rosterProjection: copy(prepared.rosterProjection),
      candidate: copy(candidate), sourceObservation: "provided-models-not-atomic", rngCryptographicallyVerified: false,
      databaseSourceVerified: false, ordinaryCheckInUsed: false, normalDrawAuthorized: false, nativePublicationAuthorized: false,
      schedulePublicationAuthorized: false, normalStartAuthorized: false, physicalRoomVerified: false};
  } catch { return {status: "blocked", code: "simulation_plan_invalid"}; }
}
