import test from "node:test";
import assert from "node:assert/strict";
import { classifySkunk, deriveScore, formatScorecardSpread, formatSignedNet, isScoreEntryReady } from "../src/lib/score.ts";
import { getScorecardVerificationStatus } from "../src/lib/games/scorecard-status.ts";
import { nextFullBracketSize, previewQualification, qualificationCount } from "../src/lib/qualification.ts";

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

test("scorecard display preserves ACC leading-zero convention for one-digit game spreads", () => {
  assert.equal(formatScorecardSpread(1), "01");
  assert.equal(formatScorecardSpread(8), "08");
  assert.equal(formatScorecardSpread(10), "10");
  assert.equal(formatScorecardSpread(121), "121");
  for (const spread of [0, 122, 1.5]) assert.throws(() => formatScorecardSpread(spread), RangeError);
});

test("score-entry readiness requires both a valid margin and winner", () => {
  assert.equal(isScoreEntryReady(17, null), false);
  assert.equal(isScoreEntryReady(0, "player"), false);
  assert.equal(isScoreEntryReady(17, "player"), true);
});

test("scorecard verification notices distinguish future games from in-progress results", () => {
  assert.deepEqual(getScorecardVerificationStatus(["pending"]), { tone: "current", message: "Current and Verified", totalMessage: null });
  assert.deepEqual(getScorecardVerificationStatus(["submitted"]), { tone: "pending", message: "Verification Pending Opponent Entry", totalMessage: "Updated Total Calculations Pending Opponent Entry" });
  assert.deepEqual(getScorecardVerificationStatus(["confirmation_pending"]), { tone: "pending", message: "Verification Pending Player Confirmation", totalMessage: "Updated Total Calculations Pending Player Confirmation" });
  assert.deepEqual(getScorecardVerificationStatus(["pending", "mismatch"]), { tone: "mismatch", message: "Result Mismatch Needs Review", totalMessage: "Updated Total Calculations Pending Review" });
});

test("ACC qualification preview ranks game points, wins, net spread, then positive spread", () => {
  const preview = previewQualification([
    { id: "d", displayName: "D", gamePoints: 18, gamesWon: 8, netSpreadPoints: 50, positiveSpreadPoints: 70 },
    { id: "a", displayName: "A", gamePoints: 20, gamesWon: 7, netSpreadPoints: 10, positiveSpreadPoints: 20 },
    { id: "c", displayName: "C", gamePoints: 18, gamesWon: 8, netSpreadPoints: 50, positiveSpreadPoints: 60 },
    { id: "b", displayName: "B", gamePoints: 18, gamesWon: 8, netSpreadPoints: 40, positiveSpreadPoints: 99 },
  ]);
  assert.deepEqual(preview.ranked.map(({ id, numericRank, qualificationStatus }) => ({ id, numericRank, qualificationStatus })), [
    { id: "a", numericRank: 1, qualificationStatus: "qualified" },
    { id: "d", numericRank: 2, qualificationStatus: "not_qualified" },
    { id: "c", numericRank: 3, qualificationStatus: "not_qualified" },
    { id: "b", numericRank: 4, qualificationStatus: "not_qualified" },
  ]);
  assert.equal(preview.finalizable, true);
});

test("ACC qualification and byes round up only the qualifier count, never to the bracket", () => {
  assert.equal(qualificationCount(121), 31);
  assert.equal(nextFullBracketSize(31), 32);
  const entrants = Array.from({ length: 108 }, (_, index) => ({ id: String(index), displayName: `Player ${index}`, gamePoints: 500 - index, gamesWon: 0, netSpreadPoints: 0, positiveSpreadPoints: 0 }));
  const preview = previewQualification(entrants);
  assert.equal(preview.qualifierCount, 27);
  assert.equal(preview.bracketSize, 32);
  assert.equal(preview.firstRoundByes, 5);
});

test("an exact numeric tie is never silently finalized and a cutoff tie is visibly unresolved", () => {
  const preview = previewQualification([
    { id: "a", displayName: "A", gamePoints: 10, gamesWon: 5, netSpreadPoints: 20, positiveSpreadPoints: 30 },
    { id: "b", displayName: "B", gamePoints: 9, gamesWon: 4, netSpreadPoints: 10, positiveSpreadPoints: 20 },
    { id: "c", displayName: "C", gamePoints: 9, gamesWon: 4, netSpreadPoints: 10, positiveSpreadPoints: 20 },
    { id: "d", displayName: "D", gamePoints: 8, gamesWon: 3, netSpreadPoints: 0, positiveSpreadPoints: 0 },
  ]);
  assert.equal(preview.qualifierCount, 1);
  assert.equal(preview.finalizable, false);
  assert.deepEqual(preview.unresolvedTies, [{
    numericRank: 2,
    candidateIds: ["b", "c"],
    affectsQualificationCut: false,
    requiredResolution: "head_to_head_if_available_then_one_game_playoff",
  }]);
  assert.deepEqual(preview.ranked.map(({ id, qualificationStatus }) => ({ id, qualificationStatus })), [
    { id: "a", qualificationStatus: "qualified" },
    { id: "b", qualificationStatus: "not_qualified" },
    { id: "c", qualificationStatus: "not_qualified" },
    { id: "d", qualificationStatus: "not_qualified" },
  ]);
  const cutoffTie = previewQualification([
    { id: "a", displayName: "A", gamePoints: 10, gamesWon: 5, netSpreadPoints: 20, positiveSpreadPoints: 30 },
    { id: "b", displayName: "B", gamePoints: 9, gamesWon: 4, netSpreadPoints: 10, positiveSpreadPoints: 20 },
    { id: "c", displayName: "C", gamePoints: 9, gamesWon: 4, netSpreadPoints: 10, positiveSpreadPoints: 20 },
    { id: "d", displayName: "D", gamePoints: 8, gamesWon: 3, netSpreadPoints: 0, positiveSpreadPoints: 0 },
    { id: "e", displayName: "E", gamePoints: 7, gamesWon: 2, netSpreadPoints: 0, positiveSpreadPoints: 0 },
    { id: "f", displayName: "F", gamePoints: 6, gamesWon: 1, netSpreadPoints: 0, positiveSpreadPoints: 0 },
    { id: "g", displayName: "G", gamePoints: 5, gamesWon: 1, netSpreadPoints: 0, positiveSpreadPoints: 0 },
    { id: "h", displayName: "H", gamePoints: 4, gamesWon: 1, netSpreadPoints: 0, positiveSpreadPoints: 0 },
  ]);
  assert.equal(cutoffTie.qualifierCount, 2);
  assert.equal(cutoffTie.ranked[1].qualificationStatus, "cutoff_tie");
  assert.equal(cutoffTie.ranked[2].qualificationStatus, "cutoff_tie");
  assert.deepEqual(cutoffTie.unresolvedTies, [{
    numericRank: 2,
    candidateIds: ["b", "c"],
    affectsQualificationCut: true,
    requiredResolution: "head_to_head_if_available_then_one_game_playoff",
  }]);
});
