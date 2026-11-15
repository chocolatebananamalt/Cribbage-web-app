import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMrpMembership, projectMrpMembershipAward } from "../src/lib/results/mrp-membership-eligibility.ts";

const id = (n) => `f0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scope = { tournamentId: id(1), eventId: id(2), rosterEntryId: id(3), membershipEffectiveOn: "2026-11-09" };
const observation = { ...scope, id: id(4), status: "active", sourceReference: "Fictional reviewed source", observedAt: "2026-11-09T10:00:00.000Z" };
const correction = { ...scope, id: id(5), observationId: id(4), status: "verified_active", actorId: id(6), actorRole: "tournament_director", reasonCode: "website_reporting_error", reason: "Renewal confirmed; website reports expired.", evidenceReference: "Fictional renewal evidence", recordedAt: "2026-11-09T11:00:00.000Z", supersedesCorrectionId: null };
const calculated = { qualifyingMrp: 15, playoffMrp: 21, totalMrp: 36 };
const input = (status = "active", override = null) => ({ scope: { ...scope }, observation: { ...observation, status }, correction: override && { ...correction, ...override } });

test("verified active evidence preserves calculated awards", () => {
  const result = projectMrpMembershipAward(input(), calculated);
  assert.equal(result.membership.status, "eligible");
  assert.equal(result.membership.reason, "active_membership");
  assert.deepEqual(result.awarded, calculated);
});
for (const status of ["inactive", "nonmember"]) test(`${status} receives no MRPs without altering performance`, () => {
  const result = projectMrpMembershipAward(input(status), calculated);
  assert.equal(result.membership.status, "ineligible");
  assert.deepEqual(result.awarded, { qualifyingMrp: 0, playoffMrp: 0, totalMrp: 0 });
  assert.deepEqual(result.calculated, calculated);
});
for (const status of ["unknown", "not_found", "unavailable"]) test(`${status} holds awards for review, never declares nonmembership`, () => {
  const result = projectMrpMembershipAward(input(status), calculated);
  assert.equal(result.membership.status, "review_required");
  assert.equal(result.awarded, null);
});
test("no observation is unverified, regardless of an asserted correction", () => {
  assert.equal(evaluateMrpMembership({ scope, observation: null, correction: null }).reason, "membership_unverified");
  assert.equal(evaluateMrpMembership({ scope, observation: null, correction }).reason, "invalid_evidence");
});
test("TD verified website-error correction permits awards while preserving original evidence", () => {
  const source = input("inactive", {});
  const original = structuredClone(source);
  const result = projectMrpMembershipAward(source, calculated);
  assert.equal(result.membership.status, "eligible");
  assert.equal(result.membership.reason, "director_verified_website_error");
  assert.equal(result.membership.observationId, observation.id);
  assert.equal(result.membership.correctionId, correction.id);
  assert.deepEqual(result.awarded, calculated);
  assert.deepEqual(source, original);
});
test("withdrawn correction falls back to source status", () => {
  const result = projectMrpMembershipAward(input("inactive", { status: "withdrawn", supersedesCorrectionId: id(8) }), calculated);
  assert.equal(result.membership.status, "ineligible");
  assert.equal(result.membership.correctionId, correction.id);
  assert.equal(result.awarded.totalMrp, 0);
});
for (const field of ["tournamentId", "eventId", "rosterEntryId", "membershipEffectiveOn"]) test(`foreign or stale ${field} evidence cannot award`, () => {
  const foreign = field === "membershipEffectiveOn" ? "2026-11-08" : id(99);
  const a = input(); a.observation[field] = foreign;
  assert.equal(evaluateMrpMembership(a).status, "review_required");
  const b = input("inactive", { [field]: foreign });
  assert.equal(evaluateMrpMembership(b).status, "review_required");
});
test("new observation invalidates an old correction rather than silently carrying it forward", () => {
  assert.equal(evaluateMrpMembership(input("inactive", { observationId: id(99) })).reason, "scope_mismatch");
});
for (const [field, value] of [["actorRole", "co_director"], ["actorRole", "player"], ["actorId", ""], ["reason", " "], ["evidenceReference", ""], ["reasonCode", "allow_nonmember"], ["recordedAt", "2026-11-09T09:00:00.000Z"], ["supersedesCorrectionId", id(5)]]) {
  test(`invalid correction ${field}=${value} fails closed`, () => assert.equal(evaluateMrpMembership(input("inactive", { [field]: value })).status, "review_required"));
}
test("malformed dates, unknown status, extra fields and missing correction fail closed", () => {
  for (const bad of [null, {}, { ...input(), correction: undefined }, { ...input(), extra: true }, input("Active"), input("expired")]) {
    assert.equal(evaluateMrpMembership(bad).status, "review_required");
  }
  const badDate = input(); badDate.scope.membershipEffectiveOn = "2026-02-30";
  assert.equal(evaluateMrpMembership(badDate).status, "review_required");
  const badTimestamp = input(); badTimestamp.observation.observedAt = "2026-02-30T10:00:00.000Z";
  assert.equal(evaluateMrpMembership(badTimestamp).status, "review_required");
});
test("invalid, incomplete or inconsistent arithmetic cannot be presented as an award", () => {
  for (const bad of [null, {}, { ...calculated, totalMrp: 100 }, { ...calculated, qualifyingMrp: -1 }, { ...calculated, playoffMrp: null }, { ...calculated, totalMrp: Infinity }]) {
    assert.throws(() => projectMrpMembershipAward(input(), bad), TypeError);
  }
});
test("projection returns detached values, never mutates calculations or source", () => {
  const source = input(); const prior = structuredClone(source); const values = { ...calculated };
  const result = projectMrpMembershipAward(source, values);
  result.calculated.totalMrp = 0; result.awarded.totalMrp = 0;
  assert.deepEqual(source, prior); assert.deepEqual(values, calculated);
});
test("UUID case does not create false scope mismatch", () => {
  const source = input("inactive", {});
  source.correction.observationId = source.correction.observationId.toUpperCase();
  source.scope.rosterEntryId = source.scope.rosterEntryId.toUpperCase();
  assert.equal(evaluateMrpMembership(source).status, "eligible");
});
for (const status of ["unknown", "not_found", "unavailable", "active"]) test(`correction does not invent an override policy for ${status} reports`, () => {
  const result = projectMrpMembershipAward(input(status, {}), calculated);
  assert.equal(result.membership.status, "review_required");
  assert.equal(result.awarded, null);
});
test("verified correction of an erroneous nonmember report permits the calculated award", () => {
  assert.deepEqual(projectMrpMembershipAward(input("nonmember", {}), calculated).awarded, calculated);
});
