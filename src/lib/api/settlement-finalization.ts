import { isUuid } from "./validation.ts";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export const MANUAL_SETTLEMENT_ATTESTATIONS = {
  expenseLedgerReviewed: true,
  mrpClaimsReviewed: true,
  noAutomaticAccSubmission: true,
  officialSourceReviewed: true,
  payoutClaimsReviewed: true,
  qPoolClaimsReviewed: true,
} as const;

export type ManualSettlementFinalizationRequest = {
  settlementDraftId: string;
  settlementDraftVersion: number;
  qualificationResultVersionId: string;
  playoffResultVersionId: string;
  expectedFinalizationVersion: number;
  eventIncomeMinor: number;
  eventExpenseMinor: number;
  placementPayoutTotalMinor: number;
  qPoolPayoutTotalMinor: number;
  otherAwardTotalMinor: number;
  retainedBalanceMinor: number;
  expectedPaymentReceiptCount: number;
  expectedPaymentReceiptTotalMinor: number;
  expectedExpenseCount: number;
  expectedExpenseTotalMinor: number;
  officialSourceReference: string;
  attestations: typeof MANUAL_SETTLEMENT_ATTESTATIONS;
  idempotencyKey: string;
};

export type ManualSettlementFinalizationWorkspace = {
  tournamentId: string;
  eventId: string;
  currentVersion: number;
  draft: null | {
    settlementDraftId: string;
    settlementDraftVersion: number;
    qualificationResultVersionId: string;
    playoffResultVersionId: string;
    paymentReceiptCount: number;
    paymentReceiptTotalMinor: number;
    expenseCount: number;
    expenseTotalMinor: number;
    placementPayoutTotalMinor: number;
    qPoolPayoutTotalMinor: number;
    otherAwardTotalMinor: number;
    mrpClaimCount: number;
    qualifierCount: number;
  };
  finalization: null | {
    finalizationId: string;
    version: number;
    settlementDraftId: string;
    eventIncomeMinor: number;
    eventExpenseMinor: number;
    placementPayoutTotalMinor: number;
    qPoolPayoutTotalMinor: number;
    otherAwardTotalMinor: number;
    retainedBalanceMinor: number;
    officialSourceReference: string;
    currencyCode: "USD";
    reconciled: true;
    accSubmitted: false;
    finalizedAt: string;
    finalizedBy: string;
  };
  capabilities: { manualReconciliation: true; automaticPayoutCalculation: false; automaticMrpCalculation: false; accSubmission: false };
};

const REJECTIONS = new Set([
  "invalid_request", "not_director", "tournament_unavailable", "settlement_draft_unavailable",
  "version_binding_unavailable", "event_dispute_unresolved", "mrp_claims_incomplete", "payout_totals_changed",
  "ledger_snapshot_changed", "non_conserving_ledger", "ledger_allocation_exceeded", "stale_version", "idempotency_conflict",
]);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};
const whole = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const pgWhole = (value: unknown) => whole(value) && (value as number) <= 2_147_483_647;
const timestamp = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const sourceReference = (value: unknown) => typeof value === "string" && value === value.trim()
  && value.length >= 1 && value.length <= 500 && new TextEncoder().encode(value).length <= 2000
  && !/[\u0000-\u001f\u007f]/.test(value);
const attestations = (value: unknown): value is typeof MANUAL_SETTLEMENT_ATTESTATIONS => record(value)
  && exact(value, Object.keys(MANUAL_SETTLEMENT_ATTESTATIONS))
  && Object.entries(MANUAL_SETTLEMENT_ATTESTATIONS).every(([key, expected]) => value[key] === expected);

