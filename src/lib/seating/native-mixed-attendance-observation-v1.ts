/** Supplied-model validation only. No QR/desk, roster/status projection, draw,
 * Start, identity-token verification or provider capability is created. */
type Scope = {scopeId: string; version: 1; admissionIntentId: string; fundingScopeId: string;
  fundingSourceDigest: string; operationalBindingId: string; participantCount: 18; digitalCount: 6; paperCount: 12; sourceDigest: string};
type Identity = {rosterEntryId: string; participantId: string; mode: "digital" | "paper"; profileId: string | null};
type Consent = {consentId: string; version: number; priorConsentId: string | null; decision: "granted";
  rosterEntryId: string; participantId: string; profileId: string; operationId: string;
  statement: "test-only-simulation-participation-v1"; sourceDigest: string};
type PaperEntry = {rosterEntryId: string; participantId: string; profileId: null; mode: "paper"; fictional: true};
type Declaration = {declarationId: string; preparerId: string; entries: PaperEntry[]; operationId: string; sourceDigest: string; fictional: true};
type Review = {reviewId: string; reviewerId: string; declarationId: string; operationId: string; sourceDigest: string; decision: "accepted-synthetic-only"};
export type NativeMixedAttendanceExpectedV1 = {actorId: string; sealId: string; tournamentId: string; eventId: string; scope: Scope; roster: Identity[];
  latestConsents: {rosterEntryId: string; consentId: string; version: number; decision: "granted" | "revoked"}[];
  officials: {profileId: string; roles: string[]}[]};
