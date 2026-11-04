import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const revised = readFileSync("tests/prize-pool-settlement-v5.sql", "utf8");
const original = readFileSync("tests/funded-settlement-v5.sql", "utf8");
const runner = readFileSync("tests/run-funded-settlement-v5-isolated.mjs", "utf8");

test("revised fixture uses supported writers for 16 x 3000 receipts and one 4800 expense", () => {
  assert.equal((revised.match(/\\ir \.\.\/database\/migrations\/0240_versioned_settlement_v5\.sql/g) ?? []).length, 1);
  assert.match(revised, /current_database\(\)<>'fixture_0240'/);
  for (const rpc of [
    "set_roster_payment_obligation_v1",
    "record_manual_roster_payment",
    "record_tournament_expense",
    "record_standard_singles_playoff_outcomes_v3",
    "save_event_settlement_draft_v5",
    "finalize_event_settlement_v2",
  ]) assert.match(revised, new RegExp(`public\\.${rpc}\\(`), rpc);
  assert.doesNotMatch(revised, /insert into app\.(?:roster_payment_obligation_versions|roster_payment_events|tournament_expense_events)/i);
  assert.match(revised, /0,3000,'TEST ONLY fictional 3000-cent revised prize-pool obligation'/);
  assert.equal((revised.match(/0,3000,'USD'/g) ?? []).length, 2);
  assert.match(revised, /paymentCount'<>'16'/);
  assert.match(revised, /paymentTotalMinor'<>'48000'/);
  assert.match(revised, /expenseCount'<>'1'/);
  assert.match(revised, /expenseTotalMinor'<>'4800'/);
  assert.match(revised, /300,16,4800,'setup'/);
});

test("revised fixture rejects missing allocation and assessment double deduction", () => {
  assert.match(revised, /'eventIncomeMinor',48000,'eventExpenseMinor',4800,'retainedBalanceMinor',0/);
  assert.match(revised, /missing 43200 allocation was not rejected/);
  assert.match(revised, /response->>'code'<>'non_conserving_ledger'/);
  assert.match(revised, /'eventIncomeMinor',43200,'eventExpenseMinor',4800,'retainedBalanceMinor',43200/);
  assert.match(revised, /double-deducted assessment was not rejected/);
  assert.match(revised, /double-deduction rejection replay changed/);
  assert.match(revised, /changed missing-allocation final key did not conflict/);
});

test("43200 is a local technical retained-field placeholder with no invented prize split", () => {
  assert.match(revised, /'eventIncomeMinor',48000,'eventExpenseMinor',4800,'retainedBalanceMinor',43200/);
  assert.match(revised, /actual[\s\S]+retainedBalanceMinor=43200 field is a TEST ONLY local algebra placeholder/);
  assert.match(revised, /does not authorize a retained-funds outcome/);
  assert.match(revised, /currentFinalVersion'<>'0'/);
  assert.match(revised, /eventIncomeMinor'<>'48000'/);
  assert.match(revised, /eventExpenseMinor'<>'4800'/);
  assert.match(revised, /retainedBalanceMinor'<>'43200'/);
  assert.match(revised, /officialSourceReference'<>'TEST ONLY 43200 prize pool pending policy; no payout split selected'/);
  assert.match(revised, /'prizeClaims','\[\]'::jsonb/);
  assert.doesNotMatch(revised, /'prizeClaims',jsonb_build_array/);
  assert.doesNotMatch(revised, /'prizeOrder'/);
  const pending = revised.indexOf("pending_request:=jsonb_build_object");
  const tail = revised.slice(pending);
  assert.ok(pending > 0);
  assert.doesNotMatch(tail, /public\.finalize_event_settlement_v2/);
  assert.match(tail, /count\(\*\)from app\.event_settlement_finals_v2[\s\S]{0,120}<>0/);
  assert.match(revised, /PRIZE_POOL_SETTLEMENT_V5_CONSERVATION_NEGATIVES_AND_PENDING_POLICY_PASSED/);
  assert.match(revised, /set constraints all immediate;\s*rollback;\s*$/);
  assert.doesNotMatch(revised, /disable trigger|session_replication_role|alter table[\s\S]{0,80}disable/i);
});

test("existing 16 x 300 funded-final fixture remains the separate positive proof", () => {
  assert.match(original, /0,300,'TEST ONLY fictional 300-cent funded settlement obligation'/);
  assert.doesNotMatch(original, /0,3000,'TEST ONLY fictional 3000-cent/);
  assert.match(original, /FUNDED_SETTLEMENT_V5_SUPPORTED_LEDGER_AND_FINALIZATION_PASSED/);
  assert.match(original, /funded v5 finalization failed/);
});

test("isolated runner selects the revised fixture only with an explicit allow-listed flag", () => {
  assert.match(runner, /args\.some\(arg => !\["--isolated-container", "--prize-pool"\]\.includes\(arg\)\)/);
  assert.match(runner, /const prizePool = args\.includes\("--prize-pool"\)/);
  assert.match(runner, /prizePool \? "tests\/prize-pool-settlement-v5\.sql" : "tests\/funded-settlement-v5\.sql"/);
  assert.match(runner, /prizePool \? "prize-pool-settlement-v5" : "funded-settlement-v5"/);
  assert.match(runner, /fixture\.includes\(expectedMarker\)/);
  assert.match(runner, /desktop-linux/);
  assert.match(runner, /NetworkMode !== "none"/);
  assert.match(runner, /fixture\.replace\(include, \(\) => canonical\)/);
  assert.doesNotMatch(runner, /https?:\/\//);
});
