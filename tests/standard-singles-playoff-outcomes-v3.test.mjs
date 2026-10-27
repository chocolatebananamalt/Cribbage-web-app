import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { isPlayoffOutcomeRequest, isPlayoffOutcomeResult, isPlayoffOutcomeWorkspace, isRejectedPlayoffOutcome } from "../src/lib/api/playoff-outcome.ts";

const tournamentId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";
const qualificationResultVersionId = "30000000-0000-4000-8000-000000000001";
const ids = ["50000000-0000-4000-8000-000000000001", "50000000-0000-4000-8000-000000000002", "50000000-0000-4000-8000-000000000003", "50000000-0000-4000-8000-000000000004"];
const series = [
  { winnerId: ids[0], loserId: ids[3], evidenceNote: "Semifinal one reviewed against both cards." },
  { winnerId: ids[1], loserId: ids[2], evidenceNote: "Semifinal two reviewed against both cards." },
  { winnerId: ids[0], loserId: ids[1], evidenceNote: "Final reviewed against both cards." },
];

test("v3 playoff outcome request is exactly three noted series", () => {
  const request = { qualificationResultVersionId, expectedVersion: 0, series, idempotencyKey: tournamentId };
  assert.equal(isPlayoffOutcomeRequest(request), true);
  assert.equal(isPlayoffOutcomeRequest({ ...request, series: series.slice(0, 2) }), false);
  assert.equal(isPlayoffOutcomeRequest({ ...request, series: series.map((match) => ({ ...match, evidenceNote: "x".repeat(201) })) }), false);
  assert.equal(isPlayoffOutcomeRequest({ ...request, prizeOrder: ids }), false);
});

test("workspace and receipts keep v3 outcomes separate from legacy placement and money claims", () => {
  const qualifiers = ids.map((participantId, index) => ({ participantId, displayName: `Player ${index + 1}`, qualificationRank: index + 1, gamePoints: 20 - index }));
  const workspace = { tournamentId, eventId, qualificationResultVersionId, currentVersion: 0, legacyConflict: false, supported: true, supportedFormat: true, canRecord: true, blocker: null, qualifiers, result: null, capabilities: { settlement: false } };
  assert.equal(isPlayoffOutcomeWorkspace(workspace, tournamentId, eventId), true);
  assert.equal(isPlayoffOutcomeWorkspace({ ...workspace, qualifiers: qualifiers.slice(0, 3), supported: false, canRecord: false, blocker: "unsupported_format" }, tournamentId, eventId), true);
  assert.equal(isPlayoffOutcomeWorkspace({ ...workspace, qualifiers: qualifiers.map((item, index) => index === 0 ? { ...item, gamePoints: -1 } : item) }, tournamentId, eventId), false);
  const result = { status: "playoff_outcomes_recorded", tournamentId, eventId, resultId: "60000000-0000-4000-8000-000000000001", version: 1, bracketSourceVersion: "acc-rulebook-2025-effective-2025-08-01", mrpSourceVersion: "acc-published-mrp-2016-08-01", recordedAt: "2026-10-27T04:00:00Z" };
  assert.equal(isPlayoffOutcomeResult(result, tournamentId, eventId), true);
  assert.equal(isPlayoffOutcomeResult({ ...result, prizeOrder: ids }, tournamentId, eventId), false);
  const recorded = { ...workspace, currentVersion: 1, result: { resultId: result.resultId, version: 1, bracketSourceVersion: result.bracketSourceVersion, mrpSourceVersion: result.mrpSourceVersion, series, outcomes: [
    { participantId: ids[0], playedMatchWins: 2, byeWins: 0, eliminatedInRound: null, champion: true, bandStart: 1, bandEnd: 1, qualifyingMrp: 35, playoffMrp: 42, totalMrp: 77 },
    { participantId: ids[1], playedMatchWins: 1, byeWins: 0, eliminatedInRound: 2, champion: false, bandStart: 2, bandEnd: 2, qualifyingMrp: 30, playoffMrp: 21, totalMrp: 51 },
    { participantId: ids[2], playedMatchWins: 0, byeWins: 0, eliminatedInRound: 1, champion: false, bandStart: 3, bandEnd: 4, qualifyingMrp: 5, playoffMrp: 7, totalMrp: 12 },
    { participantId: ids[3], playedMatchWins: 0, byeWins: 0, eliminatedInRound: 1, champion: false, bandStart: 3, bandEnd: 4, qualifyingMrp: 5, playoffMrp: 7, totalMrp: 12 },
  ], recordedAt: result.recordedAt } };
  assert.equal(isPlayoffOutcomeWorkspace(recorded, tournamentId, eventId), true);
  assert.equal(isPlayoffOutcomeWorkspace({ ...recorded, result: { ...recorded.result, outcomes: recorded.result.outcomes.map((row, index) => index === 1 ? { ...row, participantId: ids[0] } : row) } }, tournamentId, eventId), false);
  assert.equal(isRejectedPlayoffOutcome({ status: "rejected", code: "legacy_conflict", eventId }, eventId), true);
  assert.equal(isRejectedPlayoffOutcome({ status: "rejected", code: "invalid_placements", eventId }, eventId), false);
});

