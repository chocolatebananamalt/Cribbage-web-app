import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { buildSettlementWorkingCopyCsv } from "../src/lib/results/settlement-working-copy.ts";

const tournamentId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";
const qualificationResultVersionId = "30000000-0000-4000-8000-000000000001";
const participants = ["40000000-0000-4000-8000-000000000001", "40000000-0000-4000-8000-000000000002"];
const blockers = ["official_mrp_fixture_missing", "q_pool_payout_fixture_missing", "event_payment_allocation_unsupported", "settlement_reconciliation_unsupported", "official_export_unsupported"];

function fixtures() {
  const qualifiers = participants.map((participantId, index) => ({ participantId, displayName: index ? "Jordan Patel" : "=unsafe player", numericRank: index + 1, qualificationRank: index + 1, tied: false, verifiedGames: 12, gamePoints: 20 - index, gamesWon: 8 - index, plusPoints: 100 - index, minusPoints: 50, netSpreadPoints: 50 - index }));
  const qualification = { status: "qualification_finalized", tournamentId, eventId, resultVersionId: qualificationResultVersionId, version: 1, tournamentName: "October Pilot", eventName: "Main", participantCount: 8, qualifierCount: 2, finalizedAt: "2026-09-11T00:00:00Z", finalizedBy: "Director", qualifiers, highNonQualifier: { participantId: "50000000-0000-4000-8000-000000000001", displayName: "Casey Kim", numericRank: 3, verifiedGames: 12, gamePoints: 18, gamesWon: 7, plusPoints: 90, minusPoints: 50, netSpreadPoints: 40 }, playoffResultsAvailable: false, financialAwardsCalculated: false, officialAccExportAvailable: false };
  const workspace = { tournamentId, eventId, qualificationResultVersionId, currencyCode: "USD", currentVersion: 1, qualifierChoices: qualifiers.map(({ participantId, displayName, qualificationRank }) => ({ participantId, displayName, qualificationRank })), configuredQPools: [], capabilities: { publication: false, approval: false, officialExport: false, mrpEntry: false }, draft: { settlementDraftId: "60000000-0000-4000-8000-000000000001", version: 1, createdAt: "2026-09-11T01:00:00Z", createdBy: "Director", placements: [{ participantId: participants[1], placement: 1, prizeAmountMinor: 10000 }, { participantId: participants[0], placement: 2, prizeAmountMinor: 5000 }], awards: [{ participantId: participants[1], awardType: "other", qPoolSlot: null, amountMinor: 2500, note: "+formula" }], serverTotals: { currencyCode: "USD", activePaymentReceiptCount: 8, activePaymentReceiptTotalMinor: 20000, activeExpenseCount: 1, activeExpenseTotalMinor: 5000, netCashPositionMinor: 15000 }, reconciled: false, blockers } };
  return { qualification, workspace };
}

test("working copy separates playoff claims from locked qualification order and High Non-Qualifier", () => {
  const { workspace, qualification } = fixtures();
  const csv = buildSettlementWorkingCopyCsv(workspace, qualification);
  assert.ok(csv);
  assert.match(csv, /PROVISIONAL — NOT RECONCILED — NOT AN ACC SUBMISSION/);
  assert.ok(csv.indexOf("PLAYOFF PLACEMENT CLAIMS") < csv.indexOf("LOCKED QUALIFYING-ROUND RANKS"));
  assert.ok(csv.indexOf('"1","Jordan Patel"') < csv.indexOf('"LOCKED QUALIFYING-ROUND RANKS'));
  assert.ok(csv.indexOf('"High Non-Qualifier","Casey Kim"') > csv.indexOf('"2","\'=unsafe player"'));
  assert.match(csv, /This private working copy does not calculate MRPs or Q-pool payouts and is not an official ACC export/);
  for (const blocker of blockers) assert.match(csv, new RegExp(blocker));
});

test("working copy requires an exact qualification version and neutralizes spreadsheet formulas", () => {
  const { workspace, qualification } = fixtures();
  const csv = buildSettlementWorkingCopyCsv(workspace, qualification);
  assert.match(csv, /"'=unsafe player"/);
  assert.match(csv, /"'\+formula"/);
  assert.equal(buildSettlementWorkingCopyCsv({ ...workspace, qualificationResultVersionId: tournamentId }, qualification), null);
  assert.equal(buildSettlementWorkingCopyCsv({ ...workspace, qualifierChoices: workspace.qualifierChoices.map((choice, index) => index ? choice : { ...choice, displayName: "Altered" }) }, qualification), null);
  assert.equal(buildSettlementWorkingCopyCsv({ ...workspace, draft: null }, qualification), null);
});

test("working-copy route is authenticated, server-derived, private, and fail-closed", () => {
  const route = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/settlement-draft/working-copy/route.ts", "utf8");
  const client = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/settlement/settlement-client.tsx", "utf8");
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /getSettlementWorkspace\(admin, actorId, id, eventId\)[\s\S]*getQualificationResult\(admin, actorId, id, eventId\)/);
  assert.match(route, /settlement_draft_required[\s\S]*status: 409/);
  assert.match(route, /private, no-store/);
  assert.match(route, /content-disposition/);
  assert.doesNotMatch(route, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(client, /Download Private Working Copy/);
  assert.match(client, /director review only/);
  assert.match(client, /official ACC export remain unavailable/);
});
