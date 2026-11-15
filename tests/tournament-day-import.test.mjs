import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseTournamentDayCsv, tournamentDayCsvTemplateHeaders } from "../src/lib/roster/tournament-day-csv.ts";
import { isAcceptedTournamentDayImport, isTournamentDayImportRequest, isTournamentDayImportWorkspace } from "../src/lib/api/tournament-day-import.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");
const workspace = {
  tournamentName: "Genesis Rehearsal",
  events: [
    { eventId: "10000000-0000-0000-0000-000000000001", name: "Main Event", eventType: "main", format: "standard_singles", scoringMethod: "digital", qPoolSlots: [1, 2], sidePools: [{ poolId: "10000000-0000-0000-0000-000000000101", displayName: "Top 4", entryFeeMinor: 1000 }] },
    { eventId: "10000000-0000-0000-0000-000000000002", name: "Consolation Event", eventType: "consolation", format: "standard_singles", scoringMethod: "digital", qPoolSlots: [1], sidePools: [] },
  ],
};

test("tournament-day CSV parser maps event, Q Pool, and Side Pool columns to operational IDs", () => {
  assert.ok(isTournamentDayImportWorkspace(workspace));
  assert.deepEqual(tournamentDayCsvTemplateHeaders(workspace).slice(0, 8), ["First Name", "Last Name", "Email", "ACC #", "Scorecard Type", "Payment Status", "Payment Method", "Payment Reference"]);
  const rows = parseTournamentDayCsv(`First Name,Last Name,Email,ACC #,Scorecard Type,Payment Status,Payment Method,Main Event Entry,Main Event Q Pool 1,Main Event Side Pool: Top 4\nDaron,Stevens,daron@example.com,HI296Y,Digital,Paid,Cash,50,10,10\n`, workspace);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].accNumber, "HI296Y");
  assert.equal(rows[0].paymentStatus, "paid");
  assert.deepEqual(rows[0].eventEnrollments, [{ eventId: workspace.events[0].eventId, amountMinor: 5000 }]);
  assert.deepEqual(rows[0].qPoolPayments, [{ eventId: workspace.events[0].eventId, qPoolSlot: 1, amountMinor: 1000 }]);
  assert.deepEqual(rows[0].sidePoolElections, [{ eventId: workspace.events[0].eventId, poolId: workspace.events[0].sidePools[0].poolId, amountMinor: 1000 }]);
  assert.ok(isTournamentDayImportRequest({ rows, idempotencyKey: "10000000-0000-0000-0000-000000000999" }));
});

test("tournament-day CSV distinguishes paid players from desk-payment players", () => {
  const rows = parseTournamentDayCsv(`First Name,Last Name,Email,ACC #,Scorecard Type,Payment Status,Payment Method,Main Event Entry\nIan,Stevens,ian@example.com,HI297Y,Paper,Unpaid,Digital,50\n`, workspace);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].paymentStatus, "unpaid");
  assert.equal(rows[0].paymentMethod, "other");
  assert.deepEqual(rows[0].eventEnrollments, [{ eventId: workspace.events[0].eventId, amountMinor: 5000 }]);
  assert.ok(isTournamentDayImportRequest({ rows, idempotencyKey: "10000000-0000-0000-0000-000000000998" }));
  assert.throws(() => parseTournamentDayCsv(`First Name,Last Name,ACC #,Scorecard Type,Payment Status,Main Event Entry\nMaryn,Stevens,HI297,Digital,Maybe,50\n`, workspace), /Payment Status/);
});

