export const accPaybackSourceVersion = "acc-payback-review-v1" as const;

export const accBenefitExpenseCategories = [
  "sanctioning", "meals", "coffee", "donuts", "pastries", "snacks", "charity", "trophies",
] as const;
export const accOperatingExpenseCategories = [
  "cards", "printing", "advertising", "postage", "telephone", "supplies", "hall_rental",
] as const;

export type AccBenefitExpenseCategory = typeof accBenefitExpenseCategories[number];
export type AccOperatingExpenseCategory = typeof accOperatingExpenseCategories[number];
export type AccExpenseCategory = AccBenefitExpenseCategory | AccOperatingExpenseCategory;

export type AccPaybackCanonicalRow = {
  participantId: string;
  qualificationRank: number;
  bandStart: number;
  bandEnd: number;
  eliminatedInRound: number | null;
  byesWon: number;
};

export type AccPaybackEvidence = {
  amountMinor: number;
  sourceReference: string;
  evidenceReference: string;
};

export type AccPaybackExpense = {
  expenseId: string;
  category: AccExpenseCategory | "souvenirs" | "unknown";
  amountMinor: number;
  sourceReference: string;
  evidenceReference: string;
};

export type AccPaybackAward = {
  participantId: string;
  amountMinor: number;
  amountBasis: "total_award";
};

export type AccPaybackEligibilityEvidence = {
  participantId: string;
  basis: "full_entry_cash_eligible" | "fee_exempt_or_unknown";
  evidenceReference: string;
};

export type AccPaybackInput = {
  canonicalRows: AccPaybackCanonicalRow[];
  canonicalBasis: {
    mode: "trusted_server_canonical" | "untrusted_or_unknown";
    evidenceReference: string;
  };
  eligibilityEvidence: AccPaybackEligibilityEvidence[];
  bracketCapability: {
    mode: "no_byes" | "caller_verified_byes";
    evidenceReference: string;
  };
  grossEntryEvidence: AccPaybackEvidence;
  independentCashEvidence: AccPaybackEvidence;
  incomeScope: {
    mode: "single_event_entry_only" | "unsupported_other_income";
    evidenceReference: string;
  };
  expenses: AccPaybackExpense[];
  expenseCoverage: {
    mode: "complete_event_expenses" | "incomplete_or_unknown";
    evidenceReference: string;
  };
  settlementAllocation: {
    eventIncomeMinor: number;
    eventExpenseMinor: number;
    retainedBalanceMinor: number;
  };
  prizePolicy: {
    mode: "equal_elimination_cohorts" | "alternate_unverified";
    scheduleReference: string;
    sourceReference: string;
    evidenceReference: string;
  };
  awards: AccPaybackAward[];
};

export type AccPaybackTotals = {
  grossEntryIncomeMinor: number;
  eventIncomeMinor: number;
  benefitExpenseMinor: number;
  operatingExpenseMinor: number;
  eventExpenseMinor: number;
  awardTotalMinor: number;
  participantReturnMinor: number;
  minimumParticipantReturnMinor: number;
};

export type AccPaybackReviewReady = {
  status: "review_ready";
  sourceVersion: typeof accPaybackSourceVersion;
  prizePolicyMode: AccPaybackInput["prizePolicy"]["mode"];
  totals: AccPaybackTotals;
};

export type AccPaybackBlockCode =
  | "invalid_input"
  | "unsupported_canonical_basis"
  | "unsupported_eligibility_basis"
  | "unsupported_byes"
  | "unsupported_income_source"
  | "unknown_expense_category"
  | "incomplete_expense_coverage"
  | "unsupported_prize_policy"
  | "duplicate_award"
  | "ineligible_award"
  | "qualifier_award_missing"
  | "non_positive_qualifier_award"
  | "equal_cohort_award_mismatch"
  | "settlement_income_source_mismatch"
  | "expense_total_mismatch"
  | "non_conserving_allocation"
  | "retained_balance_requires_resolution"
  | "insufficient_participant_return";

