import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { isRejectedSettlementDraft, isSettlementDraftOutcome, isSettlementDraftRequest, isSettlementWorkspace } from "../src/lib/api/settlement-draft.ts";

const tournamentId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";
const qualificationResultVersionId = "30000000-0000-4000-8000-000000000001";
const ids = ["40000000-0000-4000-8000-000000000001", "40000000-0000-4000-8000-000000000002"];
const blockers = ["official_mrp_fixture_missing", "q_pool_payout_fixture_missing", "event_payment_allocation_unsupported", "settlement_reconciliation_unsupported", "official_export_unsupported"];

test("settlement draft request accepts exact cents-only placement and award claims", () => {
  const request = { qualificationResultVersionId, expectedVersion: 0, idempotencyKey: tournamentId,
    placements: ids.map((participantId, index) => ({ participantId, placement: index + 1, prizeAmountMinor: index ? 5000 : 10000 })),
    awards: [{ participantId: ids[0], awardType: "q_pool", qPoolSlot: 1, amountMinor: 2500, note: "" }] };
  assert.equal(isSettlementDraftRequest(request), true);
  assert.equal(isSettlementDraftRequest({ ...request, mrp: 10 }), false);
  assert.equal(isSettlementDraftRequest({ ...request, awards: [{ ...request.awards[0], qPoolSlot: null }] }), false);
  assert.equal(isSettlementDraftRequest({ ...request, placements: request.placements.slice(0, 1) }), false);
});

test("settlement outcomes remain explicitly unreconciled and blocked", () => {
  const outcome = { status: "settlement_draft_saved", tournamentId, eventId, qualificationResultVersionId,
    settlementDraftId: ids[0], version: 1, supersedesSettlementDraftId: null, placementCount: 2, awardCount: 0,
    currencyCode: "USD", paymentReceiptCount: 1, paymentReceiptTotalMinor: 1000, expenseCount: 1,
    expenseTotalMinor: 100, reconciled: false, blockers };
  assert.equal(isSettlementDraftOutcome(outcome, tournamentId, eventId), true);
  assert.equal(isSettlementDraftOutcome({ ...outcome, reconciled: true }, tournamentId, eventId), false);
  assert.equal(isSettlementDraftOutcome({ ...outcome, blockers: blockers.slice(1) }, tournamentId, eventId), false);
  assert.equal(isRejectedSettlementDraft({ status: "rejected", code: "stale_version", eventId }, eventId), true);
  assert.equal(isRejectedSettlementDraft({ status: "rejected", code: "publish_anyway", eventId }, eventId), false);
});

test("settlement workspace rejects expanded capabilities", () => {
  const value = { tournamentId, eventId, qualificationResultVersionId, currencyCode: "USD", currentVersion: 0,
    qualifierChoices: ids.map((participantId, index) => ({ participantId, displayName: `Player ${index + 1}`, qualificationRank: index + 1 })),
    configuredQPools: [], draft: null, capabilities: { publication: false, approval: false, officialExport: false, mrpEntry: false } };
  assert.equal(isSettlementWorkspace(value, tournamentId, eventId), true);
  assert.equal(isSettlementWorkspace({ ...value, capabilities: { ...value.capabilities, publication: true } }, tournamentId, eventId), false);
});

test("director UI keeps the draft private and labels withheld authority", () => {
  const page = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/settlement/page.tsx", "utf8");
  const client = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/settlement/settlement-client.tsx", "utf8");
  const route = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/settlement-draft/route.ts", "utf8");
  const reconciliation = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/settlement-draft/reconciliation/route.ts", "utf8");
  assert.match(page, /director.*co_director/);
  assert.match(page, /key={`\$\{workspace\.currentVersion\}-\$\{workspace\.draft\?\.settlementDraftId \?\? "new"\}`}/);
  assert.match(client, /Draft only/);
  assert.match(client, /not reconciled, approved, published, or an official ACC submission/);
  assert.match(client, /settlement-draft:\$\{actorId\}:\$\{eventId\}/);
  assert.match(client, /sessionStorage\.setItem/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /readMediumJson/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(reconciliation, /isRejectedSettlementDraft/);
  assert.match(client, /The prior save was rejected/);
  assert.match(client, /isSettlementDraftOutcome[\s\S]*setBusy\(false\); router\.refresh/);
  assert.match(client, /isRejectedSettlementDraft[\s\S]*setPlacements\(placementRows\(workspace\)\); setAwards\(awardRows\(workspace\)\)/);
  assert.match(client, /participantId: ""/);
  assert.match(client, /Choose a qualifier/);
});
