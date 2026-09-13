import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const expense = await import("../src/lib/api/expense.ts");
const migration = read("database/migrations/0128_tournament_expense_ledger.sql");
const recordRoute = read("src/app/api/v1/tournaments/[id]/expenses/record/route.ts");
const voidRoute = read("src/app/api/v1/tournaments/[id]/expenses/void/route.ts");
const reconciliationRoute = read("src/app/api/v1/tournaments/[id]/expenses/reconciliation/route.ts");
const page = read("src/app/tournament/[tournamentId]/payments/page.tsx");
const client = read("src/app/tournament/[tournamentId]/payments/expense-client.tsx");
const workspace = read("src/lib/expenses/workspace.ts");
const sessionStorage = read("src/lib/client-session-storage.ts");

const tournamentId = "a1280000-0000-4000-8000-000000000001";
const expenseId = "b1280000-0000-4000-8000-000000000001";
const eventId = "c1280000-0000-4000-8000-000000000001";
const voidEventId = "c1280000-0000-4000-8000-000000000002";
const key = "d1280000-0000-4000-8000-000000000001";

test("expense requests require exact integer-minor-unit and bounded text contracts", () => {
  const record = { amountMinor: 1250, description: "Venue supplies", idempotencyKey: key };
  assert.equal(expense.isExpenseRecordRequest(record), true);
  assert.equal(expense.isExpenseRecordRequest({ ...record, amountMinor: 12.5 }), false);
  assert.equal(expense.isExpenseRecordRequest({ ...record, amountMinor: 0 }), false);
  assert.equal(expense.isExpenseRecordRequest({ ...record, description: " ".repeat(4) }), false);
  assert.equal(expense.isExpenseRecordRequest({ ...record, description: "x".repeat(201) }), false);
  assert.equal(expense.isExpenseRecordRequest({ ...record, category: "venue" }), false);
  assert.equal(expense.isExpenseRecordRequest({ ...record, expenseDate: "2026-09-18" }), false);
  const reversal = { expenseId, expectedExpenseVersion: 1, expenseEventId: eventId, voidReason: "Entered twice", idempotencyKey: key };
  assert.equal(expense.isExpenseVoidRequest(reversal), true);
  assert.equal(expense.isExpenseVoidRequest({ ...reversal, voidReason: "" }), false);
  assert.equal(expense.isExpenseVoidRequest({ ...reversal, expectedExpenseVersion: 0 }), false);
});

test("expense outcomes are exact and remain explicitly unreconciled", () => {
  const request = { amountMinor: 1250, description: "Venue supplies", idempotencyKey: key };
  const recorded = { status: "expense_recorded", expenseId, expenseEventId: eventId, expenseVersion: 1, expenseState: "recorded", amountMinor: 1250, currencyCode: "USD", reconciled: false };
  assert.equal(expense.isRecordedExpense(recorded, request), true);
  assert.equal(expense.isRecordedExpense({ ...recorded, reconciled: true }, request), false);
  assert.equal(expense.isRecordedExpense({ ...recorded, payoutCalculated: false }, request), false);
  const voidRequest = { expenseId, expectedExpenseVersion: 1, expenseEventId: eventId, voidReason: "Entered twice", idempotencyKey: key };
  const voided = { status: "expense_voided", expenseId, expenseEventId: voidEventId, voidedExpenseEventId: eventId, expenseVersion: 2, expenseState: "voided", amountMinor: 1250, currencyCode: "USD", reconciled: false };
  assert.equal(expense.isVoidedExpense(voided, voidRequest), true);
  assert.equal(expense.isVoidedExpense({ ...voided, voidedExpenseEventId: voidEventId }, voidRequest), false);
});

