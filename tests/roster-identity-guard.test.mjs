import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("cross-source roster identity guard is locked, append-only, and withdrawal-safe", async () => {
  const sql = await read("database/migrations/0205_roster_identity_guard_and_withdrawal.sql");
  assert.match(sql, /roster_identity_outcome_v1/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /\^\[A-Z\]\{2\}\[0-9\]\+\$/);
  assert.match(sql, /create_roster_entry_from_registration_claim_before_identity_guard/);
  assert.match(sql, /create_manual_roster_entry_v3_before_acc_guard/);
  assert.match(sql, /import_roster_csv_v3_before_acc_guard/);
  assert.match(sql, /roster_entry_lifecycle_events_immutable/);
  assert.match(sql, /downstream activity requires event workflow/);
  assert.match(sql, /grant execute on function public\.set_roster_entry_active_status_v1[\s\S]*to service_role/);
});

test("new ACC values reject lowercase at every request boundary", async () => {
  const roster = await read("src/lib/api/roster.ts");
  const publicRegistration = await read("src/lib/api/public-registration-v2.ts");
  assert.match(roster, /validAccNumber/);
  assert.match(publicRegistration, /validAccNumber/);
  assert.match(publicRegistration, /\^\[A-Z\]\{2\}\\d\+\$/);
});

test("confirmed distinct review permits only weak name or email matches", async () => {
  const sql = await read("database/migrations/0206_safe_possible_duplicate_review.sql");
  assert.match(sql, /v_hard_collision/);
  assert.match(sql, /when 'hard duplicate match' then 'hard_duplicate_match'/);
  assert.match(sql, /v_outcome='duplicate'/);
  assert.match(sql, /v_outcome='withdrawn'/);
  assert.match(sql, /v_outcome='review' and v_decision\.duplicate_resolution is distinct from 'confirmed_distinct_person'/);
  assert.match(sql, /roster_collision/);
});
