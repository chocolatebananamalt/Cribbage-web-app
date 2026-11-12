import assert from "node:assert/strict";
import test from "node:test";

import { canonicalPlayoffMrpSourceVersion, deriveCanonicalPlayoffMrp } from "../src/lib/results/canonical-playoff-mrp.ts";

const ids = {
  tournament: "b2400000-0000-4000-8000-000000000001",
  event: "e2400000-0000-4000-8000-000000000001",
  result: "f2400000-0000-4000-8000-000000000001",
  qualification: "d2400000-0000-4000-8000-000000000001",
};

function participant(number) {
  return `${number.toString(16).padStart(8, "0")}-0240-4000-8000-${number.toString(16).padStart(12, "0")}`;
}

function qualifiers(count = 4, gamePoints = [24, 24, 22, 22]) {
  return Array.from({ length: count }, (_, index) => ({
    participantId: participant(index + 1),
    displayName: `Fixture Player ${index + 1}`,
    qualificationRank: index + 1,
    gamePoints: gamePoints[index] ?? 22,
  }));
}

function qualification(overrides = {}) {
  return {
    tournamentId: ids.tournament,
    eventId: ids.event,
    resultVersionId: ids.qualification,
    eventType: "main",
    gameCount: 12,
    qualifiers: qualifiers(),
    ...overrides,
  };
}

function scope(overrides = {}) {
  return {
    tournamentId: ids.tournament,
    eventId: ids.event,
    resultId: ids.result,
    qualificationResultVersionId: ids.qualification,
    ...overrides,
  };
}

function v3Input(overrides = {}) {
  const rows = qualifiers();
  return {
    kind: "playoff_outcome_v3",
    resultScope: scope(),
    qualification: qualification({ qualifiers: rows }),
    series: [
      { winnerId: rows[0].participantId, loserId: rows[3].participantId, evidenceNote: "First semifinal" },
      { winnerId: rows[1].participantId, loserId: rows[2].participantId, evidenceNote: "Second semifinal" },
      { winnerId: rows[0].participantId, loserId: rows[1].participantId, evidenceNote: "Final" },
    ],
    ...overrides,
  };
}

function legacyInput(championStoredRound = 2, overrides = {}) {
  const rows = qualifiers();
  return {
    kind: "legacy_placement_v2",
    resultScope: scope(),
    qualification: qualification({ qualifiers: rows }),
    placements: [
      { participantId: rows[0].participantId, placement: 1, mrpPlayoffExitRound: championStoredRound },
      { participantId: rows[1].participantId, placement: 2, mrpPlayoffExitRound: 2 },
      { participantId: rows[2].participantId, placement: 4, mrpPlayoffExitRound: 1 },
      { participantId: rows[3].participantId, placement: 3, mrpPlayoffExitRound: 1 },
    ],
    ...overrides,
  };
}

test("derives the four-player v3 topology, cohorts, and 97/76/12/12 MRP totals", () => {
  const result = deriveCanonicalPlayoffMrp(v3Input());
  assert.equal(result.status, "available");
  assert.equal(result.derivedSourceVersion, canonicalPlayoffMrpSourceVersion);
  assert.equal(result.resultKind, "playoff_outcome_v3");
  assert.deepEqual(result.rows.map((row) => ({
    totalMrp: row.totalMrp,
    roundsWon: row.roundsWon,
    eliminatedInRound: row.eliminatedInRound,
    band: [row.bandStart, row.bandEnd],
  })), [
    { totalMrp: 97, roundsWon: 2, eliminatedInRound: null, band: [1, 1] },
    { totalMrp: 76, roundsWon: 1, eliminatedInRound: 2, band: [2, 2] },
    { totalMrp: 12, roundsWon: 0, eliminatedInRound: 1, band: [3, 4] },
    { totalMrp: 12, roundsWon: 0, eliminatedInRound: 1, band: [3, 4] },
  ]);
  assert.ok(result.rows.every((row) => row.byesWon === 0 && !row.evidenceNote.includes("First semifinal")));
});

