import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { SatelliteCurrent } from "../api/satellite-results";
import type { SidePool } from "../api/side-pools";
type Report = { tournamentName: string; eventName: string; format: string; scoringMethod: string; current: SatelliteCurrent; sidePools?: SidePool[] };
const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;
function wrap(text: string, font: PDFFont, size: number, width: number) { const words = text.split(/\s+/); const lines: string[] = []; let line = ""; for (const word of words) { const next = line ? `${line} ${word}` : word; if (font.widthOfTextAtSize(next, size) <= width) line = next; else { if (line) lines.push(line); line = word; } } if (line) lines.push(line); return lines; }
export async function buildSatelliteResultsPdf(report: Report) {
  const document = await PDFDocument.create(); const regular = await document.embedFont(StandardFonts.Helvetica); const bold = await document.embedFont(StandardFonts.HelveticaBold); const pages: PDFPage[] = [];
  const page = () => { const next = document.addPage([612, 792]); pages.push(next); return next; }; let current = page(); let y = 750;
  const line = (text: string, options: { bold?: boolean; size?: number; gap?: number } = {}) => { const font = options.bold ? bold : regular; const size = options.size ?? 10; const gap = options.gap ?? 15; for (const row of wrap(text, font, size, 540)) { if (y < 55) { current = page(); y = 750; } current.drawText(row, { x: 36, y, size, font, color: rgb(0.08, 0.12, 0.18) }); y -= gap; } };
  line("Satellite Results and ACC Reporting Package", { bold: true, size: 18, gap: 24 }); line(`${report.tournamentName} · ${report.eventName}`, { bold: true, size: 12, gap: 18 }); line(`${report.format.replaceAll("_", " ")} · ${report.scoringMethod} scoring · Version ${report.current.version} ${report.current.status}`); line("MRPs: Not applicable—Satellite event", { bold: true }); line("Qualification effect: none. This director-assisted package does not claim automatic ACC submission."); y -= 8; line("Cashing Placements", { bold: true, size: 14, gap: 20 });
  for (const row of report.current.placements) { line(`${row.placement}. ${row.displayName} — prize ${money(row.prizeMinor)}; Q Pool ${money(row.qPoolMinor)}; Side Pool ${money(row.sidePoolMinor)}`, { bold: true }); line(`Cross-check evidence: ${row.crossCheckEvidence.map((item) => `${item.type}: ${item.ref}`).join("; ")}`); }
  y -= 8; line("Operational Side Pools", { bold: true, size: 14, gap: 20 });
  if (!report.sidePools?.length) line("No Side Pools configured.");
  for (const pool of report.sidePools ?? []) {
    line(`${pool.displayName} — collected ${money(pool.collectedMinor)}; paid ${money(pool.paidMinor)}; ${pool.finalized ? "reconciled" : "not finalized"}`, { bold: true });
    for (const payout of pool.payouts.filter((item) => !item.voided)) line(`${payout.placement}. ${payout.displayName} — ${money(payout.amountMinor)}`);
  }
  y -= 8; line("Special Hands", { bold: true, size: 14, gap: 20 }); if (!report.current.specialHands.length) line("None recorded."); for (const hand of report.current.specialHands) line(`${hand.displayName} — ${hand.hand} hand — evidence: ${hand.evidenceRef}`);
  y -= 8; line("Director Review", { bold: true, size: 14, gap: 20 }); line(`Cross-check complete: ${report.current.crossCheckComplete ? "Yes" : "No"}`); line(`Approved by: ${report.current.approvedBy ?? "Not finalized"}`); line(`Approved at: ${report.current.approvedAt}`); line(`Retain scorecards and payout evidence through at least: ${report.current.retentionUntil}`); if (report.current.directorNotes) line(`Notes: ${report.current.directorNotes}`);
  for (let index = 0; index < pages.length; index += 1) pages[index].drawText(`Page ${index + 1} of ${pages.length}`, { x: 500, y: 24, size: 8, font: regular, color: rgb(0.35, 0.38, 0.42) });
  return document.save();
}
