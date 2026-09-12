import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync("database/migrations/0133_standard_singles_settlement_draft.sql", "utf8");
const indexSql = fs.readFileSync("database/migrations/0135_settlement_foreign_key_indexes.sql", "utf8").replaceAll(" ", "");
const fixture = fs.readFileSync("tests/standard-singles-settlement-draft.sql", "utf8");

test("settlement draft is immutable, versioned, and qualification-bound", () => {
  assert.match(sql, /qualification_result_version_id uuid not null/);
  assert.match(sql, /references app\.qualification_result_versions\(id,tournament_id,event_id\)/);
  assert.match(sql, /supersedes_draft_id/);
  assert.match(sql, /settlement_drafts_immutable/);
  assert.match(sql, /p_expected_version/);
  assert.match(sql, /stale settlement version/);
});

test("claims are bounded to sequential unique qualifiers and configured event Q pools", () => {
  assert.match(sql, /jsonb_array_length\(p_placements\)<2/);
  assert.match(sql, /min\(\(x->>'placement'\)::integer\).*<>1/);
  assert.match(sql, /max\(\(x->>'placement'\)::integer\).*jsonb_array_length\(p_placements\)/);
  assert.match(sql, /qualification_status='qualified'/);
  assert.match(sql, /qp\.setup_revision_id=v_activation\.setup_revision_id/);
  assert.match(sql, /qp\.setup_event_version_id=v_activation\.setup_event_version_id/);
});

test("settlement snapshots active manual receipts and expenses without claiming reconciliation", () => {
  assert.match(sql, /distinct on\(roster_entry_id\)/);
  assert.match(sql, /where event_type='received'/);
  assert.match(sql, /distinct on\(expense_id\)/);
  assert.match(sql, /where event_type='recorded'/);
  assert.match(sql, /reconciled boolean not null check\(not reconciled\)/);
  for (const blocker of ["official_mrp_fixture_missing", "q_pool_payout_fixture_missing", "event_payment_allocation_unsupported", "settlement_reconciliation_unsupported", "official_export_unsupported"]) assert.match(sql, new RegExp(blocker));
  assert.doesNotMatch(sql, /mrp_points|publish_standard|approve_standard|export_standard/);
});

test("all settlement RPCs remain server-only and audited", () => {
  assert.match(sql, /coalesce\(auth\.role\(\),''\)<>'service_role'/);
  assert.match(sql, /r\.role in\('director','co_director'\)/);
  assert.match(sql, /standard_singles_settlement_conflicts/);
  assert.match(sql, /settlement_draft_saved/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /revoke all on function public\.save_standard_singles_settlement_draft_v1[\s\S]*grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/);
});

test("hosted fixture covers replay, supersession, conflict, MRP and Q-pool rejection", () => {
  assert.match(fixture, /r1<>replay/);
  assert.match(fixture, /versioned draft failed/);
  assert.match(fixture, /stale version accepted/);
  assert.match(fixture, /changed retry accepted/);
  assert.match(fixture, /unconfigured q pool accepted/);
  assert.match(fixture, /MRP field accepted/);
  assert.match(fixture, /rollback;/);
});

test("every advisor-reported settlement foreign key has a covering index", () => {
  for (const columns of [
    "settlement_draft_id,tournament_id,event_id", "tournament_id",
    "operation_receipt_id,tournament_id", "qualification_result_version_id,tournament_id,event_id",
    "setup_event_version_id,tournament_id,setup_revision_id", "supersedes_draft_id",
    "expense_event_id,expense_id,tournament_id", "settlement_draft_id,tournament_id",
    "payment_event_id,roster_entry_id,tournament_id",
  ]) assert.match(indexSql, new RegExp(`\\(${columns}\\)`));
});
