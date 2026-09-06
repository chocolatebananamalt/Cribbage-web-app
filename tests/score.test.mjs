import test from "node:test";
import assert from "node:assert/strict";
import { classifySkunk, deriveScore, formatSignedNet, isScoreEntryReady } from "../src/lib/score.ts";

test("score boundaries classify informal skunk bands and derive game points", () => {
  const cases = [
    [1, 0, 2],
    [30, 0, 2],
    [31, 1, 3],
    [60, 1, 3],
    [61, 2, 3],
    [90, 2, 3],
    [91, 3, 3],
    [121, 3, 3],
  ];
  for (const [margin, skunk, points] of cases) {
    assert.equal(classifySkunk(margin), skunk);
    const result = deriveScore(margin, "player");
    assert.equal(result.playerGamePoints, points);
    assert.equal(result.playerPlus, margin);
    assert.equal(result.opponentMinus, margin);
  }
});

test("score rejects values outside 1 through 121", () => {
  for (const margin of [0, 122, 1.5, Number.NaN]) {
    assert.throws(() => deriveScore(margin, "player"), RangeError);
  }
});

test("score rejects a missing or invalid winner", () => {
  for (const winner of [undefined, null, "spectator"]) {
    assert.throws(() => deriveScore(10, winner), TypeError);
  }
});

test("losing player receives reciprocal plus/minus values", () => {
  assert.deepEqual(deriveScore(17, "opponent"), {
    margin: 17,
    winner: "opponent",
    playerPlus: 0,
    playerMinus: 17,
    opponentPlus: 17,
    opponentMinus: 0,
    playerGamePoints: 0,
    opponentGamePoints: 2,
    skunkLevel: 0,
  });
});

test("opponent winner receives three game points for a skunk", () => {
  assert.deepEqual(deriveScore(31, "opponent"), {
    margin: 31,
    winner: "opponent",
    playerPlus: 0,
    playerMinus: 31,
    opponentPlus: 31,
    opponentMinus: 0,
    playerGamePoints: 0,
    opponentGamePoints: 3,
    skunkLevel: 1,
  });
});

test("signed net formatter handles positive, zero, and negative totals", () => {
  assert.equal(formatSignedNet(38), "+38");
  assert.equal(formatSignedNet(0), "0");
  assert.equal(formatSignedNet(-12), "-12");
});

test("score-entry readiness requires both a valid margin and winner", () => {
  assert.equal(isScoreEntryReady(17, null), false);
  assert.equal(isScoreEntryReady(0, "player"), false);
  assert.equal(isScoreEntryReady(17, "player"), true);
});
