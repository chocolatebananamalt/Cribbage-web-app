/**
 * Pure Rule 13.1 playoff-absence timing fixture.
 *
 * It calculates only how many game forfeits are due for a nonappearing
 * qualifier. It neither declares a match official nor calculates money or
 * MRPs; those require the approved bracket, payout, and results workflows.
 *
 * Source: ACC Official Tournament Rules 2025, Rule 13.1. Cached source
 * SHA-256: DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD.
 */

export type PlayoffAbsenceDecision =
  | { status: "grace_period"; graceMinutesRemaining: number }
  | {
      status: "forfeitures_due";
      totalForfeituresDue: number;
      additionalForfeituresDue: number;
      matchComplete: boolean;
      nonappearingQualifierEntitlement: "round_loser_prize_money_and_mrps";
    };

/**
 * Whole-minute fixture: the five-minute grace includes minutes 0 through 5;
 * the first forfeit is due from minute 6, then one more at minute 20 and each
 * subsequent fifteen-minute boundary.
 */
export function evaluatePlayoffAbsence(input: {
  minutesLate: number;
  gamesInMatch: number;
  forfeituresAlreadyRecorded: number;
}): PlayoffAbsenceDecision {
  for (const [label, value] of Object.entries(input)) {
    if (!Number.isSafeInteger(value) || value < 0 || (label === "gamesInMatch" && value < 1)) {
      throw new RangeError(`${label} must be a ${label === "gamesInMatch" ? "positive" : "non-negative"} whole number.`);
    }
  }
  if (input.forfeituresAlreadyRecorded > input.gamesInMatch) {
    throw new RangeError("Recorded forfeitures cannot exceed the number of games in the match.");
  }
  if (input.minutesLate <= 5) {
    return { status: "grace_period", graceMinutesRemaining: 5 - input.minutesLate };
  }

  const uncappedDue = 1 + Math.floor((input.minutesLate - 5) / 15);
  const totalForfeituresDue = Math.min(input.gamesInMatch, uncappedDue);
  return {
    status: "forfeitures_due",
    totalForfeituresDue,
    additionalForfeituresDue: Math.max(0, totalForfeituresDue - input.forfeituresAlreadyRecorded),
    matchComplete: totalForfeituresDue === input.gamesInMatch,
    nonappearingQualifierEntitlement: "round_loser_prize_money_and_mrps",
  };
}
