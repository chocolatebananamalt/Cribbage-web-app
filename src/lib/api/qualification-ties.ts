import { isUuid } from "./validation.ts";

export type QualificationTieMethod = "head_to_head" | "one_game_playoff";
export type QualificationTieRequest = {
  expectedSourceFingerprint: string; participantIds: [string, string]; winnerId: string;
  method: QualificationTieMethod; reason: string; evidenceReference: string;
};
export type QualificationTieResolution = {
  id: string; winnerId: string; method: QualificationTieMethod; reason: string;
  evidenceReference: string; recordedAt: string; recordedBy: string;
};
export type QualificationTieGroup = {
  candidateIds: string[]; numericRank: number; affectsQualificationCut: boolean;
  method: QualificationTieMethod | "blocked"; headToHeadGameId: string | null;
  headToHeadWinnerId: string | null; resolution: QualificationTieResolution | null;
};
export type QualificationTieWorkspace = {
  tournamentId: string; eventId: string; sourceFingerprint: string; finalized: boolean;
  blockers: string[]; groups: QualificationTieGroup[];
};
export type QualificationTieOutcome = {
  status: "qualification_tie_recorded"; eventId: string; resolutionId: string; sourceFingerprint: string;
  participantIds: [string, string]; winnerId: string; method: QualificationTieMethod;
} | { status: "rejected"; eventId: string; code: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 500 && !/[\u0000-\u001f\u007f]/.test(v);
const method = (v: unknown): v is QualificationTieMethod => v === "head_to_head" || v === "one_game_playoff";
const codes = new Set(["invalid_request", "not_director", "event_unavailable", "tournament_unavailable", "already_finalized", "stale_source", "invalid_pair", "ambiguous_tie", "method_unavailable", "head_to_head_winner_mismatch", "resolution_already_recorded", "idempotency_conflict", "schedule_incomplete", "scorecards_unresolved", "recovery_pending", "correction_pending", "qualification_notice_pending", "dispute_open"]);
export function isQualificationTieRequest(v: unknown): v is QualificationTieRequest {
  return object(v) && exact(v, ["expectedSourceFingerprint", "participantIds", "winnerId", "method", "reason", "evidenceReference"])
    && digest(v.expectedSourceFingerprint) && Array.isArray(v.participantIds) && v.participantIds.length === 2
    && v.participantIds.every(isUuid) && new Set(v.participantIds).size === 2 && isUuid(v.winnerId)
    && v.participantIds.includes(v.winnerId) && method(v.method) && text(v.reason) && text(v.evidenceReference);
}
export function isQualificationTieReconciliationRequest(v: unknown): v is { operationId: string; request: QualificationTieRequest } {
  return object(v) && exact(v, ["operationId", "request"]) && isUuid(v.operationId) && isQualificationTieRequest(v.request);
}
export function isQualificationTieOutcome(v: unknown, eventId: string): v is QualificationTieOutcome {
  return object(v) && v.eventId === eventId && isUuid(eventId) && (v.status === "qualification_tie_recorded"
    ? exact(v, ["status", "eventId", "resolutionId", "sourceFingerprint", "participantIds", "winnerId", "method"])
      && isUuid(v.resolutionId) && digest(v.sourceFingerprint) && Array.isArray(v.participantIds)
      && v.participantIds.length === 2 && v.participantIds.every(isUuid) && new Set(v.participantIds).size === 2
      && isUuid(v.winnerId) && v.participantIds.includes(v.winnerId) && method(v.method)
    : v.status === "rejected" && exact(v, ["status", "eventId", "code"]) && typeof v.code === "string" && codes.has(v.code));
}
export function qualificationTieOutcomeMatches(v: QualificationTieOutcome, r: QualificationTieRequest) {
  return v.status === "rejected" || (v.sourceFingerprint === r.expectedSourceFingerprint
    && [...v.participantIds].sort().join() === [...r.participantIds].sort().join()
    && v.winnerId === r.winnerId && v.method === r.method);
}
export function isQualificationTieWorkspace(v: unknown, tournamentId: string, eventId: string): v is QualificationTieWorkspace {
  if (!object(v) || !exact(v, ["tournamentId", "eventId", "sourceFingerprint", "finalized", "blockers", "groups"])
    || v.tournamentId !== tournamentId || v.eventId !== eventId || !isUuid(tournamentId) || !isUuid(eventId)
    || !digest(v.sourceFingerprint) || typeof v.finalized !== "boolean" || !Array.isArray(v.blockers)
    || !v.blockers.every(b => typeof b === "string" && /^[a-z_]{1,100}$/.test(b)) || v.blockers.length > 64
    || !Array.isArray(v.groups) || v.groups.length > 256) return false;
  const used = new Set<string>();
  return v.groups.every(g => {
    if (!object(g) || !exact(g, ["candidateIds", "numericRank", "affectsQualificationCut", "method", "headToHeadGameId", "headToHeadWinnerId", "resolution"])
      || !Array.isArray(g.candidateIds) || g.candidateIds.length < 2 || g.candidateIds.length > 256
      || !g.candidateIds.every(isUuid) || new Set(g.candidateIds).size !== g.candidateIds.length
      || g.candidateIds.some(id => used.has(id)) || !Number.isSafeInteger(g.numericRank) || (g.numericRank as number) < 1
      || typeof g.affectsQualificationCut !== "boolean" || !(method(g.method) || g.method === "blocked")) return false;
    g.candidateIds.forEach(id => used.add(id));
    if (g.method === "head_to_head" ? !isUuid(g.headToHeadGameId) || !isUuid(g.headToHeadWinnerId) || !g.candidateIds.includes(g.headToHeadWinnerId)
      : g.headToHeadGameId !== null || g.headToHeadWinnerId !== null) return false;
    if (g.method !== "blocked" && g.candidateIds.length !== 2) return false;
    const r = g.resolution;
    return r === null || (g.method !== "blocked" && object(r)
      && exact(r, ["id", "winnerId", "method", "reason", "evidenceReference", "recordedAt", "recordedBy"])
      && isUuid(r.id) && isUuid(r.winnerId) && g.candidateIds.includes(r.winnerId) && r.method === g.method
      && (g.method !== "head_to_head" || r.winnerId === g.headToHeadWinnerId)
      && text(r.reason) && text(r.evidenceReference) && isUuid(r.recordedBy)
      && typeof r.recordedAt === "string" && Number.isFinite(Date.parse(r.recordedAt)));
  });
}
