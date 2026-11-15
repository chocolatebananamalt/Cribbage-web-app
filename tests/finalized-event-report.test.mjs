import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { PDFDocument } from "pdf-lib";
import { isFinalizedEventReport } from "../src/lib/api/finalized-event-report.ts";
import { buildFinalizedEventReportPdf } from "../src/lib/results/finalized-event-report-pdf.ts";

const tournamentId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";
const ids = {
  qualification: "30000000-0000-4000-8000-000000000001",
  playoff: "30000000-0000-4000-8000-000000000002",
  draft: "30000000-0000-4000-8000-000000000003",
  finalization: "30000000-0000-4000-8000-000000000004",
  winner: "40000000-0000-4000-8000-000000000001",
  runnerUp: "40000000-0000-4000-8000-000000000002",
  highNonQualifier: "40000000-0000-4000-8000-000000000003",
};

function fixture() {
  return {
    status: "finalized_event_report", tournamentId, eventId, tournamentName: "October Pilot", tournamentDate: "10-03-2026",
    eventName: "Main Event", qualificationResultVersionId: ids.qualification, playoffResultVersionId: ids.playoff,
    settlementDraftId: ids.draft, finalizationId: ids.finalization, finalizationVersion: 1, participantCount: 8,
    qualifierCount: 2, currencyCode: "USD", finalizedAt: "2026-10-03T23:00:00Z", finalizedBy: "Director",
    officialSourceReference: "Reviewed tournament worksheet dated 10-03-2026",
    playoffPlacements: [
      { participantId: ids.runnerUp, displayName: "Jordan Patel", placement: 1, prizeAmountMinor: 10000 },
      { participantId: ids.winner, displayName: "Barb Stevens", placement: 2, prizeAmountMinor: 5000 },
    ],
    qualifiers: [
      { participantId: ids.winner, displayName: "Barb Stevens", qualificationRank: 1, gamePoints: 20, gamesWon: 9, plusPoints: 120, minusPoints: 55, netSpreadPoints: 65, mrpPoints: 12, qPoolAwardMinor: 2500, otherAwardMinor: 0 },
      { participantId: ids.runnerUp, displayName: "Jordan Patel", qualificationRank: 2, gamePoints: 19, gamesWon: 8, plusPoints: 110, minusPoints: 60, netSpreadPoints: 50, mrpPoints: 10, qPoolAwardMinor: 0, otherAwardMinor: 500 },
    ],
    highNonQualifier: { participantId: ids.highNonQualifier, displayName: "Casey Kim", gamePoints: 18, gamesWon: 8, plusPoints: 100, minusPoints: 62, netSpreadPoints: 38 },
  };
}

test("finalized event report accepts only ordered, internally consistent authoritative data", () => {
  const report = fixture();
  assert.equal(isFinalizedEventReport(report, tournamentId, eventId), true);
  assert.equal(isFinalizedEventReport({ ...report, finalizationId: "not-a-uuid" }, tournamentId, eventId), false);
  assert.equal(isFinalizedEventReport({ ...report, qualifiers: [...report.qualifiers].reverse() }, tournamentId, eventId), false);
  assert.equal(isFinalizedEventReport({ ...report, qualifiers: report.qualifiers.map((row, index) => index ? row : { ...row, netSpreadPoints: 999 }) }, tournamentId, eventId), false);
  assert.equal(isFinalizedEventReport({ ...report, highNonQualifier: { ...report.highNonQualifier, participantId: ids.winner } }, tournamentId, eventId), false);
  assert.equal(isFinalizedEventReport({ ...report, playoffPlacements: report.playoffPlacements.map((row) => ({ ...row, participantId: ids.winner })) }, tournamentId, eventId), false);
  assert.equal(isFinalizedEventReport({ ...report, playoffPlacements: report.playoffPlacements.map((row, index) => index ? { ...row, participantId: ids.highNonQualifier } : row) }, tournamentId, eventId), false);
});

test("finalized report PDF is a real, deterministic multi-section PDF", async () => {
  const first = await buildFinalizedEventReportPdf(fixture());
  const loaded = await PDFDocument.load(first);
  assert.equal(loaded.getTitle(), "October Pilot - Main Event Results");
  assert.ok(loaded.getPageCount() >= 1);
  assert.equal(Buffer.from(first).subarray(0, 5).toString("ascii"), "%PDF-");
  const long = "A".repeat(160);
  const stressed = fixture();
  stressed.playoffPlacements[0].displayName = long;
  stressed.qualifiers[1].displayName = long;
  stressed.officialSourceReference = "S".repeat(5000);
  const stressedPdf = await buildFinalizedEventReportPdf(stressed);
  assert.ok((await PDFDocument.load(stressedPdf)).getPageCount() >= 2);
});

test("final report reader is role scoped, final-version bound, and excludes provisional data", () => {
  const sql = fs.readFileSync("database/migrations/0153_finalized_event_results_report.sql", "utf8");
  const route = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/final-results.pdf/route.ts", "utf8");
  const page = fs.readFileSync("src/app/tournament/[tournamentId]/results/page.tsx", "utf8");
  assert.match(sql, /role in\('director','co_director','player','cross_checker','judge','viewer'\)/);
  assert.match(sql, /standard_singles_settlement_final_versions/);
  assert.match(sql, /qualification_result_version_id=result\.id/);
  assert.match(sql, /playoff_result_version_id=result\.id/);
  assert.match(sql, /newer\.version>finalized\.settlement_draft_version/);
  assert.match(sql, /activation\.tournament_id=p_tournament_id and activation\.event_id=p_event_id/);
  assert.match(sql, /qualification_status='high_non_qualifier'/);
  assert.match(sql, /revoke all on function[\s\S]*from public,anon,authenticated/);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /\bcreate policy\b|\bgrant\s+(select|insert|update|delete)\b/i);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /final_results_not_ready[\s\S]*status: 409/);
  assert.match(route, /private, no-store/);
  assert.match(route, /application\/pdf/);
  assert.match(route, /x-content-type-options/);
  assert.match(page, /const finalReport = finalized \? await getFinalizedEventReport/);
  assert.match(page, /\{finalReport \? <a[\s\S]*Download Final Event Results PDF[\s\S]*: null\}/);
  assert.match(page, /finalReport \? "Final Event Results" : "Finalized Qualification"/);
  assert.match(page, /Winner[\s\S]*Runner-up[\s\S]*Prize/);
  assert.match(page, /MRPs · Q Pool/);
});
