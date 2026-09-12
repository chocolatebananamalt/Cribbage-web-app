import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  MANUAL_SETTLEMENT_ATTESTATIONS,
  isManualSettlementFinalizationOutcome,
  isManualSettlementFinalizationRequest,
  isManualSettlementFinalizationWorkspace,
  isRejectedManualSettlementFinalization,
} from "../src/lib/api/settlement-finalization.ts";

const migration = fs.readFileSync("database/migrations/0145_manual_settlement_finalization.sql", "utf8");
const route = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/settlement-finalization/route.ts", "utf8");
const reconciliationRoute = fs.readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/settlement-finalization/reconciliation/route.ts", "utf8");
const client = fs.readFileSync("src/app/tournament/[tournamentId]/events/[eventId]/settlement/settlement-finalization-client.tsx", "utf8");
const fixture = fs.readFileSync("tests/settlement-finalization.sql", "utf8");

const tournamentId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const draftId = "33333333-3333-4333-8333-333333333333";
const qualificationId = "44444444-4444-4444-8444-444444444444";
const playoffId = "55555555-5555-4555-8555-555555555555";
const operationId = "66666666-6666-4666-8666-666666666666";
const finalizationId = "77777777-7777-4777-8777-777777777777";

const request = {
  settlementDraftId: draftId, settlementDraftVersion: 3, qualificationResultVersionId: qualificationId,
  playoffResultVersionId: playoffId, expectedFinalizationVersion: 1, eventIncomeMinor: 20000,
  eventExpenseMinor: 2500, placementPayoutTotalMinor: 10000, qPoolPayoutTotalMinor: 5000,
  otherAwardTotalMinor: 1000, retainedBalanceMinor: 1500, expectedPaymentReceiptCount: 20,
  expectedPaymentReceiptTotalMinor: 40000, expectedExpenseCount: 2, expectedExpenseTotalMinor: 2500,
  officialSourceReference: "Director worksheet dated 2026-10-03", attestations: MANUAL_SETTLEMENT_ATTESTATIONS,
  idempotencyKey: operationId,
};

test("manual finalization request is exact, bounded, integer-only, and fully attested", () => {
  assert.equal(isManualSettlementFinalizationRequest(request), true);
  assert.equal(isManualSettlementFinalizationRequest({ ...request, extra: true }), false);
  assert.equal(isManualSettlementFinalizationRequest({ ...request, eventIncomeMinor: 1.5 }), false);
  assert.equal(isManualSettlementFinalizationRequest({ ...request, eventIncomeMinor: Number.MAX_SAFE_INTEGER + 1 }), false);
  assert.equal(isManualSettlementFinalizationRequest({ ...request, expectedExpenseCount: 2_147_483_648 }), false);
  assert.equal(isManualSettlementFinalizationRequest({ ...request, officialSourceReference: " source " }), false);
  assert.equal(isManualSettlementFinalizationRequest({ ...request, attestations: { ...MANUAL_SETTLEMENT_ATTESTATIONS, mrpClaimsReviewed: false } }), false);
  assert.equal(isManualSettlementFinalizationRequest({ ...request, attestations: { ...MANUAL_SETTLEMENT_ATTESTATIONS, extra: true } }), false);
});

