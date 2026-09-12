import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  getEventDisputeWorkspace,
  isEventDisputeWorkspace,
  isOpenEventDisputeOutcome,
  isOpenEventDisputeRequest,
  isRejectedEventDispute,
  isResolvedEventDisputeOutcome,
  isResolveEventDisputeRequest,
  openEventDispute,
  resolveEventDispute,
} from "../src/lib/api/event-disputes.ts";
import { isRejectedQualificationFinalization } from "../src/lib/api/qualification-finalization.ts";

const migration = fs.readFileSync("database/migrations/0138_event_dispute_register_and_finalization_guard.sql", "utf8");
const openRoute = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/disputes/route.ts", "utf8");
const resolutionRoute = fs.readFileSync("src/app/api/v1/disputes/[id]/resolution/route.ts", "utf8");
const disputesPage = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/disputes/page.tsx", "utf8");
const disputesClient = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/disputes/dispute-client.tsx", "utf8");
const resultsPage = fs.readFileSync("src/app/tournament/[tournamentId]/results/page.tsx", "utf8");
const tournamentId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";
const gameId = "30000000-0000-4000-8000-000000000001";
const disputeId = "40000000-0000-4000-8000-000000000001";
const operationId = "50000000-0000-4000-8000-000000000001";
const openRequest = { disputeId, gameId, summary: "Player reported a card discrepancy", idempotencyKey: operationId };
const resolveRequest = { resolutionNote: "Both source cards were reviewed; no score change is required.", idempotencyKey: operationId };

test("dispute request contracts are exact, bounded, and control-character safe", () => {
  assert.equal(isOpenEventDisputeRequest(openRequest), true);
  assert.equal(isOpenEventDisputeRequest({ ...openRequest, summary: "" }), false);
  assert.equal(isOpenEventDisputeRequest({ ...openRequest, summary: " leading" }), false);
  assert.equal(isOpenEventDisputeRequest({ ...openRequest, summary: "bad\nline" }), false);
  assert.equal(isOpenEventDisputeRequest({ ...openRequest, extra: true }), false);
  assert.equal(isResolveEventDisputeRequest(resolveRequest), true);
  assert.equal(isResolveEventDisputeRequest({ ...resolveRequest, resolutionNote: "x".repeat(501) }), false);
});

test("dispute success and rejection contracts bind exact operation scope", () => {
  const opened = { status: "open", disputeId, tournamentId, eventId, gameId };
  assert.equal(isOpenEventDisputeOutcome(opened, openRequest, tournamentId, eventId), true);
  assert.equal(isOpenEventDisputeOutcome({ ...opened, gameId: eventId }, openRequest, tournamentId, eventId), false);
  assert.equal(isOpenEventDisputeOutcome({ ...opened, privateNote: "leak" }, openRequest, tournamentId, eventId), false);
  assert.equal(isResolvedEventDisputeOutcome({ status: "resolved", disputeId, eventId, gameId }, disputeId), true);
  assert.equal(isRejectedEventDispute({ status: "rejected", code: "open_dispute_exists", disputeId, eventId, gameId }, disputeId), true);
  assert.equal(isRejectedEventDispute({ status: "rejected", code: "resolver_not_independent", disputeId }, disputeId, true), true);
  assert.equal(isRejectedQualificationFinalization({ status: "rejected", code: "dispute_open", eventId }, eventId), true);
});

test("workspace exposes only bounded open-dispute fields to current officials", async () => {
  const workspace = {
    tournamentId, eventId, actorRole: "cross_checker",
    games: [{ gameId, roundNumber: 1, matchInstance: 1, sideAName: "Synthetic Player",
      sideBName: "Other Player", state: "verified", canOpen: false }],
    openDisputes: [{ disputeId, gameId, matchInstance: 1, summary: openRequest.summary,
      openedAt: "2026-09-11T12:00:00Z", openedBy: "Synthetic Player",
      sideAName: "Synthetic Player", sideBName: "Other Player", canResolve: false }],
  };
  assert.equal(isEventDisputeWorkspace(workspace, tournamentId, eventId), true);
  assert.equal(isEventDisputeWorkspace({ ...workspace, openDisputes: [...workspace.openDisputes, workspace.openDisputes[0]] }, tournamentId, eventId), false);
  assert.equal(isEventDisputeWorkspace({ ...workspace, games: [] }, tournamentId, eventId), false);
  assert.equal(isEventDisputeWorkspace({ ...workspace, actorRole: "player" }, tournamentId, eventId), false);
  const admin = { async rpc() { return { data: workspace, error: null }; } };
  assert.deepEqual(await getEventDisputeWorkspace(admin, operationId, tournamentId, eventId), workspace);
});

