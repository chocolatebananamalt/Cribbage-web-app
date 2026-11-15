import { isUuid } from "./validation.ts";
import { buildFacingGeometry, validateLocalRandomPlanInput, type LocalRandomPlanInput, type LocalRandomPlanResult } from "../seating/local-random-plan.ts";
export const localSeatingAlgorithm = "local-circle-18-v1";
export const localSeatingNotice = "Anonymous local planning only. No tournament is loaded, no permanent IDs are assigned, and no seating or schedule can be published here.";
export type LocalSeatingRequest = { kind: "local-seating-preview-v1"; plannerId: string; operationId: string; epochId: string; inputDigest: string; input: LocalRandomPlanInput };
export type LocalSeatingReceipt = { kind: "local-seating-receipt-v1"; plannerId: string; operationId: string; epochId: string; inputDigest: string; result: LocalRandomPlanResult; authoritative: false; databaseWritten: false; persistentAudit: false };
export type LocalSeatingCapability = { kind: "local-seating-planner-v1"; epochId: string; algorithmVersion: typeof localSeatingAlgorithm; notice: typeof localSeatingNotice; authoritative: false; databaseWritten: false; persistentAudit: false };
export type LocalRedrawReason = "changed-room-layout" | "changed-stationary-assumptions" | "changed-constraint-assumptions" | "compare-another-draw" | "previous-result-unavailable";
export const localRedrawReasons: LocalRedrawReason[] = ["changed-room-layout", "changed-stationary-assumptions", "changed-constraint-assumptions", "compare-another-draw", "previous-result-unavailable"];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const anon = (v: unknown): v is string => typeof v === "string" && /^entry-(?:0[1-9]|1[0-8])$/.test(v);
const seat = (v: unknown): v is string => typeof v === "string" && /^[A-Z]-(?:[1-9]|1[0-9]|20)$/.test(v);
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const integer = (v: unknown, max: number, min = 1): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
export function canonicalLocalPlan(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalLocalPlan).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalLocalPlan(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
/** No actual names, ACC numbers, live roster UUIDs or free-text personal fields. */
export function isAnonymousLocalPlanInput(v: unknown): v is LocalRandomPlanInput {
  if (!record(v) || !exact(v, ["source", "registration", "seating", "existingTournamentIds", "participants", "tables", "activePairIds", "anchor", "stationaryDecisions", "constraints", ...(Object.hasOwn(v, "maxAttempts") ? ["maxAttempts"] : [])])) return false;
  if (!record(v.source) || !exact(v.source, ["version", "sha256"]) || !integer(v.source.version, 1000000) || !digest(v.source.sha256)
    || !["open", "closed"].includes(v.registration as string) || !["unpublished", "published"].includes(v.seating as string)
    || !Array.isArray(v.existingTournamentIds) || v.existingTournamentIds.length > 18 || !v.existingTournamentIds.every(seat)
    || !Array.isArray(v.participants) || v.participants.length !== 18 || !v.participants.every(p => record(p) && exact(p, ["participantId", "stationaryPreference"]) && anon(p.participantId) && ["requested", "none"].includes(p.stationaryPreference as string))
    || !Array.isArray(v.tables) || !integer(v.tables.length, 26) || !v.tables.every(t => record(t) && exact(t, ["tableId", "seatCount"]) && typeof t.tableId === "string" && /^[A-Z]$/.test(t.tableId) && integer(t.seatCount, 20))
    || !Array.isArray(v.activePairIds) || v.activePairIds.length > 260 || !v.activePairIds.every(p => typeof p === "string" && /^[A-Z]:[0-9]{1,2}-[0-9]{1,2}$/.test(p))
    || !record(v.anchor) || !exact(v.anchor, ["participantId", "seatId", "directorApproved"]) || !(v.anchor.participantId === null || anon(v.anchor.participantId)) || !seat(v.anchor.seatId) || typeof v.anchor.directorApproved !== "boolean"
    || !Array.isArray(v.stationaryDecisions) || v.stationaryDecisions.length > 18 || !v.stationaryDecisions.every(d => record(d) && exact(d, ["participantId", "decision"]) && anon(d.participantId) && ["selected-anchor", "not-accommodated"].includes(d.decision as string))
    || !Array.isArray(v.constraints) || v.constraints.length > 36 || !v.constraints.every(c => record(c) && exact(c, ["kind", "participantIds", "round", "verified", "sourceReference"]) && c.kind === "avoid-pair-in-round" && Array.isArray(c.participantIds) && c.participantIds.length === 2 && c.participantIds.every(anon) && integer(c.round, 12) && c.verified === true && typeof c.sourceReference === "string" && /^LOCAL-PLAN-[A-Z0-9_-]{1,40}$/.test(c.sourceReference))
    || (Object.hasOwn(v, "maxAttempts") && !integer(v.maxAttempts, 256))) return false;
  return new Set(v.tables.map(t => t.tableId)).size === v.tables.length && new Set(v.participants.map(p => p.participantId)).size === 18;
}
export function isLocalSeatingRequest(v: unknown): v is LocalSeatingRequest {
  return record(v) && exact(v, ["kind", "plannerId", "operationId", "epochId", "inputDigest", "input"]) && v.kind === "local-seating-preview-v1" && isUuid(v.plannerId) && isUuid(v.operationId) && isUuid(v.epochId) && digest(v.inputDigest) && isAnonymousLocalPlanInput(v.input);
}
export function isLocalSeatingCapability(v: unknown): v is LocalSeatingCapability {
  return record(v) && exact(v, ["kind", "epochId", "algorithmVersion", "notice", "authoritative", "databaseWritten", "persistentAudit"]) && v.kind === "local-seating-planner-v1" && isUuid(v.epochId) && v.algorithmVersion === localSeatingAlgorithm && v.notice === localSeatingNotice && v.authoritative === false && v.databaseWritten === false && v.persistentAudit === false;
}
/** Independent output validation: no server/client claim can become a publication. */
export function isLocalPlanResult(v: unknown, input: LocalRandomPlanInput): v is LocalRandomPlanResult {
  if (!record(v)) return false;
  if (v.status === "readonly") return exact(v, ["status", "reason"]) && (input.seating === "published" || input.existingTournamentIds.length > 0) && typeof v.reason === "string" && v.reason.length <= 300;
  if (v.status === "blocked") return exact(v, ["status", "reasons", "attempts"]) && Array.isArray(v.reasons) && v.reasons.length > 0 && v.reasons.length <= 20 && v.reasons.every(r => typeof r === "string" && r.length > 0 && r.length <= 300) && integer(v.attempts, 256, 0);
  if (v.status !== "candidate" || !exact(v, ["status", "algorithmVersion", "source", "hashVerified", "inputSnapshot", "canonicalInput", "attempts", "anchor", "assignments", "matches", "physicalReviewRequired", "publishable", "persistentAudit"])
    || v.algorithmVersion !== localSeatingAlgorithm || v.hashVerified !== false || v.physicalReviewRequired !== true || v.publishable !== false || v.persistentAudit !== false || validateLocalRandomPlanInput(input).length > 0
    || !integer(v.attempts, input.constraints.length ? input.maxAttempts ?? 128 : 1) || canonicalLocalPlan(v.inputSnapshot) !== canonicalLocalPlan(input) || canonicalLocalPlan(v.source) !== canonicalLocalPlan(input.source) || v.canonicalInput !== JSON.stringify(v.inputSnapshot)
    || !record(v.anchor) || !exact(v.anchor, ["seatId", "participantId", "selection"]) || v.anchor.seatId !== input.anchor.seatId || !anon(v.anchor.participantId) || v.anchor.selection !== (input.anchor.participantId === null ? "blind-draw" : "approved-person") || (input.anchor.participantId !== null && v.anchor.participantId !== input.anchor.participantId)
    || !Array.isArray(v.assignments) || v.assignments.length !== 18 || !Array.isArray(v.matches) || v.matches.length !== 108) return false;
  const people = new Set(input.participants.map(p => p.participantId)), geometry = buildFacingGeometry(input.tables), active = geometry.pairs.filter(p => input.activePairIds.includes(p.pairId));
  const occupied = new Set(active.flatMap(p => p.seats.map(s => s.seatId))), slots = new Set<number>(), assignedPeople = new Set<string>(), assignedSeats = new Set<string>();
  const assigned = new Map<string, string>();
  for (const a of v.assignments) {
    if (!record(a) || !exact(a, ["participantId", "tournamentId", "logicalSlot"]) || !anon(a.participantId) || !people.has(a.participantId) || !seat(a.tournamentId) || !occupied.has(a.tournamentId) || !integer(a.logicalSlot, 17, 0) || slots.has(a.logicalSlot) || assignedPeople.has(a.participantId) || assignedSeats.has(a.tournamentId)) return false;
    slots.add(a.logicalSlot); assignedPeople.add(a.participantId); assignedSeats.add(a.tournamentId); assigned.set(a.participantId, a.tournamentId);
  }
  const opponents = new Map([...people].map(p => [p, new Set<string>()]));
  for (let round = 1; round <= 12; round++) {
    const matches = v.matches.filter(m => record(m) && m.round === round), seen = new Set<string>(), usedSeats = new Set<string>(), usedPairs = new Set<string>();
    if (matches.length !== 9) return false;
    for (const m of matches) {
      if (!record(m) || !exact(m, ["round", "pairId", "sides"]) || typeof m.pairId !== "string" || usedPairs.has(m.pairId) || !Array.isArray(m.sides) || m.sides.length !== 2) return false;
      const pair = active.find(p => p.pairId === m.pairId); if (!pair) return false; usedPairs.add(m.pairId);
      const sides = m.sides;
      for (const side of sides) {
        if (!record(side) || !exact(side, ["participantId", "seatId"]) || !anon(side.participantId) || !people.has(side.participantId) || seen.has(side.participantId) || !seat(side.seatId) || !pair.seats.some(s => s.seatId === side.seatId) || usedSeats.has(side.seatId)
          || (round === 1 && assigned.get(side.participantId) !== side.seatId) || (side.participantId === v.anchor.participantId && side.seatId !== v.anchor.seatId)) return false;
        seen.add(side.participantId); usedSeats.add(side.seatId);
      }
      const a = sides[0].participantId as string, b = sides[1].participantId as string;
      if (opponents.get(a)!.has(b)) return false;
      opponents.get(a)!.add(b); opponents.get(b)!.add(a);
      if (input.constraints.some(c => c.round === round && c.participantIds.includes(a) && c.participantIds.includes(b))) return false;
    }
  }
  const anchorParticipantId = v.anchor.participantId;
  return [...opponents.values()].every(set => set.size === 12) && v.assignments.some(a => a.participantId === anchorParticipantId && a.logicalSlot === 0);
}
export function isLocalSeatingReceipt(v: unknown, request: LocalSeatingRequest): v is LocalSeatingReceipt {
  return record(v) && exact(v, ["kind", "plannerId", "operationId", "epochId", "inputDigest", "result", "authoritative", "databaseWritten", "persistentAudit"]) && v.kind === "local-seating-receipt-v1" && v.plannerId === request.plannerId && v.operationId === request.operationId && v.epochId === request.epochId && v.inputDigest === request.inputDigest && v.authoritative === false && v.databaseWritten === false && v.persistentAudit === false && isLocalPlanResult(v.result, request.input);
}
export function isLocalSeatingPlannerEnabled(env: Record<string, string | undefined>) { return env.CRIBBAGE_LOCAL_SEATING_PLANNER === "1" && ["development", "test"].includes(env.NODE_ENV ?? "") && (env.VERCEL_ENV === undefined || env.VERCEL_ENV === "development"); }
export function isLoopbackPlannerUrl(url: string) { try { const u = new URL(url); return u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname) && !u.username && !u.password; } catch { return false; } }