test("manual finalization response and workspace codecs fail closed", () => {
  const outcome = {
    status: "settlement_finalized_manual", tournamentId, eventId, settlementDraftId: draftId,
    settlementDraftVersion: 3, qualificationResultVersionId: qualificationId, playoffResultVersionId: playoffId,
    finalizationId, version: 2, supersedesFinalizationId: null, eventIncomeMinor: 20000,
    eventExpenseMinor: 2500, placementPayoutTotalMinor: 10000, qPoolPayoutTotalMinor: 5000,
    otherAwardTotalMinor: 1000, retainedBalanceMinor: 1500, paymentReceiptCount: 20,
    paymentReceiptTotalMinor: 40000, expenseCount: 2, expenseTotalMinor: 2500, mrpClaimCount: 8,
    currencyCode: "USD", reconciled: true, accSubmitted: false, finalizedAt: "2026-10-03T20:00:00Z",
  };
  assert.equal(isManualSettlementFinalizationOutcome(outcome, tournamentId, eventId), true);
  assert.equal(isManualSettlementFinalizationOutcome({ ...outcome, accSubmitted: true }, tournamentId, eventId), false);
  assert.equal(isManualSettlementFinalizationOutcome({ ...outcome, surprise: true }, tournamentId, eventId), false);
  assert.equal(isRejectedManualSettlementFinalization({ status: "rejected", code: "non_conserving_ledger", eventId }, eventId), true);
  assert.equal(isRejectedManualSettlementFinalization({ status: "rejected", code: "invented", eventId }, eventId), false);

  const workspace = {
    tournamentId, eventId, currentVersion: 0,
    draft: { settlementDraftId: draftId, settlementDraftVersion: 3, qualificationResultVersionId: qualificationId,
      playoffResultVersionId: playoffId, paymentReceiptCount: 20, paymentReceiptTotalMinor: 40000,
      expenseCount: 2, expenseTotalMinor: 2500, placementPayoutTotalMinor: 10000,
      qPoolPayoutTotalMinor: 5000, otherAwardTotalMinor: 1000, mrpClaimCount: 8, qualifierCount: 8 },
    finalization: null,
    capabilities: { manualReconciliation: true, automaticPayoutCalculation: false, automaticMrpCalculation: false, accSubmission: false },
  };
  assert.equal(isManualSettlementFinalizationWorkspace(workspace, tournamentId, eventId), true);
  assert.equal(isManualSettlementFinalizationWorkspace({ ...workspace, capabilities: { ...workspace.capabilities, accSubmission: true } }, tournamentId, eventId), false);
});

