/**
 * Pure ACC 2025 cross-check and judge-protocol fixture rules. These helpers
 * are intentionally not authorization: a future server workflow must bind
 * identities, table assignments, relationship declarations, and audit events
 * before it treats an accepted fixture as an operational assignment.
 *
 * Sources: ACC Official Tournament Rules 2025, Judge Protocols; Rule 11.5(a);
 * Appendix A, items 2–3. Cached source SHA-256:
 * DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD.
 */

export type ProtocolDecision = { accepted: true; requiredCount: number } | { accepted: false; requiredCount: number; code: "invalid_table_size" | "duplicate_official" | "self_dispute" | "insufficient_officials" | "relationship_review_requires_third" };

function distinct(values: readonly string[]) {
  return new Set(values).size === values.length;
}

/** Appendix A(2): 2 checkers for <=24 players; 3 for >24. */
export function requiredCrossCheckers(tablePlayerCount: number): number {
  if (!Number.isSafeInteger(tablePlayerCount) || tablePlayerCount < 1) throw new RangeError("A cross-check table must have at least one player.");
  return tablePlayerCount <= 24 ? 2 : 3;
}

/**
 * Appendix A(3): a relationship involving an apparent qualifier is escalated
 * to three checkers. The relationship fact must be supplied by a future
 * authorized workflow; it is not inferred from names or accounts.
 */
export function evaluateCrossCheckAssignment(input: {
  tablePlayerCount: number;
  checkerProfileIds: readonly string[];
  /** True only after an authorized official records the Appendix A(3) fact. */
  qualifyingRelationshipConflict: boolean;
}): ProtocolDecision {
  let requiredCount: number;
  try {
    requiredCount = requiredCrossCheckers(input.tablePlayerCount);
  } catch {
    return { accepted: false, requiredCount: 0, code: "invalid_table_size" };
  }
  if (!distinct(input.checkerProfileIds)) return { accepted: false, requiredCount, code: "duplicate_official" };
  const relationshipRequiredCount = input.qualifyingRelationshipConflict ? Math.max(requiredCount, 3) : requiredCount;
  if (input.checkerProfileIds.length < relationshipRequiredCount) {
    return { accepted: false, requiredCount: relationshipRequiredCount, code: input.qualifyingRelationshipConflict ? "relationship_review_requires_third" : "insufficient_officials" };
  }
  return { accepted: true, requiredCount: relationshipRequiredCount };
}

/** Judge Protocol (a) and Rule 11.5(a): begin with two; disagreement may add a third. */
export function evaluateJudgeHearing(input: {
  judgeProfileIds: readonly string[];
  disputingPlayerProfileIds: readonly string[];
  disagreementAfterInitialDecision: boolean;
}): ProtocolDecision {
  const requiredCount = input.disagreementAfterInitialDecision ? 3 : 2;
  if (!distinct(input.judgeProfileIds)) return { accepted: false, requiredCount, code: "duplicate_official" };
  if (input.judgeProfileIds.some((id) => input.disputingPlayerProfileIds.includes(id))) return { accepted: false, requiredCount, code: "self_dispute" };
  if (input.judgeProfileIds.length < requiredCount) return { accepted: false, requiredCount, code: "insufficient_officials" };
  return { accepted: true, requiredCount };
}
