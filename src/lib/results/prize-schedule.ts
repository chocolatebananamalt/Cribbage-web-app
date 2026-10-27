export const directorPrizeScheduleVersion = "director-selected-prize-schedule-v1" as const;

export type PrizeScheduleCohortV1 = {
  bandStart: number;
  bandEnd: number;
  weight: number;
};

export type DirectorPrizeScheduleV1 = {
  kind: typeof directorPrizeScheduleVersion;
  amountBasis: "total_award";
  expectedQualifierCount: 4;
  sourceReference: string;
  roundingRule: "floor_each_weighted_share_then_assign_remainder_to_champion";
  cohorts: PrizeScheduleCohortV1[];
};

export type PrizeScheduleCanonicalRow = {
  participantId: string;
  bandStart: number;
  bandEnd: number;
  byeWins: number;
};

export type PrizeScheduleExpense = {
  expenseId: string;
  amountMinor: number;
  approvalStatus: "approved" | "unapproved_or_unknown";
};

export type PrizeScheduleFinancialBasis = {
  status: "estimate";
  estimatedGrossEntryIncomeMinor: number;
  estimatedExpenseMinor: number;
} | {
  status: "resolved";
  grossEntryIncomeMinor: number;
  retainedBalanceMinor: number;
  expenseEvidence: {
    status: "complete" | "incomplete_or_unknown";
    items: PrizeScheduleExpense[];
  };
};

export type PrizeScheduleInput = {
  schedule: DirectorPrizeScheduleV1;
  scope: {
    eventKind: "main" | "other";
    styleCode: "Standard" | "other";
    format: "standard_singles" | "other";
    gameCount: number;
    eventMode: "single_event" | "multiple_or_unknown";
    bracketMode: "complete_no_bye" | "byes_or_unknown";
    poolMode: "none" | "pools_present_or_unknown";
  };
  financialBasis: PrizeScheduleFinancialBasis;
  canonicalRows: PrizeScheduleCanonicalRow[];
};

export type PrizeScheduleAward = {
  participantId: string;
  bandStart: number;
  bandEnd: number;
  weight: number;
  totalAwardMinor: number;
};

export type PrizeScheduleAvailable = {
  status: "available";
  scheduleVersion: typeof directorPrizeScheduleVersion;
  amountBasis: "total_award";
  expectedQualifierCount: 4;
  grossEntryIncomeMinor: number;
  expenseTotalMinor: number;
  prizeBudgetMinor: number;
  weightDenominator: number;
  roundingRemainderMinor: number;
  roundingRule: "floor_each_weighted_share_then_assign_remainder_to_champion";
  awards: PrizeScheduleAward[];
};

export type PrizeScheduleBlockCode =
  | "invalid_input"
  | "unsupported_scope"
  | "actual_financials_required"
  | "incomplete_expense_evidence"
  | "retained_balance_requires_resolution"
  | "schedule_revision_required"
  | "non_positive_prize_budget"
  | "non_positive_award";

export type PrizeScheduleResult = PrizeScheduleAvailable | {
  status: "blocked";
  code: PrizeScheduleBlockCode;
};

