import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isRejectedSetupActivation,
  isSetupActivationRequest,
  isSetupActivationResult,
} from "../src/lib/api/setup-activation.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const revisionId = "10000000-0000-4000-8000-000000000001";
const operationId = "20000000-0000-4000-8000-000000000002";
const request = { setupRevisionId: revisionId, expectedVersion: 3, idempotencyKey: operationId };

test("setup activation is a released October operation without a deployment toggle", () => {
  assert.doesNotMatch(read("src/lib/api/setup-activation.ts"), /ACC_TOURNAMENT_SETUP_ACTIVATION_ENABLED|tournamentSetupActivationEnabled/);
  assert.doesNotMatch(read(".env.example"), /^ACC_TOURNAMENT_SETUP_ACTIVATION_ENABLED=/m);
});

test("setup activation accepts only a revision-bound exact request", () => {
  assert.equal(isSetupActivationRequest(request), true);
  assert.equal(isSetupActivationRequest({ ...request, expectedVersion: 0 }), false);
  assert.equal(isSetupActivationRequest({ ...request, setupRevisionId: "not-a-uuid" }), false);
  assert.equal(isSetupActivationRequest({ ...request, eventId: revisionId }), false);
  assert.equal(isSetupActivationRequest({ ...request, format: "team" }), false);
});

test("setup activation validates the exact server-derived result and safe exclusions", () => {
  const result = {
    status: "tournament_setup_activated",
    setupRevisionId: revisionId,
    setupVersion: 3,
    eventCount: 2,
    events: [{
      activationId: "30000000-0000-4000-8000-000000000003",
      setupEventVersionId: "40000000-0000-4000-8000-000000000004",
      rulesetVersionId: "50000000-0000-4000-8000-000000000005",
      eventId: "60000000-0000-4000-8000-000000000006",
      eventType: "main",
      name: "Main Event",
      format: "standard_singles",
      scoringMethod: "digital",
      gameCount: 22,
    }, {
      activationId: "70000000-0000-4000-8000-000000000007",
      setupEventVersionId: "80000000-0000-4000-8000-000000000008",
      rulesetVersionId: "90000000-0000-4000-8000-000000000009",
      eventId: "a0000000-0000-4000-8000-00000000000a",
      eventType: "satellite",
      name: "Canadian Doubles",
      format: "canadian_doubles",
      scoringMethod: "manual",
      gameCount: 7,
    }],
    roundsCreated: false,
    participantsEnrolled: false,
    seatingUpdated: false,
    financeUpdated: false,
    resultsUpdated: false,
    payoutsCalculated: false,
    qualifiersCalculated: false,
    accSubmissionCreated: false,
  };
  assert.equal(isSetupActivationResult(result, request), true);
  assert.equal(isSetupActivationResult({ ...result, setupRevisionId: operationId }, request), false);
  assert.equal(isSetupActivationResult({ ...result, payoutsCalculated: true }, request), false);
  assert.equal(isSetupActivationResult({ ...result, eventCount: 1 }, request), false);
  assert.equal(isSetupActivationResult({ ...result, events: [{ ...result.events[0], scoringMethod: "manual" }, result.events[1]] }, request), false);
  assert.equal(isSetupActivationResult({ ...result, extra: false }, request), false);
});

test("setup activation exposes only known controlled rejections", () => {
  assert.equal(isRejectedSetupActivation({ status: "rejected", code: "unsupported_setup" }), true);
  assert.equal(isRejectedSetupActivation({ status: "rejected", code: "made_up" }), false);
  assert.equal(isRejectedSetupActivation({ status: "rejected", code: "not_director", detail: "private" }), false);
});