test("RPC adapters bind actor, tournament, event, game, dispute, and retry identity", async () => {
  const calls = [];
  const admin = { async rpc(name, args) { calls.push({ name, args }); return { data: null, error: null }; } };
  await openEventDispute(admin, operationId, tournamentId, eventId, openRequest);
  await resolveEventDispute(admin, operationId, disputeId, resolveRequest);
  assert.deepEqual(calls[0], { name: "open_event_dispute_v1", args: {
    p_actor_id: operationId, p_tournament_id: tournamentId, p_event_id: eventId,
    p_game_id: gameId, p_dispute_id: disputeId, p_summary: openRequest.summary,
    p_operation_id: operationId,
  } });
  assert.deepEqual(calls[1], { name: "resolve_event_dispute_v1", args: {
    p_actor_id: operationId, p_dispute_id: disputeId,
    p_resolution_note: resolveRequest.resolutionNote, p_operation_id: operationId,
  } });
});

test("migration is immutable, private, non-self, retry-safe, and guards qualification atomically", () => {
  for (const pattern of [
    /create table app\.event_disputes/,
    /create table app\.event_dispute_state_events/,
    /create table app\.event_dispute_operation_conflicts/,
    /enable row level security/,
    /force row level security/,
    /event_disputes_immutable/,
    /event_dispute_state_events_immutable/,
    /event_dispute_conflicts_immutable/,
    /event dispute resolver not independent/,
    /participant\.id in \(v_game\.side_a_participant_id,v_game\.side_b_participant_id\)/,
    /qualification-finalization:' \|\| p_event_id::text/,
    /qualification_result_open_dispute_guard/,
    /'dispute_open'/,
    /event_dispute_operation_conflicts/,
  ]) assert.match(migration, pattern);
  assert.ok(migration.indexOf("select * into v_existing from app.operation_receipts receipt", migration.indexOf("resolve_event_dispute_v1"))
    < migration.indexOf("event dispute resolver not independent", migration.indexOf("resolve_event_dispute_v1")));
  assert.match(migration, /if not exists \(select 1 from app\.tournament_roles[\s\S]*return jsonb_build_object\('status','rejected','code','not_director'/);
  assert.match(migration, /when 'event dispute resolver unauthorized' then 'dispute_unavailable'/);
  const openWriter = migration.slice(migration.indexOf("create or replace function public.open_event_dispute_v1"), migration.indexOf("create or replace function public.resolve_event_dispute_v1"));
  const resolveWriter = migration.slice(migration.indexOf("create or replace function public.resolve_event_dispute_v1"), migration.indexOf("create or replace function public.get_event_dispute_workspace_v1"));
  for (const writer of [openWriter, resolveWriter]) {
    const handler = writer.slice(writer.indexOf("exception when sqlstate 'P0001'"));
    assert.match(handler, /pg_advisory_xact_lock[\s\S]*select \* into v_existing from app\.operation_receipts/);
    assert.match(handler, /if found then[\s\S]*request_hash <> v_hash[\s\S]*event_dispute_operation_conflicts[\s\S]*return v_existing\.response_payload/);
    assert.doesNotMatch(handler, /and not exists \(select 1 from app\.operation_receipts/);
  }
  assert.match(migration, /revoke all on function app\.finalize_standard_singles_qualification_without_event_dispute_guard_v1[\s\S]*from public, anon, authenticated, service_role/);
  assert.doesNotMatch(migration, /grant execute[^;]+to authenticated/i);
});

test("HTTP routes retain same-origin, verified-subject, bounded-body, server-only boundaries", () => {
  assert.match(openRoute, /export async function GET/);
  assert.match(openRoute, /isSameOriginRequest\(request\)[\s\S]*readSmallJson\(request\)/);
  assert.match(openRoute, /requireVerifiedSubject[\s\S]*createServerOnlyAdminClient/);
  assert.match(resolutionRoute, /isSameOriginRequest\(request\)[\s\S]*readSmallJson\(request\)/);
  assert.match(resolutionRoute, /requireVerifiedSubject[\s\S]*createServerOnlyAdminClient/);
});

test("protected staff UI lists published games, preserves retries, and exposes non-self resolution", () => {
  assert.match(disputesPage, /\["director", "co_director", "cross_checker", "judge"\]\.includes\(access\.role\)/);
  assert.match(disputesPage, /getEventDisputeWorkspace[\s\S]*DisputeClient/);
  assert.match(disputesClient, /workspace\.games\.filter/);
  assert.match(disputesClient, /sessionStorage\.setItem/);
  assert.match(disputesClient, /Retry locked request/);
  assert.match(disputesClient, /const \{ kind: _kind, \.\.\.request \} = envelope;[\s\S]*isResolveEventDisputeRequest\(request\)/);
  assert.match(disputesClient, /async function open[\s\S]*const \{ kind: _kind, \.\.\.request \} = envelope;[\s\S]*isOpenEventDisputeRequest\(request\)/);
  assert.match(disputesClient, /dispute\.canResolve/);
  assert.match(disputesClient, /isResolvedEventDisputeOutcome/);
  assert.match(resultsPage, /Open Event Dispute Register/);
});
