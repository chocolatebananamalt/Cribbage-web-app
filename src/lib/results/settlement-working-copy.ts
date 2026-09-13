import { createHash } from "node:crypto";

import type { QualificationResult } from "../api/qualification-finalization.ts";
import type { SettlementWorkspace } from "../api/settlement-draft.ts";

type Cell = string | number;

function csvCell(value: Cell) {
  let rendered = String(value);
  if (typeof value === "string" && /^[\t\r\n ]*[=+\-@]/.test(rendered)) rendered = `'${rendered}`;
  return `"${rendered.replaceAll('"', '""')}"`;
}

function usd(minor: number) {
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function row(...cells: Cell[]) { return cells.map(csvCell).join(","); }

export function buildSettlementWorkingCopyCsv(workspace: SettlementWorkspace, qualification: QualificationResult) {
  const draft = workspace.draft;
  if (!draft || workspace.qualificationResultVersionId !== qualification.resultVersionId
    || draft.qualificationResultVersionId !== workspace.qualificationResultVersionId
    || !workspace.playoffResult || draft.playoffResultVersionId === null
    || draft.playoffResultVersionId !== workspace.playoffResult.playoffResultVersionId) return null;

  const names = new Map(qualification.qualifiers.map((qualifier) => [qualifier.participantId, qualifier]));
  if (workspace.qualifierChoices.length !== qualification.qualifiers.length
    || workspace.qualifierChoices.some((choice) => {
      const qualifier = names.get(choice.participantId);
      return !qualifier || qualifier.displayName !== choice.displayName || qualifier.qualificationRank !== choice.qualificationRank;
    })) return null;
  const canonicalSource = {
    schema: "settlement-working-copy-v3",
    tournament: { id: workspace.tournamentId, name: qualification.tournamentName },
    event: { id: workspace.eventId, name: qualification.eventName },
    qualification: {
      resultVersionId: qualification.resultVersionId, version: qualification.version,
      qualifiers: qualification.qualifiers.map((qualifier) => ({
        participantId: qualifier.participantId, displayName: qualifier.displayName,
        qualificationRank: qualifier.qualificationRank, gamePoints: qualifier.gamePoints,
        gamesWon: qualifier.gamesWon, plusPoints: qualifier.plusPoints,
        minusPoints: qualifier.minusPoints, netSpreadPoints: qualifier.netSpreadPoints,
      })),
      highNonQualifier: qualification.highNonQualifier,
    },
    playoff: workspace.playoffResult,
    settlement: draft,
  };
  const digest = createHash("sha256").update(JSON.stringify(canonicalSource), "utf8").digest("hex");
  const placementTotal = draft.placements.reduce((total, claim) => total + claim.prizeAmountMinor, 0);
  const awardTotal = draft.awards.reduce((total, claim) => total + claim.amountMinor, 0);
  const mrpTotal = draft.mrpClaims.reduce((total, claim) => total + claim.mrpPoints, 0);
  const mrpClaims = new Map(draft.mrpClaims.map((claim) => [claim.participantId, claim]));
  const lines = [
    row("Schema", "settlement-working-copy-v3"),
    row("Document", "Private director settlement working copy"),
    row("Status", "PROVISIONAL — UNRECONCILED — NOT APPROVED — NOT AN ACC SUBMISSION"),
    row("Canonical source SHA-256", digest),
    row("Tournament ID", workspace.tournamentId),
    row("Tournament", qualification.tournamentName),
    row("Event ID", workspace.eventId),
    row("Event", qualification.eventName),
    row("Qualification result version", qualification.resultVersionId),
    row("Qualification result version number", qualification.version),
    row("Bound playoff result version", draft.playoffResultVersionId ?? "UNAVAILABLE"),
    row("Bound playoff result version number", workspace.playoffResult?.version ?? "UNAVAILABLE"),
    row("Settlement draft version", draft.version),
    row("Settlement draft ID", draft.settlementDraftId),
    row("Saved at", draft.createdAt),
    row("Saved by", draft.createdBy),
    row("Currency", workspace.currencyCode),
    "",
    row("PLAYOFF PLACEMENT CLAIMS — SEPARATE FROM QUALIFYING-ROUND RANKS"),
    row("Place", "Participant ID", "Player", "Qualifying-round rank", "Prize claim (USD)"),
    ...draft.placements.map((placement) => {
      const participant = names.get(placement.participantId);
      return row(placement.placement, placement.participantId, participant?.displayName ?? "Unavailable qualifier", participant?.qualificationRank ?? "", usd(placement.prizeAmountMinor));
    }),
    "",
    row("LOCKED QUALIFYING-ROUND RANKS — NOT PLAYOFF PLACEMENTS"),
    row("Qualifying-round rank", "Participant ID", "Player", "Game Points", "Games Won", "Plus Points", "Minus Points", "Net Spread Points"),
    ...qualification.qualifiers.map((qualifier) => row(qualifier.qualificationRank, qualifier.participantId, qualifier.displayName, qualifier.gamePoints, qualifier.gamesWon, qualifier.plusPoints, qualifier.minusPoints, qualifier.netSpreadPoints)),
    row("High Non-Qualifier", qualification.highNonQualifier.participantId, qualification.highNonQualifier.displayName, qualification.highNonQualifier.gamePoints, qualification.highNonQualifier.gamesWon, qualification.highNonQualifier.plusPoints, qualification.highNonQualifier.minusPoints, qualification.highNonQualifier.netSpreadPoints),
    "",
    row("AWARD CLAIMS — ENTERED BY DIRECTOR; NOT CALCULATED OR APPROVED"),
    row("Participant ID", "Player", "Award type", "Q-pool slot", "Amount claim (USD)", "Note"),
    ...draft.awards.map((award) => row(award.participantId, names.get(award.participantId)?.displayName ?? "Unavailable qualifier", award.awardType, award.qPoolSlot ?? "", usd(award.amountMinor), award.note)),
    "",
    row("MRP CLAIMS — DIRECTOR-TRANSCRIBED; NOT CALCULATED OR ACC-APPROVED"),
    row("Participant ID", "Player", "Claim status", "MRP whole-point claim", "Required source or evidence"),
    ...qualification.qualifiers.map((qualifier) => {
      const claim = mrpClaims.get(qualifier.participantId);
      return row(qualifier.participantId, qualifier.displayName, claim ? "ENTERED" : "MISSING", claim?.mrpPoints ?? "", claim?.evidenceNote ?? "");
    }),
    "",
    row("CLAIM TOTALS — PROVISIONAL AND UNRECONCILED"),
    row("Placement prize claims (USD)", usd(placementTotal)),
    row("Q-pool and other award claims (USD)", usd(awardTotal)),
    row("All money claims (USD)", usd(placementTotal + awardTotal)),
    row("Entered MRP claim count", draft.mrpClaims.length),
    row("Entered MRP whole-point total", mrpTotal),
    "",
    row("SERVER CASH SNAPSHOT — TOURNAMENT-WIDE; NOT EVENT-ALLOCATED"),
    row("Active payment receipts", draft.serverTotals.activePaymentReceiptCount),
    row("Active payment receipt total (USD)", usd(draft.serverTotals.activePaymentReceiptTotalMinor)),
    row("Active expenses", draft.serverTotals.activeExpenseCount),
    row("Active expense total (USD)", usd(draft.serverTotals.activeExpenseTotalMinor)),
    row("Unallocated cash position (USD)", usd(draft.serverTotals.netCashPositionMinor)),
    "",
    row("BLOCKING CONDITIONS — THIS WORKING COPY CANNOT BE PUBLISHED OR SUBMITTED"),
    row("Blocker code"),
    ...draft.blockers.map((blocker) => row(blocker)),
    "",
    row("Notice", "This private working copy is unreconciled, not approved, and not an ACC submission. MRP values are transcribed claims, not calculations."),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
