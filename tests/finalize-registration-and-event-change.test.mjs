import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("finalization opens registration only after explicit primary-director confirmation", async () => {
  const [sql, client, route] = await Promise.all([
    read("database/migrations/0194_finalize_registration_and_event_change_lifecycle.sql"),
    read("src/app/tournament/[tournamentId]/setup/setup-client.tsx"),
    read("src/app/api/v1/tournaments/[id]/setup/activation/route.ts"),
  ]);
  for (const required of [
    "finalize_tournament_setup_and_open_registration_v1",
    "tournament_setup_finalization_confirmations",
    "registration_status = 'closed'",
    "registration_status='open'",
    "p_confirmed is distinct from true",
    "registration_not_open",
    "issue_registration_link_v2_legacy",
    "submit_registration_claim_v3_legacy",
  ]) assert.match(sql, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(client, /Please confirm you intend to open registration for these events/);
  assert.match(client, /Yes, Finalize & Open Registration|Finalize All Events \/ Open Registration/);
  assert.match(client, /router\.push\(`\/tournament\/\$\{tournamentId\}\/registration`\)/);
  assert.match(route, /p_confirmed: body\.confirmed/);
});

test("retire and replace preserve history and reject event operations after Start Play", async () => {
  const [sql, route, page] = await Promise.all([
    read("database/migrations/0194_finalize_registration_and_event_change_lifecycle.sql"),
    read("src/app/api/v1/tournaments/[id]/event-changes/route.ts"),
    read("src/app/tournament/[tournamentId]/event-changes/event-changes-client.tsx"),
  ]);
  for (const required of [
    "event_change_operations",
    "operational_state",
    "primary_director_required",
    "platform_emergency_override",
    "event_already_started",
    "event_participants_require_active_event",
    "event_retired",
    "tournament_setup_revisions",
    "tournament_setup_activations",
  ]) assert.match(sql, new RegExp(required));
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(route, /change_event_lifecycle_v1/);
  assert.doesNotMatch(route, /\.from\(|\.insert\(|\.update\(/);
  assert.match(page, /Cancel \/ Retire/);
  assert.match(page, /Cancel \/ Replace/);
  assert.match(page, /Required director reason/);
});
