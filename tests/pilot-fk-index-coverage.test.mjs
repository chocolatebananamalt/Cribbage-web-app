import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  "database/migrations/0143_pilot_fk_index_coverage.sql",
  "utf8",
);

const expectedIndexes = [
  ["independent_card_correction_claims_game_scope_fk_idx", "correction_id, canonical_game_id, tournament_id, event_id"],
  ["independent_card_corrections_affected_participant_scope_fk_idx", "affected_participant_id, event_id, tournament_id"],
  ["rule12_affected_player_notices_correction_scope_fk_idx", "correction_id, canonical_game_id, tournament_id, event_id"],
  ["rule12_affected_player_notices_participant_scope_fk_idx", "participant_id, profile_id, event_id, tournament_id"],
  ["playoff_placement_rows_result_scope_fk_idx", "playoff_result_version_id, tournament_id, event_id, qualification_result_version_id"],
  ["playoff_result_conflicts_tournament_fk_idx", "tournament_id"],
  ["playoff_result_versions_supersedes_scope_fk_idx", "supersedes_playoff_result_version_id, tournament_id, event_id, qualification_result_version_id"],
  ["settlement_mrp_claims_draft_scope_fk_idx", "settlement_draft_id, tournament_id, event_id, qualification_result_version_id"],
  ["settlement_playoff_bindings_draft_scope_fk_idx", "settlement_draft_id, tournament_id, event_id, qualification_result_version_id"],
  ["tournament_setup_amendments_receipt_scope_fk_idx", "operation_receipt_id, tournament_id, actor_profile_id"],
  ["tournament_setup_amendments_revision_scope_fk_idx", "setup_revision_id, tournament_id"],
];

test("migration covers every advisor-reported foreign-key path idempotently", () => {
  for (const [name, columns] of expectedIndexes) {
    assert.match(migration, new RegExp(`create index if not exists ${name}[\\s\\S]*?\\(${columns}\\)`));
  }
  assert.equal((migration.match(/create index if not exists/g) ?? []).length, expectedIndexes.length);
});
