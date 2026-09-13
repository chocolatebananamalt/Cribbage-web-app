import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isRejectedSetupAmendment, isSetupAmendmentRequest, isSetupAmendmentResult } from "../src/lib/api/setup-amendment.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const base = "10000000-0000-4000-8000-000000000001";
const operation = "20000000-0000-4000-8000-000000000002";
const event = { clientRowId: "30000000-0000-4000-8000-000000000003", eventKind: "consolation", displayName: "Consolation", startsAt: "2026-10-03T18:00", timezone: "Pacific/Honolulu", styleCode: "Standard", formatCode: "standard_singles", gameCount: 9, entryFeeCents: 2000, feeIncludesNote: "", payoutNote: "", qualificationNote: "", eligibilityNote: "", mugginsStatus: "unset", qPools: [] };
const request = { expectedSetupRevisionId: base, expectedSetupVersion: 1, events: [event], operationId: operation };

test("activated setup amendment accepts only exact bounded new-event requests", () => {
  assert.equal(isSetupAmendmentRequest(request), true);
  assert.equal(isSetupAmendmentRequest({ ...request, events: [] }), false);
  assert.equal(isSetupAmendmentRequest({ ...request, events: [{ ...event, eventKind: "main" }] }), false);
  assert.equal(isSetupAmendmentRequest({ ...request, expectedSetupVersion: 0 }), false);
  assert.equal(isSetupAmendmentRequest({ ...request, extra: true }), false);
});

test("activated setup amendment validates the exact server-derived projection", () => {
  const result = { status: "tournament_setup_amended", amendmentId: "40000000-0000-4000-8000-000000000004", setupRevisionId: "50000000-0000-4000-8000-000000000005", setupVersion: 2, addedEventCount: 1, events: [{ activationId: "60000000-0000-4000-8000-000000000006", setupEventVersionId: "70000000-0000-4000-8000-000000000007", rulesetVersionId: "80000000-0000-4000-8000-000000000008", eventId: "90000000-0000-4000-8000-000000000009", eventType: "consolation", name: "Consolation", format: "standard_singles", scoringMethod: "digital", gameCount: 9 }] };
  assert.equal(isSetupAmendmentResult(result, request), true);
  assert.equal(isSetupAmendmentResult({ ...result, setupRevisionId: base }, request), false);
  assert.equal(isSetupAmendmentResult({ ...result, events: [{ ...result.events[0], scoringMethod: "manual" }] }, request), false);
  assert.equal(isSetupAmendmentResult({ ...result, addedEventCount: 2 }, request), false);
  assert.equal(isRejectedSetupAmendment({ status: "rejected", code: "stale_setup_revision" }), true);
  assert.equal(isRejectedSetupAmendment({ status: "rejected", code: "invented" }), false);
});

test("migration is append-only, serialized, audited, source-bounded, and server-only", () => {
  const sql = read("database/migrations/0137_activated_setup_event_amendments.sql");
  assert.match(sql, /create table app\.tournament_setup_amendments/);
  assert.match(sql, /enable row level security[\s\S]*force row level security[\s\S]*revoke all on table app\.tournament_setup_amendments/);
  assert.match(sql, /tournament_setup_amendments_immutable/);
  assert.match(sql, /guard_activated_setup_revision_insert[\s\S]*setup lifecycle closed/);
  assert.match(sql, /create function public\.append_tournament_setup_events_v1/);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /setup-amendment:' \|\| p_tournament_id::text[\s\S]*from app\.tournaments where id = p_tournament_id for update/);
  assert.match(sql, /order by revision\.version desc limit 1 for update[\s\S]*v_base\.id <> p_expected_setup_revision_id/);
  assert.match(sql, /role_row\.role in \('director', 'co_director'\)/);
  assert.match(sql, /activation\.setup_revision_id = v_base\.id/);
  assert.match(sql, /setup officials stale/);
  assert.match(sql, /v_event->>'eventKind' = 'consolation'[\s\S]*'Consy Lite'/);
  assert.match(sql, /'Canadian Doubles'[\s\S]*'canadian_doubles'/);
  assert.match(sql, /case when v_event->>'formatCode' = 'standard_singles' then 'digital' else 'manual' end/);
  assert.match(sql, /insert into app\.tournament_setup_revisions/);
  assert.match(sql, /insert into app\.tournament_setup_amendments/);
  assert.match(sql, /insert into app\.operation_receipts/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /return v_existing\.response_payload/);
  assert.doesNotMatch(sql, /update app\.(tournament_setup_revisions|tournament_setup_event_versions|events|ruleset_versions|tournament_setup_activations)/);
  assert.match(sql, /revoke all on function public\.append_tournament_setup_events_v1[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.append_tournament_setup_events_v1[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.append_tournament_setup_events_v1[\s\S]*to authenticated/);
});

test("amendment route is same-origin, session-bound, strict, and server-only", () => {
  const route = read("src/app/api/v1/tournaments/[id]/setup/amendments/route.ts");
  assert.doesNotMatch(route, /tournamentSetupActivationEnabled|ACC_TOURNAMENT_SETUP_ACTIVATION_ENABLED/);
  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /readLargeJson\(request\)/);
  assert.match(route, /isSetupAmendmentRequest\(body\)/);
  assert.match(route, /requireVerifiedSubject\(await createClient\(\)\)/);
  assert.match(route, /createServerOnlyAdminClient\(\)\.rpc\("append_tournament_setup_events_v1"/);
  assert.match(route, /p_actor_id: subject/);
  assert.doesNotMatch(route, /\.from\(|\.insert\(|\.update\(/);
});

test("activated setup UI can append events but cannot edit active ones", () => {
  const client = read("src/app/tournament/[tournamentId]/setup/setup-client.tsx");
  assert.match(client, /Add a later event/);
  assert.match(client, /without changing any active event/);
  assert.match(client, /setup\/amendments/);
  assert.match(client, /Retry Exact Event Addition/);
  assert.match(client, /isSetupAmendmentRequest/);
  assert.match(client, /tournament-setup-amendment:/);
  assert.match(client, /<fieldset disabled=\{busy \|\| !!pending \|\| activated\}>/);
});

test("rollback fixture covers accepted, replay, rejection, and serialized contention outcomes", () => {
  const sql = read("tests/tournament-setup-amendment.sql");
  for (const marker of ["exact_replay", "changed_retry", "stale_competitor", "duplicate_event", "direct browser role was not denied", "rollback;"]) assert.match(sql, new RegExp(marker));
  assert.match(sql, /set_config\('request\.jwt\.claim\.role','service_role',true\);\s*set local role service_role;/);
  assert.match(sql, /set_config\('request\.jwt\.claim\.role','authenticated',true\);\s*set local role authenticated;/);
});
