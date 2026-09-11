import assert from "node:assert/strict";
import test from "node:test";

import { isPreliminaryEventStandings } from "../src/lib/results/preliminary-standings-contract.ts";

const participantIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
];

function row(index, values) {
  return {
    participantId: participantIds[index],
    displayName: `Player ${index + 1}`,
    participantStatus: "checked_in",
    verifiedGames: 0,
    gamePoints: 0,
    gamesWon: 0,
    plusPoints: 0,
    minusPoints: 0,
    netSpreadPoints: 0,
    numericRank: 1,
    tied: false,
    ...values,
  };
}

function validStandings() {
  return {
    tournamentId: "20000000-0000-4000-8000-000000000001",
    eventId: "30000000-0000-4000-8000-000000000001",
    tournamentName: "Synthetic tournament",
    eventName: "Main",
    status: "preliminary",
    rows: [
      row(0, { verifiedGames: 2, gamePoints: 4, gamesWon: 2, plusPoints: 29, netSpreadPoints: 29, numericRank: 1 }),
      row(1, { numericRank: 2, tied: true }),
      row(2, { numericRank: 2, tied: true }),
      row(3, { verifiedGames: 2, minusPoints: 30, netSpreadPoints: -30, numericRank: 4 }),
    ],
  };
}

test("preliminary standings validator accepts exact corrected totals and competition ties", () => {
  assert.equal(isPreliminaryEventStandings(validStandings()), true);
});

test("preliminary standings validator rejects extra fields and inconsistent arithmetic", () => {
  const extra = structuredClone(validStandings());
  extra.rows[0].official = true;
  assert.equal(isPreliminaryEventStandings(extra), false);

  const badNet = structuredClone(validStandings());
  badNet.rows[0].netSpreadPoints = 30;
  assert.equal(isPreliminaryEventStandings(badNet), false);

  const impossiblePoints = structuredClone(validStandings());
  impossiblePoints.rows[0].gamePoints = 7;
  assert.equal(isPreliminaryEventStandings(impossiblePoints), false);
});

test("preliminary standings validator rejects false order, rank, tie, and duplicate identity", () => {
  const outOfOrder = structuredClone(validStandings());
  [outOfOrder.rows[0], outOfOrder.rows[1]] = [outOfOrder.rows[1], outOfOrder.rows[0]];
  assert.equal(isPreliminaryEventStandings(outOfOrder), false);

  const falseRank = structuredClone(validStandings());
  falseRank.rows[3].numericRank = 3;
  assert.equal(isPreliminaryEventStandings(falseRank), false);

  const falseTie = structuredClone(validStandings());
  falseTie.rows[1].tied = false;
  assert.equal(isPreliminaryEventStandings(falseTie), false);

  const duplicate = structuredClone(validStandings());
  duplicate.rows[1].participantId = duplicate.rows[0].participantId;
  assert.equal(isPreliminaryEventStandings(duplicate), false);
});
