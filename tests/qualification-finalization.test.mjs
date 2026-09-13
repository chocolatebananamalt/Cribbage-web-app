import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  isQualificationFinalizationOutcome,
  isQualificationFinalizationRequest,
  isQualificationResult,
  isRejectedQualificationFinalization,
} from "../src/lib/api/qualification-finalization.ts";

const migration = fs.readFileSync("database/migrations/0131_standard_singles_qualification_finalization.sql", "utf8");
const page = fs.readFileSync("src/app/tournament/[tournamentId]/results/page.tsx", "utf8");

const tournamentId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";
const resultVersionId = "30000000-0000-4000-8000-000000000001";
const ids = ["40000000-0000-4000-8000-000000000001", "40000000-0000-4000-8000-000000000002"];

test("qualification finalization accepts only one exact operation identifier", () => {
  assert.equal(isQualificationFinalizationRequest({ idempotencyKey: resultVersionId }), true);
  assert.equal(isQualificationFinalizationRequest({ idempotencyKey: resultVersionId, eventId }), false);
  assert.equal(isQualificationFinalizationRequest({ idempotencyKey: "retry" }), false);
});

test("qualification finalization response validates scope, count, and immutable version", () => {
  const value = { status: "qualification_finalized", tournamentId, eventId, resultVersionId, version: 1, participantCount: 4, qualifierCount: 1, finalizedAt: "2026-09-11T10:00:00Z" };
  assert.equal(isQualificationFinalizationOutcome(value, tournamentId, eventId), true);
  assert.equal(isQualificationFinalizationOutcome({ ...value, qualifierCount: 2 }, tournamentId, eventId), false);
  assert.equal(isQualificationFinalizationOutcome({ ...value, eventId: tournamentId }, tournamentId, eventId), false);
  assert.equal(isRejectedQualificationFinalization({ status: "rejected", code: "cutoff_tied", eventId }, eventId), true);
  assert.equal(isRejectedQualificationFinalization({ status: "rejected", code: "money_missing", eventId }, eventId), false);
});

test("finalized result keeps qualifying rank separate from playoff and money authority", () => {
  const row = (participantId, displayName, qualificationRank) => ({ participantId, displayName, qualificationRank, numericRank: qualificationRank, tied: false, verifiedGames: 1, gamePoints: qualificationRank === 1 ? 3 : 2, gamesWon: 1, plusPoints: qualificationRank === 1 ? 40 : 20, minusPoints: 0, netSpreadPoints: qualificationRank === 1 ? 40 : 20 });
  const value = {
    status: "qualification_finalized", tournamentId, eventId, resultVersionId, version: 1,
    tournamentName: "Synthetic", eventName: "Main", participantCount: 4, qualifierCount: 1,
    finalizedAt: "2026-09-11T10:00:00Z", finalizedBy: "Test Director",
    qualifiers: [row(ids[0], "First Qualifier", 1)],
    highNonQualifier: { participantId: ids[1], displayName: "High Non-Qualifier", numericRank: 2,
      verifiedGames: 1, gamePoints: 2, gamesWon: 1, plusPoints: 20, minusPoints: 0, netSpreadPoints: 20 },
    playoffResultsAvailable: false, financialAwardsCalculated: false, officialAccExportAvailable: false,
  };
  assert.equal(isQualificationResult(value, tournamentId, eventId), true);
  assert.equal(isQualificationResult({ ...value, qualifiers: [{ ...value.qualifiers[0], qualificationRank: 2 }] }, tournamentId, eventId), false);
  assert.equal(isQualificationResult({ ...value, playoffResultsAvailable: true }, tournamentId, eventId), false);
});

test("database writer fails closed on every required operational blocker", () => {
  for (const evidence of [
    /tournament_setup_activations/, /current_effective_scorelines/, /scorecards unresolved/,
    /device recovery pending/, /correction pending/, /qualification notice pending/,
    /ranking tie unresolved/,
  ]) assert.match(migration, evidence);
  assert.match(migration, /game_points desc,games_won desc,\(plus_points-minus_points\) desc,plus_points desc/);
  assert.match(migration, /v_qualifier_count := \(v_participant_count \+ 3\) \/ 4/);
  assert.match(migration, /qualification_freeze_score_submissions/);
  assert.match(migration, /qualification_freeze_corrections/);
  assert.match(migration, /qualification_freeze_canonical_games before insert or update or delete/);
  assert.match(migration, /order by game\.id for update/);
  assert.match(migration, /group by game_points,games_won,\(plus_points-minus_points\),plus_points\s+having count\(\*\) > 1/);
  assert.match(migration, /revoke all on function public\.finalize_standard_singles_qualification_v1[\s\S]*grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to authenticated/);
});

test("finalization browser preserves one retry identity across ambiguous outcomes", () => {
  const client = fs.readFileSync("src/app/tournament/[tournamentId]/results/qualification-finalization-client.tsx", "utf8");
  const route = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/qualification-finalization/route.ts", "utf8");
  assert.match(client, /qualification-finalization:\$\{actorId\}:\$\{eventId\}/);
  assert.match(client, /window\.sessionStorage\.setItem/);
  assert.match(client, /locked \?\? \{ kind: "qualification-finalization" as const, idempotencyKey: crypto\.randomUUID\(\) \}/);
  assert.match(client, /outcome is not yet confirmed/);
  assert.doesNotMatch(client, /Nothing was changed/);
  assert.match(route, /export async function GET/);
  assert.match(route, /getQualificationResult/);
});

test("results UI labels final qualification separately and places HNQ after qualifiers", () => {
  assert.match(page, /Finalized Qualification/);
  assert.ok(page.indexOf("Qualifiers") < page.indexOf("High Non-Qualifier"));
  assert.match(page, /Playoff winner and runner-up are separate results/);
  assert.match(page, /does not calculate playoff placements, MRPs, Q-pools, payouts, or an official ACC export/);
});