test("activation migration is private, atomic, source-bound, and deliberately narrow", () => {
  const sql = read("database/migrations/0108_standard_singles_setup_activation.sql");
  for (const table of ["tournament_setup_activations", "tournament_setup_activation_conflicts"]) {
    assert.match(sql, new RegExp(`create table app\\.${table}`));
    assert.match(sql, new RegExp(`alter table app\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`alter table app\\.${table} force row level security`));
    assert.match(sql, new RegExp(`revoke all on table app\\.${table} from public, anon, authenticated`));
    assert.match(sql, new RegExp(`${table}_immutable`));
  }
  assert.match(sql, /create or replace function public\.activate_standard_singles_setup_v1/);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /p_actor_id uuid/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /from app\.tournaments\s+where id = p_tournament_id for update/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /v_setup_revision\.version <> p_expected_version or v_current_version <> p_expected_version/);
  assert.match(sql, /v_setup_event_count <> 1/);
  assert.match(sql, /v_setup_event\.format_code <> 'standard_singles'/);
  assert.match(sql, /o\.role = 'director'[\s\S]*o\.profile_id = v_tournament\.director_profile_id[\s\S]*v_current_official_count <> 1/);
  assert.match(sql, /ACC Official Tournament Rules 2025/);
  assert.match(sql, /scope=standard_singles_scoring_core_only/);
  assert.match(sql, /insert into app\.ruleset_versions/);
  assert.match(sql, /insert into app\.events/);
  assert.match(sql, /insert into app\.tournament_setup_activations/);
  assert.match(sql, /update app\.tournaments\s+set name = v_setup_revision\.tournament_name, status = 'open'/);
  assert.match(sql, /insert into app\.operation_receipts/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /insert into app\.tournament_setup_activation_conflicts/);
  assert.match(sql, /return v_existing\.response_payload/);
  assert.match(sql, /from public, anon, authenticated;\s+grant execute[\s\S]*to service_role;/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/);
  assert.doesNotMatch(sql, /insert into app\.(rounds|event_participants|canonical_games|score_submissions|score_confirmations|roster_payment_events)/);
  assert.doesNotMatch(sql, /update app\.(tournament_setup_revisions|tournament_setup_event_versions)/);
});

test("activation route is released, same-origin, subject-bound, and server-only", () => {
  const route = read("src/app/api/v1/tournaments/[id]/setup/activation/route.ts");
  assert.doesNotMatch(route, /tournamentSetupActivationEnabled|ACC_TOURNAMENT_SETUP_ACTIVATION_ENABLED/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /readSmallJson/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(route, /activate_tournament_setup_v2/);
  assert.match(route, /get_tournament_setup_activation_state_v3/);
  assert.match(route, /p_actor_id: subject/);
  assert.match(route, /p_setup_revision_id: body\.setupRevisionId/);
  assert.match(route, /p_expected_version: body\.expectedVersion/);
  assert.match(route, /p_idempotency_key: body\.idempotencyKey/);
  assert.match(route, /isSetupActivationResult/);
  assert.match(route, /isRejectedSetupActivation/);
  assert.match(route, /\["tournament_unavailable", "not_director"\][\s\S]*error: "not_found"[\s\S]*status: 404/);
  assert.match(route, /withApiFailureBoundary/);
  assert.doesNotMatch(route, /\.from\(|\.insert\(|\.update\(/);
});

test("multi-event activation is atomic, same-tournament, format-safe, and server-only", () => {
  const sql = read("database/migrations/0112_multi_event_setup_activation.sql");
  assert.match(sql, /drop constraint if exists tournament_setup_activations_tournament_id_key/);
  assert.match(sql, /create or replace function public\.activate_tournament_setup_v2/);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /v_setup_event_count < 1 or v_setup_event_count > 32 or v_main_count <> 1/);
  assert.match(sql, /case when v_setup_event\.format_code = 'standard_singles' then 'digital' else 'manual' end/);
  assert.match(sql, /insert into app\.ruleset_versions/);
  assert.match(sql, /insert into app\.events/);
  assert.match(sql, /insert into app\.tournament_setup_activations/);
  assert.match(sql, /'tournament_setup_activated'/);
  assert.match(sql, /'participantsEnrolled', false/);
  assert.match(sql, /create or replace function public\.get_tournament_setup_activation_state_v2/);
  assert.match(sql, /from public, anon, authenticated;\s+grant execute[\s\S]*to service_role;/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/);
  assert.doesNotMatch(sql, /insert into app\.(rounds|event_participants|canonical_games|score_submissions|score_confirmations|roster_payment_events)/);
});

test("setup UI activates only a saved unchanged revision and locks activated setup", () => {
  const client = read("src/app/tournament/[tournamentId]/setup/setup-client.tsx");
  const page = read("src/app/tournament/[tournamentId]/setup/page.tsx");
  assert.doesNotMatch(page, /activationEnabled|tournamentSetupActivationEnabled/);
  assert.doesNotMatch(client, /activationEnabled/);
  assert.match(client, /fetch\(`\/api\/v1\/tournaments\/\$\{tournamentId\}\/setup\/activation`/);
  assert.match(client, /JSON\.stringify\(payload\) !== savedFingerprint/);
  assert.match(client, /disabled=\{busy \|\| dirty\}/);
  assert.match(client, /Activate Tournament Events/);
  assert.match(client, /Tournament events are active/);
  assert.match(client, /Team and doubles events remain paper-scored/);
});
