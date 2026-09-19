/**
 * Plain-language text for an automatic MRP blocker.
 *
 * The settlement screen used to print the raw code with its underscores turned
 * into spaces: "Automatic MRP calculation is blocked: unsupported game count."
 * A director reading that has no way to tell a broken feature from a correct
 * refusal, and this one is a correct refusal.
 *
 * The ACC published Standard Singles schedule, source version
 * acc-published-mrp-2016-08-01, defines a minimum qualifying game-point figure
 * only for the game counts below. Anything else has no published row, so there
 * is no MRP to calculate and inventing one would be inventing rating points.
 * Measured on the 2026-09-19 rehearsal: a Main event configured for 9 games.
 */
export const publishedMrpGameCounts = {
  main: [12, 14, 16, 18, 20, 21, 22],
  consolation: [7, 8, 9, 10, 12],
} as const;

function list(counts: readonly number[]) {
  return `${counts.slice(0, -1).join(", ")} or ${counts[counts.length - 1]}`;
}

export function mrpBlockerMessage(code: string, gameCount?: number | null): string {
  const configured = typeof gameCount === "number" ? ` This event is configured for ${gameCount} games.` : "";
  switch (code) {
    case "unsupported_game_count":
      return `The ACC published MRP schedule covers Main events of ${list(publishedMrpGameCounts.main)} games and Consolation events of ${list(publishedMrpGameCounts.consolation)} games.${configured} There is no published row for this game count, so MRPs cannot be calculated here and must be reported to the ACC by hand. Everything else on this screen, including payouts and the result package, is unaffected.`;
    case "unsupported_event":
      return "Automatic MRP applies to Standard Singles Main and Consolation events only. Satellite events never award MRPs, and other formats are reported by hand.";
    case "complete_playoff_rounds_required":
      return "Every qualifier needs a recorded playoff exit round before MRPs can be calculated. Record the remaining exit rounds on the playoff placement screen, then return here.";
    case "below_published_threshold":
      return "A top-half qualifier finished below the minimum game points the published schedule requires for this game count, so the schedule yields no qualifying MRP for them. Check the recorded game points before reporting.";
    case "automatic_mrp_unavailable":
      return "The server could not produce an automatic MRP calculation for this event. Report MRPs by hand and raise this with support after the tournament.";
    case "automatic_mrp_mismatch":
      return "The MRP values submitted do not match what the server calculated from the locked qualifying result. Reload this screen so the calculated values are used.";
    default:
      return `Automatic MRP calculation is blocked: ${code.replaceAll("_", " ")}.`;
  }
}
