export const standardSinglesMrpReferenceVersion = "acc-public-mrp-2016-observed-2026-09-11" as const;

type EventType = "main" | "consolation";

export type StandardSinglesMrpReferenceInput = {
  eventType: EventType;
  gameCount: number;
  qualifierCount: number;
  qualificationRank: number;
  gamePoints: number;
  playoffExitRound: number | null;
};

export type StandardSinglesMrpReferenceResult = {
  status: "reference_only";
  sourceVersion: typeof standardSinglesMrpReferenceVersion;
  currentEffectiveApproved: false;
  qualifyingMrp: number;
  playoffMrp: number | null;
  totalMrp: number | null;
};

export type StandardSinglesMrpReferenceBlocker = {
  status: "blocked";
  sourceVersion: typeof standardSinglesMrpReferenceVersion;
  currentEffectiveApproved: false;
  code: "unsupported_event_type" | "unsupported_game_count" | "invalid_game_points"
    | "invalid_qualifier_position" | "below_published_threshold" | "invalid_playoff_round";
};

const schedules = {
  main: { qualifyingScale: 5, playoffScale: 7, minimumByGames: { 12: 14, 14: 17, 16: 20, 18: 22, 20: 25, 21: 26, 22: 27 } },
  consolation: { qualifyingScale: 3, playoffScale: 4, minimumByGames: { 7: 9, 8: 11, 9: 12, 10: 13, 12: 16 } },
} as const;

function whole(value: number) { return Number.isSafeInteger(value); }
function blocked(code: StandardSinglesMrpReferenceBlocker["code"]): StandardSinglesMrpReferenceBlocker {
  return { status: "blocked", sourceVersion: standardSinglesMrpReferenceVersion, currentEffectiveApproved: false, code };
}

/**
 * Reproduces only the Standard Main/Consolation reference schedules currently
 * published by ACC. It deliberately does not decide that those 2016-effective
 * schedules are approved for a current event and must not be persisted as an
 * official award until that separate gate is satisfied.
 */
export function calculateStandardSinglesMrpReference(input: StandardSinglesMrpReferenceInput): StandardSinglesMrpReferenceResult | StandardSinglesMrpReferenceBlocker {
  if (!(input.eventType in schedules)) return blocked("unsupported_event_type");
  const schedule = schedules[input.eventType];
  const minimum = (schedule.minimumByGames as Record<number, number>)[input.gameCount];
  if (minimum === undefined) return blocked("unsupported_game_count");
  if (!whole(input.gamePoints) || input.gamePoints < 0 || input.gamePoints > 3 * input.gameCount) return blocked("invalid_game_points");
  if (!whole(input.qualifierCount) || input.qualifierCount < 1 || !whole(input.qualificationRank)
    || input.qualificationRank < 1 || input.qualificationRank > input.qualifierCount) return blocked("invalid_qualifier_position");
  if (input.playoffExitRound !== null && (!whole(input.playoffExitRound) || input.playoffExitRound < 1 || input.playoffExitRound > 10)) return blocked("invalid_playoff_round");

  const topHalf = input.qualificationRank <= Math.ceil(input.qualifierCount / 2);
  if (topHalf && input.gamePoints < minimum) return blocked("below_published_threshold");
  const qualifyingMrp = topHalf ? schedule.qualifyingScale * (input.gamePoints - minimum + 1) : schedule.qualifyingScale;
  const playoffMrp = input.playoffExitRound === null
    ? null
    : schedule.playoffScale * input.playoffExitRound * (input.playoffExitRound + 1) / 2;
  return {
    status: "reference_only",
    sourceVersion: standardSinglesMrpReferenceVersion,
    currentEffectiveApproved: false,
    qualifyingMrp,
    playoffMrp,
    totalMrp: playoffMrp === null ? null : qualifyingMrp + playoffMrp,
  };
}
