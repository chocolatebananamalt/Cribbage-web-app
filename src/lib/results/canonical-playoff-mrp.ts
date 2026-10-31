import { calculateStandardSinglesMrpFromWins } from "./playoff-rounds-won.ts";

export const canonicalPlayoffMrpSourceVersion = "canonical-playoff-mrp-v1" as const;

type EventType = "main" | "consolation";

export type CanonicalPlayoffResultScope = {
  tournamentId: string;
  eventId: string;
  resultId: string;
  qualificationResultVersionId: string;
};

export type CanonicalPlayoffQualifier = {
  participantId: string;
  displayName: string;
  qualificationRank: number;
  gamePoints: number;
};

export type CanonicalPlayoffQualification = {
  tournamentId: string;
  eventId: string;
  resultVersionId: string;
  eventType: EventType;
  gameCount: number;
  qualifiers: CanonicalPlayoffQualifier[];
};

export type LegacyPlayoffPlacementEvidence = {
  participantId: string;
  placement: number;
  mrpPlayoffExitRound: number;
};

export type V3PlayoffSeriesEvidence = {
  winnerId: string;
  loserId: string;
  evidenceNote: string;
};

export type CanonicalLegacyPlayoffMrpInput = {
  kind: "legacy_placement_v2";
  resultScope: CanonicalPlayoffResultScope;
  qualification: CanonicalPlayoffQualification;
  placements: LegacyPlayoffPlacementEvidence[];
};

export type CanonicalV3PlayoffMrpInput = {
  kind: "playoff_outcome_v3";
  resultScope: CanonicalPlayoffResultScope;
  qualification: CanonicalPlayoffQualification;
  series: [V3PlayoffSeriesEvidence, V3PlayoffSeriesEvidence, V3PlayoffSeriesEvidence];
};

export type CanonicalPlayoffMrpInput = CanonicalLegacyPlayoffMrpInput | CanonicalV3PlayoffMrpInput;

export type CanonicalPlayoffMrpRow = CanonicalPlayoffQualifier & {
  qualifyingMrp: number;
  playoffMrp: number;
  totalMrp: number;
  evidenceNote: string;
  roundsWon: number;
  byesWon: 0;
  eliminatedInRound: number | null;
  bandStart: number;
  bandEnd: number;
};

export type CanonicalPlayoffMrpAvailable = {
  status: "available";
  derivedSourceVersion: typeof canonicalPlayoffMrpSourceVersion;
  resultKind: CanonicalPlayoffMrpInput["kind"];
  resultScope: CanonicalPlayoffResultScope;
  rows: CanonicalPlayoffMrpRow[];
};

export type CanonicalPlayoffMrpBlockCode =
  | "invalid_input"
  | "result_scope_mismatch"
  | "unsupported_event_type"
  | "unsupported_game_count"
  | "below_published_threshold"
  | "mrp_evidence_correction_required";

export type CanonicalPlayoffMrpBlocked = { status: "blocked"; code: CanonicalPlayoffMrpBlockCode };
export type CanonicalPlayoffMrpResult = CanonicalPlayoffMrpAvailable | CanonicalPlayoffMrpBlocked;

