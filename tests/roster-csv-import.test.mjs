import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRosterCsv } from "../src/lib/roster/csv.ts";
import { isAcceptedRosterCsvImport, isRejectedRosterCsvImport, isRosterCsvImportRequest } from "../src/lib/api/roster.ts";

const operationId = "10000000-0000-4000-8000-000000000001";

test("CSV parser supports quoted names and optional identity columns", () => {
  assert.deepEqual(parseRosterCsv('Player Name,Email,ACC #\r\n"Stevens, Barb",barb@example.test,HI-296\r\nSteve Hall,,\r\n'), [
    { displayName: "Stevens, Barb", email: "barb@example.test", accNumber: "HI-296" },
    { displayName: "Steve Hall", email: "", accNumber: "" },
  ]);
  assert.deepEqual(parseRosterCsv("Name\nPaper Player\n"), [{ displayName: "Paper Player", email: "", accNumber: "" }]);
});

test("CSV parser rejects malformed files before upload", () => {
  assert.throws(() => parseRosterCsv("Email\na@example.test\n"), /Player Name or Name/);
  assert.throws(() => parseRosterCsv("Name\nSame Player\nSame Player\n"), /duplicate entry/);
  assert.throws(() => parseRosterCsv("Name,Email\nFirst Name,same@example.test\nDifferent Name,same@example.test\n"), /duplicate entry/);
  assert.throws(() => parseRosterCsv("Name,ACC #\nFirst Name,HI-296\nDifferent Name, hi-296 \n"), /duplicate entry/);
  assert.throws(() => parseRosterCsv('Name\n"Missing close\n'), /unmatched quotation mark/);
  assert.throws(() => parseRosterCsv("Name,Email\nPlayer,invalid\n"), /invalid email/);
});

test("CSV import request and response envelopes are exact and bounded", () => {
  const request = { rows: [{ displayName: "Player One", email: "", accNumber: "" }], idempotencyKey: operationId };
  assert.equal(isRosterCsvImportRequest(request), true);
  assert.equal(isRosterCsvImportRequest({ ...request, extra: true }), false);
  assert.equal(isRosterCsvImportRequest({ ...request, rows: [] }), false);
  assert.equal(isRosterCsvImportRequest({ ...request, rows: [{ ...request.rows[0], extra: true }] }), false);
  assert.equal(isAcceptedRosterCsvImport({ status: "roster_csv_imported", importedCount: 1 }), true);
  assert.equal(isAcceptedRosterCsvImport({ status: "roster_csv_imported", importedCount: 0 }), false);
  assert.equal(isRejectedRosterCsvImport({ status: "rejected", code: "duplicate_in_batch" }), true);
  assert.equal(isRejectedRosterCsvImport({ status: "rejected", code: "unknown" }), false);
});

test("CSV import is atomic, audited, role-scoped, and locked with registration", () => {
  const sql = readFileSync("database/migrations/0130_director_csv_roster_import.sql", "utf8");
  const route = readFileSync("src/app/api/v1/tournaments/[id]/roster-csv/route.ts", "utf8");
  const ui = readFileSync("src/app/tournament/[tournamentId]/roster/roster-client.tsx", "utf8");
  assert.match(sql, /jsonb_array_length\(p_rows\) not between 1 and 500/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /registration_status = 'open'/);
  assert.match(sql, /initial_seating_publications/);
  assert.match(sql, /duplicate in roster batch/);
  assert.match(sql, /operation_type, target_id, request_hash/);
  assert.match(sql, /'roster_csv_imported'/);
  assert.match(sql, /revoke all on function public\.import_roster_csv_v1/);
  assert.match(route, /readLargeJson/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(ui, /The full file is checked before anyone is added/);
  assert.match(ui, /accept="\.csv,text\/csv"/);
});
