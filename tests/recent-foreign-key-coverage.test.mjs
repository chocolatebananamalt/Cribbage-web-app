import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("database/migrations/0132_recent_foreign_key_coverage.sql", "utf8");

test("recent relationship indexes cover every advisor-reported foreign key", () => {
  assert.equal((migration.match(/create index if not exists/g) ?? []).length, 29);
  for (const columns of [
    "canonical_game_id, tournament_id, event_id", "operation_receipt_id, tournament_id",
    "round_id, tournament_id, event_id", "recovery_id, canonical_game_id",
    "recovery_id, tournament_id, event_id", "result_version_id, tournament_id, event_id",
    "high_non_qualifier_participant_id, event_id, tournament_id",
    "schedule_publication_id, tournament_id, event_id", "issued_by_profile_id",
  ]) assert.match(migration, new RegExp(columns.replaceAll(" ", "\\s*")));
});