type DerivedEvidence = { roundsWon: number; eliminatedInRound: number | null; bandStart: number; bandEnd: number };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const supportedGameCounts: Record<EventType, ReadonlySet<number>> = {
  main: new Set([12, 14, 16, 18, 20, 21, 22]),
  consolation: new Set([7, 8, 9, 10, 12]),
};
const resultScopeKeys = ["eventId", "qualificationResultVersionId", "resultId", "tournamentId"];
const qualificationKeys = ["eventId", "eventType", "gameCount", "qualifiers", "resultVersionId", "tournamentId"];
const qualifierKeys = ["displayName", "gamePoints", "participantId", "qualificationRank"];
const placementKeys = ["mrpPlayoffExitRound", "participantId", "placement"];
const seriesKeys = ["evidenceNote", "loserId", "winnerId"];

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function whole(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function normalizedId(value: string) {
  return value.toLowerCase();
}

function sameId(left: string, right: string) {
  return normalizedId(left) === normalizedId(right);
}

function blocked(code: CanonicalPlayoffMrpBlockCode): CanonicalPlayoffMrpBlocked {
  return { status: "blocked", code };
}

function readSharedInput(input: Record<string, unknown>) {
  if (!record(input.resultScope) || !exact(input.resultScope, resultScopeKeys)
    || ![input.resultScope.tournamentId, input.resultScope.eventId, input.resultScope.resultId, input.resultScope.qualificationResultVersionId].every(uuid)
    || !record(input.qualification) || !exact(input.qualification, qualificationKeys)
    || ![input.qualification.tournamentId, input.qualification.eventId, input.qualification.resultVersionId].every(uuid)
    || !Array.isArray(input.qualification.qualifiers)) return blocked("invalid_input");

  const scope = input.resultScope as CanonicalPlayoffResultScope;
  const qualification = input.qualification as unknown as CanonicalPlayoffQualification;
  if (!sameId(scope.tournamentId, qualification.tournamentId) || !sameId(scope.eventId, qualification.eventId)
    || !sameId(scope.qualificationResultVersionId, qualification.resultVersionId)) return blocked("result_scope_mismatch");
  if (qualification.eventType !== "main" && qualification.eventType !== "consolation") return blocked("unsupported_event_type");
  if (!whole(qualification.gameCount, 1) || !supportedGameCounts[qualification.eventType].has(qualification.gameCount)) return blocked("unsupported_game_count");

  const qualifiers = qualification.qualifiers;
  if (qualifiers.length < 2 || qualifiers.length > 256 || qualifiers.some((item) => !record(item) || !exact(item, qualifierKeys)
    || !uuid(item.participantId) || typeof item.displayName !== "string" || item.displayName.trim() !== item.displayName
    || item.displayName.length < 1 || item.displayName.length > 200 || !whole(item.qualificationRank, 1, qualifiers.length)
    || !whole(item.gamePoints, 0, 3 * qualification.gameCount))) return blocked("invalid_input");
  const ids = qualifiers.map((item) => normalizedId(item.participantId));
  const ranks = qualifiers.map((item) => item.qualificationRank);
  if (new Set(ids).size !== qualifiers.length || new Set(ranks).size !== qualifiers.length
    || !Array.from({ length: qualifiers.length }, (_, index) => index + 1).every((rank) => ranks.includes(rank))) {
    return blocked("invalid_input");
  }
  return { scope, qualification, qualifiers: [...qualifiers].sort((left, right) => left.qualificationRank - right.qualificationRank) };
}

function deriveLegacyEvidence(input: Record<string, unknown>, qualifiers: CanonicalPlayoffQualifier[]) {
  const qualifierCount = qualifiers.length;
  if (qualifierCount < 4 || qualifierCount > 256 || (qualifierCount & (qualifierCount - 1)) !== 0
    || !Array.isArray(input.placements) || input.placements.length !== qualifierCount) return blocked("mrp_evidence_correction_required");
  if (input.placements.some((item) => !record(item) || !exact(item, placementKeys) || !uuid(item.participantId)
    || !whole(item.placement, 1, qualifierCount) || !whole(item.mrpPlayoffExitRound, 1, 9))) return blocked("mrp_evidence_correction_required");

  const placements = input.placements as LegacyPlayoffPlacementEvidence[];
  const qualifierIds = new Set(qualifiers.map((item) => normalizedId(item.participantId)));
  const placementIds = placements.map((item) => normalizedId(item.participantId));
  const placementNumbers = placements.map((item) => item.placement);
  if (new Set(placementIds).size !== qualifierCount || !placementIds.every((id) => qualifierIds.has(id))
    || new Set(placementNumbers).size !== qualifierCount
    || !Array.from({ length: qualifierCount }, (_, index) => index + 1).every((placement) => placementNumbers.includes(placement))) {
    return blocked("mrp_evidence_correction_required");
  }

  const depth = Math.log2(qualifierCount);
  const championRows = placements.filter((item) => item.placement === 1);
  if (championRows.length !== 1 || ![depth, depth + 1].includes(championRows[0].mrpPlayoffExitRound)) {
    return blocked("mrp_evidence_correction_required");
  }
  for (let round = 1; round <= depth; round += 1) {
    const expectedLosers = qualifierCount / 2 ** round;
    const actualLosers = placements.filter((item) => item.placement !== 1 && item.mrpPlayoffExitRound === round).length;
    if (actualLosers !== expectedLosers) return blocked("mrp_evidence_correction_required");
  }
  if (placements.some((item) => item.placement !== 1 && item.mrpPlayoffExitRound > depth)) {
    return blocked("mrp_evidence_correction_required");
  }

  const evidence = new Map<string, DerivedEvidence>();
  evidence.set(normalizedId(championRows[0].participantId), { roundsWon: depth, eliminatedInRound: null, bandStart: 1, bandEnd: 1 });
  let nextBand = 2;
  for (let round = depth; round >= 1; round -= 1) {
    const cohort = placements.filter((item) => item.placement !== 1 && item.mrpPlayoffExitRound === round);
    const bandStart = nextBand;
    const bandEnd = nextBand + cohort.length - 1;
    for (const item of cohort) evidence.set(normalizedId(item.participantId), { roundsWon: round - 1, eliminatedInRound: round, bandStart, bandEnd });
    nextBand = bandEnd + 1;
  }
  return evidence;
}

function samePair(series: V3PlayoffSeriesEvidence, left: string, right: string) {
  const pair = new Set([normalizedId(series.winnerId), normalizedId(series.loserId)]);
  return pair.size === 2 && pair.has(normalizedId(left)) && pair.has(normalizedId(right));
}

function deriveV3Evidence(input: Record<string, unknown>, qualifiers: CanonicalPlayoffQualifier[]) {
  if (qualifiers.length !== 4 || !Array.isArray(input.series) || input.series.length !== 3
    || input.series.some((item) => !record(item) || !exact(item, seriesKeys) || !uuid(item.winnerId) || !uuid(item.loserId)
      || typeof item.evidenceNote !== "string" || item.evidenceNote.trim() !== item.evidenceNote
      || item.evidenceNote.length < 1 || item.evidenceNote.length > 200)) return blocked("mrp_evidence_correction_required");
  const series = input.series as V3PlayoffSeriesEvidence[];
  const [first, second, final] = series;
  if (!samePair(first, qualifiers[0].participantId, qualifiers[3].participantId)
    || !samePair(second, qualifiers[1].participantId, qualifiers[2].participantId)
    || !samePair(final, first.winnerId, second.winnerId)) return blocked("mrp_evidence_correction_required");

  const championId = normalizedId(final.winnerId);
  const runnerId = normalizedId(final.loserId);
  const evidence = new Map<string, DerivedEvidence>();
  for (const qualifier of qualifiers) {
    const id = normalizedId(qualifier.participantId);
    const roundsWon = series.filter((item) => sameId(item.winnerId, qualifier.participantId)).length;
    evidence.set(id, id === championId
      ? { roundsWon, eliminatedInRound: null, bandStart: 1, bandEnd: 1 }
      : id === runnerId
        ? { roundsWon, eliminatedInRound: 2, bandStart: 2, bandEnd: 2 }
        : { roundsWon, eliminatedInRound: 1, bandStart: 3, bandEnd: 4 });
  }
  return evidence;
}

/**
 * Pure canonical derivation over caller-supplied immutable evidence. This is
 * not an authorization or persistence boundary; callers must separately bind
 * the validated scope to authoritative stored rows.
 */
export function deriveCanonicalPlayoffMrp(input: CanonicalPlayoffMrpInput): CanonicalPlayoffMrpResult {
  if (!record(input) || (input.kind !== "legacy_placement_v2" && input.kind !== "playoff_outcome_v3")
    || !exact(input, input.kind === "legacy_placement_v2"
      ? ["kind", "placements", "qualification", "resultScope"]
      : ["kind", "qualification", "resultScope", "series"])) return blocked("invalid_input");
  const shared = readSharedInput(input);
  if ("status" in shared) return shared;
  const evidence = input.kind === "legacy_placement_v2"
    ? deriveLegacyEvidence(input, shared.qualifiers)
    : deriveV3Evidence(input, shared.qualifiers);
  if ("status" in evidence) return evidence;

  const evidenceNote = input.kind === "legacy_placement_v2"
    ? "Canonical MRP derived from a complete power-of-two no-bye legacy elimination cohort using acc-published-mrp-2016-08-01."
    : "Canonical MRP derived from exact four-qualifier playoff series using acc-published-mrp-2016-08-01.";
  const rows: CanonicalPlayoffMrpRow[] = [];
  for (const qualifier of shared.qualifiers) {
    const bracket = evidence.get(normalizedId(qualifier.participantId));
    if (!bracket) return blocked("mrp_evidence_correction_required");
    const calculated = calculateStandardSinglesMrpFromWins({
      eventType: shared.qualification.eventType,
      gameCount: shared.qualification.gameCount,
      qualifierCount: shared.qualifiers.length,
      qualificationRank: qualifier.qualificationRank,
      gamePoints: qualifier.gamePoints,
      roundsWon: bracket.roundsWon,
      byesWon: 0,
    });
    if (calculated.status === "blocked") {
      if (calculated.code === "unsupported_event_type") return blocked("unsupported_event_type");
      if (calculated.code === "unsupported_game_count") return blocked("unsupported_game_count");
      if (calculated.code === "below_published_threshold") return blocked("below_published_threshold");
      return blocked("invalid_input");
    }
    if (calculated.playoffMrp === null || calculated.totalMrp === null) return blocked("mrp_evidence_correction_required");
    rows.push({
      participantId: qualifier.participantId,
      displayName: qualifier.displayName,
      qualificationRank: qualifier.qualificationRank,
      gamePoints: qualifier.gamePoints,
      qualifyingMrp: calculated.qualifyingMrp,
      playoffMrp: calculated.playoffMrp,
      totalMrp: calculated.totalMrp,
      evidenceNote,
      roundsWon: bracket.roundsWon,
      byesWon: 0,
      eliminatedInRound: bracket.eliminatedInRound,
      bandStart: bracket.bandStart,
      bandEnd: bracket.bandEnd,
    });
  }
  return {
    status: "available",
    derivedSourceVersion: canonicalPlayoffMrpSourceVersion,
    resultKind: input.kind,
    resultScope: { ...shared.scope },
    rows,
  };
}
