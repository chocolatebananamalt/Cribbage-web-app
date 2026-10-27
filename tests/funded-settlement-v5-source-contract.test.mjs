import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixture = readFileSync("tests/funded-settlement-v5.sql", "utf8");

test("funded settlement fixture uses supported financial and settlement RPCs", () => {
  for (const rpc of [
    "set_roster_payment_obligation_v1",
    "record_manual_roster_payment",
    "record_tournament_expense",
    "record_standard_singles_playoff_outcomes_v3",
    "save_event_settlement_draft_v5",
    "finalize_event_settlement_v2",
  ]) assert.match(fixture, new RegExp(`public\\.${rpc}\\(`), rpc);

  assert.doesNotMatch(fixture, /insert into app\.(?:roster_payment_obligation_versions|roster_payment_events|tournament_expense_events)/i);
  assert.match(fixture, /generate_series\(1,16\)n[\s\S]+set_roster_payment_obligation_v1/);
  assert.match(fixture, /generate_series\(1,16\)n[\s\S]+record_manual_roster_payment/);
  assert.match(fixture, /record_tournament_expense\([\s\S]+4800,'USD'/);
  assert.match(fixture, /'payment-replay-1',public\.record_manual_roster_payment/);
  assert.match(fixture, /'expense-replay',public\.record_tournament_expense/);
  assert.match(fixture, /set local role postgres;/);
  assert.doesNotMatch(fixture, /reset role;/);
  assert.match(fixture, /paymentCount'<>'16'/);
  assert.equal(fixture.split("label ~ '^payment-[0-9]+$'").length - 1, 2,
    "original payment counts must exclude the separate replay result");
  assert.match(fixture, /paymentTotalMinor'<>'4800'/);
  assert.match(fixture, /expenseCount'<>'1'/);
  assert.match(fixture, /expenseTotalMinor'<>'4800'/);
});

test("funded settlement fixture binds the immutable assessment and proves bounded failures", () => {
  assert.match(fixture, /current_database\(\)<>'fixture_0240'/);
  assert.match(fixture, /300,16,4800,'setup'/);
  assert.match(fixture, /'prizeClaims','\[\]'::jsonb/);
  assert.match(fixture, /'eventIncomeMinor',4800/);
  assert.match(fixture, /'eventExpenseMinor',4800/);
  assert.match(fixture, /'retainedBalanceMinor',0/);
  for (const marker of [
    "missing assessment expense binding did not block finalization",
    "mismatched assessment expense evidence was accepted",
    "unauthorized funded draft created hidden state",
    "stale funded draft append was accepted",
    "funded draft exact replay changed",
    "changed funded draft key did not conflict",
    "funded v5 finalization failed",
    "funded final exact replay changed",
    "changed funded final key did not conflict",
    "stale funded final append was accepted",
    "unauthorized funded final created hidden state",
    "payment history was mutable",
    "expense history was mutable",
    "funded draft history was mutable",
    "funded final history was mutable",
    "supported writer receipt-to-audit cardinality changed",
    "v5 receipt, conflict, or audit cardinality changed",
  ]) assert.ok(fixture.includes(marker), marker);
  assert.equal((fixture.match(/sqlerrm<>'immutable history'/g) ?? []).length, 4);
  assert.match(fixture, /operation_type='save_event_settlement_draft_v5'\)<>4/);
  assert.match(fixture, /operation_type='finalize_event_settlement_v2'\)<>3/);
  assert.match(fixture, /event_settlement_conflicts_v5[\s\S]{0,120}\)<>3/);
  assert.match(fixture, /entity_type='event_settlement_v5'\)<>10/);
});

test("funded fixture is explicit about synthetic foundation and always rolls back", () => {
  assert.match(fixture, /does not represent a played tournament/);
  assert.match(fixture, /direct synthetic setup/);
  assert.equal((fixture.match(/\\ir \.\.\/database\/migrations\/0240_versioned_settlement_v5\.sql/g) ?? []).length, 1);
  assert.match(fixture, /supported financial operation receipt counts changed/);
  assert.match(fixture, /FUNDED_SETTLEMENT_V5_SUPPORTED_LEDGER_AND_FINALIZATION_PASSED/);
  assert.match(fixture, /set constraints all immediate;\s*rollback;\s*$/);
  assert.doesNotMatch(fixture, /disable trigger|session_replication_role|alter table[\s\S]{0,80}disable/i);
});
