import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";
const root = process.cwd(), read = (relative) => readFile(path.join(root, relative), "utf8");
const api = await import(pathToFileURL(path.join(root, "src/lib/api/roster.ts")).href);
const operationId = "00000000-0000-4000-8000-000000000001";
test("manual roster request requires bounded first and last names with optional contact identifiers", () => {
  assert.equal(api.isManualRosterEntryRequest({ firstName: "Paper", lastName: "Player", email: "", accNumber: "", scorecardType: "paper", idempotencyKey: operationId }), true);
  assert.equal(api.isManualRosterEntryRequest({ firstName: "Test", lastName: "Player", email: "player@example.com", accNumber: "HI296", scorecardType: "digital", idempotencyKey: operationId }), true);
  assert.equal(api.isManualRosterEntryRequest({ firstName: "Youth", lastName: "Player", email: "player@example.com", accNumber: "HI296Y", scorecardType: "digital", idempotencyKey: operationId }), true);
  assert.equal(api.isManualRosterEntryRequest({ firstName: "Youth", lastName: "Player", email: "player@example.com", accNumber: "HI296YY", scorecardType: "digital", idempotencyKey: operationId }), false);
  assert.equal(api.isManualRosterEntryRequest({ firstName: "Player", lastName: "", email: "", accNumber: "", scorecardType: "digital", idempotencyKey: operationId }), false);
  assert.equal(api.isManualRosterEntryRequest({ firstName: "Player", lastName: "Name", email: "bad", accNumber: "", scorecardType: "digital", idempotencyKey: operationId }), false);
  assert.equal(api.isManualRosterEntryRequest({ firstName: "Player", lastName: "Name", email: "", accNumber: "", scorecardType: "digital", idempotencyKey: operationId, role: "director" }), false);
});
test("manual roster response contracts reject mixed or authority-expanding receipts", () => {
  const accepted = { status: "manual_roster_entry_created", rosterEntryId: operationId, source: "director_manual", profileLinked: false, roleGranted: false, eventEnrolled: false, paymentRecorded: false, checkedIn: false, seatAssigned: false };
  assert.equal(api.isAcceptedManualRosterEntry(accepted), true); assert.equal(api.isAcceptedManualRosterEntry({ ...accepted, checkedIn: true }), false); assert.equal(api.isAcceptedManualRosterEntry({ ...accepted, extra: true }), false); assert.equal(api.isRejectedManualRosterEntry({ status: "rejected", code: "duplicate_roster_entry" }), true);
});
test("manual intake SQL is private, role checked, audited, replay safe, and grants no downstream authority", async () => {
  const sql = await read("database/migrations/0111_director_manual_roster_intake.sql");
  assert.match(sql, /create or replace function public\.create_manual_roster_entry_v1/); assert.match(sql, /security definer set search_path = ''/); assert.match(sql, /role in \('director', 'co_director'\)/); assert.match(sql, /pg_advisory_xact_lock/); assert.match(sql, /duplicate roster entry/); assert.match(sql, /initial seating already published/); assert.match(sql, /manual_roster_entry_created/); assert.match(sql, /insert into app\.audit_events/); assert.match(sql, /get_manual_roster_entry_reconciliation_v1/); assert.match(sql, /revoke all on function public\.create_manual_roster_entry_v1[\s\S]*from public, anon/);
  assert.doesNotMatch(sql, /insert into (auth\.users|app\.(profiles|tournament_roles|event_participants|roster_payment_events|roster_check_in_events|initial_seating_assignments))/);
});
test("manual roster routes and UI enforce session, origin, bounded JSON, and non-PII retry identity", async () => {
  const route = await read("src/app/api/v1/tournaments/[id]/roster-manual/route.ts"), reconciliation = await read("src/app/api/v1/tournaments/[id]/roster-manual/reconciliation/route.ts"), client = await read("src/app/tournament/[tournamentId]/roster/roster-client.tsx");
  for (const source of [route, reconciliation]) { assert.match(source, /isSameOriginRequest/); assert.match(source, /readSmallJson/); assert.match(source, /requireVerifiedSubject/); assert.match(source, /withApiFailureBoundary/); }
  assert.match(client, /Add Player Manually/); assert.match(client, /manual-roster-operation:/); assert.match(client, /Retry manual entry/); assert.match(client, /credentials: "same-origin"/); assert.match(client, /JSON\.stringify\(\{ idempotencyKey: envelope\.idempotencyKey \}\)/); assert.doesNotMatch(client, /sessionStorage[^\n]*(displayName|email|accNumber)/);
});
