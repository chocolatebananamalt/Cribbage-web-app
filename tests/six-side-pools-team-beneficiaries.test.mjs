import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSidePoolMutation } from "../src/lib/api/side-pools.ts";
const sql = readFileSync("database/migrations/0176_side_pool_team_beneficiaries.sql", "utf8") + readFileSync("database/migrations/0177_side_pool_team_integrity_repairs.sql", "utf8");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("team Side Pool beneficiaries and independent payout review are server boundaries", () => {
  for (const token of ["event_side_pool_team_election_versions", "event_side_pool_team_payout_versions", "set_event_side_pool_team_election_v1", "set_event_side_pool_team_payout_v1", "event_side_pool_payout_review_versions", "event_side_pool_payout_reviews_immutable", "side_pool_payout_review_required", "self_review_forbidden", "side_pool_combined_unreconciled", "side_pool_finalized", "winner_not_elected", "placement_exists"]) assert.match(sql, new RegExp(token));
  assert.equal(isSidePoolMutation({ action: "set_team_election", eventId: id(1), poolId: id(2), teamEntryId: id(3), electionId: id(4), elected: true, amountReceivedMinor: 2000, paymentMethod: "cash", paymentReference: "", reason: "team election", idempotencyKey: id(5) }), true);
  assert.equal(isSidePoolMutation({ action: "set_team_payout", eventId: id(1), poolId: id(2), teamEntryId: id(3), payoutId: id(4), placement: 1, amountMinor: 2000, voided: false, reason: "team payout", idempotencyKey: id(5) }), true);
  assert.equal(isSidePoolMutation({ action: "review_payout", eventId: id(1), payoutId: id(4), beneficiaryKind: "team_entry", approved: true, evidenceReference: "independent card", idempotencyKey: id(5) }), true);
});