const maximumSafe = BigInt(Number.MAX_SAFE_INTEGER);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rootKeys = ["canonicalRows", "financialBasis", "schedule", "scope"];
const scheduleKeys = ["amountBasis", "cohorts", "expectedQualifierCount", "kind", "roundingRule", "sourceReference"];
const cohortFieldKeys = ["bandEnd", "bandStart", "weight"];
const scopeKeys = ["bracketMode", "eventKind", "eventMode", "format", "gameCount", "poolMode", "styleCode"];
const canonicalKeys = ["bandEnd", "bandStart", "byeWins", "participantId"];
const estimateKeys = ["estimatedExpenseMinor", "estimatedGrossEntryIncomeMinor", "status"];
const resolvedKeys = ["expenseEvidence", "grossEntryIncomeMinor", "retainedBalanceMinor", "status"];
const coverageKeys = ["items", "status"];
const expenseKeys = ["amountMinor", "approvalStatus", "expenseId"];

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function whole(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function reference(value: unknown) {
  return typeof value === "string" && value.length >= 1 && value.length <= 500
    && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function blocked(code: PrizeScheduleBlockCode): PrizeScheduleResult {
  return { status: "blocked", code };
}

function bandKey(bandStart: number, bandEnd: number) {
  return `${bandStart}:${bandEnd}`;
}

export function isDirectorPrizeScheduleV1(value: unknown): value is DirectorPrizeScheduleV1 {
  if (!record(value) || !exact(value, scheduleKeys) || value.kind !== directorPrizeScheduleVersion
    || value.amountBasis !== "total_award" || value.expectedQualifierCount !== 4
    || !reference(value.sourceReference)
    || value.roundingRule !== "floor_each_weighted_share_then_assign_remainder_to_champion"
    || !Array.isArray(value.cohorts) || value.cohorts.length !== 3
    || value.cohorts.some((item) => !record(item) || !exact(item, cohortFieldKeys)
      || !whole(item.bandStart, 1) || !whole(item.bandEnd, item.bandStart as number) || !whole(item.weight, 1))) return false;
  const cohorts = value.cohorts as unknown as PrizeScheduleCohortV1[];
  const bands = cohorts.map((item) => bandKey(item.bandStart, item.bandEnd));
  if (new Set(bands).size !== cohorts.length || !["1:1", "2:2", "3:4"].every((key) => bands.includes(key))) return false;
  const denominator = cohorts.reduce((sum, cohort) => sum + BigInt(cohort.weight) * BigInt(cohort.bandEnd - cohort.bandStart + 1), BigInt(0));
  return denominator > BigInt(0) && denominator <= maximumSafe;
}

/**
 * Resolves a director-selected total-award schedule against authoritative,
 * resolved server facts. It does not authenticate evidence, determine who
 * qualified, approve expenses, enforce ACC payback, or persist a settlement.
 */
export function resolveDirectorPrizeScheduleV1(input: unknown): PrizeScheduleResult {
  if (!record(input) || !exact(input, rootKeys) || !record(input.schedule)
    || !exact(input.schedule, scheduleKeys) || !record(input.scope) || !exact(input.scope, scopeKeys)
    || !record(input.financialBasis) || !Array.isArray(input.canonicalRows)) return blocked("invalid_input");

  const schedule = input.schedule;
  if (!isDirectorPrizeScheduleV1(schedule)) return blocked("invalid_input");
  const cohorts = schedule.cohorts;
  const scheduledBands = cohorts.map((item) => bandKey(item.bandStart, item.bandEnd));

  const scope = input.scope;
  if (scope.eventKind !== "main" || scope.styleCode !== "Standard" || scope.format !== "standard_singles"
    || scope.gameCount !== 12 || scope.eventMode !== "single_event"
    || scope.bracketMode !== "complete_no_bye" || scope.poolMode !== "none") return blocked("unsupported_scope");

  const rows = input.canonicalRows;
  if (rows.some((item) => !record(item) || !exact(item, canonicalKeys) || !uuid(item.participantId)
    || !whole(item.bandStart, 1) || !whole(item.bandEnd, item.bandStart as number) || !whole(item.byeWins))) {
    return blocked("invalid_input");
  }
  const canonicalRows = rows as unknown as PrizeScheduleCanonicalRow[];
  if (canonicalRows.some((item) => item.byeWins !== 0)) return blocked("unsupported_scope");
  const participantIds = canonicalRows.map((item) => item.participantId.toLowerCase());
  const actualBands = canonicalRows.map((item) => bandKey(item.bandStart, item.bandEnd));
  if (canonicalRows.length !== 4 || new Set(participantIds).size !== canonicalRows.length
    || actualBands.filter((band) => band === "1:1").length !== 1
    || actualBands.filter((band) => band === "2:2").length !== 1
    || actualBands.filter((band) => band === "3:4").length !== 2
    || actualBands.some((band) => !scheduledBands.includes(band))) return blocked("schedule_revision_required");

  const basis = input.financialBasis;
  if (basis.status === "estimate") {
    if (!exact(basis, estimateKeys) || !whole(basis.estimatedGrossEntryIncomeMinor)
      || !whole(basis.estimatedExpenseMinor)) return blocked("invalid_input");
    return blocked("actual_financials_required");
  }
  if (basis.status !== "resolved" || !exact(basis, resolvedKeys)
    || !whole(basis.grossEntryIncomeMinor) || !whole(basis.retainedBalanceMinor)
    || !record(basis.expenseEvidence) || !exact(basis.expenseEvidence, coverageKeys)
    || !Array.isArray(basis.expenseEvidence.items) || basis.expenseEvidence.items.length > 256) {
    return blocked("invalid_input");
  }
  if (basis.retainedBalanceMinor !== 0) return blocked("retained_balance_requires_resolution");
  if (basis.expenseEvidence.status !== "complete") return blocked("incomplete_expense_evidence");
  const expenses = basis.expenseEvidence.items;
  if (expenses.some((item) => !record(item) || !exact(item, expenseKeys) || !uuid(item.expenseId)
    || !whole(item.amountMinor) || (item.approvalStatus !== "approved" && item.approvalStatus !== "unapproved_or_unknown"))) {
    return blocked("invalid_input");
  }
  const expenseRows = expenses as unknown as PrizeScheduleExpense[];
  if (new Set(expenseRows.map((item) => item.expenseId.toLowerCase())).size !== expenseRows.length
    || expenseRows.some((item) => item.approvalStatus !== "approved")) return blocked("incomplete_expense_evidence");

  const expenseTotal = expenseRows.reduce((sum, item) => sum + BigInt(item.amountMinor), BigInt(0));
  const gross = BigInt(basis.grossEntryIncomeMinor);
  if (expenseTotal > maximumSafe) return blocked("invalid_input");
  const budget = gross - expenseTotal;
  if (budget <= BigInt(0)) return blocked("non_positive_prize_budget");

  const cohortByBand = new Map(cohorts.map((item) => [bandKey(item.bandStart, item.bandEnd), item]));
  const denominator = canonicalRows.reduce((sum, row) => sum + BigInt(cohortByBand.get(bandKey(row.bandStart, row.bandEnd))!.weight), BigInt(0));
  if (denominator > maximumSafe) return blocked("invalid_input");
  const calculated = canonicalRows.map((row) => {
    const cohort = cohortByBand.get(bandKey(row.bandStart, row.bandEnd))!;
    return { row, cohort, amount: budget * BigInt(cohort.weight) / denominator };
  });
  const allocated = calculated.reduce((sum, item) => sum + item.amount, BigInt(0));
  const remainder = budget - allocated;
  const champion = calculated.find((item) => item.row.bandStart === 1 && item.row.bandEnd === 1)!;
  champion.amount += remainder;
  if (calculated.some((item) => item.amount <= BigInt(0))) return blocked("non_positive_award");

  const awards = calculated.map((item) => ({
    participantId: item.row.participantId,
    bandStart: item.row.bandStart,
    bandEnd: item.row.bandEnd,
    weight: item.cohort.weight,
    totalAwardMinor: Number(item.amount),
  })).sort((left, right) => left.bandStart - right.bandStart || left.participantId.localeCompare(right.participantId));

  return {
    status: "available",
    scheduleVersion: directorPrizeScheduleVersion,
    amountBasis: "total_award",
    expectedQualifierCount: 4,
    grossEntryIncomeMinor: basis.grossEntryIncomeMinor,
    expenseTotalMinor: Number(expenseTotal),
    prizeBudgetMinor: Number(budget),
    weightDenominator: Number(denominator),
    roundingRemainderMinor: Number(remainder),
    roundingRule: "floor_each_weighted_share_then_assign_remainder_to_champion",
    awards,
  };
}