test("expense workspace validates history, active totals, and tournament scope", () => {
  const history = [{ expenseEventId: eventId, version: 1, eventType: "recorded", description: "Venue supplies", amountMinor: 1250, currencyCode: "USD", voidReason: null, approvalActorDisplayName: "Synthetic Director", recordedAt: "2026-09-11T12:00:00Z" }];
  const entry = { expenseId, expenseVersion: 1, expenseState: "recorded", currentExpenseEventId: eventId, description: "Venue supplies", amountMinor: 1250, currencyCode: "USD", history };
  const value = { tournamentId, currencyCode: "USD", activeExpenseTotalMinor: 1250, reconciled: false, expenses: [entry] };
  assert.equal(expense.isExpenseWorkspace(value, tournamentId), true);
  assert.equal(expense.isExpenseWorkspace({ ...value, activeExpenseTotalMinor: 0 }, tournamentId), false);
  assert.equal(expense.isExpenseWorkspace({ ...value, tournamentId: expenseId }, tournamentId), false);
  assert.equal(expense.isExpenseWorkspace({ ...value, expenses: [{ ...entry, expenseVersion: 2 }] }, tournamentId), false);
});

test("database ledger is private, immutable, role-checked, and replay safe", () => {
  const historyValidator = migration.slice(migration.indexOf("create or replace function app.revalidate_tournament_expense_history"), migration.indexOf("create or replace function app.revalidate_tournament_expense_history_from_event"));
  assert.match(migration, /create table app\.tournament_expense_events/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table app\.tournament_expense_events from public, anon, authenticated/);
  assert.match(migration, /tournament_expense_events_immutable/);
  assert.match(migration, /revalidate_tournament_expense_history/);
  assert.match(migration, /event_type in \('recorded', 'voided'\)/);
  assert.match(migration, /role_row\.role in \('director', 'co_director'\)/);
  assert.doesNotMatch(historyValidator, /tournament_roles/, "immutable history must not depend on an actor retaining a current role");
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /client_operation_id = p_idempotency_key/);
  assert.match(migration, /idempotency_conflict/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /'reconciled', false/);
  assert.doesNotMatch(migration, /insert into app\.(canonical_games|score_submissions|card_scorelines)/);
});

test("expense API and page remain protected server boundaries", () => {
  for (const route of [recordRoute, voidRoute, reconciliationRoute]) {
    assert.match(route, /isSameOriginRequest/);
    assert.match(route, /readSmallJson/);
    assert.match(route, /requireVerifiedSubject/);
    assert.match(route, /createClient/);
    assert.doesNotMatch(route, /createServerOnlyAdminClient|service_role/);
  }
  assert.match(recordRoute, /record_tournament_expense/);
  assert.match(voidRoute, /void_tournament_expense/);
  assert.match(reconciliationRoute, /get_tournament_expense_operation_reconciliation/);
  assert.match(workspace, /import "server-only"/);
  assert.match(workspace, /get_tournament_expense_workspace/);
  assert.match(page, /\["director", "co_director"\]\.includes\(access\.role\)/);
  assert.match(page, /getExpenseWorkspace/);
  assert.match(client, />Add Expense</);
  assert.match(client, /sessionStorage/);
  assert.match(sessionStorage, /"expense-operation:"/);
  assert.match(client, /This ledger is private and not reconciled/);
  assert.doesNotMatch(client, /sessionStorage[^\n]*(description|amountMinor|voidReason)/);
  assert.doesNotMatch(client, /category|expenseDate|MRP calculation|payout calculation/i);
});

test("rollback fixture covers authorization, replay, reversal, and immutability", () => {
  const fixture = read("tests/tournament-expense-ledger.sql");
  assert.match(fixture, /^-- Rollback-only/m);
  assert.match(fixture, /begin;/);
  assert.match(fixture, /rollback;/);
  assert.match(fixture, /exact replay created a duplicate expense/);
  assert.match(fixture, /changed replay was not rejected/);
  assert.match(fixture, /viewer recorded an expense/);
  assert.match(fixture, /expense void did not preserve the original/);
  assert.match(fixture, /void-after-recorder-role-removed/);
  assert.match(fixture, /expense history was mutable/);
});
