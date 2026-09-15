import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { isPlayoffPlacementOutcome, isPlayoffPlacementRequest, isPlayoffPlacementWorkspace, isRejectedPlayoffPlacement } from "../src/lib/api/playoff-placement.ts";

const tournamentId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";
const qualificationResultVersionId = "30000000-0000-4000-8000-000000000001";
const playoffResultVersionId = "40000000-0000-4000-8000-000000000001";
const participants = ["50000000-0000-4000-8000-000000000001", "50000000-0000-4000-8000-000000000002", "50000000-0000-4000-8000-000000000003"];

test("playoff placement request requires unique sequential qualifiers beginning with winner and runner-up", () => {
  const request = { qualificationResultVersionId, expectedVersion: 0, idempotencyKey: tournamentId,
    placements: participants.slice(0, 2).map((participantId, index) => ({ participantId, placement: index + 1, mrpPlayoffExitRound: 1 })) };
  assert.equal(isPlayoffPlacementRequest(request), true);
  assert.equal(isPlayoffPlacementRequest({ ...request, placements: request.placements.slice(0, 1) }), false);
  assert.equal(isPlayoffPlacementRequest({ ...request, placements: [{ ...request.placements[0], placement: 2 }, request.placements[1]] }), false);
  assert.equal(isPlayoffPlacementRequest({ ...request, placements: [request.placements[0], { ...request.placements[1], participantId: participants[0] }] }), false);
  assert.equal(isPlayoffPlacementRequest({ ...request, payout: 100 }), false);
});

test("playoff result and workspace preserve a separate authority boundary", () => {
  const outcome = { status: "playoff_placements_recorded", tournamentId, eventId, qualificationResultVersionId,
    playoffResultVersionId, version: 1, supersedesPlayoffResultVersionId: null, placementCount: 2, recordedAt: "2026-09-11T04:00:00Z" };
  assert.equal(isPlayoffPlacementOutcome(outcome, tournamentId, eventId), true);
  assert.equal(isPlayoffPlacementOutcome({ ...outcome, mrp: 7 }, tournamentId, eventId), false);
  const choices = participants.map((participantId, index) => ({ participantId, displayName: `Player ${index + 1}`, qualificationRank: index + 1 }));
  const workspace = { tournamentId, eventId, qualificationResultVersionId, currentVersion: 1, qualifierChoices: choices,
    playoffResult: { playoffResultVersionId, version: 1, recordedAt: outcome.recordedAt, recordedBy: "Director",
      placements: choices.slice(0, 2).map((choice, index) => ({ participantId: choice.participantId, displayName: choice.displayName, placement: index + 1, mrpPlayoffExitRound: 1 })) },
    capabilities: { mrpCalculation: true, qPoolCalculation: false, payoutCalculation: false, publication: false } };
  assert.equal(isPlayoffPlacementWorkspace(workspace, tournamentId, eventId), true);
  assert.equal(isPlayoffPlacementWorkspace({ ...workspace, capabilities: { ...workspace.capabilities, publication: true } }, tournamentId, eventId), false);
  assert.equal(isRejectedPlayoffPlacement({ status: "rejected", code: "invalid_placements", eventId }, eventId), true);
  assert.equal(isRejectedPlayoffPlacement({ status: "rejected", code: "calculate_mrp", eventId }, eventId), false);
});

test("migration is immutable, role scoped, idempotent, and binds later settlement drafts", () => {
  const sql = fs.readFileSync("database/migrations/0139_standard_singles_playoff_placements.sql", "utf8");
  const fixture = fs.readFileSync("tests/standard-singles-playoff-placements.sql", "utf8");
  for (const fragment of [
    "playoff_result_versions_immutable", "playoff_placement_rows_immutable", "expected_version",
    "idempotency_conflict", "director','co_director", "qualification_status='qualified'",
    "standard_singles_settlement_playoff_bindings", "playoff_result_version_id",
    "placement does not match playoff result", "get_standard_singles_settlement_workspace_v2",
    "standard_singles_playoff_placements_recorded", "standard_singles_playoff_placements_rejected",
  ]) assert.match(sql, new RegExp(fragment, "i"));
  assert.match(sql, /insert into app\.audit_events[\s\S]*v_receipt_id[\s\S]*standard_singles_playoff_placements_recorded/i);
  assert.match(sql, /returning id into v_receipt_id[\s\S]*insert into app\.audit_events[\s\S]*standard_singles_playoff_placements_rejected/i);
  const placementWriter = sql.slice(sql.indexOf("create or replace function public.record_standard_singles_playoff_placements_v1"), sql.indexOf("create or replace function public.get_standard_singles_playoff_placement_workspace_v1"));
  const settlementWriter = sql.slice(sql.indexOf("create or replace function public.save_standard_singles_settlement_draft_v2"), sql.indexOf("create or replace function public.get_standard_singles_settlement_workspace_v2"));
  for (const writer of [placementWriter, settlementWriter]) {
    assert.ok(writer.indexOf("from app.tournament_roles") < writer.indexOf("select * into v_existing from app.operation_receipts"));
    assert.match(writer, /exception when others[\s\S]*pg_advisory_xact_lock[\s\S]*from app\.tournament_roles[\s\S]*select \* into v_existing from app\.operation_receipts/i);
    assert.match(writer, /standard-singles-post-event:/);
  }
  assert.match(sql, /revoke all on function public\.record_standard_singles_playoff_placements_v1[\s\S]*grant execute[\s\S]*to service_role/i);
  assert.doesNotMatch(sql, /grant execute[^;]+to authenticated/i);
  assert.match(fixture, /select set_config\('request\.jwt\.claim\.role','service_role',true\);[\s\S]*rollback;/i);
  assert.doesNotMatch(fixture, /set local role service_role/i);
});

test("director UI visibly separates playoff finish from qualifying rank and withheld money rules", () => {
  const page = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/settlement/page.tsx", "utf8");
  const client = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/settlement/playoff-placement-client.tsx", "utf8");
  const settlement = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/settlement/settlement-client.tsx", "utf8");
  const route = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/playoff-placements/route.ts", "utf8");
  const reconciliation = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/playoff-placements/reconciliation/route.ts", "utf8");
  assert.match(page, /director.*co_director/);
  assert.match(client, /Supervised playoff placements/);
  assert.match(client, /Qualifying-round rank remains unchanged/);
  assert.match(client, /ACC published MRP schedule effective August 1, 2016/);
  assert.match(client, /MRP playoff exit round/);
  assert.match(client, /playoff-placement:\$\{actorId\}:\$\{eventId\}/);
  assert.match(client, /reconciliation/);
  assert.match(client, /const request = requestFromEnvelope\(envelope\);[\s\S]*isPlayoffPlacementRequest\(request\)/);
  assert.match(client, /body: JSON\.stringify\(request\)/);
  assert.doesNotMatch(client, /isPlayoffPlacementRequest\(candidate\)/);
  assert.match(settlement, /playoffResultVersionId/);
  assert.match(settlement, /Record the supervised playoff winner and runner-up/);
  assert.match(settlement, /const request = requestFromEnvelope\(envelope\);[\s\S]*isSettlementDraftRequest\(request\)/);
  assert.match(settlement, /body: JSON\.stringify\(request\)/);
  assert.doesNotMatch(settlement, /isSettlementDraftRequest\(candidate\)/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(reconciliation, /get_standard_singles_playoff_placement_reconciliation_v1/);
  assert.match(reconciliation, /isRejectedPlayoffPlacement/);
});