export function isManualSettlementFinalizationRequest(value: unknown): value is ManualSettlementFinalizationRequest {
  if (!record(value) || !exact(value, ["settlementDraftId", "settlementDraftVersion", "qualificationResultVersionId",
    "playoffResultVersionId", "expectedFinalizationVersion", "eventIncomeMinor", "eventExpenseMinor",
    "placementPayoutTotalMinor", "qPoolPayoutTotalMinor", "otherAwardTotalMinor", "retainedBalanceMinor",
    "expectedPaymentReceiptCount", "expectedPaymentReceiptTotalMinor", "expectedExpenseCount", "expectedExpenseTotalMinor",
    "officialSourceReference", "attestations", "idempotencyKey"])) return false;
  return isUuid(value.settlementDraftId) && pgWhole(value.settlementDraftVersion) && value.settlementDraftVersion !== 0
    && isUuid(value.qualificationResultVersionId) && isUuid(value.playoffResultVersionId)
    && pgWhole(value.expectedFinalizationVersion) && whole(value.eventIncomeMinor) && whole(value.eventExpenseMinor)
    && whole(value.placementPayoutTotalMinor) && whole(value.qPoolPayoutTotalMinor) && whole(value.otherAwardTotalMinor)
    && whole(value.retainedBalanceMinor) && pgWhole(value.expectedPaymentReceiptCount) && whole(value.expectedPaymentReceiptTotalMinor)
    && pgWhole(value.expectedExpenseCount) && whole(value.expectedExpenseTotalMinor)
    && sourceReference(value.officialSourceReference) && attestations(value.attestations) && isUuid(value.idempotencyKey);
}

export function isManualSettlementFinalizationOutcome(value: unknown, tournamentId: string, eventId: string) {
  return record(value) && exact(value, ["status", "tournamentId", "eventId", "settlementDraftId", "settlementDraftVersion",
    "qualificationResultVersionId", "playoffResultVersionId", "finalizationId", "version", "supersedesFinalizationId",
    "eventIncomeMinor", "eventExpenseMinor", "placementPayoutTotalMinor", "qPoolPayoutTotalMinor", "otherAwardTotalMinor",
    "retainedBalanceMinor", "paymentReceiptCount", "paymentReceiptTotalMinor", "expenseCount", "expenseTotalMinor",
    "mrpClaimCount", "currencyCode", "reconciled", "accSubmitted", "finalizedAt"])
    && value.status === "settlement_finalized_manual" && value.tournamentId === tournamentId && value.eventId === eventId
    && [value.settlementDraftId, value.qualificationResultVersionId, value.playoffResultVersionId, value.finalizationId].every(isUuid)
    && (value.supersedesFinalizationId === null || isUuid(value.supersedesFinalizationId))
    && [value.settlementDraftVersion, value.version].every((item) => whole(item) && item !== 0)
    && [value.eventIncomeMinor, value.eventExpenseMinor, value.placementPayoutTotalMinor, value.qPoolPayoutTotalMinor,
      value.otherAwardTotalMinor, value.retainedBalanceMinor, value.paymentReceiptCount, value.paymentReceiptTotalMinor,
      value.expenseCount, value.expenseTotalMinor, value.mrpClaimCount].every(whole)
    && value.currencyCode === "USD" && value.reconciled === true && value.accSubmitted === false && timestamp(value.finalizedAt);
}

export function isRejectedManualSettlementFinalization(value: unknown, eventId: string) {
  return record(value) && exact(value, ["status", "code", "eventId"]) && value.status === "rejected"
    && value.eventId === eventId && typeof value.code === "string" && REJECTIONS.has(value.code);
}

