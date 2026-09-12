import { previewQualification } from "../qualification.ts";
import type { PreliminaryStanding } from "./preliminary-standings-contract.ts";

export function buildPreliminaryQualification(rows: PreliminaryStanding[]) {
  if (rows.length === 0) return null;
  const preview = previewQualification(rows.map((row) => ({
    id: row.participantId,
    displayName: row.displayName,
    gamePoints: row.gamePoints,
    gamesWon: row.gamesWon,
    netSpreadPoints: row.netSpreadPoints,
    positiveSpreadPoints: row.plusPoints,
  })));
  const provisionalQualifiers = preview.ranked.filter((row) => row.qualificationStatus === "qualified");
  const cutoffTie = preview.unresolvedTies.find((tie) => tie.affectsQualificationCut) ?? null;
  const firstNonQualifier = preview.ranked.find((row) => row.qualificationStatus === "not_qualified") ?? null;
  const highNonQualifierTie = firstNonQualifier
    ? preview.unresolvedTies.find((tie) => tie.candidateIds.includes(firstNonQualifier.id)) ?? null
    : null;
  return {
    preview,
    provisionalQualifiers,
    cutoffTie,
    highNonQualifierTie,
    highNonQualifier: cutoffTie || highNonQualifierTie ? null : firstNonQualifier,
  };
}
