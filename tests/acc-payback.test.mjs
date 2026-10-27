import assert from "node:assert/strict";
import test from "node:test";

import { accPaybackSourceVersion, validateAccPayback } from "../src/lib/results/acc-payback.ts";

function id(number) {
  return `${number.toString(16).padStart(8, "0")}-accc-4000-8000-${number.toString(16).padStart(12, "0")}`;
}

function canonicalRows(count = 4) {
  const rows = [{ participantId: id(1), qualificationRank: 1, bandStart: 1, bandEnd: 1, eliminatedInRound: null, byesWon: 0 }];
  const depth = Math.log2(count);
  let cursor = 2;
  for (let round = depth; round >= 1; round -= 1) {
    const size = count / 2 ** round;
    const bandStart = cursor;
    const bandEnd = cursor + size - 1;
    for (let index = 0; index < size; index += 1) {
      rows.push({ participantId: id(cursor), qualificationRank: cursor, bandStart, bandEnd, eliminatedInRound: round, byesWon: 0 });
      cursor += 1;
    }
  }
  return rows;
}

function awards(amounts = [14400, 10800, 9000, 9000]) {
  return amounts.map((amountMinor, index) => ({ participantId: id(index + 1), amountMinor, amountBasis: "total_award" }));
}

function eligibility(count = 4) {
  return Array.from({ length: count }, (_, index) => ({ participantId: id(index + 1), basis: "full_entry_cash_eligible", evidenceReference: `Server-reviewed eligibility ${index + 1}` }));
}

function expense(number, category, amountMinor) {
  return { expenseId: id(1000 + number), category, amountMinor, sourceReference: `Recorded expense source ${number}`, evidenceReference: `Recorded expense evidence ${number}` };
}

function input(overrides = {}) {
  return {
    canonicalRows: canonicalRows(),
    canonicalBasis: { mode: "trusted_server_canonical", evidenceReference: "Server canonical result version" },
    eligibilityEvidence: eligibility(),
    bracketCapability: { mode: "no_byes", evidenceReference: "Complete no-bye canonical bracket" },
    grossEntryEvidence: { amountMinor: 48000, sourceReference: "Reviewed gross entry record", evidenceReference: "16 ordinary entries at 3000" },
    independentCashEvidence: { amountMinor: 0, sourceReference: "No independent cash source", evidenceReference: "Reviewed zero independent cash" },
    incomeScope: { mode: "single_event_entry_only", evidenceReference: "Single event income scope" },
    expenses: [expense(1, "sanctioning", 4800)],
    expenseCoverage: { mode: "complete_event_expenses", evidenceReference: "Complete recorded event expense set" },
    settlementAllocation: { eventIncomeMinor: 48000, eventExpenseMinor: 4800, retainedBalanceMinor: 0 },
    prizePolicy: { mode: "equal_elimination_cohorts", scheduleReference: "Director-selected schedule A", sourceReference: "Current Policy Manual chapter 6 III", evidenceReference: "Reviewed schedule evidence" },
    awards: awards(),
    ...overrides,
  };
}

test("returns review-ready totals for the bounded 48000/4800/43200 evidence", () => {
  const result = validateAccPayback(input());
  assert.deepEqual(result, {
    status: "review_ready",
    sourceVersion: accPaybackSourceVersion,
    prizePolicyMode: "equal_elimination_cohorts",
    totals: {
      grossEntryIncomeMinor: 48000,
      eventIncomeMinor: 48000,
      benefitExpenseMinor: 4800,
      operatingExpenseMinor: 0,
      eventExpenseMinor: 4800,
      awardTotalMinor: 43200,
      participantReturnMinor: 48000,
      minimumParticipantReturnMinor: 40800,
    },
  });
});

test("uses exact BigInt 85 percent boundaries without float rounding down", () => {
  const exact = validateAccPayback(input({
    expenses: [expense(1, "sanctioning", 4800), expense(2, "hall_rental", 7200)],
    settlementAllocation: { eventIncomeMinor: 48000, eventExpenseMinor: 12000, retainedBalanceMinor: 0 },
    awards: awards([12000, 10000, 7000, 7000]),
  }));
  assert.equal(exact.status, "review_ready");
  assert.equal(exact.totals.participantReturnMinor, 40800);

  const oneShort = validateAccPayback(input({
    expenses: [expense(1, "sanctioning", 4800), expense(2, "hall_rental", 7201)],
    settlementAllocation: { eventIncomeMinor: 48000, eventExpenseMinor: 12001, retainedBalanceMinor: 0 },
    awards: awards([11999, 10000, 7000, 7000]),
  }));
  assert.deepEqual(oneShort, { status: "blocked", code: "insufficient_participant_return" });

  const fractionalCent = validateAccPayback(input({
    grossEntryEvidence: { amountMinor: 101, sourceReference: "Reviewed gross", evidenceReference: "101-cent boundary" },
    expenses: [expense(1, "cards", 16)],
    settlementAllocation: { eventIncomeMinor: 101, eventExpenseMinor: 16, retainedBalanceMinor: 0 },
    awards: awards([31, 22, 16, 16]),
  }));
  assert.deepEqual(fractionalCent, { status: "blocked", code: "insufficient_participant_return" });
});

