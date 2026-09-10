/**
 * Narrow Rule 11.4 late-return-from-lunch fixture.
 *
 * This is not a general forfeit, rotation, replacement, or disqualification
 * engine. It deliberately limits an automatic recommendation to the first
 * post-lunch game after the five-minute grace period. A director must record
 * any later-game decision under the approved operational workflow.
 *
 * Source: ACC Official Tournament Rules 2025, Rule 11.4. Cached source
 * SHA-256: DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD.
 */

export type LateLunchDecision =
  | { status: "grace_period"; graceMinutesRemaining: number }
  | {
      status: "award_first_post_lunch_game";
      winner: { gamePoints: 2; spreadPoints: 10 };
      latePlayer: { gamePoints: 0; spreadPoints: -10 };
      latePlayerResumesWith: "next_opponent_in_rotation";
    }
  | { status: "director_review_required"; reason: "only_one_2_plus_10_award" | "second_post_lunch_game_or_later" };

/**
 * Evaluates only the documented Rule 11.4 automatic award boundary.
 * `postLunchGameNumber` is one for the first scheduled game after lunch.
 */
export function evaluateLateLunchAbsence(input: {
  minutesLate: number;
  postLunchGameNumber: number;
  previouslyAwardedRule114Forfeit: boolean;
}): LateLunchDecision {
  if (!Number.isSafeInteger(input.minutesLate) || input.minutesLate < 0) {
    throw new RangeError("Minutes late must be a non-negative whole number.");
  }
  if (!Number.isSafeInteger(input.postLunchGameNumber) || input.postLunchGameNumber < 1) {
    throw new RangeError("Post-lunch game number must be a positive whole number.");
  }

  // Rule 11.4 permits possible disqualification/replacement after the second
  // game begins, but gives no automatic outcome. Keep that human decision open.
  if (input.postLunchGameNumber >= 2) {
    return { status: "director_review_required", reason: "second_post_lunch_game_or_later" };
  }
  // The director allows five full minutes before a forfeit; a score is never
  // awarded during that grace interval.
  if (input.minutesLate <= 5) {
    return { status: "grace_period", graceMinutesRemaining: 5 - input.minutesLate };
  }
  // "Only one 2/+10 will ever be given" prevents a second automatic award.
  if (input.previouslyAwardedRule114Forfeit) {
    return { status: "director_review_required", reason: "only_one_2_plus_10_award" };
  }
  return {
    status: "award_first_post_lunch_game",
    winner: { gamePoints: 2, spreadPoints: 10 },
    latePlayer: { gamePoints: 0, spreadPoints: -10 },
    latePlayerResumesWith: "next_opponent_in_rotation",
  };
}
