export type QualificationCandidate = {
  id: string;
  displayName: string;
  gamePoints: number;
  gamesWon: number;
  netSpreadPoints: number;
  positiveSpreadPoints: number;
};

export type QualificationStatus = "qualified" | "not_qualified" | "cutoff_tie";

export type QualificationPreview = {
  qualifierCount: number;
  bracketSize: number;
  firstRoundByes: number;
  finalizable: boolean;
  ranked: Array<QualificationCandidate & { numericRank: number; qualificationStatus: QualificationStatus }>;
};

function assertNonNegativeSafeInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${field} must be a non-negative whole number.`);
}

function compare(a: QualificationCandidate, b: QualificationCandidate) {
  return b.gamePoints - a.gamePoints
    || b.gamesWon - a.gamesWon
    || b.netSpreadPoints - a.netSpreadPoints
    || b.positiveSpreadPoints - a.positiveSpreadPoints;
}

function sameNumericStanding(a: QualificationCandidate, b: QualificationCandidate) {
  return compare(a, b) === 0;
}

/** ACC qualification count: one entrant in four, with a fraction rounded up. */
export function qualificationCount(entrants: number) {
  if (!Number.isSafeInteger(entrants) || entrants < 1) throw new RangeError("Entrants must be a positive whole number.");
  return Math.ceil(entrants / 4);
}

export function nextFullBracketSize(qualifiers: number) {
  if (!Number.isSafeInteger(qualifiers) || qualifiers < 1) throw new RangeError("Qualifiers must be a positive whole number.");
  let size = 1;
  while (size < qualifiers) size *= 2;
  return Math.max(4, size);
}

/**
 * Produces only a numeric-rule preview. A fully tied numeric standing never
 * receives a fabricated final ordering; a tie crossing the qualification cut
 * is visibly unresolved and blocks finalization.
 */
export function previewQualification(candidates: QualificationCandidate[]): QualificationPreview {
  if (!Array.isArray(candidates) || candidates.length < 1) throw new RangeError("At least one candidate is required.");
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate.id !== "string" || candidate.id.length === 0 || ids.has(candidate.id)
      || typeof candidate.displayName !== "string" || candidate.displayName.length === 0) {
      throw new TypeError("Each qualification candidate needs a unique ID and display name.");
    }
    ids.add(candidate.id);
    assertNonNegativeSafeInteger(candidate.gamePoints, "Game points");
    assertNonNegativeSafeInteger(candidate.gamesWon, "Games won");
    assertNonNegativeSafeInteger(candidate.positiveSpreadPoints, "Positive spread points");
    if (!Number.isSafeInteger(candidate.netSpreadPoints)) throw new RangeError("Net spread points must be a whole number.");
  }

  const qualifierCountValue = qualificationCount(candidates.length);
  const ranked = [...candidates].sort(compare);
  let hasTie = false;
  let index = 0;
  const output: QualificationPreview["ranked"] = [];
  while (index < ranked.length) {
    let end = index + 1;
    while (end < ranked.length && sameNumericStanding(ranked[index], ranked[end])) end += 1;
    const tied = end - index > 1;
    hasTie ||= tied;
    const qualificationStatus: QualificationStatus = index < qualifierCountValue && end > qualifierCountValue
      ? "cutoff_tie"
      : end <= qualifierCountValue ? "qualified" : "not_qualified";
    for (let item = index; item < end; item += 1) {
      output.push({ ...ranked[item], numericRank: index + 1, qualificationStatus });
    }
    index = end;
  }

  const bracketSize = nextFullBracketSize(qualifierCountValue);
  return {
    qualifierCount: qualifierCountValue,
    bracketSize,
    firstRoundByes: bracketSize - qualifierCountValue,
    finalizable: !hasTie,
    ranked: output,
  };
}
