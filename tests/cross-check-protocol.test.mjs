import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCrossCheckAssignment, evaluateJudgeHearing, requiredCrossCheckers } from "../src/lib/cross-check-protocol.ts";

test("Appendix A requires two cross checkers through 24 players and three above 24", () => {
  assert.equal(requiredCrossCheckers(1), 2);
  assert.equal(requiredCrossCheckers(24), 2);
  assert.equal(requiredCrossCheckers(25), 3);
  assert.throws(() => requiredCrossCheckers(0), /at least one/);
});

test("cross-check assignment requires distinct officials and a third checker for a qualifying relationship conflict", () => {
  assert.deepEqual(evaluateCrossCheckAssignment({ tablePlayerCount: 24, checkerProfileIds: ["one", "two"], qualifyingRelationshipConflict: false }), { accepted: true, requiredCount: 2 });
  assert.deepEqual(evaluateCrossCheckAssignment({ tablePlayerCount: 25, checkerProfileIds: ["one", "two"], qualifyingRelationshipConflict: false }), { accepted: false, requiredCount: 3, code: "insufficient_officials" });
  assert.deepEqual(evaluateCrossCheckAssignment({ tablePlayerCount: 12, checkerProfileIds: ["one", "two"], qualifyingRelationshipConflict: true }), { accepted: false, requiredCount: 3, code: "relationship_review_requires_third" });
  assert.deepEqual(evaluateCrossCheckAssignment({ tablePlayerCount: 12, checkerProfileIds: ["one", "two", "three"], qualifyingRelationshipConflict: true }), { accepted: true, requiredCount: 3 });
  assert.deepEqual(evaluateCrossCheckAssignment({ tablePlayerCount: 12, checkerProfileIds: ["one", "one", "two"], qualifyingRelationshipConflict: false }), { accepted: false, requiredCount: 2, code: "duplicate_official" });
});

test("judge hearing cannot start with fewer than two or include a disputing player, and a disagreement needs three", () => {
  assert.deepEqual(evaluateJudgeHearing({ judgeProfileIds: ["judge-one"], disputingPlayerProfileIds: ["player-a", "player-b"], disagreementAfterInitialDecision: false }), { accepted: false, requiredCount: 2, code: "insufficient_officials" });
  assert.deepEqual(evaluateJudgeHearing({ judgeProfileIds: ["judge-one", "player-a"], disputingPlayerProfileIds: ["player-a", "player-b"], disagreementAfterInitialDecision: false }), { accepted: false, requiredCount: 2, code: "self_dispute" });
  assert.deepEqual(evaluateJudgeHearing({ judgeProfileIds: ["judge-one", "judge-two"], disputingPlayerProfileIds: ["player-a", "player-b"], disagreementAfterInitialDecision: true }), { accepted: false, requiredCount: 3, code: "insufficient_officials" });
  assert.deepEqual(evaluateJudgeHearing({ judgeProfileIds: ["judge-one", "judge-two", "judge-three"], disputingPlayerProfileIds: ["player-a", "player-b"], disagreementAfterInitialDecision: true }), { accepted: true, requiredCount: 3 });
});
