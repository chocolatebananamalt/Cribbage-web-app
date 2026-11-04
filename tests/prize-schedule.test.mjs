import assert from "node:assert/strict";
import test from "node:test";

import { directorPrizeScheduleVersion, isDirectorPrizeScheduleV1, resolveDirectorPrizeScheduleV1 } from "../src/lib/results/prize-schedule.ts";

function id(number) {
  return `${number.toString(16).padStart(8, "0")}-acc5-4000-8000-${number.toString(16).padStart(12, "0")}`;
}

function schedule() {
  return {
    kind: directorPrizeScheduleVersion,
    amountBasis: "total_award",
    expectedQualifierCount: 4,
    sourceReference: "Director-selected schedule reviewed for this event",
    roundingRule: "floor_each_weighted_share_then_assign_remainder_to_champion",
    cohorts: [
      { bandStart: 1, bandEnd: 1, weight: 4 },
      { bandStart: 2, bandEnd: 2, weight: 3 },
      { bandStart: 3, bandEnd: 4, weight: 2 },
    ],
  };
}

function rows() {
  return [
    { participantId: id(1), bandStart: 1, bandEnd: 1, byeWins: 0 },
    { participantId: id(2), bandStart: 2, bandEnd: 2, byeWins: 0 },
    { participantId: id(3), bandStart: 3, bandEnd: 4, byeWins: 0 },
    { participantId: id(4), bandStart: 3, bandEnd: 4, byeWins: 0 },
  ];
}

function expense(number, amountMinor, approvalStatus = "approved") {
  return { expenseId: id(100 + number), amountMinor, approvalStatus };
}

function resolvedFinancials(overrides = {}) {
  return {
    status: "resolved",
    grossEntryIncomeMinor: 48000,
    retainedBalanceMinor: 0,
    expenseEvidence: { status: "complete", items: [expense(1, 21600)] },
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    schedule: schedule(),
    scope: { eventKind: "main", styleCode: "Standard", format: "standard_singles", gameCount: 12, eventMode: "single_event", bracketMode: "complete_no_bye", poolMode: "none" },
    financialBasis: resolvedFinancials(),
    canonicalRows: rows(),
    ...overrides,
  };
}

test("resolves the reviewed 26400-cent budget into total awards 9600/7200/4800/4800", () => {
  const result = resolveDirectorPrizeScheduleV1(input());
  assert.deepEqual(result, {
    status: "available",
    scheduleVersion: directorPrizeScheduleVersion,
    amountBasis: "total_award",
    expectedQualifierCount: 4,
    grossEntryIncomeMinor: 48000,
    expenseTotalMinor: 21600,
    prizeBudgetMinor: 26400,
    weightDenominator: 11,
    roundingRemainderMinor: 0,
    roundingRule: "floor_each_weighted_share_then_assign_remainder_to_champion",
    awards: [
      { participantId: id(1), bandStart: 1, bandEnd: 1, weight: 4, totalAwardMinor: 9600 },
      { participantId: id(2), bandStart: 2, bandEnd: 2, weight: 3, totalAwardMinor: 7200 },
      { participantId: id(3), bandStart: 3, bandEnd: 4, weight: 2, totalAwardMinor: 4800 },
      { participantId: id(4), bandStart: 3, bandEnd: 4, weight: 2, totalAwardMinor: 4800 },
    ],
  });
});

test("floors each per-person weighted share and assigns every remaining cent only to champion", () => {
  const result = resolveDirectorPrizeScheduleV1(input({
    financialBasis: resolvedFinancials({ grossEntryIncomeMinor: 12, expenseEvidence: { status: "complete", items: [] } }),
  }));
  assert.equal(result.status, "available");
  assert.equal(result.roundingRemainderMinor, 1);
  assert.deepEqual(result.awards.map((award) => award.totalAwardMinor), [5, 3, 2, 2]);
  assert.equal(result.awards[2].totalAwardMinor, result.awards[3].totalAwardMinor);
  assert.equal(result.awards.reduce((sum, award) => sum + award.totalAwardMinor, 0), 12);
});

test("keeps estimates visibly non-authoritative and requires resolved actual financials", () => {
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    financialBasis: { status: "estimate", estimatedGrossEntryIncomeMinor: 48000, estimatedExpenseMinor: 21600 },
  })), { status: "blocked", code: "actual_financials_required" });
});

test("rejects unsafe integers, zero weights, and budgets too small for positive awards", () => {
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    financialBasis: resolvedFinancials({ grossEntryIncomeMinor: Number.MAX_SAFE_INTEGER + 1 }),
  })), { status: "blocked", code: "invalid_input" });
  const zeroWeight = schedule();
  zeroWeight.cohorts[2].weight = 0;
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({ schedule: zeroWeight })), { status: "blocked", code: "invalid_input" });
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    financialBasis: resolvedFinancials({ grossEntryIncomeMinor: 3, expenseEvidence: { status: "complete", items: [] } }),
  })), { status: "blocked", code: "non_positive_award" });
});