test("canonicalizes either historic champion field convention from complete legacy cohorts", () => {
  const actualFinalRound = deriveCanonicalPlayoffMrp(legacyInput(2));
  const oldCreditDepth = deriveCanonicalPlayoffMrp(legacyInput(3));
  assert.equal(actualFinalRound.status, "available");
  assert.equal(oldCreditDepth.status, "available");
  assert.deepEqual(actualFinalRound.rows, oldCreditDepth.rows);
  assert.deepEqual(actualFinalRound.rows.map((row) => [row.totalMrp, row.roundsWon, row.bandStart, row.bandEnd]), [
    [97, 2, 1, 1], [76, 1, 2, 2], [12, 0, 3, 4], [12, 0, 3, 4],
  ]);
  assert.equal(actualFinalRound.rows[2].bandStart, actualFinalRound.rows[3].bandStart, "unique legacy 3/4 order must not become finish order");
});

test("validates a complete larger power-of-two cohort without using recorded placement as its band", () => {
  const rows = qualifiers(8, [24, 24, 22, 22, 20, 20, 18, 18]);
  const result = deriveCanonicalPlayoffMrp(legacyInput(3, {
    qualification: qualification({ qualifiers: rows }),
    placements: [
      { participantId: rows[0].participantId, placement: 1, mrpPlayoffExitRound: 3 },
      { participantId: rows[1].participantId, placement: 8, mrpPlayoffExitRound: 3 },
      { participantId: rows[2].participantId, placement: 2, mrpPlayoffExitRound: 2 },
      { participantId: rows[3].participantId, placement: 7, mrpPlayoffExitRound: 2 },
      ...rows.slice(4).map((row, index) => ({ participantId: row.participantId, placement: index + 3, mrpPlayoffExitRound: 1 })),
    ],
  }));
  assert.equal(result.status, "available");
  assert.deepEqual(result.rows.map((row) => [row.eliminatedInRound, row.bandStart, row.bandEnd]), [
    [null, 1, 1], [3, 2, 2], [2, 3, 4], [2, 3, 4],
    [1, 5, 8], [1, 5, 8], [1, 5, 8], [1, 5, 8],
  ]);
});

test("accepts complete no-bye power-of-two legacy brackets through 256 qualifiers", () => {
  for (const count of [4, 8, 16, 32, 64, 128, 256]) {
    const rows = qualifiers(count, Array(count).fill(24));
    const depth = Math.log2(count);
    const placements = [{ participantId: rows[0].participantId, placement: 1, mrpPlayoffExitRound: depth }];
    let cursor = 1;
    for (let round = depth; round >= 1; round -= 1) {
      for (let index = 0; index < count / 2 ** round; index += 1) {
        placements.push({ participantId: rows[cursor].participantId, placement: cursor + 1, mrpPlayoffExitRound: round });
        cursor += 1;
      }
    }
    const result = deriveCanonicalPlayoffMrp(legacyInput(depth, { qualification: qualification({ qualifiers: rows }), placements }));
    assert.equal(result.status, "available", String(count));
    assert.equal(result.rows.length, count);
    assert.deepEqual([result.rows.at(-1).bandStart, result.rows.at(-1).bandEnd], [count / 2 + 1, count]);
  }
});

test("supports every published Main and Consolation game count through the existing calculator", () => {
  for (const [eventType, gameCounts] of [["main", [12, 14, 16, 18, 20, 21, 22]], ["consolation", [7, 8, 9, 10, 12]]]) {
    for (const gameCount of gameCounts) {
      const points = Array(4).fill(3 * gameCount);
      const result = deriveCanonicalPlayoffMrp(v3Input({ qualification: qualification({ eventType, gameCount, qualifiers: qualifiers(4, points) }) }));
      assert.equal(result.status, "available", `${eventType} ${gameCount}`);
    }
  }
  assert.deepEqual(deriveCanonicalPlayoffMrp(v3Input({ qualification: qualification({ gameCount: 13 }) })), { status: "blocked", code: "unsupported_game_count" });
  assert.deepEqual(deriveCanonicalPlayoffMrp(v3Input({ qualification: qualification({ eventType: "satellite" }) })), { status: "blocked", code: "unsupported_event_type" });
  assert.deepEqual(deriveCanonicalPlayoffMrp(v3Input({ qualification: qualification({ qualifiers: qualifiers(4, [13, 24, 22, 22]) }) })), { status: "blocked", code: "below_published_threshold" });
});