type Result = {status: "blocked"; code: string} | {
  status: "simulation-attendance-observation"; actorId: string; sealId: string; tournamentId: string; eventId: string; scope: Scope;
  attendanceSourceDigest: string; digitalConsents: Consent[]; paperDeclaration: Declaration; paperReview: Review;
  readyIdentityCount: 18; simulationReadinessComplete: true;
  sourceObservation: "provided-models-not-atomic" | "matching-double-read-not-atomic";
  databaseProvenanceVerified: false; identityBoundConsentVerified: false; independentHumanReviewVerified: false;
  ordinaryAttendanceUsed: false; paymentVerified: false; humanPresenceVerified: false; physicalPresenceVerified: false;
  actualMoneyReceived: false; moneyMoved: false; refundAuthorized: false; payoutAuthorized: false; finalizationAuthorized: false;
  normalDrawAuthorized: false; normalStartAuthorized: false;
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> => record(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const digest = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const version = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 2147483647;
const canonical = (v: unknown): string => JSON.stringify(v, (_k, x) => x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const flags = ["ordinaryAttendanceUsed", "paymentVerified", "humanPresenceVerified", "physicalPresenceVerified",
  "actualMoneyReceived", "moneyMoved", "refundAuthorized", "payoutAuthorized", "finalizationAuthorized", "normalDrawAuthorized", "normalStartAuthorized"];
function validScope(s: unknown): s is Scope {
  return exact(s, ["scopeId", "version", "admissionIntentId", "fundingScopeId", "fundingSourceDigest", "operationalBindingId",
    "participantCount", "digitalCount", "paperCount", "sourceDigest"])
    && uuid(s.scopeId) && s.version === 1 && uuid(s.admissionIntentId) && uuid(s.fundingScopeId) && digest(s.fundingSourceDigest)
    && uuid(s.operationalBindingId) && s.participantCount === 18 && s.digitalCount === 6 && s.paperCount === 12 && digest(s.sourceDigest);
}
function validIdentity(v: unknown): v is Identity {
  return exact(v, ["rosterEntryId", "participantId", "mode", "profileId"]) && uuid(v.rosterEntryId) && uuid(v.participantId)
    && ((v.mode === "digital" && uuid(v.profileId)) || (v.mode === "paper" && v.profileId === null));
}
function validExpected(e: NativeMixedAttendanceExpectedV1): boolean {
  if (!e || !uuid(e.actorId) || !uuid(e.sealId) || !uuid(e.tournamentId) || !uuid(e.eventId) || !validScope(e.scope) || !Array.isArray(e.roster)
    || e.roster.length !== 18 || !e.roster.every(validIdentity) || new Set(e.roster.map(r => r.rosterEntryId)).size !== 18
    || new Set(e.roster.map(r => r.participantId)).size !== 18 || e.roster.filter(r => r.mode === "digital").length !== 6
    || new Set(e.roster.filter(r => r.mode === "digital").map(r => r.profileId)).size !== 6
    || !Array.isArray(e.latestConsents) || e.latestConsents.length !== 6
    || !Array.isArray(e.officials) || e.officials.length < 2) return false;
  return new Set(e.latestConsents.map(c => c.rosterEntryId)).size === 6 && e.latestConsents.every(c =>
    exact(c, ["rosterEntryId", "consentId", "version", "decision"]) && uuid(c.rosterEntryId) && uuid(c.consentId) && version(c.version)
    && (c.decision === "granted" || c.decision === "revoked") && e.roster.some(r => r.rosterEntryId === c.rosterEntryId && r.mode === "digital"))
    && new Set(e.officials.map(o => o.profileId)).size === e.officials.length
    && e.officials.every(o => uuid(o.profileId) && Array.isArray(o.roles) && o.roles.every(r => typeof r === "string"));
}

export function observeNativeMixedAttendanceV1(value: unknown, expected: NativeMixedAttendanceExpectedV1): Result {
  const blocked = (code: string): Result => ({status: "blocked", code});
  try {
    if (!validExpected(expected)) return blocked("retained_attendance_scope_invalid");
    if (!exact(value, ["status", "kind", "actorId", "sealId", "tournamentId", "eventId", "scope", "digitalConsents", "paperDeclaration", "paperReview", "sourceDigest", ...flags])
      || value.status !== "source_available" || value.kind !== "native-mixed-attendance-source-v1" || !digest(value.sourceDigest)
      || flags.some(k => value[k] !== false)) return blocked("simulation_attendance_unavailable");
    if (value.actorId !== expected.actorId || value.sealId !== expected.sealId || value.tournamentId !== expected.tournamentId || value.eventId !== expected.eventId
      || !validScope(value.scope) || canonical(value.scope) !== canonical(expected.scope)) return blocked("attendance_scope_changed");
    if (!Array.isArray(value.digitalConsents) || value.digitalConsents.length !== 6) return blocked("six_current_self_consents_required");
    const consentIds = new Set<string>(), rosterIds = new Set<string>();
    for (const c of value.digitalConsents) {
      if (!exact(c, ["consentId", "version", "priorConsentId", "decision", "rosterEntryId", "participantId", "profileId", "operationId", "statement", "sourceDigest"])
        || !uuid(c.consentId) || !version(c.version) || !((c.version === 1 && c.priorConsentId === null)
          || (c.version > 1 && uuid(c.priorConsentId) && c.priorConsentId !== c.consentId))
        || c.decision !== "granted" || !uuid(c.rosterEntryId) || !uuid(c.participantId) || !uuid(c.profileId) || !uuid(c.operationId)
        || c.statement !== "test-only-simulation-participation-v1" || !digest(c.sourceDigest)) return blocked("self_consent_invalid");
      if (consentIds.has(c.consentId) || rosterIds.has(c.rosterEntryId)) return blocked("self_consent_ambiguous");
      consentIds.add(c.consentId); rosterIds.add(c.rosterEntryId);
      if (!expected.roster.some(r => r.mode === "digital" && r.rosterEntryId === c.rosterEntryId && r.participantId === c.participantId && r.profileId === c.profileId))
        return blocked("self_consent_identity_changed");
      if (!expected.latestConsents.some(h => h.rosterEntryId === c.rosterEntryId && h.consentId === c.consentId && h.version === c.version && h.decision === "granted"))
        return blocked("self_consent_changed_or_revoked");
    }
    const d = value.paperDeclaration, r = value.paperReview;
    if (!exact(d, ["declarationId", "preparerId", "entries", "operationId", "sourceDigest", "fictional"])
      || !uuid(d.declarationId) || !uuid(d.preparerId) || !uuid(d.operationId) || !digest(d.sourceDigest) || d.fictional !== true
      || !Array.isArray(d.entries) || d.entries.length !== 12
      || !expected.officials.some(o => o.profileId === d.preparerId && o.roles.includes("director"))) return blocked("fictional_declaration_required");
    const papers = new Set<string>();
    for (const p of d.entries) {
      if (!exact(p, ["rosterEntryId", "participantId", "profileId", "mode", "fictional"]) || !uuid(p.rosterEntryId) || !uuid(p.participantId)
        || p.profileId !== null || p.mode !== "paper" || p.fictional !== true || papers.has(p.rosterEntryId)
        || !expected.roster.some(x => x.mode === "paper" && x.profileId === null && x.rosterEntryId === p.rosterEntryId && x.participantId === p.participantId))
        return blocked("fictional_identity_changed");
      papers.add(p.rosterEntryId);
    }
    if (!exact(r, ["reviewId", "reviewerId", "declarationId", "operationId", "sourceDigest", "decision"])
      || !uuid(r.reviewId) || !uuid(r.reviewerId) || !uuid(r.operationId) || !digest(r.sourceDigest)
      || r.declarationId !== d.declarationId || r.reviewerId === d.preparerId || r.decision !== "accepted-synthetic-only"
      || !expected.officials.some(o => o.profileId === r.reviewerId && o.roles.includes("cross_checker"))) return blocked("independent_paper_review_required");
    return {status: "simulation-attendance-observation", actorId: expected.actorId, sealId: expected.sealId, tournamentId: expected.tournamentId, eventId: expected.eventId,
      scope: copy(value.scope), attendanceSourceDigest: value.sourceDigest, digitalConsents: copy(value.digitalConsents) as Consent[],
      paperDeclaration: copy(d) as Declaration, paperReview: copy(r) as Review, readyIdentityCount: 18, simulationReadinessComplete: true,
      sourceObservation: "provided-models-not-atomic", databaseProvenanceVerified: false, identityBoundConsentVerified: false,
      independentHumanReviewVerified: false, ordinaryAttendanceUsed: false, paymentVerified: false, humanPresenceVerified: false,
      physicalPresenceVerified: false, actualMoneyReceived: false, moneyMoved: false, refundAuthorized: false, payoutAuthorized: false,
      finalizationAuthorized: false, normalDrawAuthorized: false, normalStartAuthorized: false};
  } catch { return blocked("simulation_attendance_invalid"); }
}

type Dependencies = {access: (tournamentId: string) => Promise<{actorId: string; roles: string[]} | null>;
  models: (actorId: string, tournamentId: string, eventId: string) => Promise<{value: unknown; expected: NativeMixedAttendanceExpectedV1}>};
export function createNativeMixedAttendanceObservationReaderV1(d: Dependencies) {
  return async (tournamentId: string, eventId: string): Promise<Result> => {
    const blocked = (code: string): Result => ({status: "blocked", code});
    try {
      if (!uuid(tournamentId) || !uuid(eventId)) return blocked("invalid_scope");
      const access = async () => {
        const a = await d.access(tournamentId); return a && uuid(a.actorId) && a.roles.includes("director") ? a : null;
      };
      const actor = await access(); if (!actor) return blocked("director_access_required");
      const first = copy(await d.models(actor.actorId, tournamentId, eventId));
      const parsed = observeNativeMixedAttendanceV1(first.value, first.expected);
      if (parsed.status === "blocked") return parsed;
      if (parsed.actorId !== actor.actorId || parsed.tournamentId !== tournamentId || parsed.eventId !== eventId) return blocked("loader_scope_mismatch");
      if ((await access())?.actorId !== actor.actorId) return blocked("director_access_changed");
      const second = copy(await d.models(actor.actorId, tournamentId, eventId));
      if ((await access())?.actorId !== actor.actorId) return blocked("director_access_changed");
      if (canonical(first) !== canonical(second)) return blocked("attendance_source_changed");
      const result = observeNativeMixedAttendanceV1(second.value, second.expected);
      return result.status === "blocked" ? result : {...result, sourceObservation: "matching-double-read-not-atomic"};
    } catch { return blocked("simulation_attendance_unavailable"); }
  };
}
