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
  if (!draft || workspace.qualificationResultVersionId !== qualification.resultVersionId) return null;

  const names = new Map(qualification.qualifiers.map((qualifier) => [qualifier.participantId, qualifier]));
  if (workspace.qualifierChoices.length !== qualification.qualifiers.length
    || workspace.qualifierChoices.some((choice) => {
      const qualifier = names.get(choice.participantId);
      return !qualifier || qualifier.displayName !== choice.displayName || qualifier.qualificationRank !== choice.qualificationRank;
    })) return null;
  const lines = [
    row("Document", "Private director settlement working copy"),
    row("Status", "PROVISIONAL — NOT RECONCILED — NOT AN ACC SUBMISSION"),
    row("Tournament", qualification.tournamentName),
    row("Event", qualification.eventName),
    row("Qualification result version", qualification.resultVersionId),
    row("Settlement draft version", draft.version),
    row("Settlement draft ID", draft.settlementDraftId),
    row("Saved at", draft.createdAt),
    row("Saved by", draft.createdBy),
    row("Currency", workspace.currencyCode),
    "",
    row("PLAYOFF PLACEMENT CLAIMS — SEPARATE FROM QUALIFYING-ROUND RANKS"),
    row("Place", "Player", "Qualifying-round rank", "Prize claim (USD)"),
    ...draft.placements.map((placement) => {
      const participant = names.get(placement.participantId);
      return row(placement.placement, participant?.displayName ?? "Unavailable qualifier", participant?.qualificationRank ?? "", usd(placement.prizeAmountMinor));
    }),
    "",
    row("LOCKED QUALIFYING-ROUND RANKS — NOT PLAYOFF PLACEMENTS"),
    row("Qualifying-round rank", "Player", "Game Points", "Games Won", "Plus Points", "Minus Points", "Net Spread Points"),
    ...qualification.qualifiers.map((qualifier) => row(qualifier.qualificationRank, qualifier.displayName, qualifier.gamePoints, qualifier.gamesWon, qualifier.plusPoints, qualifier.minusPoints, qualifier.netSpreadPoints)),
    row("High Non-Qualifier", qualification.highNonQualifier.displayName, qualification.highNonQualifier.gamePoints, qualification.highNonQualifier.gamesWon, qualification.highNonQualifier.plusPoints, qualification.highNonQualifier.minusPoints, qualification.highNonQualifier.netSpreadPoints),
    "",
    row("AWARD CLAIMS — ENTERED BY DIRECTOR; NOT CALCULATED OR APPROVED"),
    row("Player", "Award type", "Q-pool slot", "Amount claim (USD)", "Note"),
    ...draft.awards.map((award) => row(names.get(award.participantId)?.displayName ?? "Unavailable qualifier", award.awardType, award.qPoolSlot ?? "", usd(award.amountMinor), award.note)),
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
    row("Notice", "This private working copy does not calculate MRPs or Q-pool payouts and is not an official ACC export."),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
