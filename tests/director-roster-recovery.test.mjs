import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rosterPromotionReconciliation, isRejectedRosterPromotion } from "../src/lib/api/roster.ts";
const id = "10000000-0000-4000-8000-000000000001";
test("promotion recovery recognizes exact accepted/rejected receipts and never mistakes null or malformed reads for acceptance", () => {
  const receipt = { status: "roster_entry_created", rosterEntryId: id, sourceClaimId: id, approvalDecisionId: id, profileLinked: false, roleGranted: false, eventEnrolled: false, paymentRecorded: false, checkedIn: false, seatAssigned: false };
  assert.equal(rosterPromotionReconciliation({ result: receipt }, id), "accepted");
  assert.equal(rosterPromotionReconciliation({ result: { status: "rejected", code: "registration_closed", approvalDecisionId: id } }, id), "rejected");
  assert.equal(isRejectedRosterPromotion({ status: "rejected", code: "initial_seating_already_published", approvalDecisionId: id }, id), true);
  for (const value of [null, { result: null }, { error: "operation_unavailable" }, { result: { ...receipt, checkedIn: true } }, { result: { ...receipt, approvalDecisionId: "other" } }]) assert.equal(rosterPromotionReconciliation(value, id), "unresolved");
});
test("roster retries keep the exact envelope, explain recovered rejection, and gate new promotions", () => {
  const client = readFileSync("src/app/tournament/[tournamentId]/roster/roster-client.tsx", "utf8");
  assert.match(client, /response.ok \? rosterPromotionReconciliation/);
  assert.match(client, /Retry exact roster request/);
  assert.match(client, /promote\(locked\)/);
  assert.match(client, /!promotionReady \|\| !!locked \|\| intakeState !== "open"/);
  assert.match(client, /The prior roster request was rejected/);
});
