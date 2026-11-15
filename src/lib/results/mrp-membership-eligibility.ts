/**
 * Pure, unmounted membership projection over trusted, current server evidence.
 * This is NOT an authorization, identity-match, source-freshness or audit writer.
 * The caller must load the current observation/correction from protected storage,
 * authorize the actual TD, and establish the applicable membership date first.
 */
export const mrpMembershipRuleVersion = "active-acc-membership-v1" as const;

type Scope = {
  tournamentId: string;
  eventId: string;
  rosterEntryId: string;
  membershipEffectiveOn: string;
};
export type MrpMembershipObservation = Scope & {
  id: string;
  status: "active" | "inactive" | "nonmember" | "unknown" | "not_found" | "unavailable";
  sourceReference: string;
  observedAt: string;
};
export type MrpMembershipCorrection = Scope & {
  id: string;
  observationId: string;
  status: "verified_active" | "withdrawn";
  actorId: string;
  actorRole: "tournament_director";
  reasonCode: "website_reporting_error";
  reason: string;
  evidenceReference: string;
  recordedAt: string;
  supersedesCorrectionId: string | null;
};
export type MrpMembershipInput = {
  scope: Scope;
  observation: MrpMembershipObservation | null;
  correction: MrpMembershipCorrection | null;
};
export type MrpMembershipDecision = {
  ruleVersion: typeof mrpMembershipRuleVersion;
  status: "eligible" | "ineligible" | "review_required";
  reason: "active_membership" | "director_verified_website_error" | "inactive_membership"
    | "confirmed_nonmember" | "membership_unverified" | "invalid_evidence" | "scope_mismatch";
  observationId: string | null;
  correctionId: string | null;
};
export type CalculatedMrp = { qualifyingMrp: number; playoffMrp: number; totalMrp: number };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const scopeKeys = ["tournamentId", "eventId", "rosterEntryId", "membershipEffectiveOn"];
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}
function uuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 2000;
}
function date(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === value;
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function scope(value: unknown): value is Record<string, unknown> & Scope {
  return object(value) && uuid(value.tournamentId) && uuid(value.eventId)
    && uuid(value.rosterEntryId) && date(value.membershipEffectiveOn);
}
function sameScope(left: Scope, right: Scope) {
  return left.tournamentId.toLowerCase() === right.tournamentId.toLowerCase()
    && left.eventId.toLowerCase() === right.eventId.toLowerCase()
    && left.rosterEntryId.toLowerCase() === right.rosterEntryId.toLowerCase()
    && left.membershipEffectiveOn === right.membershipEffectiveOn;
}
function decision(status: MrpMembershipDecision["status"], reason: MrpMembershipDecision["reason"], observationId: string | null = null, correctionId: string | null = null): MrpMembershipDecision {
  return { ruleVersion: mrpMembershipRuleVersion, status, reason, observationId, correctionId };
}

export function evaluateMrpMembership(input: unknown): MrpMembershipDecision {
  if (!object(input) || !exact(input, ["scope", "observation", "correction"])
    || !scope(input.scope) || !exact(input.scope, scopeKeys)) return decision("review_required", "invalid_evidence");
  const observation = input.observation;
  const correction = input.correction;
  if (observation === null) return decision("review_required", correction === null ? "membership_unverified" : "invalid_evidence");
  if (!scope(observation) || !exact(observation, [...scopeKeys, "id", "status", "sourceReference", "observedAt"])
    || !uuid(observation.id) || !text(observation.sourceReference) || !timestamp(observation.observedAt)
    || !["active", "inactive", "nonmember", "unknown", "not_found", "unavailable"].includes(observation.status as string)) {
    return decision("review_required", "invalid_evidence");
  }
  if (!sameScope(input.scope, observation)) return decision("review_required", "scope_mismatch");
  if (correction !== null) {
    if (!scope(correction) || !exact(correction, [...scopeKeys, "id", "observationId", "status", "actorId", "actorRole", "reasonCode", "reason", "evidenceReference", "recordedAt", "supersedesCorrectionId"])
      || !uuid(correction.id) || !uuid(correction.observationId) || !uuid(correction.actorId)
      || correction.actorRole !== "tournament_director" || correction.reasonCode !== "website_reporting_error"
      || !["verified_active", "withdrawn"].includes(correction.status as string)
      || !text(correction.reason) || !text(correction.evidenceReference) || !timestamp(correction.recordedAt)
      || (correction.supersedesCorrectionId !== null && (!uuid(correction.supersedesCorrectionId)
        || correction.supersedesCorrectionId.toLowerCase() === correction.id.toLowerCase()))
      || Date.parse(correction.recordedAt) < Date.parse(observation.observedAt)) {
      return decision("review_required", "invalid_evidence", observation.id);
    }
    if (!sameScope(input.scope, correction) || correction.observationId.toLowerCase() !== observation.id.toLowerCase()) {
      return decision("review_required", "scope_mismatch", observation.id);
    }
    if (correction.status === "verified_active") {
      // A failed or ambiguous lookup is not an erroneous definitive status.
      if (observation.status !== "inactive" && observation.status !== "nonmember") {
        return decision("review_required", "membership_unverified", observation.id, correction.id);
      }
      return decision("eligible", "director_verified_website_error", observation.id, correction.id);
    }
    // A withdrawn correction grants nothing. Keep its ID for review traceability.
  }
  const correctionId = correction === null ? null : (correction as MrpMembershipCorrection).id;
  switch (observation.status) {
    case "active": return decision("eligible", "active_membership", observation.id, correctionId);
    case "inactive": return decision("ineligible", "inactive_membership", observation.id, correctionId);
    case "nonmember": return decision("ineligible", "confirmed_nonmember", observation.id, correctionId);
    default: return decision("review_required", "membership_unverified", observation.id, correctionId);
  }
}

/** Preserve performance arithmetic; only project membership's effect on awards. */
export function projectMrpMembershipAward(input: unknown, calculated: CalculatedMrp) {
  if (!object(calculated) || !exact(calculated, ["qualifyingMrp", "playoffMrp", "totalMrp"])
    || !Object.values(calculated).every((value) => Number.isSafeInteger(value) && value >= 0)
    || !Number.isSafeInteger(calculated.qualifyingMrp + calculated.playoffMrp)
    || calculated.totalMrp !== calculated.qualifyingMrp + calculated.playoffMrp) {
    throw new TypeError("A complete consistent MRP calculation is required.");
  }
  const membership = evaluateMrpMembership(input);
  const awarded = membership.status === "eligible" ? { ...calculated }
    : membership.status === "ineligible" ? { qualifyingMrp: 0, playoffMrp: 0, totalMrp: 0 } : null;
  return { membership, calculated: { ...calculated }, awarded };
}