test("database finalization is private, immutable, version-bound, conserving, audited, and retry-safe", () => {
  const writer = migration.slice(migration.indexOf("create or replace function public.finalize_standard_singles_settlement_manual_v1"), migration.indexOf("create or replace function public.get_standard_singles_settlement_finalization_workspace_v1"));
  assert.match(migration, /create table app\.standard_singles_settlement_final_versions/);
  assert.match(migration, /standard_singles_settlement_final_versions_immutable/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table app\.standard_singles_settlement_final_versions from public,anon,authenticated/);
  assert.doesNotMatch(migration, /auth\.role\(\)|request\.jwt\.claim\.role/);
  assert.match(migration, /role_row\.role in\('director','co_director'\)/);
  assert.match(migration, /p_settlement_draft_version is null[\s\S]*p_expected_expense_total_minor is null/);
  assert.match(migration, /standard_singles_settlement_playoff_bindings/);
  assert.match(migration, /qualification_result_versions newer/);
  assert.match(migration, /event_dispute_is_open/);
  assert.match(migration, /v_mrp_count<>v_qualifier_count/);
  assert.match(migration, /v_payment_count<>v_draft\.payment_receipt_count/);
  assert.match(migration, /v_active_payment_event_ids is distinct from v_draft_payment_event_ids/);
  assert.match(migration, /v_active_expense_event_ids is distinct from v_draft_expense_event_ids/);
  assert.match(migration, /p_event_income_minor<>p_event_expense_minor\+v_placement_total\+v_q_pool_total\+v_other_total\+p_retained_balance_minor/);
  assert.match(migration, /v_other_income\+p_event_income_minor>v_payment_total/);
  assert.match(migration, /standard_singles_settlement_manually_finalized/);
  assert.match(migration, /standard_singles_settlement_manual_finalization_rejected/);
  assert.match(migration, /expected-error subtransaction releases its advisory locks[\s\S]*pg_advisory_xact_lock[\s\S]*standard-singles-post-event:[\s\S]*from app\.tournaments[\s\S]*from app\.tournament_roles[\s\S]*select \* into v_existing/);
  assert.doesNotMatch(migration, /tournament-finance:/);
  const actorLock = writer.indexOf("p_actor_id::text||':'||p_operation_id::text");
  const eventLock = writer.indexOf("'standard-singles-post-event:'");
  const tournamentRowLock = writer.indexOf("from app.tournaments tournament");
  const roleRowLock = writer.indexOf("from app.tournament_roles role_row");
  assert.ok(actorLock >= 0 && actorLock < eventLock && eventLock < tournamentRowLock && tournamentRowLock < roleRowLock);
  const firstReceiptLookup = writer.indexOf("select * into v_existing from app.operation_receipts");
  const newOperationLifecycleGate = writer.indexOf("v_tournament_status not in('open','pending_finalization')");
  assert.ok(roleRowLock < firstReceiptLookup && firstReceiptLookup < newOperationLifecycleGate);
  const handler = writer.slice(writer.indexOf("exception when sqlstate 'P0001'"));
  const handlerTournamentLock = handler.indexOf("from app.tournaments tournament");
  const handlerRoleLock = handler.indexOf("from app.tournament_roles role_row");
  const handlerReceiptLookup = handler.indexOf("select * into v_existing from app.operation_receipts");
  assert.ok(handlerTournamentLock >= 0 && handlerTournamentLock < handlerRoleLock && handlerRoleLock < handlerReceiptLookup);
  assert.match(handler, /from app\.tournaments tournament[\s\S]*if not found then return v_response; end if;[\s\S]*from app\.tournament_roles role_row[\s\S]*if not found then return v_response; end if;[\s\S]*select \* into v_existing/);
  assert.match(migration, /idempotency_conflict/);
  assert.doesNotMatch(migration, /grant execute[^;]+to authenticated/i);
  assert.match(migration, /'automaticPayoutCalculation',false,'automaticMrpCalculation',false,'accSubmission',false/);
  assert.match(migration, /acc_submitted boolean not null check \(not acc_submitted\)/);
});

test("protected API and UI preserve an unresolved exact operation and avoid automatic claims", () => {
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(route, /isManualSettlementFinalizationRequest/);
  assert.match(reconciliationRoute, /Object\.keys\(body\)\.length !== 1/);
  assert.match(reconciliationRoute, /get_standard_singles_settlement_finalization_reconciliation_v1/);
  assert.match(client, /sessionStorage\.setItem\(key, JSON\.stringify\(envelope\)\)/);
  assert.match(client, /The prior finalization is unresolved\. Only its exact protected request may be retried\./);
  assert.match(client, /setSource\(saved\.officialSourceReference\)/);
  assert.match(client, /income must equal expenses, payouts, awards, and retained balance/);
  assert.match(client, /does not calculate ACC payouts or MRPs, send money, publish results, or submit anything to the ACC/);
  assert.match(client, /Not submitted to ACC/);
});

test("rollback fixture covers lifecycle, rejection, replay, conflict, audit, authority, and immutability", () => {
  for (const fragment of [
    "manual settlement finalization failed", "exact finalization replay failed", "changed finalization retry did not conflict",
    "non-conserving ledger accepted", "ledger snapshot change accepted", "incomplete MRP claims accepted",
    "equal-value payment event replacement accepted", "equal-value expense event replacement accepted",
    "closed-tournament accepted replay lost stored response", "closed-tournament rejected replay lost stored response",
    "unresolved event dispute accepted", "unauthorized finalization accepted", "revoked director exact replay bypassed current authority", "immutable finalization updated",
    "finalization acceptance was not audited", "finalization rejection was not audited",
  ]) assert.match(fixture, new RegExp(fragment, "i"));
  assert.match(fixture, /set_config\('request\.jwt\.claim\.role','service_role',true\)/);
  assert.match(fixture, /rollback;/);
});
