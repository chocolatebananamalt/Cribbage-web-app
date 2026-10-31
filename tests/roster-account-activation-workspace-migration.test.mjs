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

test("activation instructions distinguish the approving director from the player, not the issuer", async () => {
  const page = await readFile("src/app/tournament/[tournamentId]/account-activations/page.tsx", "utf8");
  const client = await readFile("src/app/tournament/[tournamentId]/account-activations/activation-workspace-client.tsx", "utf8");
  const decision = await readFile("database/migrations/0094_roster_account_activation_approval_rpc.sql", "utf8");
  assert.match(page, /signed in separately from the player/);
  assert.match(page, /The director who issued the link may approve it/);
  assert.match(page, /nobody may approve their own player request/);
  assert.match(client, /You cannot approve your own player request/);
  assert.doesNotMatch(page + client, /A different (signed-in )?director/);
  assert.match(decision, /p_actor_id = v_request\.profile_id/);
  assert.doesNotMatch(decision, /issued_by_profile_id/);
  assert.match(migration, /'canApprove', request_row\.profile_id <> p_actor_id/);
});