test("requires exactly one positive total award for every eligible qualifier", () => {
  assert.deepEqual(validateAccPayback(input({ awards: [...awards().slice(0, 3), awards()[2]] })), { status: "blocked", code: "duplicate_award" });
  assert.deepEqual(validateAccPayback(input({ awards: awards().slice(0, 3) })), { status: "blocked", code: "qualifier_award_missing" });
  assert.deepEqual(validateAccPayback(input({ awards: [...awards().slice(0, 3), { ...awards()[3], participantId: id(99) }] })), { status: "blocked", code: "ineligible_award" });
  assert.deepEqual(validateAccPayback(input({ awards: awards([23400, 10800, 9000, 0]) })), { status: "blocked", code: "non_positive_qualifier_award" });
  assert.deepEqual(validateAccPayback(input({ awards: awards().map((row) => ({ ...row, amountBasis: "incremental_award" })) })), { status: "blocked", code: "invalid_input" });
});

test("enforces equal amounts within canonical elimination cohorts and blocks alternates", () => {
  assert.deepEqual(validateAccPayback(input({ awards: awards([14400, 10800, 8999, 9001]) })), { status: "blocked", code: "equal_cohort_award_mismatch" });
  assert.deepEqual(validateAccPayback(input({ prizePolicy: { ...input().prizePolicy, mode: "alternate_unverified" } })), { status: "blocked", code: "unsupported_prize_policy" });
  assert.deepEqual(validateAccPayback(input({ prizePolicy: { ...input().prizePolicy, scheduleReference: "" } })), { status: "blocked", code: "invalid_input" });
});

test("separates reviewed gross evidence from allocation and catches double deduction", () => {
  assert.deepEqual(validateAccPayback(input({ settlementAllocation: { eventIncomeMinor: 43200, eventExpenseMinor: 4800, retainedBalanceMinor: 0 } })), { status: "blocked", code: "settlement_income_source_mismatch" });
  assert.deepEqual(validateAccPayback(input({ settlementAllocation: { eventIncomeMinor: 48000, eventExpenseMinor: 4799, retainedBalanceMinor: 0 } })), { status: "blocked", code: "expense_total_mismatch" });
  assert.deepEqual(validateAccPayback(input({ awards: awards([14399, 10800, 9000, 9000]) })), { status: "blocked", code: "non_conserving_allocation" });
  assert.deepEqual(validateAccPayback(input({ awards: awards([13400, 10800, 9000, 9000]), settlementAllocation: { eventIncomeMinor: 48000, eventExpenseMinor: 4800, retainedBalanceMinor: 1000 } })), { status: "blocked", code: "retained_balance_requires_resolution" });
});

test("classifies only current sourced benefit and operating categories", () => {
  for (const category of ["sanctioning", "meals", "coffee", "donuts", "pastries", "snacks", "charity", "trophies"]) {
    const result = validateAccPayback(input({ expenses: [expense(1, category, 4800)] }));
    assert.equal(result.status, "review_ready", category);
    assert.equal(result.totals.benefitExpenseMinor, 4800, category);
  }
  for (const category of ["cards", "printing", "advertising", "postage", "telephone", "supplies", "hall_rental"]) {
    const result = validateAccPayback(input({ expenses: [expense(1, category, 4800)] }));
    assert.equal(result.status, "review_ready", category);
    assert.equal(result.totals.operatingExpenseMinor, 4800, category);
  }
  assert.deepEqual(validateAccPayback(input({ expenses: [expense(1, "souvenirs", 4800)] })), { status: "blocked", code: "unknown_expense_category" });
  assert.deepEqual(validateAccPayback(input({ expenses: [expense(1, "unknown", 4800)] })), { status: "blocked", code: "unknown_expense_category" });
  assert.deepEqual(validateAccPayback(input({ expenses: [{ ...expense(1, "sanctioning", 4800), evidenceReference: "" }] })), { status: "blocked", code: "invalid_input" });
});

