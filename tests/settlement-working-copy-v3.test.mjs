import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("database/migrations/0141_standard_singles_settlement_working_copy_v3.sql", "utf8");
const playoffMigration = fs.readFileSync("database/migrations/0139_standard_singles_playoff_placements.sql", "utf8");
const authorityRepair = fs.readFileSync("database/migrations/0142_secret_key_rpc_authority_repair.sql", "utf8");
const api = fs.readFileSync("src/lib/api/settlement-draft.ts", "utf8");
const client = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/settlement/settlement-client.tsx", "utf8");
const route = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/settlement-draft/working-copy/route.ts", "utf8");
const fixture = fs.readFileSync("tests/settlement-working-copy-v3.sql", "utf8");

test("v3 stores immutable qualification-bound MRP transcriptions and distinguishes explicit zero", () => {
  assert.match(migration, /create table app\.standard_singles_settlement_mrp_claims/);
  assert.match(migration, /mrp_points integer not null check \(mrp_points >= 0\)/);
  assert.match(migration, /evidence_note text not null check/);
  assert.match(migration, /qualification_result_version_id,participant_id[\s\S]*references app\.qualification_result_rows/);
  assert.match(playoffMigration, /settlement_drafts_playoff_binding_identity_unique[\s\S]*unique \(id,tournament_id,event_id,qualification_result_version_id\)/);
  assert.doesNotMatch(migration, /settlement_drafts_exact_qualification_scope_unique/);
  assert.match(migration, /qualification_status='qualified'/);
  assert.match(migration, /settlement_mrp_claims_immutable/);
  assert.doesNotMatch(migration, /calculate[^\n]*mrp|approved_mrp|publish_standard|submit_standard/i);
});

test("v3 save is exact, authorized before receipts, versioned, locked, audited, and retry-safe", () => {
  const writer = migration.slice(
    migration.indexOf("create or replace function public.save_standard_singles_settlement_draft_v3"),
    migration.indexOf("create or replace function public.get_standard_singles_settlement_workspace_v3"),
  );
  assert.ok(writer.indexOf("from app.tournament_roles") < writer.indexOf("select * into v_existing from app.operation_receipts"));
  assert.match(writer, /save_standard_singles_settlement_draft_v3[\s\S]*p_expected_version[\s\S]*p_mrp_claims/);
  assert.match(writer, /standard-singles-post-event:/);
  assert.match(writer, /save_standard_singles_settlement_draft_v2/);
  assert.match(writer, /settlement_working_copy_v3_saved/);
  assert.match(writer, /settlement_working_copy_v3_rejected/);
  assert.match(writer, /settlement_working_copy_v3_idempotency_conflict/);
  assert.match(writer, /exception when sqlstate 'P0001'[\s\S]*pg_advisory_xact_lock[\s\S]*select \* into v_existing from app\.operation_receipts/);
  assert.match(writer, /v_existing\.request_hash<>v_hash[\s\S]*standard_singles_settlement_conflicts/);
});

test("v3 read and reconciliation RPCs are scoped and service-only", () => {
  assert.match(migration, /get_standard_singles_settlement_workspace_v3[\s\S]*get_standard_singles_settlement_workspace_v2/);
  assert.match(migration, /select draft\.qualification_result_version_id into v_qualification_id[\s\S]*'qualificationResultVersionId',v_qualification_id/);
  assert.match(migration, /get_standard_singles_settlement_reconciliation_v3[\s\S]*actor_profile_id=p_actor_id[\s\S]*tournament_id=p_tournament_id[\s\S]*target_id=p_event_id/);
  for (const rpc of ["save_standard_singles_settlement_draft_v3", "get_standard_singles_settlement_workspace_v3", "get_standard_singles_settlement_reconciliation_v3"]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${rpc}[\\s\\S]*from public,anon,authenticated`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}[\\s\\S]*to service_role`, "i"));
  }
  assert.doesNotMatch(migration, /grant execute[^;]+to authenticated/i);
  assert.doesNotMatch(migration, /current_setting\('request\.jwt\.claim\.role'/);
  assert.match(authorityRepair, /save_standard_singles_settlement_draft_v3/);
  assert.match(authorityRepair, /get_standard_singles_settlement_reconciliation_v3/);
  assert.match(authorityRepair, /from public, anon, authenticated[\s\S]*to service_role/);
  assert.match(api, /get_standard_singles_settlement_workspace_v3/);
  assert.match(api, /save_standard_singles_settlement_draft_v3/);
});

test("director editor preserves exact retry payload including MRP claims and restores authoritative rejection", () => {
  assert.match(client, /type Envelope = SettlementDraftRequest/);
  assert.match(client, /requestFromEnvelope/);
  assert.match(client, /mrpClaims: parsedMrpClaims/);
  assert.match(client, /sessionStorage\.setItem\(storageKey, JSON\.stringify\(envelope\)\)/);
  assert.match(client, /body: JSON\.stringify\(request\)/);
  assert.match(client, /disabled=\{busy \|\| !!locked\}/);
  assert.match(client, /response\.status === 409[\s\S]*setPlacements\(placementRows\(workspace\)\)[\s\S]*setAwards\(awardRows\(workspace\)\)[\s\S]*setMrpClaims\(mrpRows\(workspace\)\)/);
  assert.match(client, /blank value means missing; enter 0 only/);
  assert.match(client, /not calculated or ACC-approved/);
});

test("private CSV v3 is attachment-only and explicitly non-authoritative", () => {
  assert.match(route, /settlement-working-copy-v3-draft/);
  assert.match(route, /private, no-store/);
  assert.match(route, /x-content-type-options/);
  assert.match(route, /attachment/);
  assert.doesNotMatch(route, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("rollback fixture covers explicit zero, missing claims, scope, replay, conflict, audit, and immutability", () => {
  for (const fragment of [
    "explicit zero MRP claim was not preserved", "missing MRP claims were not distinct from explicit zero",
    "non-qualifier MRP accepted", "rejected v3 request did not replay exactly",
    "changed v3 retry did not conflict", "changed retry conflict was not audited",
    "missing MRP evidence accepted", "immutable MRP claim updated",
  ]) assert.match(fixture, new RegExp(fragment, "i"));
  assert.match(fixture, /workspace->'draft'->>'qualificationResultVersionId'<>q::text/);
  assert.match(fixture, /set_config\('request\.jwt\.claim\.role','service_role',true\)[\s\S]*rollback;/i);
  assert.doesNotMatch(fixture, /set local role service_role/i);
});
