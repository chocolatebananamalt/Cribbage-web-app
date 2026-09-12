import assert from "node:assert/strict";
import test from "node:test";

import { calculateStandardSinglesMrpReference, standardSinglesMrpReferenceVersion } from "../src/lib/results/standard-singles-mrp-reference.ts";

function calculate(overrides = {}) {
  return calculateStandardSinglesMrpReference({ eventType: "main", gameCount: 12, qualifierCount: 8, qualificationRank: 1, gamePoints: 20, playoffExitRound: 4, ...overrides });
}

test("matches the published Standard Main and Consolation qualifying schedules", () => {
  assert.deepEqual(calculate(), { status: "reference_only", sourceVersion: standardSinglesMrpReferenceVersion, currentEffectiveApproved: false, qualifyingMrp: 35, playoffMrp: 70, totalMrp: 105 });
  assert.deepEqual(calculate({ eventType: "consolation", gameCount: 9, qualificationRank: 2, gamePoints: 17 }), { status: "reference_only", sourceVersion: standardSinglesMrpReferenceVersion, currentEffectiveApproved: false, qualifyingMrp: 18, playoffMrp: 40, totalMrp: 58 });
  assert.equal(calculate({ qualificationRank: 8, gamePoints: 0, playoffExitRound: 1 }).qualifyingMrp, 5);
  assert.equal(calculate({ eventType: "consolation", gameCount: 7, qualificationRank: 8, gamePoints: 0, playoffExitRound: 1 }).qualifyingMrp, 3);
  assert.equal(calculate({ gameCount: 22, qualifierCount: 15, qualificationRank: 8, gamePoints: 30 }).qualifyingMrp, 20);
  assert.equal(calculate({ gameCount: 22, qualifierCount: 15, qualificationRank: 9, gamePoints: 0 }).qualifyingMrp, 5);
});

test("keeps incomplete playoff results incomplete instead of inventing a round", () => {
  assert.deepEqual(calculate({ playoffExitRound: null }), { status: "reference_only", sourceVersion: standardSinglesMrpReferenceVersion, currentEffectiveApproved: false, qualifyingMrp: 35, playoffMrp: null, totalMrp: null });
});

test("fails closed where the published schedule does not resolve the input", () => {
  assert.equal(calculate({ eventType: "main", gameCount: 9 }).code, "unsupported_game_count");
  assert.equal(calculate({ eventType: "satellite" }).code, "unsupported_event_type");
  assert.equal(calculate({ gamePoints: 13 }).code, "below_published_threshold");
  assert.equal(calculate({ playoffExitRound: 0 }).code, "invalid_playoff_round");
  assert.equal(calculate({ gamePoints: 37 }).code, "invalid_game_points");
  assert.equal(calculate({ qualificationRank: 9 }).code, "invalid_qualifier_position");
});
