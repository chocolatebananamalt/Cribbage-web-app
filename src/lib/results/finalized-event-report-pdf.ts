import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { FinalizedEventReport } from "../api/finalized-event-report.ts";
import type { SidePool } from "../api/side-pools.ts";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

function safeText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[–—−]/g, "-")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E]/g, "?");
}

function usd(minor: number) { return `$${(minor / 100).toFixed(2)}`; }
function signed(value: number) { return value > 0 ? `+${value}` : String(value); }

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = safeText(text).split(/\s+/).filter(Boolean).flatMap((word) => {
    if (font.widthOfTextAtSize(word, size) <= width) return [word];
    const pieces: string[] = [];
    let piece = "";
    for (const character of word) {
      const candidate = piece + character;
      if (piece && font.widthOfTextAtSize(candidate, size) > width) { pieces.push(piece); piece = character; }
      else piece = candidate;
    }
    if (piece) pieces.push(piece);
    return pieces;
  });
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildFinalizedEventReportPdf(report: FinalizedEventReport, sidePools: SidePool[] = []) {
  const document = await PDFDocument.create();
  document.setTitle(`${report.tournamentName} - ${report.eventName} Results`);
  document.setSubject("Finalized tournament event results");
  document.setCreator("ACC Tournament Desk");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page!: PDFPage;
  let y!: number;

  const startPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText("ACC TOURNAMENT DESK", { x: MARGIN, y, size: 9, font: bold, color: rgb(0.08, 0.24, 0.48) });
    page.drawText(`Finalized report v${report.finalizationVersion}`, { x: PAGE_WIDTH - MARGIN - 110, y, size: 8, font: regular, color: rgb(0.35, 0.39, 0.45) });
    y -= 22;
  };
  const ensure = (height: number) => { if (y - height < MARGIN + 24) startPage(); };
  const line = (value: string, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const size = options.size ?? 10;
    const selected = options.font ?? regular;
    const lines = wrap(value, selected, size, CONTENT_WIDTH);
    ensure(lines.length * (size + 3));
    for (const current of lines) { page.drawText(current, { x: MARGIN, y, size, font: selected, color: options.color }); y -= size + 3; }
    y -= options.gap ?? 2;
  };
  const section = (value: string) => { ensure(26); y -= 6; line(value, { font: bold, size: 12, color: rgb(0.08, 0.24, 0.48), gap: 5 }); };
  const columns = (values: Array<{ text: string; x: number; width: number; bold?: boolean }>, size = 9) => {
    const rendered = values.map((item) => wrap(item.text, item.bold ? bold : regular, size, item.width));
    const rows = Math.max(...rendered.map((item) => item.length));
    ensure(rows * (size + 3) + 4);
    rendered.forEach((lines, index) => lines.forEach((text, row) => page.drawText(text, {
      x: MARGIN + values[index].x, y: y - row * (size + 3), size, font: values[index].bold ? bold : regular,
    })));
    y -= rows * (size + 3) + 4;
  };

  startPage();
  line("Tournament Event Results", { font: bold, size: 20, color: rgb(0.03, 0.10, 0.22), gap: 5 });
  line(`${report.tournamentName}${report.tournamentDate ? ` - ${report.tournamentDate}` : ""}`, { font: bold, size: 13, gap: 1 });
  line(report.eventName, { size: 12, gap: 8 });
  line(`Finalized ${new Date(report.finalizedAt).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })} by ${report.finalizedBy}.`, { size: 8, color: rgb(0.35, 0.39, 0.45), gap: 0 });
  line("Director-reviewed final record. This PDF is not an automatic submission to the ACC.", { size: 8, color: rgb(0.35, 0.39, 0.45), gap: 8 });

  section("Event Results");
  columns([{ text: "Place", x: 0, width: 45, bold: true }, { text: "Player", x: 50, width: 260, bold: true },
    { text: "Prize", x: 320, width: 90, bold: true }, { text: "Qualifying Rank", x: 420, width: 120, bold: true }]);
  const rankByParticipant = new Map(report.qualifiers.map((item) => [item.participantId, item.qualificationRank]));
  for (const placement of report.playoffPlacements) columns([
    { text: String(placement.placement), x: 0, width: 45, bold: placement.placement <= 2 },
    { text: placement.displayName, x: 50, width: 260, bold: placement.placement <= 2 },
    { text: usd(placement.prizeAmountMinor), x: 320, width: 90 },
    { text: String(rankByParticipant.get(placement.participantId) ?? "-"), x: 420, width: 120 },
  ]);

  section("Qualifiers");
  columns([{ text: "#", x: 0, width: 20, bold: true }, { text: "Player", x: 25, width: 175, bold: true },
    { text: "GP", x: 205, width: 25, bold: true }, { text: "Won", x: 235, width: 32, bold: true },
    { text: "(+) ", x: 272, width: 35, bold: true }, { text: "(-)", x: 312, width: 35, bold: true },
    { text: "Net", x: 352, width: 40, bold: true }, { text: "MRPs", x: 397, width: 35, bold: true },
    { text: "Q Pool", x: 437, width: 48, bold: true }, { text: "Other", x: 490, width: 50, bold: true }], 8);
  for (const qualifier of report.qualifiers) columns([
    { text: String(qualifier.qualificationRank), x: 0, width: 20 }, { text: qualifier.displayName, x: 25, width: 175 },
    { text: String(qualifier.gamePoints), x: 205, width: 25 }, { text: String(qualifier.gamesWon), x: 235, width: 32 },
    { text: `+${qualifier.plusPoints}`, x: 272, width: 35 }, { text: `-${qualifier.minusPoints}`, x: 312, width: 35 },
    { text: signed(qualifier.netSpreadPoints), x: 352, width: 40 }, { text: String(qualifier.mrpPoints), x: 397, width: 35 },
    { text: usd(qualifier.qPoolAwardMinor), x: 437, width: 48 }, { text: usd(qualifier.otherAwardMinor), x: 490, width: 50 },
  ], 8);
  y -= 3;
  columns([{ text: "High Non-Qualifier", x: 0, width: 120, bold: true },
    { text: report.highNonQualifier.displayName, x: 125, width: 210, bold: true },
    { text: `${report.highNonQualifier.gamePoints} GP / ${report.highNonQualifier.gamesWon} won / +${report.highNonQualifier.plusPoints} / -${report.highNonQualifier.minusPoints} / ${signed(report.highNonQualifier.netSpreadPoints)} net`, x: 345, width: 195 }]);

  if (sidePools.length) {
    section("Side Pools");
    for (const pool of sidePools) {
      line(`${pool.displayName}: collected ${usd(pool.collectedMinor)}; paid ${usd(pool.paidMinor)}; ${pool.finalized ? "finalized" : "open"}.`, { font: bold, size: 9 });
      for (const payout of pool.payouts) line(`${payout.placement}. ${payout.displayName} - ${usd(payout.amountMinor)}`, { size: 8, gap: 0 });
    }
  }

  section("Record Details");
  line(`Participants: ${report.participantCount} | Qualifiers: ${report.qualifierCount} | Currency: ${report.currencyCode}`, { size: 8, gap: 0 });
  line(`Qualification version: ${report.qualificationResultVersionId}`, { size: 7, gap: 0 });
  line(`Playoff version: ${report.playoffResultVersionId}`, { size: 7, gap: 0 });
  line(`Settlement version: ${report.settlementDraftId}`, { size: 7, gap: 0 });
  line(`Finalization version: ${report.finalizationId}`, { size: 7, gap: 3 });
  line(`Reviewed source: ${report.officialSourceReference}`, { size: 8 });

  const pageCount = document.getPageCount();
  document.getPages().forEach((current, index) => current.drawText(`Page ${index + 1} of ${pageCount}`, {
    x: PAGE_WIDTH - MARGIN - 55, y: 20, size: 8, font: regular, color: rgb(0.35, 0.39, 0.45),
  }));
  return document.save();
}
