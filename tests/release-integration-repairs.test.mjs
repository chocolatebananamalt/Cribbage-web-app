import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const preferenceRepair = fs.readFileSync("database/migrations/0149_scorecard_preference_mutation_repair.sql", "utf8");
const hybridRepair = fs.readFileSync("database/migrations/0150_hybrid_revalidation_repair.sql", "utf8");
const indexRepair = fs.readFileSync("database/migrations/0151_release_foreign_key_indexes.sql", "utf8");
const restoreParityIndexes = fs.readFileSync("database/migrations/0152_restore_parity_foreign_key_indexes.sql", "utf8");

test("scorecard preference is the only permitted roster projection update", () => {
  assert.match(preferenceRepair, /drop trigger tournament_roster_entries_immutable/);
  assert.match(preferenceRepair, /to_jsonb\(new\)-'scorecard_type'-'scorecard_preference_version'/);
  assert.match(preferenceRepair, /new\.scorecard_preference_version<>old\.scorecard_preference_version\+1/);
  assert.match(preferenceRepair, /set_config\('app\.scorecard_preference_write','enabled',true\)/);
  assert.match(preferenceRepair, /insert into app\.roster_scorecard_preference_events/);
  assert.match(preferenceRepair, /insert into app\.audit_events/);
});

test("canonical game revalidation recognizes only an independently approved hybrid case", () => {
  assert.match(hybridRepair, /app\.hybrid_game_latest_state\(id\)='approved'/);
  assert.match(hybridRepair, /submission_count<>1 or confirmation_count<>0/);
  assert.match(hybridRepair, /source_method='digital'/);
  assert.match(hybridRepair, /count\(\*\) from app\.hybrid_game_reviews where hybrid_case_id=hybrid_case\.id and decision='approve'/);
  assert.match(hybridRepair, /game cannot have two manual authority paths/);
});

test("October release foreign keys have explicit lookup indexes", () => {
  const indexes = indexRepair.match(/create index /g) ?? [];
  assert.equal(indexes.length, 18);
  assert.match(indexRepair, /paper_game_completion_evidence\(completion_id,tournament_id,event_id\)/);
  assert.match(indexRepair, /paper_game_completion_state_events\(operation_receipt_id,tournament_id\)/);
  assert.match(indexRepair, /hybrid_game_cases\(canonical_game_id,tournament_id,event_id\)/);
});

test("an older disposable restore receives every pilot relationship index", () => {
  const indexes = restoreParityIndexes.match(/create index if not exists/g) ?? [];
  assert.equal(indexes.length, 24);
  for (const required of [
    /initial_seating_assignments\(publication_id,tournament_id\)/,
    /registration_link_lifecycle_events\(operation_receipt_id,tournament_id\)/,
    /roster_account_links\(roster_entry_id,tournament_id\)/,
    /tournament_setup_q_pool_versions\(setup_event_version_id,tournament_id,setup_revision_id\)/,
  ]) assert.match(restoreParityIndexes, required);
});