test("blocks unsupported eligibility, byes, income, and incomplete evidence scope", () => {
  assert.deepEqual(validateAccPayback(input({ eligibilityEvidence: eligibility().slice(0, 3) })), { status: "blocked", code: "unsupported_eligibility_basis" });
  assert.deepEqual(validateAccPayback(input({ eligibilityEvidence: [...eligibility().slice(0, 3), eligibility()[2]] })), { status: "blocked", code: "unsupported_eligibility_basis" });
  assert.deepEqual(validateAccPayback(input({ eligibilityEvidence: [...eligibility().slice(0, 3), { participantId: id(99), basis: "full_entry_cash_eligible", evidenceReference: "Outsider" }] })), { status: "blocked", code: "unsupported_eligibility_basis" });
  assert.deepEqual(validateAccPayback(input({ eligibilityEvidence: eligibility().map((row, index) => index === 0 ? { ...row, basis: "fee_exempt_or_unknown" } : row) })), { status: "blocked", code: "unsupported_eligibility_basis" });
  assert.deepEqual(validateAccPayback(input({ bracketCapability: { mode: "caller_verified_byes", evidenceReference: "Caller statement" } })), { status: "blocked", code: "unsupported_byes" });
  const withBye = canonicalRows(); withBye[0] = { ...withBye[0], byesWon: 1 };
  assert.deepEqual(validateAccPayback(input({ canonicalRows: withBye })), { status: "blocked", code: "unsupported_byes" });
  const sixWithBye = Array.from({ length: 6 }, (_, index) => ({ participantId: id(index + 1), qualificationRank: index + 1, bandStart: index + 1, bandEnd: index + 1, eliminatedInRound: index === 0 ? null : 1, byesWon: index === 0 ? 1 : 0 }));
  assert.deepEqual(validateAccPayback(input({ canonicalRows: sixWithBye, eligibilityEvidence: eligibility(6), awards: sixWithBye.map((row) => ({ participantId: row.participantId, amountMinor: 100, amountBasis: "total_award" })) })), { status: "blocked", code: "unsupported_byes" });
  assert.deepEqual(validateAccPayback(input({ independentCashEvidence: { amountMinor: 1, sourceReference: "Donation", evidenceReference: "Donation evidence" } })), { status: "blocked", code: "unsupported_income_source" });
  assert.deepEqual(validateAccPayback(input({ incomeScope: { mode: "unsupported_other_income", evidenceReference: "Q or side income" } })), { status: "blocked", code: "unsupported_income_source" });
  assert.deepEqual(validateAccPayback(input({ expenseCoverage: { mode: "incomplete_or_unknown", evidenceReference: "Missing expense coverage" } })), { status: "blocked", code: "incomplete_expense_coverage" });
  assert.deepEqual(validateAccPayback(input({ canonicalBasis: { mode: "untrusted_or_unknown", evidenceReference: "Untrusted rows" } })), { status: "blocked", code: "unsupported_canonical_basis" });
});

test("accepts complete no-bye canonical cohorts from 4 through 256", () => {
  for (const count of [4, 8, 16, 32, 64, 128, 256]) {
    const rows = canonicalRows(count);
    const result = validateAccPayback(input({
      canonicalRows: rows,
      eligibilityEvidence: eligibility(count),
      grossEntryEvidence: { amountMinor: count * 100, sourceReference: "Reviewed gross", evidenceReference: `${count} entries` },
      expenses: [],
      settlementAllocation: { eventIncomeMinor: count * 100, eventExpenseMinor: 0, retainedBalanceMinor: 0 },
      awards: rows.map((row) => ({ participantId: row.participantId, amountMinor: 100, amountBasis: "total_award" })),
    }));
    assert.equal(result.status, "review_ready", String(count));
  }
  const malformed = canonicalRows(8); malformed[7] = { ...malformed[7], bandStart: 7, bandEnd: 8 };
  assert.deepEqual(validateAccPayback(input({ canonicalRows: malformed, eligibilityEvidence: eligibility(8), awards: malformed.map((row) => ({ participantId: row.participantId, amountMinor: 100, amountBasis: "total_award" })) })), { status: "blocked", code: "invalid_input" });
});

test("is exact-key, deterministic, and does not mutate frozen evidence", () => {
  const value = input();
  const snapshot = structuredClone(value);
  for (const row of value.canonicalRows) Object.freeze(row);
  for (const row of value.awards) Object.freeze(row);
  for (const row of value.expenses) Object.freeze(row);
  Object.freeze(value.canonicalRows); Object.freeze(value.awards); Object.freeze(value.expenses); Object.freeze(value);
  assert.deepEqual(validateAccPayback(value), validateAccPayback(value));
  assert.deepEqual(value, snapshot);
  assert.deepEqual(validateAccPayback({ ...snapshot, callerFormula: "85%" }), { status: "blocked", code: "invalid_input" });
});
