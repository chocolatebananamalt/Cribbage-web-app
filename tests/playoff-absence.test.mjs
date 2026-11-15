import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePlayoffAbsence } from "../src/lib/playoff-absence.ts";

test("Rule 13.1 retains the five-minute playoff grace period", () => {
  assert.deepEqual(evaluatePlayoffAbsence({ minutesLate: 5, gamesInMatch: 3, forfeituresAlreadyRecorded: 0 }), { status: "grace_period", graceMinutesRemaining: 0 });
});

test("Rule 13.1 schedules the first forfeit then an additional game every fifteen minutes", () => {
  assert.deepEqual(evaluatePlayoffAbsence({ minutesLate: 6, gamesInMatch: 3, forfeituresAlreadyRecorded: 0 }), {
    status: "forfeitures_due", totalForfeituresDue: 1, additionalForfeituresDue: 1, matchComplete: false,
    nonappearingQualifierEntitlement: "round_loser_prize_money_and_mrps",
  });
  assert.deepEqual(evaluatePlayoffAbsence({ minutesLate: 20, gamesInMatch: 3, forfeituresAlreadyRecorded: 1 }), {
    status: "forfeitures_due", totalForfeituresDue: 2, additionalForfeituresDue: 1, matchComplete: false,
    nonappearingQualifierEntitlement: "round_loser_prize_money_and_mrps",
  });
});

test("Rule 13.1 never exceeds the match length and preserves the round-loser entitlement", () => {
  assert.deepEqual(evaluatePlayoffAbsence({ minutesLate: 99, gamesInMatch: 3, forfeituresAlreadyRecorded: 3 }), {
    status: "forfeitures_due", totalForfeituresDue: 3, additionalForfeituresDue: 0, matchComplete: true,
    nonappearingQualifierEntitlement: "round_loser_prize_money_and_mrps",
  });
  assert.throws(() => evaluatePlayoffAbsence({ minutesLate: 1, gamesInMatch: 0, forfeituresAlreadyRecorded: 0 }), /positive/);
  assert.throws(() => evaluatePlayoffAbsence({ minutesLate: 1, gamesInMatch: 2, forfeituresAlreadyRecorded: 3 }), /cannot exceed/);
});
