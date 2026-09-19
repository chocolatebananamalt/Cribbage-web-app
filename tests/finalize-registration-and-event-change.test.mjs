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
  const [sql, transferSql, indexSql, route, page, client] = await Promise.all([
    read("database/migrations/0194_finalize_registration_and_event_change_lifecycle.sql"),
    read("database/migrations/0195_event_replacement_enrollment_and_credit_transfer.sql"),
    read("database/migrations/0196_event_change_and_transfer_fk_indexes.sql"),
    read("src/app/api/v1/tournaments/[id]/event-changes/route.ts"),
    read("src/app/tournament/[tournamentId]/event-changes/event-changes-client.tsx"),
    read("src/app/tournament/[tournamentId]/event-changes/page.tsx"),
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
  assert.match(client, /getCurrentSubject/);
  assert.match(client, /getEventChangesWorkspaceAccess/);
  for (const required of [
    "event_replacement_transfer_records",
    "event_change_operations_transfer_replacement_membership",
    "individual_enrollment",
    "tournament_payment_credit",
    "team_enrollment",
    "team_financial_contribution",
    "status in ('registered','checked_in','absent')",
    "Transferred with pre-play event replacement",
  ]) assert.match(transferSql, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const required of [
    "event_change_operations_actor_idx",
    "event_change_operations_original_event_scope_idx",
    "event_replacement_transfer_records_source_event_scope_idx",
    "event_replacement_transfer_records_payment_event_idx",
  ]) assert.match(indexSql, new RegExp(required));
  assert.match(page, /Yes, Retire Event/);
  assert.match(page, /Yes, Cancel & Replace/);
});

test("event changes name the event they act on and tell a co-director they cannot act", async () => {
  const client = await read("src/app/tournament/[tournamentId]/event-changes/event-changes-client.tsx");
  assert.match(client, /Only the primary director may make these exceptional changes\. Enter a reason to enable them\./);
  assert.match(client, /You cannot make these changes\. Only the primary director who created this tournament may retire or replace an event; a co-director cannot\./);
  // The two ternary branches must not be the same sentence again.
  assert.doesNotMatch(client, /data\.canManage \? "Only the primary director may make these exceptional changes\." : "Only the primary director may make these exceptional changes\."/);
  // The destructive confirmation has to name the event, since the buttons sit
  // beside a bulleted list of every event.
  assert.match(client, /`Retire \$\{pendingChange\.event\.name\}\?`/);
  assert.match(client, /`Cancel and replace \$\{pendingChange\.event\.name\}\?`/);
  assert.match(client, /\$\{pendingChange\.event\.name\} keeps its registrations, payment history and audit history/);
  assert.match(client, /enrolled participant\$\{pendingChange\.event\.participantCount === 1 \? "" : "s"\} stay on record\./);
});

test("a label that wraps its own control stacks instead of colliding with it", async () => {
  const css = await read("src/app/globals.css");
  assert.match(css, /label:has\(> input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)\),\s*\nlabel:has\(> select\),\s*\nlabel:has\(> textarea\) \{ display:grid; gap:6px; \}/);
  assert.match(css, /label > textarea \{ min-height:92px;/);
  // Checkbox and radio labels must keep reading inline next to their box.
  assert.match(css, /label > textarea,label > input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\),label > select \{ width:100%; \}/);
  for (const file of [
    "src/app/tournament/[tournamentId]/event-changes/event-changes-client.tsx",
    "src/app/tournament/[tournamentId]/payments/payment-obligation-client.tsx",
    "src/app/tournament/[tournamentId]/side-pools/side-pools-client.tsx",
  ]) {
    const source = await read(file);
    assert.ok(/<label>[^<]+<(textarea|input)/.test(source), `${file} should still wrap a control in its label`);
  }
});
