import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migration = await readFile(path.join(process.cwd(), "database/migrations/0127_roster_account_activation_workspace.sql"), "utf8");

test("activation workspace is service-only and limited to current directors", () => {
  assert.match(migration, /perform app\.roster_account_activation_service_only\(\)/);
  assert.match(migration, /role_row\.role in \('director', 'co_director'\)/);
  assert.match(migration, /tournament\.status in \('draft', 'open'\)/);
  assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
});

test("activation workspace exposes pending ceremony metadata but no witness secret", () => {
  assert.match(migration, /'pendingRequests'/);
  assert.match(migration, /'canApprove', request_row\.profile_id <> p_actor_id/);
  assert.match(migration, /activation\.expires_at > now\(\)/);
  assert.doesNotMatch(migration, /confirmation_phrase|credential_digest|credential_salt/);
  assert.doesNotMatch(migration, /app\.profiles|accountDisplayName/);
});