test("fails closed for mismatched scope and malformed exact-series evidence", () => {
  assert.deepEqual(deriveCanonicalPlayoffMrp(v3Input({ resultScope: scope({ eventId: "e2400000-0000-4000-8000-000000000099" }) })), { status: "blocked", code: "result_scope_mismatch" });
  const wrongFinal = v3Input();
  wrongFinal.series[2] = { winnerId: wrongFinal.series[0].winnerId, loserId: wrongFinal.series[0].loserId, evidenceNote: "Wrong finalist" };
  assert.deepEqual(deriveCanonicalPlayoffMrp(wrongFinal), { status: "blocked", code: "mrp_evidence_correction_required" });
  assert.deepEqual(deriveCanonicalPlayoffMrp({ ...v3Input(), clientMrp: 999 }), { status: "blocked", code: "invalid_input" });
  const duplicateRank = qualifiers(); duplicateRank[3] = { ...duplicateRank[3], qualificationRank: 3 };
  assert.deepEqual(deriveCanonicalPlayoffMrp(v3Input({ qualification: qualification({ qualifiers: duplicateRank }) })), { status: "blocked", code: "invalid_input" });
  const duplicateParticipant = qualifiers(); duplicateParticipant[3] = { ...duplicateParticipant[3], participantId: duplicateParticipant[2].participantId };
  assert.deepEqual(deriveCanonicalPlayoffMrp(v3Input({ qualification: qualification({ qualifiers: duplicateParticipant }) })), { status: "blocked", code: "invalid_input" });
});

test("blocks legacy byes, incomplete or contradictory cohorts, and malicious champion depth", () => {
  const seven = qualifiers(7);
  const byeInput = legacyInput(3, { qualification: qualification({ qualifiers: seven }), placements: seven.map((row, index) => ({ participantId: row.participantId, placement: index + 1, mrpPlayoffExitRound: index === 0 ? 3 : 1 })) });
  const byeSnapshot = structuredClone(byeInput);
  for (const row of byeInput.placements) Object.freeze(row);
  Object.freeze(byeInput.placements); Object.freeze(byeInput);
  assert.deepEqual(deriveCanonicalPlayoffMrp(byeInput), { status: "blocked", code: "mrp_evidence_correction_required" });
  assert.deepEqual(byeInput, byeSnapshot, "unsupported bye evidence must remain unchanged");
  assert.deepEqual(deriveCanonicalPlayoffMrp(legacyInput(3, { qualification: qualification({ qualifiers: seven }), placements: seven.map((row, index) => ({ participantId: row.participantId, placement: index + 1, mrpPlayoffExitRound: index === 0 ? 3 : 1 })) })), { status: "blocked", code: "mrp_evidence_correction_required" });
  const incomplete = legacyInput(); incomplete.placements.pop();
  assert.deepEqual(deriveCanonicalPlayoffMrp(incomplete), { status: "blocked", code: "mrp_evidence_correction_required" });
  const wrongCohort = legacyInput(); wrongCohort.placements[1].mrpPlayoffExitRound = 1;
  assert.deepEqual(deriveCanonicalPlayoffMrp(wrongCohort), { status: "blocked", code: "mrp_evidence_correction_required" });
  assert.deepEqual(deriveCanonicalPlayoffMrp(legacyInput(9)), { status: "blocked", code: "mrp_evidence_correction_required" });
  const two = qualifiers(2, [24, 24]);
  assert.deepEqual(deriveCanonicalPlayoffMrp(legacyInput(2, { qualification: qualification({ qualifiers: two }), placements: two.map((row, index) => ({ participantId: row.participantId, placement: index + 1, mrpPlayoffExitRound: 2 })) })), { status: "blocked", code: "mrp_evidence_correction_required" });
});

test("is deterministic on frozen immutable input and returns newly derived objects only", () => {
  const input = v3Input();
  const snapshot = structuredClone(input);
  for (const row of input.qualification.qualifiers) Object.freeze(row);
  for (const series of input.series) Object.freeze(series);
  Object.freeze(input.qualification.qualifiers); Object.freeze(input.series);
  Object.freeze(input.qualification); Object.freeze(input.resultScope); Object.freeze(input);
  const first = deriveCanonicalPlayoffMrp(input);
  const replay = deriveCanonicalPlayoffMrp(input);
  assert.deepEqual(first, replay);
  assert.deepEqual(input, snapshot);
  assert.notEqual(first.resultScope, input.resultScope);
  assert.ok(first.rows.every((row, index) => row !== input.qualification.qualifiers[index]));
});
