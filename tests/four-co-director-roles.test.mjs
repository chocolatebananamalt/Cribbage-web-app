import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("four-co-director release preserves the five-official snapshot and protected lifecycle", async () => {
  const setup = await readFile(new URL("../src/lib/api/setup.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../database/migrations/0191_four_co_director_roles.sql", import.meta.url), "utf8");
  assert.match(setup, /officials\.length >= 1 && officials\.length <= 5/);
  assert.match(setup, /coDirectorProfileIds\.length <= 4/);
  assert.match(migration, /v_co_director_count > 4/);
  assert.match(migration, /tournament_co_director_slot_count/);
  assert.match(migration, /status in \('pending','accepted','revoked','expired'\)/);
  assert.match(migration, /now\(\)\+interval '7 days'/);
  assert.match(migration, /revoke all on function public\.invite_tournament_co_director_v1/);
  assert.match(migration, /grant execute on function public\.invite_tournament_co_director_v1[\s\S]*to service_role/);
  assert.match(migration, /delete from app\.tournament_roles[\s\S]*role='co_director'/);
  assert.match(migration, /p_emergency and v_admin and length\(trim\(coalesce\(p_reason,''\)\)\) between 1 and 500/);
});