test("requires the exact four-player 1, 2, and equal 3-4 cohort schedule", () => {
  const missing = schedule();
  missing.cohorts = missing.cohorts.slice(0, 2);
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({ schedule: missing })), { status: "blocked", code: "invalid_input" });

  const duplicate = schedule();
  duplicate.cohorts[2] = { ...duplicate.cohorts[1] };
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({ schedule: duplicate })), { status: "blocked", code: "invalid_input" });

  const missingQualifier = rows().slice(0, 3);
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({ canonicalRows: missingQualifier })), { status: "blocked", code: "schedule_revision_required" });

  const wrongBand = rows();
  wrongBand[3] = { ...wrongBand[3], bandStart: 4, bandEnd: 4 };
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({ canonicalRows: wrongBand })), { status: "blocked", code: "schedule_revision_required" });
});

test("blocks byes, pools, and bracket-count mismatch rather than expanding the schedule", () => {
  const byeRows = rows();
  byeRows[0] = { ...byeRows[0], byeWins: 1 };
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({ canonicalRows: byeRows })), { status: "blocked", code: "unsupported_scope" });
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    scope: { eventKind: "main", styleCode: "Standard", format: "standard_singles", gameCount: 12, eventMode: "single_event", bracketMode: "complete_no_bye", poolMode: "pools_present_or_unknown" },
  })), { status: "blocked", code: "unsupported_scope" });
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    canonicalRows: [...rows(), ...rows().map((row, index) => ({ ...row, participantId: id(index + 10) }))],
  })), { status: "blocked", code: "schedule_revision_required" });
});

test("requires exact Main 12 and single-event scope tags", () => {
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    scope: { eventKind: "main", styleCode: "Standard", format: "standard_singles", gameCount: 14, eventMode: "single_event", bracketMode: "complete_no_bye", poolMode: "none" },
  })), { status: "blocked", code: "unsupported_scope" });
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    scope: { eventKind: "main", styleCode: "Standard", format: "standard_singles", gameCount: 12, eventMode: "multiple_or_unknown", bracketMode: "complete_no_bye", poolMode: "none" },
  })), { status: "blocked", code: "unsupported_scope" });
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    scope: { eventKind: "main", styleCode: "other", format: "standard_singles", gameCount: 12, eventMode: "single_event", bracketMode: "complete_no_bye", poolMode: "none" },
  })), { status: "blocked", code: "unsupported_scope" });
});

test("requires complete approved expense evidence, zero retained balance, and a positive budget", () => {
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    financialBasis: resolvedFinancials({ expenseEvidence: { status: "incomplete_or_unknown", items: [] } }),
  })), { status: "blocked", code: "incomplete_expense_evidence" });
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    financialBasis: resolvedFinancials({ expenseEvidence: { status: "complete", items: [expense(1, 21600, "unapproved_or_unknown")] } }),
  })), { status: "blocked", code: "incomplete_expense_evidence" });
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    financialBasis: resolvedFinancials({ retainedBalanceMinor: 1 }),
  })), { status: "blocked", code: "retained_balance_requires_resolution" });
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({
    financialBasis: resolvedFinancials({ expenseEvidence: { status: "complete", items: [expense(1, 48000)] } }),
  })), { status: "blocked", code: "non_positive_prize_budget" });
});

test("enforces exact tagged contracts and the saved rounding rule", () => {
  assert.equal(isDirectorPrizeScheduleV1(schedule()), true);
  const missingKind = structuredClone(schedule());
  delete missingKind.kind;
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({ schedule: missingKind })), { status: "blocked", code: "invalid_input" });
  const changedRule = schedule();
  changedRule.roundingRule = "largest_remainder";
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({ schedule: changedRule })), { status: "blocked", code: "invalid_input" });
  const extra = input();
  extra.schedule.extra = true;
  assert.deepEqual(resolveDirectorPrizeScheduleV1(extra), { status: "blocked", code: "invalid_input" });
  const invalidUuid = rows();
  invalidUuid[0] = { ...invalidUuid[0], participantId: "00000001-acc5-0000-0000-000000000001" };
  assert.deepEqual(resolveDirectorPrizeScheduleV1(input({ canonicalRows: invalidUuid })), { status: "blocked", code: "invalid_input" });
});

test("is deterministic across canonical row order and does not mutate frozen evidence", () => {
  const first = input();
  const second = input({ canonicalRows: [...rows()].reverse() });
  const snapshot = structuredClone(first);
  Object.freeze(first.schedule.cohorts);
  Object.freeze(first.schedule);
  Object.freeze(first.canonicalRows);
  Object.freeze(first);
  assert.deepEqual(resolveDirectorPrizeScheduleV1(first), resolveDirectorPrizeScheduleV1(second));
  assert.deepEqual(first, snapshot);
});
