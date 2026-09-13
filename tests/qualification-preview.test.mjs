import assert from "node:assert/strict";
import test from "node:test";

import { buildPreliminaryQualification } from "../src/lib/results/qualification-preview.ts";

const id = (number) => `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const row = (number, gamePoints, gamesWon, netSpreadPoints, plusPoints) => ({
  participantId: id(number),
  displayName: `Player ${number}`,
  participantStatus: "checked_in",
  verifiedGames: 4,
  gamePoints,
  gamesWon,
  plusPoints,
  minusPoints: plusPoints - netSpreadPoints,
  netSpreadPoints,
  numericRank: number,
  tied: false,
});

test("qualification display identifies provisional qualifiers and one High Non-Qualifier", () => {
  const result = buildPreliminaryQualification([
    row(1, 9, 4, 40, 50), row(2, 8, 4, 30, 45), row(3, 7, 3, 20, 40), row(4, 6, 3, 10, 35),
    row(5, 5, 2, 0, 30), row(6, 4, 2, -10, 25), row(7, 3, 1, -20, 20), row(8, 2, 1, -30, 15),
  ]);
  assert.equal(result.preview.qualifierCount, 2);
  assert.deepEqual(result.provisionalQualifiers.map((candidate) => candidate.id), [id(1), id(2)]);
  assert.equal(result.highNonQualifier.id, id(3));
  assert.equal(result.cutoffTie, null);
});

test("qualification display never manufactures a cutoff result or tied High Non-Qualifier", () => {
  const cutoff = buildPreliminaryQualification([
    row(1, 8, 4, 30, 40), row(2, 8, 4, 30, 40), row(3, 6, 3, 10, 30), row(4, 2, 1, -20, 10),
  ]);
  assert.ok(cutoff.cutoffTie);
  assert.equal(cutoff.highNonQualifier, null);
  assert.equal(cutoff.provisionalQualifiers.length, 0);

  const highTie = buildPreliminaryQualification([
    row(1, 9, 4, 40, 50), row(2, 8, 4, 30, 40), row(3, 6, 3, 10, 30), row(4, 6, 3, 10, 30),
    row(5, 1, 1, -30, 5), row(6, 0, 0, -40, 0), row(7, 0, 0, -50, 0), row(8, 0, 0, -60, 0),
  ]);
  assert.equal(highTie.cutoffTie, null);
  assert.ok(highTie.highNonQualifierTie);
  assert.equal(highTie.highNonQualifier, null);
});

test("qualification display has a deliberate empty state", () => {
  assert.equal(buildPreliminaryQualification([]), null);
});