export function isManualSettlementFinalizationWorkspace(value: unknown, tournamentId: string, eventId: string): value is ManualSettlementFinalizationWorkspace {
  if (!record(value) || !exact(value, ["tournamentId", "eventId", "currentVersion", "draft", "finalization", "capabilities"])
    || value.tournamentId !== tournamentId || value.eventId !== eventId || !whole(value.currentVersion)
    || !record(value.capabilities) || !exact(value.capabilities, ["manualReconciliation", "automaticPayoutCalculation", "automaticMrpCalculation", "accSubmission"])
    || value.capabilities.manualReconciliation !== true || value.capabilities.automaticPayoutCalculation !== false
    || value.capabilities.automaticMrpCalculation !== false || value.capabilities.accSubmission !== false) return false;
  if (value.draft !== null) {
    if (!record(value.draft) || !exact(value.draft, ["settlementDraftId", "settlementDraftVersion", "qualificationResultVersionId",
      "playoffResultVersionId", "paymentReceiptCount", "paymentReceiptTotalMinor", "expenseCount", "expenseTotalMinor",
      "placementPayoutTotalMinor", "qPoolPayoutTotalMinor", "otherAwardTotalMinor", "mrpClaimCount", "qualifierCount"])
      || ![value.draft.settlementDraftId, value.draft.qualificationResultVersionId, value.draft.playoffResultVersionId].every(isUuid)
      || ![value.draft.settlementDraftVersion, value.draft.paymentReceiptCount, value.draft.paymentReceiptTotalMinor,
        value.draft.expenseCount, value.draft.expenseTotalMinor, value.draft.placementPayoutTotalMinor,
        value.draft.qPoolPayoutTotalMinor, value.draft.otherAwardTotalMinor, value.draft.mrpClaimCount,
        value.draft.qualifierCount].every(whole) || value.draft.settlementDraftVersion === 0) return false;
  }
  if (value.finalization !== null) {
    if (!record(value.finalization) || !exact(value.finalization, ["finalizationId", "version", "settlementDraftId", "eventIncomeMinor",
      "eventExpenseMinor", "placementPayoutTotalMinor", "qPoolPayoutTotalMinor", "otherAwardTotalMinor", "retainedBalanceMinor",
      "officialSourceReference", "currencyCode", "reconciled", "accSubmitted", "finalizedAt", "finalizedBy"])
      || !isUuid(value.finalization.finalizationId) || !isUuid(value.finalization.settlementDraftId)
      || !whole(value.finalization.version) || value.finalization.version === 0
      || ![value.finalization.eventIncomeMinor, value.finalization.eventExpenseMinor, value.finalization.placementPayoutTotalMinor,
        value.finalization.qPoolPayoutTotalMinor, value.finalization.otherAwardTotalMinor, value.finalization.retainedBalanceMinor].every(whole)
      || !sourceReference(value.finalization.officialSourceReference) || value.finalization.currencyCode !== "USD"
      || value.finalization.reconciled !== true || value.finalization.accSubmitted !== false
      || !timestamp(value.finalization.finalizedAt) || typeof value.finalization.finalizedBy !== "string"
      || value.finalization.finalizedBy.trim().length === 0) return false;
  }
  return true;
}

export async function getManualSettlementFinalizationWorkspace(admin: RpcClient, actorId: string, tournamentId: string, eventId: string) {
  const { data, error } = await admin.rpc("get_standard_singles_settlement_finalization_workspace_v1", {
    p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId,
  });
  return !error && isManualSettlementFinalizationWorkspace(data, tournamentId, eventId) ? data : null;
}

export async function finalizeManualSettlement(admin: RpcClient, actorId: string, tournamentId: string, eventId: string, request: ManualSettlementFinalizationRequest) {
  return admin.rpc("finalize_standard_singles_settlement_manual_v1", {
    p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId,
    p_settlement_draft_id: request.settlementDraftId, p_settlement_draft_version: request.settlementDraftVersion,
    p_qualification_result_version_id: request.qualificationResultVersionId,
    p_playoff_result_version_id: request.playoffResultVersionId,
    p_expected_final_version: request.expectedFinalizationVersion, p_event_income_minor: request.eventIncomeMinor,
    p_event_expense_minor: request.eventExpenseMinor, p_placement_payout_total_minor: request.placementPayoutTotalMinor,
    p_q_pool_payout_total_minor: request.qPoolPayoutTotalMinor, p_other_award_total_minor: request.otherAwardTotalMinor,
    p_retained_balance_minor: request.retainedBalanceMinor, p_expected_payment_receipt_count: request.expectedPaymentReceiptCount,
    p_expected_payment_receipt_total_minor: request.expectedPaymentReceiptTotalMinor,
    p_expected_expense_count: request.expectedExpenseCount, p_expected_expense_total_minor: request.expectedExpenseTotalMinor,
    p_official_source_reference: request.officialSourceReference, p_attestations: request.attestations,
    p_operation_id: request.idempotencyKey,
  });
}
