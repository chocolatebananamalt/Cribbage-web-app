import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLateLunchAbsence } from "../src/lib/late-lunch-absence.ts";

test("Rule 11.4 retains the five-minute post-lunch grace period", () => {
  assert.deepEqual(evaluateLateLunchAbsence({ minutesLate: 0, postLunchGameNumber: 1, previouslyAwardedRule114Forfeit: false }), { status: "grace_period", graceMinutesRemaining: 5 });
  assert.deepEqual(evaluateLateLunchAbsence({ minutesLate: 5, postLunchGameNumber: 1, previouslyAwardedRule114Forfeit: false }), { status: "grace_period", graceMinutesRemaining: 0 });
});

test("Rule 11.4 gives the first post-lunch forfeit exactly 2/+10 and 0/-10, then resumes rotation", () => {
  assert.deepEqual(evaluateLateLunchAbsence({ minutesLate: 6, postLunchGameNumber: 1, previouslyAwardedRule114Forfeit: false }), {
    status: "award_first_post_lunch_game",
    winner: { gamePoints: 2, spreadPoints: 10 },
    latePlayer: { gamePoints: 0, spreadPoints: -10 },
    latePlayerResumesWith: "next_opponent_in_rotation",
  });
});

test("Rule 11.4 does not invent a second award or a disqualification decision", () => {
  assert.deepEqual(evaluateLateLunchAbsence({ minutesLate: 6, postLunchGameNumber: 1, previouslyAwardedRule114Forfeit: true }), { status: "director_review_required", reason: "only_one_2_plus_10_award" });
  assert.deepEqual(evaluateLateLunchAbsence({ minutesLate: 6, postLunchGameNumber: 2, previouslyAwardedRule114Forfeit: false }), { status: "director_review_required", reason: "second_post_lunch_game_or_later" });
  assert.throws(() => evaluateLateLunchAbsence({ minutesLate: -1, postLunchGameNumber: 1, previouslyAwardedRule114Forfeit: false }), /non-negative/);
  assert.throws(() => evaluateLateLunchAbsence({ minutesLate: 1, postLunchGameNumber: 0, previouslyAwardedRule114Forfeit: false }), /positive/);
});