test("tournament-day CSV rejects unsafe registration shortcuts before import", () => {
  assert.throws(() => parseTournamentDayCsv(`First Name,Last Name,ACC #,Scorecard Type,Main Event Entry\nMaryn,Stevens,HI296,Digital,50\nOther,Player,HI296Y,Paper,50\n`, workspace), /duplicate ACC # identity/);
  assert.throws(() => parseTournamentDayCsv(`First Name,Last Name,ACC #,Scorecard Type,Main Event Entry\nMaryn,Stevens,HI 296,Digital,50\n`, workspace), /valid ACC #/);
  assert.throws(() => parseTournamentDayCsv(`First Name,Last Name,ACC #,Scorecard Type,Unknown Event Entry\nMaryn,Stevens,HI297,Digital,50\n`, workspace), /not active/);
  assert.throws(() => parseTournamentDayCsv(`First Name,Last Name,ACC #,Scorecard Type,Payment Method,Main Event Side Pool: Top 4\nMaryn,Stevens,HI297,Digital,Venmo,10\n`, workspace), /Side Pool collection currently accepts Cash or Check/);
});

test("tournament-day import migration is service-only and feeds existing operational tables", () => {
  const sql = read("database/migrations/0232_tournament_day_csv_import.sql");
  assert.match(sql, /get_tournament_day_import_workspace_v1/);
  assert.match(sql, /import_tournament_day_csv_v1/);
  assert.match(sql, /grant execute on function public\.import_tournament_day_csv_v1\(uuid,uuid,jsonb,uuid\) to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.import_tournament_day_csv_v1[\s\S]*authenticated/);
  assert.match(sql, /insert into app\.tournament_roster_entries/);
  assert.match(sql, /insert into app\.event_participants/);
  assert.match(sql, /insert into app\.roster_payment_obligation_versions/);
  assert.match(sql, /insert into app\.roster_payment_events/);
  assert.match(sql, /v_payment_status='paid' and v_total_minor>0/);
  assert.match(sql, /payment_conflict/);
  assert.match(sql, /insert into app\.event_side_pool_election_versions/);
  assert.match(sql, /initial_seating_already_published/);
  assert.match(sql, /registration_closed/);

  // 'open' is set by activate_tournament_setup_v2 (0112:239), so it means setup
  // was activated. This import checks every row against the activations table, so
  // the tighter guard is the right one and returns one registration_closed rather
  // than a per-row event_unavailable.
  assert.ok(sql.includes("tournament.status='open' and tournament.registration_status='open'"));

  // The branch shipped this writer with no service_role guard, alone among the
  // writers in this schema. The grants were the only thing keeping anon and
  // authenticated out.
  assert.ok(sql.includes("coalesce((select auth.jwt()->>'role'), '') <> 'service_role'"));

  // Everything after the receipt insert has already written rows. PostgREST
  // commits a function that returns normally, so a 'rejected' return there
  // committed a partial import behind a receipt marked accepted, while the
  // client told the director no partial import was applied. Those paths raise,
  // which rolls the partial rows and the receipt back together.
  const applyPass = sql.slice(sql.indexOf("returning id into v_receipt;"));
  assert.ok(applyPass.length > 0);
  assert.ok(!applyPass.includes("return jsonb_build_object('status','rejected'"));
  assert.ok(applyPass.includes("raise exception using errcode='P0001', message='tournament day csv import failed its own recheck at apply time"));

  // Every rejection that is real input validation still runs before the first
  // write, so it stays a 409 with its own code rather than a 503.
  const validationPass = sql.slice(0, sql.indexOf("returning id into v_receipt;"));
  assert.ok(validationPass.includes("return jsonb_build_object('status','rejected','code','withdrawn_roster_entry'"));
  assert.ok(validationPass.includes("return jsonb_build_object('status','rejected','code','duplicate_in_batch'"));
});

test("the ported migration does not reuse an ordinal that production already applied", () => {
  const names = readdirSync(`${root}/database/migrations`).filter((name) => name.endsWith(".sql"));
  const ordinals = names.map((name) => name.slice(0, 4));
  assert.equal(new Set(ordinals).size, ordinals.length, "two migrations claim one ordinal");
  assert.ok(names.includes("0232_tournament_day_csv_import.sql"));
  // 0219 is the results reader that is already live. PR #106 numbered this file
  // 0219 as well, which is the reason it is renumbered rather than merged.
  assert.ok(names.includes("0219_players_can_read_their_own_tournament_results.sql"));
  assert.ok(!names.includes("0219_tournament_day_csv_import.sql"));
});

test("workspace route exposes the CSV-first fallback without removing normal registration", () => {
  const page = read("src/app/tournament/[tournamentId]/tournament-day-import/page.tsx");
  const route = read("src/app/api/v1/tournaments/[id]/tournament-day-import/route.ts");
  const client = read("src/app/tournament/[tournamentId]/tournament-day-import/tournament-day-import-client.tsx");
  assert.match(page, /Tournament Day CSV Import/);
  assert.match(route, /import_tournament_day_csv_v1/);
  assert.match(client, /Q Pool dollars are included in payment\/audit evidence/);
  assert.match(client, /Download blank CSV template/);
  assert.match(client, /100 starter rows/);
  assert.match(client, /up to 500 players/);
  assert.match(client, /Payment Status/);

  // readLargeJson stops at 524288 bytes and hands the guard null, which the
  // route reports as an invalid request shape. The shape is fine, so the client
  // measures the body first and says what is actually wrong.
  assert.ok(client.includes("new TextEncoder().encode(body).length > 524_288"));
  assert.match(client, /too large to send in one request/);
  assert.ok(isAcceptedTournamentDayImport({ status: "tournament_day_csv_imported", importedRows: 1, rosterCreatedCount: 1, rosterMatchedCount: 0, eventEnrollmentCount: 1, eventEnrollmentExistingCount: 0, paymentReceiptCount: 1, paymentExistingCount: 0, sidePoolElectionCount: 1, sidePoolElectionExistingCount: 0, qPoolPaymentTotalMinor: 1000 }));
});
