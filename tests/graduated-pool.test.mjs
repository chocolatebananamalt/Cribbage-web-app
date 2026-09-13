import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estimateGraduatedPool } from "../src/lib/finance/graduated-pool.ts";

test("matches the ACC calculator examples observed on 2026-09-11", () => {
  assert.deepEqual(
    estimateGraduatedPool({ playerCount: 20, payoutRatio: 6, entryFeeMinor: 1_000 }).awardsMinor,
    [8_000, 6_000, 4_000, 2_000],
  );
  const twentyFive = estimateGraduatedPool({ playerCount: 25, payoutRatio: 4, entryFeeMinor: 1_000 });
  assert.equal(twentyFive.winnerCount, 7);
  assert.deepEqual(twentyFive.awardsMinor, [6_000, 5_500, 4_500, 3_500, 2_500, 2_000, 1_000]);
  assert.equal(twentyFive.awardTotalMinor, twentyFive.fundMinor);
});

test("reports the portal-documented nearest-five-dollar difference for director adjustment", () => {
  const result = estimateGraduatedPool({ playerCount: 17, payoutRatio: 6, entryFeeMinor: 700 });
  assert.equal(result.winnerCount, 3);
  assert.equal(result.manualAdjustmentRequired, result.awardTotalMinor !== result.fundMinor);
  assert.equal(result.differenceMinor, result.fundMinor - result.awardTotalMinor);
});

test("preserves at least the entry fee when the ordinary graduated base is too small", () => {
  const result = estimateGraduatedPool({ playerCount: 10, payoutRatio: 2, entryFeeMinor: 1_000 });
  assert.deepEqual(result.awardsMinor, [3_000, 2_500, 2_000, 1_500, 1_000]);
  assert.equal(result.awardTotalMinor, 10_000);
  assert.equal(result.differenceMinor, 0);
});

test("rejects impossible inputs without producing an award", () => {
  for (const input of [
    { playerCount: 1, payoutRatio: 2, entryFeeMinor: 1_000 },
    { playerCount: 20, payoutRatio: 1, entryFeeMinor: 1_000 },
    { playerCount: 20, payoutRatio: 21, entryFeeMinor: 1_000 },
    { playerCount: 20, payoutRatio: 6, entryFeeMinor: 0 },
    { playerCount: 20.5, payoutRatio: 6, entryFeeMinor: 1_000 },
  ]) assert.throws(() => estimateGraduatedPool(input), RangeError);
});

test("protected finance workspace exposes the calculator without claiming persistence", () => {
  const page = readFileSync("src/app/tournament/[tournamentId]/payments/page.tsx", "utf8");
  const client = readFileSync("src/app/tournament/[tournamentId]/payments/pool-calculator.tsx", "utf8");
  assert.match(page, /<PoolCalculator \/>/);
  assert.match(client, /nearest-\$5 rounding/);
  assert.match(client, /Review and adjust the suggested amounts/);
  assert.doesNotMatch(client, /saved|official payout|approved payout/i);
});