export type AccPaybackBlocked = { status: "blocked"; code: AccPaybackBlockCode };
export type AccPaybackResult = AccPaybackReviewReady | AccPaybackBlocked;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maximumSafe = BigInt(Number.MAX_SAFE_INTEGER);
const benefitCategories = new Set<string>(accBenefitExpenseCategories);
const operatingCategories = new Set<string>(accOperatingExpenseCategories);
const rootKeys = ["awards", "bracketCapability", "canonicalBasis", "canonicalRows", "eligibilityEvidence", "expenseCoverage", "expenses", "grossEntryEvidence", "incomeScope", "independentCashEvidence", "prizePolicy", "settlementAllocation"];
const rowKeys = ["bandEnd", "bandStart", "byesWon", "eliminatedInRound", "participantId", "qualificationRank"];
const evidenceKeys = ["amountMinor", "evidenceReference", "sourceReference"];
const expenseKeys = ["amountMinor", "category", "evidenceReference", "expenseId", "sourceReference"];
const awardKeys = ["amountBasis", "amountMinor", "participantId"];
const eligibilityKeys = ["basis", "evidenceReference", "participantId"];
const capabilityKeys = ["evidenceReference", "mode"];
const allocationKeys = ["eventExpenseMinor", "eventIncomeMinor", "retainedBalanceMinor"];
const policyKeys = ["evidenceReference", "mode", "scheduleReference", "sourceReference"];

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function whole(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function reference(value: unknown) {
  return typeof value === "string" && value.length >= 1 && value.length <= 500
    && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function normalized(value: string) {
  return value.toLowerCase();
}

function blocked(code: AccPaybackBlockCode): AccPaybackBlocked {
  return { status: "blocked", code };
}

function safeTotal(values: number[]) {
  const total = values.reduce((sum, value) => sum + BigInt(value), BigInt(0));
  return total <= maximumSafe ? total : null;
}

function completeNoByeCohorts(rows: AccPaybackCanonicalRow[]) {
  const count = rows.length;
  if ((count & (count - 1)) !== 0) return false;
  const champion = rows.filter((row) => row.bandStart === 1 && row.bandEnd === 1 && row.eliminatedInRound === null);
  if (champion.length !== 1) return false;
  const depth = Math.log2(count);
  let start = 2;
  for (let round = depth; round >= 1; round -= 1) {
    const cohortSize = count / 2 ** round;
    const end = start + cohortSize - 1;
    const cohort = rows.filter((row) => row.bandStart === start && row.bandEnd === end && row.eliminatedInRound === round);
    if (cohort.length !== cohortSize) return false;
    start = end + 1;
  }
  return start === count + 1;
}

/**
 * Pure mathematical and policy validation over supplied trusted-server evidence.
 * Reference strings are identifiers for integration lookup, not authenticity
 * proof. This function does not establish ACC sanction eligibility, actual
 * payment, evidence authenticity, qualification, MRP, authorization, audit, or
 * persistence state.
 */
export function validateAccPayback(input: unknown): AccPaybackResult {
  if (!record(input) || !exact(input, rootKeys) || !Array.isArray(input.canonicalRows)
    || input.canonicalRows.length < 4 || input.canonicalRows.length > 256
    || !record(input.canonicalBasis) || !exact(input.canonicalBasis, capabilityKeys)
    || !Array.isArray(input.eligibilityEvidence) || input.eligibilityEvidence.length > 256
    || !record(input.bracketCapability) || !exact(input.bracketCapability, capabilityKeys)
    || !record(input.grossEntryEvidence) || !exact(input.grossEntryEvidence, evidenceKeys)
    || !record(input.independentCashEvidence) || !exact(input.independentCashEvidence, evidenceKeys)
    || !record(input.incomeScope) || !exact(input.incomeScope, capabilityKeys)
    || !Array.isArray(input.expenses) || input.expenses.length > 256
    || !record(input.expenseCoverage) || !exact(input.expenseCoverage, capabilityKeys)
    || !record(input.settlementAllocation) || !exact(input.settlementAllocation, allocationKeys)
    || !record(input.prizePolicy) || !exact(input.prizePolicy, policyKeys)
    || !Array.isArray(input.awards) || input.awards.length > 256) return blocked("invalid_input");

  const rows = input.canonicalRows;
  if (rows.some((item) => !record(item) || !exact(item, rowKeys) || !uuid(item.participantId)
    || !whole(item.qualificationRank, 1, rows.length) || !whole(item.bandStart, 1, rows.length)
    || !whole(item.bandEnd, item.bandStart as number, rows.length)
    || !(item.eliminatedInRound === null || whole(item.eliminatedInRound, 1, 8))
    || !whole(item.byesWon, 0, 8))) return blocked("invalid_input");
  const canonicalRows = rows as unknown as AccPaybackCanonicalRow[];
  const participantIds = canonicalRows.map((row) => normalized(row.participantId));
  const ranks = canonicalRows.map((row) => row.qualificationRank);
  if (new Set(participantIds).size !== canonicalRows.length || new Set(ranks).size !== canonicalRows.length
    || !Array.from({ length: canonicalRows.length }, (_, index) => index + 1).every((rank) => ranks.includes(rank))) {
    return blocked("invalid_input");
  }

  const canonicalBasis = input.canonicalBasis;
  const bracket = input.bracketCapability;
  const incomeScope = input.incomeScope;
  const expenseCoverage = input.expenseCoverage;
  if (![canonicalBasis, bracket, incomeScope, expenseCoverage].every((item) => reference(item.evidenceReference))) {
    return blocked("invalid_input");
  }
  if (canonicalBasis.mode !== "trusted_server_canonical") return blocked("unsupported_canonical_basis");
  if (bracket.mode !== "no_byes" || canonicalRows.some((row) => row.byesWon !== 0)) return blocked("unsupported_byes");
  if (!completeNoByeCohorts(canonicalRows)) return blocked("invalid_input");
  if (incomeScope.mode !== "single_event_entry_only") return blocked("unsupported_income_source");
  if (expenseCoverage.mode !== "complete_event_expenses") return blocked("incomplete_expense_coverage");

  const eligibilityEvidence = input.eligibilityEvidence;
  if (eligibilityEvidence.some((item) => !record(item) || !exact(item, eligibilityKeys) || !uuid(item.participantId)
    || (item.basis !== "full_entry_cash_eligible" && item.basis !== "fee_exempt_or_unknown")
    || !reference(item.evidenceReference))) return blocked("invalid_input");
  const eligibilityRows = eligibilityEvidence as unknown as AccPaybackEligibilityEvidence[];
  const eligibilityIds = eligibilityRows.map((item) => normalized(item.participantId));
  if (new Set(eligibilityIds).size !== eligibilityRows.length || eligibilityIds.some((id) => !participantIds.includes(id))
    || eligibilityRows.length !== canonicalRows.length || participantIds.some((id) => !eligibilityIds.includes(id))
    || eligibilityRows.some((item) => item.basis !== "full_entry_cash_eligible")) {
    return blocked("unsupported_eligibility_basis");
  }

  const gross = input.grossEntryEvidence;
  const independent = input.independentCashEvidence;
  if (![gross, independent].every((item) => whole(item.amountMinor) && reference(item.sourceReference) && reference(item.evidenceReference))) {
    return blocked("invalid_input");
  }
  if (independent.amountMinor !== 0) return blocked("unsupported_income_source");

  const expenses = input.expenses;
  if (expenses.some((item) => !record(item) || !exact(item, expenseKeys) || !uuid(item.expenseId)
    || !whole(item.amountMinor) || !reference(item.sourceReference) || !reference(item.evidenceReference))) return blocked("invalid_input");
  const expenseRows = expenses as unknown as AccPaybackExpense[];
  if (new Set(expenseRows.map((item) => normalized(item.expenseId))).size !== expenseRows.length) return blocked("invalid_input");
  if (expenseRows.some((item) => !benefitCategories.has(item.category) && !operatingCategories.has(item.category))) {
    return blocked("unknown_expense_category");
  }

  const allocation = input.settlementAllocation;
  if (![allocation.eventIncomeMinor, allocation.eventExpenseMinor, allocation.retainedBalanceMinor].every((value) => whole(value))) {
    return blocked("invalid_input");
  }
  const policy = input.prizePolicy;
  if ((policy.mode !== "equal_elimination_cohorts" && policy.mode !== "alternate_unverified")
    || !reference(policy.scheduleReference) || !reference(policy.sourceReference) || !reference(policy.evidenceReference)) {
    return blocked("invalid_input");
  }
  if (policy.mode !== "equal_elimination_cohorts") return blocked("unsupported_prize_policy");

  const awards = input.awards;
  if (awards.some((item) => !record(item) || !exact(item, awardKeys) || !uuid(item.participantId)
    || item.amountBasis !== "total_award" || !whole(item.amountMinor))) return blocked("invalid_input");
  const awardRows = awards as unknown as AccPaybackAward[];
  const awardIds = awardRows.map((item) => normalized(item.participantId));
  if (new Set(awardIds).size !== awardRows.length) return blocked("duplicate_award");
  const eligible = new Set(participantIds);
  if (awardIds.some((id) => !eligible.has(id))) return blocked("ineligible_award");
  if (awardRows.length !== canonicalRows.length || participantIds.some((id) => !awardIds.includes(id))) {
    return blocked("qualifier_award_missing");
  }
  if (awardRows.some((item) => item.amountMinor <= 0)) return blocked("non_positive_qualifier_award");

  const awardByParticipant = new Map(awardRows.map((item) => [normalized(item.participantId), item.amountMinor]));
  const amountByBand = new Map<string, number>();
  for (const row of canonicalRows) {
    const band = `${row.bandStart}:${row.bandEnd}`;
    const amount = awardByParticipant.get(normalized(row.participantId));
    if (amount === undefined) return blocked("qualifier_award_missing");
    if (amountByBand.has(band) && amountByBand.get(band) !== amount) return blocked("equal_cohort_award_mismatch");
    amountByBand.set(band, amount);
  }

  const benefitTotal = safeTotal(expenseRows.filter((item) => benefitCategories.has(item.category)).map((item) => item.amountMinor));
  const operatingTotal = safeTotal(expenseRows.filter((item) => operatingCategories.has(item.category)).map((item) => item.amountMinor));
  const expenseTotal = safeTotal(expenseRows.map((item) => item.amountMinor));
  const awardTotal = safeTotal(awardRows.map((item) => item.amountMinor));
  if (benefitTotal === null || operatingTotal === null || expenseTotal === null || awardTotal === null) return blocked("invalid_input");

  const grossMinor = BigInt(gross.amountMinor as number);
  const incomeMinor = BigInt(allocation.eventIncomeMinor as number);
  const allocatedExpenseMinor = BigInt(allocation.eventExpenseMinor as number);
  const retainedMinor = BigInt(allocation.retainedBalanceMinor as number);
  if (grossMinor !== incomeMinor) return blocked("settlement_income_source_mismatch");
  if (expenseTotal !== allocatedExpenseMinor) return blocked("expense_total_mismatch");
  if (allocatedExpenseMinor + awardTotal + retainedMinor !== incomeMinor) return blocked("non_conserving_allocation");
  if (retainedMinor !== BigInt(0)) return blocked("retained_balance_requires_resolution");

  const participantReturn = awardTotal + benefitTotal;
  const requiredNumerator = BigInt(85) * grossMinor;
  if (BigInt(100) * participantReturn < requiredNumerator) return blocked("insufficient_participant_return");
  const minimumReturn = (requiredNumerator + BigInt(99)) / BigInt(100);
  if (participantReturn > maximumSafe || minimumReturn > maximumSafe) return blocked("invalid_input");

  return {
    status: "review_ready",
    sourceVersion: accPaybackSourceVersion,
    prizePolicyMode: policy.mode,
    totals: {
      grossEntryIncomeMinor: gross.amountMinor as number,
      eventIncomeMinor: allocation.eventIncomeMinor as number,
      benefitExpenseMinor: Number(benefitTotal),
      operatingExpenseMinor: Number(operatingTotal),
      eventExpenseMinor: allocation.eventExpenseMinor as number,
      awardTotalMinor: Number(awardTotal),
      participantReturnMinor: Number(participantReturn),
      minimumParticipantReturnMinor: Number(minimumReturn),
    },
  };
}
