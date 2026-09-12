import { isUuid } from "./validation.ts";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

const BLOCKERS = [
  "official_mrp_fixture_missing",
  "q_pool_payout_fixture_missing",
  "event_payment_allocation_unsupported",
  "settlement_reconciliation_unsupported",
  "official_export_unsupported",
] as const;

const REJECTIONS = new Set([
  "tournament_unavailable", "not_director", "qualification_result_unavailable",
  "activated_setup_unavailable", "stale_version", "invalid_claims", "invalid_request",
  "idempotency_conflict",
]);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: string[]) {
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

const whole = (value: unknown, minimum = 0) => Number.isSafeInteger(value) && (value as number) >= minimum;
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const timestamp = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const nullableUuid = (value: unknown) => value === null || isUuid(value);

export type SettlementPlacement = { participantId: string; placement: number; prizeAmountMinor: number };
export type SettlementAward = { participantId: string; awardType: "q_pool" | "other"; qPoolSlot: 1 | 2 | null; amountMinor: number; note: string };
export type SettlementDraftRequest = {
  qualificationResultVersionId: string;
  expectedVersion: number;
  placements: SettlementPlacement[];
  awards: SettlementAward[];
  idempotencyKey: string;
};

export type SettlementDraftOutcome = {
  status: "settlement_draft_saved";
  tournamentId: string;
  eventId: string;
  qualificationResultVersionId: string;
  settlementDraftId: string;
  version: number;
  supersedesSettlementDraftId: string | null;
  placementCount: number;
  awardCount: number;
  currencyCode: "USD";
  paymentReceiptCount: number;
  paymentReceiptTotalMinor: number;
  expenseCount: number;
  expenseTotalMinor: number;
  reconciled: false;
  blockers: string[];
};

export type SettlementWorkspace = {
  tournamentId: string;
  eventId: string;
  qualificationResultVersionId: string;
  currencyCode: "USD";
  currentVersion: number;
  qualifierChoices: Array<{ participantId: string; displayName: string; qualificationRank: number }>;
  configuredQPools: Array<{ qPoolId: string; slot: 1 | 2; poolTypeCode: string; entryFeeMinor: number }>;
  draft: null | {
    settlementDraftId: string;
    version: number;
    createdAt: string;
    createdBy: string;
    placements: SettlementPlacement[];
    awards: SettlementAward[];
    serverTotals: {
      currencyCode: "USD";
      activePaymentReceiptCount: number;
      activePaymentReceiptTotalMinor: number;
      activeExpenseCount: number;
      activeExpenseTotalMinor: number;
      netCashPositionMinor: number;
    };
    reconciled: false;
    blockers: string[];
  };
  capabilities: { publication: false; approval: false; officialExport: false; mrpEntry: false };
};

function placement(value: unknown): value is SettlementPlacement {
  return record(value) && exact(value, ["participantId", "placement", "prizeAmountMinor"])
    && isUuid(value.participantId) && whole(value.placement, 1) && whole(value.prizeAmountMinor);
}

function award(value: unknown): value is SettlementAward {
  return record(value) && exact(value, ["participantId", "awardType", "qPoolSlot", "amountMinor", "note"])
    && isUuid(value.participantId) && (value.awardType === "q_pool" || value.awardType === "other")
    && ((value.awardType === "q_pool" && (value.qPoolSlot === 1 || value.qPoolSlot === 2))
      || (value.awardType === "other" && value.qPoolSlot === null))
    && whole(value.amountMinor, 1) && (value.amountMinor as number) <= 2147483647
    && typeof value.note === "string" && value.note.length <= 500;
}

export function isSettlementDraftRequest(value: unknown): value is SettlementDraftRequest {
  return record(value) && exact(value, ["qualificationResultVersionId", "expectedVersion", "placements", "awards", "idempotencyKey"])
    && isUuid(value.qualificationResultVersionId) && whole(value.expectedVersion)
    && Array.isArray(value.placements) && value.placements.length >= 2 && value.placements.length <= 128
    && value.placements.every(placement) && Array.isArray(value.awards) && value.awards.length <= 64
    && value.awards.every(award) && isUuid(value.idempotencyKey);
}

function blockers(value: unknown): value is string[] {
  return Array.isArray(value) && value.length === BLOCKERS.length
    && value.every((entry, index) => entry === BLOCKERS[index]);
}

export function isSettlementDraftOutcome(value: unknown, tournamentId: string, eventId: string): value is SettlementDraftOutcome {
  return record(value) && exact(value, ["status", "tournamentId", "eventId", "qualificationResultVersionId", "settlementDraftId", "version", "supersedesSettlementDraftId", "placementCount", "awardCount", "currencyCode", "paymentReceiptCount", "paymentReceiptTotalMinor", "expenseCount", "expenseTotalMinor", "reconciled", "blockers"])
    && value.status === "settlement_draft_saved" && value.tournamentId === tournamentId && value.eventId === eventId
    && isUuid(value.qualificationResultVersionId) && isUuid(value.settlementDraftId)
    && whole(value.version, 1) && nullableUuid(value.supersedesSettlementDraftId)
    && whole(value.placementCount, 2) && whole(value.awardCount) && value.currencyCode === "USD"
    && whole(value.paymentReceiptCount) && whole(value.paymentReceiptTotalMinor)
    && whole(value.expenseCount) && whole(value.expenseTotalMinor)
    && value.reconciled === false && blockers(value.blockers);
}

export function isRejectedSettlementDraft(value: unknown, eventId: string) {
  return record(value) && exact(value, ["status", "code", "eventId"])
    && value.status === "rejected" && value.eventId === eventId
    && typeof value.code === "string" && REJECTIONS.has(value.code);
}

export function isSettlementWorkspace(value: unknown, tournamentId: string, eventId: string): value is SettlementWorkspace {
  if (!record(value) || !exact(value, ["tournamentId", "eventId", "qualificationResultVersionId", "currencyCode", "currentVersion", "qualifierChoices", "configuredQPools", "draft", "capabilities"])
    || value.tournamentId !== tournamentId || value.eventId !== eventId || !isUuid(value.qualificationResultVersionId)
    || value.currencyCode !== "USD" || !whole(value.currentVersion) || !Array.isArray(value.qualifierChoices)
    || !value.qualifierChoices.every((item) => record(item) && exact(item, ["participantId", "displayName", "qualificationRank"])
      && isUuid(item.participantId) && text(item.displayName) && whole(item.qualificationRank, 1))
    || !Array.isArray(value.configuredQPools) || !value.configuredQPools.every((item) => record(item)
      && exact(item, ["qPoolId", "slot", "poolTypeCode", "entryFeeMinor"]) && isUuid(item.qPoolId)
      && (item.slot === 1 || item.slot === 2) && text(item.poolTypeCode) && whole(item.entryFeeMinor))
    || !record(value.capabilities) || !exact(value.capabilities, ["publication", "approval", "officialExport", "mrpEntry"])
    || Object.values(value.capabilities).some((entry) => entry !== false)) return false;
  if (value.draft === null) return true;
  const draft = value.draft;
  if (!record(draft) || !exact(draft, ["settlementDraftId", "version", "createdAt", "createdBy", "placements", "awards", "serverTotals", "reconciled", "blockers"])
    || !isUuid(draft.settlementDraftId) || !whole(draft.version, 1) || !timestamp(draft.createdAt)
    || !text(draft.createdBy) || !Array.isArray(draft.placements) || !draft.placements.every(placement)
    || !Array.isArray(draft.awards) || !draft.awards.every(award) || draft.reconciled !== false || !blockers(draft.blockers)
    || !record(draft.serverTotals) || !exact(draft.serverTotals, ["currencyCode", "activePaymentReceiptCount", "activePaymentReceiptTotalMinor", "activeExpenseCount", "activeExpenseTotalMinor", "netCashPositionMinor"])
    || draft.serverTotals.currencyCode !== "USD" || !whole(draft.serverTotals.activePaymentReceiptCount)
    || !whole(draft.serverTotals.activePaymentReceiptTotalMinor) || !whole(draft.serverTotals.activeExpenseCount)
    || !whole(draft.serverTotals.activeExpenseTotalMinor) || !Number.isSafeInteger(draft.serverTotals.netCashPositionMinor)) return false;
  return draft.version === value.currentVersion;
}

export async function getSettlementWorkspace(admin: RpcClient, actorId: string, tournamentId: string, eventId: string) {
  if (![actorId, tournamentId, eventId].every(isUuid)) throw new Error("Settlement workspace is unavailable.");
  const { data, error } = await admin.rpc("get_standard_singles_settlement_workspace_v1", {
    p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId,
  });
  if (error || !isSettlementWorkspace(data, tournamentId, eventId)) return null;
  return data;
}

export async function saveSettlementDraft(admin: RpcClient, actorId: string, tournamentId: string, eventId: string, request: SettlementDraftRequest) {
  return admin.rpc("save_standard_singles_settlement_draft_v1", {
    p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId,
    p_qualification_result_version_id: request.qualificationResultVersionId,
    p_expected_version: request.expectedVersion, p_placements: request.placements,
    p_awards: request.awards, p_operation_id: request.idempotencyKey,
  });
}