test("v3 stays standalone while normal settlement keeps the legacy editor", () => {
  const page = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/playoff-outcomes/page.tsx", "utf8");
  const client = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/playoff-outcomes/playoff-outcome-client.tsx", "utf8");
  const settlement = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/settlement/page.tsx", "utf8");
  const legacyRoute = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/playoff-placements/route.ts", "utf8");
  const storage = fs.readFileSync("src/lib/client-session-storage.ts", "utf8");
  const settlementRoute = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/settlement-draft/route.ts", "utf8");
  const finalizationRoute = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/settlement-finalization/route.ts", "utf8");
  assert.match(client, /Semifinal 1: qualifier 1 vs qualifier 4/);
  assert.match(client, /Final: semifinal winners/);
  assert.match(client, /Retry exact playoff outcome request/);
  assert.match(client, /already recorded\. Change a supervised result or source note/);
  assert.match(client, /malformed or unknown and was retained/);
  assert.match(client, /sessionStorage\.getItem\(key\) !== stored\.raw/);
  assert.match(client, /Another playoff outcome request is already retained/);
  assert.match(page, /key=\{`\$\{workspace\?\.currentVersion/);
  assert.match(client, /playoff-outcome:\$\{actorId\}:\$\{tournamentId\}:\$\{eventId\}/);
  assert.doesNotMatch(client, /prizeOrder|<input[^>]*mrp/i);
  assert.match(client, /Bracket source:/);
  assert.doesNotMatch(settlement, /PlayoffOutcomeClient/);
  assert.match(page, /Playoff outcomes/);
  assert.doesNotMatch(legacyRoute, /legacy_playoff_read_only/);
  assert.match(legacyRoute, /recordPlayoffPlacements\(/);
  assert.match(storage, /"playoff-outcome:"/);
  assert.match(storage, /"playoff-placement:"/);
  assert.match(storage, /"settlement-finalization:"/);
  assert.doesNotMatch(settlementRoute, /legacy_settlement_read_only/);
  assert.doesNotMatch(finalizationRoute, /legacy_settlement_finalization_read_only/);
});

test("legacy placement receipts accept both historical envelope shapes", async () => {
  const placementModule = await import("../src/lib/api/playoff-placement.ts");
  const request = { qualificationResultVersionId, expectedVersion: 0, idempotencyKey: tournamentId, placements: ids.slice(0, 2).map((participantId, index) => ({ participantId, placement: index + 1, mrpPlayoffExitRound: 1 })) };
  assert.deepEqual(placementModule.parsePlayoffPlacementEnvelope({ kind: "playoff-placement", ...request }), request);
  assert.deepEqual(placementModule.parsePlayoffPlacementEnvelope({ kind: "playoff-placement", request }), request);
  assert.equal(placementModule.parsePlayoffPlacementEnvelope({ kind: "playoff-placement", request: { ...request, placements: [] } }), null);
});
