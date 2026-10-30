import { isUuid } from "./validation.ts";
import { isQObligationsV2, type QObligationV2 } from "./q-obligation-review-v2.ts";
import { isDirectorPrizeSchedule, type DirectorPrizeSchedule } from "../results/prize-schedule.ts";
import type { CanonicalMrp, LedgerSnapshot, ExpenseEvidence } from "./settlement-v5.ts";

export const Q_ACCOUNTING_EXPENSE_CATEGORIES = ["sanctioning", "meals", "coffee", "donuts", "pastries", "snacks", "charity", "trophies", "cards", "printing", "advertising", "postage", "telephone", "supplies", "hall_rental"] as const;
export type QAccountingExpenseCategory = typeof Q_ACCOUNTING_EXPENSE_CATEGORIES[number];
export type QAccountingClassification = { expenseEventId: string; category: QAccountingExpenseCategory; evidenceReference: string };
export type QAccountingDraftRequest = { expectedVersion: number; sourceDigest: string; qReviewId: string; scheduleVersionId: string; reason: string; expenseClassifications: QAccountingClassification[]; reviewed: true };
export type QAccountingFinalRequest = { draftId: string; draftVersion: number; expectedVersion: number; reason: string; reviewed: true };
export type QAccountingAction = "draft" | "final";
export type QAccountingRequest = QAccountingDraftRequest | QAccountingFinalRequest;
export type QAccountingSource = { kind: "playoff_outcome_v3" | "playoff_outcome_v4"; resultId: string; qualificationResultVersionId: string };
export type QAccountingFacts = { baseIncomeMinor: number; qIncomeMinor: number; receiptTotalMinor: number; expenseTotalMinor: number; regularAwardMinor: number; minimumReturnMinor: number; expenseEvidence: ExpenseEvidence[]; ledgerSnapshot: LedgerSnapshot; canonicalMrp: Extract<CanonicalMrp, { status: "available" }> };
export type QAccountingReviewedFacts = QAccountingFacts & { benefitExpenseMinor: number; operatingExpenseMinor: number; participantReturnMinor: number; expenseClassifications: QAccountingClassification[]; source: QAccountingSource };
export type QAccountingSchedule = { status: "available"; scheduleVersionId: string; scheduleVersion: number; rule: DirectorPrizeSchedule; grossEntryIncomeMinor: number; expenseTotalMinor: number; prizeBudgetMinor: number; roundingRemainderMinor: number; awards: Array<{ participantId: string; displayName: string; bandStart: number; bandEnd: number; weight: number; totalAwardMinor: number }> };
export type QAccountingWorkspace = { tournamentId: string; eventId: string; sourceDigest: string; blockers: string[]; currentDraftVersion: number; currentFinalVersion: number; qReview: null | { id: string; version: number; sourceDigest: string; obligations: QObligationV2[] }; regularSchedule: QAccountingSchedule | null; facts: QAccountingFacts | null; draft: null | { id: string; version: number; sourceDigest: string; request: QAccountingDraftRequest; facts: QAccountingReviewedFacts; current: boolean }; finalization: null | { id: string; version: number; draftId: string; sourceDigest: string; current: boolean; status: "unpaid" }; automaticPayment: false };
export type QAccountingResult = { status: "q_accounting_draft_saved_v6"; draftId: string; eventId: string; version: number; sourceDigest: string } | { status: "q_accounting_finalized_unpaid_v6"; finalizationId: string; draftId: string; eventId: string; version: number; sourceDigest: string } | { status: "rejected"; eventId: string; code: string };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join() === [...keys].sort().join();
const whole = (v: unknown, minimum = 0): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= minimum;
const version = (v: unknown, minimum = 0): v is number => whole(v, minimum) && v <= 256;
const reference = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 500 && v === v.trim() && !/[\u0000-\u001f\u007f]/.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const sum = (items: number[]) => items.reduce((total, n) => total + BigInt(n), BigInt(0));
const unique = (ids: string[]) => new Set(ids).size === ids.length;
export function isQAccountingClassifications(v: unknown): v is QAccountingClassification[] {
  return Array.isArray(v) && v.length <= 256 && v.every(c => record(c) && exact(c, ["expenseEventId", "category", "evidenceReference"]) && isUuid(c.expenseEventId) && Q_ACCOUNTING_EXPENSE_CATEGORIES.includes(c.category as QAccountingExpenseCategory) && reference(c.evidenceReference)) && unique(v.map(c => c.expenseEventId));
}
export function isQAccountingDraftRequest(v: unknown): v is QAccountingDraftRequest {
  return record(v) && exact(v, ["expectedVersion", "sourceDigest", "qReviewId", "scheduleVersionId", "reason", "expenseClassifications", "reviewed"]) && version(v.expectedVersion) && v.expectedVersion < 256 && hash(v.sourceDigest) && isUuid(v.qReviewId) && isUuid(v.scheduleVersionId) && reference(v.reason) && isQAccountingClassifications(v.expenseClassifications) && v.reviewed === true;
}
export function isQAccountingFinalRequest(v: unknown): v is QAccountingFinalRequest {
  return record(v) && exact(v, ["draftId", "draftVersion", "expectedVersion", "reason", "reviewed"]) && isUuid(v.draftId) && version(v.draftVersion, 1) && version(v.expectedVersion) && v.expectedVersion < 256 && reference(v.reason) && v.reviewed === true;
}
export function isQAccountingRequest(v: unknown, action: QAccountingAction): v is QAccountingRequest { return action === "draft" ? isQAccountingDraftRequest(v) : isQAccountingFinalRequest(v); }
const rejections = new Set(["whole_five_awards_required", "invalid_request", "not_director", "tournament_unavailable", "unsupported_scope", "source_blocked", "source_changed", "stale_version", "already_finalized", "already_drafted", "q_review_required", "schedule_required", "schedule_revision_required", "funding_unreconciled", "legacy_settlement_preserved", "invalid_expense_classification", "sanctioning_assessment_unfunded", "insufficient_participant_return", "non_conserving_ledger", "crosscheck_incomplete", "idempotency_conflict"]);
export function isQAccountingResult(v: unknown, eventId: string): v is QAccountingResult {
  if (!record(v) || v.eventId !== eventId || !isUuid(eventId)) return false;
  if (v.status === "rejected") return exact(v, ["status", "eventId", "code"]) && typeof v.code === "string" && rejections.has(v.code);
  return (v.status === "q_accounting_draft_saved_v6" ? exact(v, ["status", "draftId", "eventId", "version", "sourceDigest"]) : v.status === "q_accounting_finalized_unpaid_v6" && exact(v, ["status", "finalizationId", "draftId", "eventId", "version", "sourceDigest"]) && isUuid(v.finalizationId)) && isUuid(v.draftId) && version(v.version, 1) && hash(v.sourceDigest);
}
export function qAccountingResultMatches(v: QAccountingResult, action: QAccountingAction, request: QAccountingRequest): boolean {
  if (v.status === "rejected") return true;
  return action === "draft" ? v.status === "q_accounting_draft_saved_v6" && isQAccountingDraftRequest(request) && v.sourceDigest === request.sourceDigest && v.version === request.expectedVersion + 1
    : v.status === "q_accounting_finalized_unpaid_v6" && isQAccountingFinalRequest(request) && v.draftId === request.draftId && v.version === request.expectedVersion + 1;
}
function isLedger(v: unknown): v is LedgerSnapshot {
  return record(v) && exact(v, ["paymentCount", "paymentTotalMinor", "expenseCount", "expenseTotalMinor", "paymentIds", "expenseIds"]) && whole(v.paymentCount) && whole(v.expenseCount) && whole(v.paymentTotalMinor) && whole(v.expenseTotalMinor) && Array.isArray(v.paymentIds) && Array.isArray(v.expenseIds) && v.paymentIds.length <= 256 && v.expenseIds.length <= 256 && v.paymentIds.length === v.paymentCount && v.expenseIds.length === v.expenseCount && v.paymentIds.every(isUuid) && v.expenseIds.every(isUuid) && unique(v.paymentIds) && unique(v.expenseIds);
}
function isCanonical(v: unknown): v is Extract<CanonicalMrp, { status: "available" }> {
  if (!record(v) || !exact(v, ["status", "sourceVersion", "effectiveDate", "bracketSourceVersion", "rows"]) || v.status !== "available" || v.sourceVersion !== "acc-published-mrp-2016-08-01" || v.effectiveDate !== "2016-08-01" || v.bracketSourceVersion !== "acc-rulebook-2025-effective-2025-08-01" || !Array.isArray(v.rows) || ![4,5].includes(v.rows.length)) return false;
  const valid = v.rows.every((r, i) => record(r) && exact(r, ["participantId", "displayName", "qualificationRank", "gamePoints", "qualifyingMrp", "playoffMrp", "totalMrp", "evidenceNote", "playedMatchWins", "byeWins", "eliminatedInRound", "bandStart", "bandEnd"]) && isUuid(r.participantId) && reference(r.displayName) && r.qualificationRank === i + 1 && whole(r.gamePoints) && whole(r.qualifyingMrp) && whole(r.playoffMrp) && whole(r.totalMrp) && r.totalMrp === r.qualifyingMrp + r.playoffMrp && reference(r.evidenceNote) && whole(r.playedMatchWins) && r.playedMatchWins <= ((v.rows as unknown[]).length === 4 ? 2 : 3) && r.byeWins === ((v.rows as unknown[]).length === 5 && i < 3 ? 1 : 0) && (r.eliminatedInRound === null || whole(r.eliminatedInRound, 1)) && whole(r.bandStart, 1) && whole(r.bandEnd, r.bandStart) && r.bandEnd <= (v.rows as unknown[]).length) && unique(v.rows.map(r => r.participantId));
  if (!valid) return false;
  if (v.rows.length === 4) return true;
  const rows = v.rows as Extract<CanonicalMrp, {status:"available"}>["rows"];
  const bands = rows.map(r=>`${r.bandStart}:${r.bandEnd}`).sort().join(',');
  return bands === '1:1,2:2,3:4,3:4,5:5' && sum(rows.map(r=>r.playedMatchWins)) === BigInt(4)
    && rows.every(r=>{
      const credits = r.playedMatchWins + r.byeWins;
      const champion = r.bandStart === 1;
      const elimination = champion ? null : r.bandStart === 2 ? 3 : r.bandStart === 3 ? 2 : 1;
      const qualifying = r.qualificationRank <= 3 ? 5*(r.gamePoints-13) : 5;
      return r.gamePoints <= 36 && (r.qualificationRank > 3 || r.gamePoints >= 14)
        && r.qualifyingMrp === qualifying && r.eliminatedInRound === elimination
        && credits === (champion ? 3 : elimination! - 1)
        && r.playoffMrp === 7*(credits+1)*(credits+2)/2;
    });
}
const factKeys = ["baseIncomeMinor", "qIncomeMinor", "receiptTotalMinor", "expenseTotalMinor", "regularAwardMinor", "minimumReturnMinor", "expenseEvidence", "ledgerSnapshot", "canonicalMrp"];
export function isQAccountingFacts(v: unknown, reviewed = false): v is QAccountingFacts | QAccountingReviewedFacts {
  if (!record(v) || !exact(v, [...factKeys, ...(reviewed ? ["benefitExpenseMinor", "operatingExpenseMinor", "participantReturnMinor", "expenseClassifications", "source"] : [])]) || !factKeys.slice(0, 6).every(k => whole(v[k])) || !isLedger(v.ledgerSnapshot) || !isCanonical(v.canonicalMrp) || !Array.isArray(v.expenseEvidence) || v.expenseEvidence.length !== v.ledgerSnapshot.expenseCount || !v.expenseEvidence.every(e => record(e) && exact(e, ["expenseEventId", "description", "amountMinor", "currencyCode"]) && isUuid(e.expenseEventId) && reference(e.description) && whole(e.amountMinor) && e.currencyCode === "USD" && v.ledgerSnapshot && (v.ledgerSnapshot as LedgerSnapshot).expenseIds.includes(e.expenseEventId)) || !unique(v.expenseEvidence.map(e => e.expenseEventId))) return false;
  if (sum(v.expenseEvidence.map(e => e.amountMinor)) !== BigInt(v.expenseTotalMinor as number) || v.expenseTotalMinor !== v.ledgerSnapshot.expenseTotalMinor || v.receiptTotalMinor !== v.ledgerSnapshot.paymentTotalMinor || BigInt(v.baseIncomeMinor as number) + BigInt(v.qIncomeMinor as number) !== BigInt(v.receiptTotalMinor as number) || BigInt(v.regularAwardMinor as number) + BigInt(v.expenseTotalMinor as number) !== BigInt(v.baseIncomeMinor as number) || BigInt(v.minimumReturnMinor as number) !== (BigInt(v.baseIncomeMinor as number) * BigInt(85) + BigInt(99)) / BigInt(100)) return false;
  if (!reviewed) return true;
  return whole(v.benefitExpenseMinor) && whole(v.operatingExpenseMinor) && whole(v.participantReturnMinor) && isQAccountingClassifications(v.expenseClassifications) && v.expenseClassifications.length === v.expenseEvidence.length && v.expenseClassifications.every(c => (v.expenseEvidence as ExpenseEvidence[]).some(e => e.expenseEventId === c.expenseEventId)) && BigInt(v.benefitExpenseMinor) + BigInt(v.operatingExpenseMinor) === BigInt(v.expenseTotalMinor as number) && BigInt(v.benefitExpenseMinor) + BigInt(v.regularAwardMinor as number) === BigInt(v.participantReturnMinor) && v.participantReturnMinor >= (v.minimumReturnMinor as number) && record(v.source) && exact(v.source, ["kind", "resultId", "qualificationResultVersionId"]) && v.source.kind === ((v.canonicalMrp as Extract<CanonicalMrp,{status:"available"}>).rows.length === 5 ? "playoff_outcome_v4" : "playoff_outcome_v3") && isUuid(v.source.resultId) && isUuid(v.source.qualificationResultVersionId);
}
export function isQAccountingSchedule(v: unknown): v is QAccountingSchedule {
  // Legacy penny codecs cannot certify the new whole-$5 funding policy.
  if (record(v) && record(v.rule) && v.rule.kind === "regular-prize-cohort-5usd-v3") return false;
  if (!record(v) || !exact(v, ["status", "scheduleVersionId", "scheduleVersion", "rule", "grossEntryIncomeMinor", "expenseTotalMinor", "prizeBudgetMinor", "roundingRemainderMinor", "awards"]) || v.status !== "available" || !isUuid(v.scheduleVersionId) || !version(v.scheduleVersion, 1) || !isDirectorPrizeSchedule(v.rule) || !whole(v.grossEntryIncomeMinor) || !whole(v.expenseTotalMinor) || !whole(v.prizeBudgetMinor) || !whole(v.roundingRemainderMinor) || !Array.isArray(v.awards) || v.awards.length !== v.rule.expectedQualifierCount || !v.awards.every(a => record(a) && exact(a, ["participantId", "displayName", "bandStart", "bandEnd", "weight", "totalAwardMinor"]) && isUuid(a.participantId) && reference(a.displayName) && whole(a.bandStart, 1) && whole(a.bandEnd, a.bandStart) && a.bandEnd <= (v.rule as DirectorPrizeSchedule).expectedQualifierCount && whole(a.weight, 1) && whole(a.totalAwardMinor, 1)) || !unique(v.awards.map(a => a.participantId))) return false;
  const denominator = v.rule.cohorts.reduce((n, c) => n + BigInt(c.weight) * BigInt(c.bandEnd - c.bandStart + 1), BigInt(0));
  const floors = v.awards.map(a => BigInt(v.prizeBudgetMinor as number) * BigInt(a.weight) / denominator);
  const remainder = BigInt(v.prizeBudgetMinor) - floors.reduce((n, x) => n + x, BigInt(0));
  return BigInt(v.roundingRemainderMinor) === remainder && v.awards.every((a, i) => BigInt(a.totalAwardMinor) === floors[i] + (a.bandStart === 1 && a.bandEnd === 1 ? remainder : BigInt(0))) && sum(v.awards.map(a => a.totalAwardMinor)) === BigInt(v.prizeBudgetMinor) && BigInt(v.expenseTotalMinor) + BigInt(v.prizeBudgetMinor) === BigInt(v.grossEntryIncomeMinor);
}
export function isQAccountingWorkspace(v: unknown, tid: string, eid: string): v is QAccountingWorkspace {
  if (!record(v) || !exact(v, ["tournamentId", "eventId", "sourceDigest", "blockers", "currentDraftVersion", "currentFinalVersion", "qReview", "regularSchedule", "facts", "draft", "finalization", "automaticPayment"]) || v.tournamentId !== tid || v.eventId !== eid || !isUuid(tid) || !isUuid(eid) || !hash(v.sourceDigest) || !Array.isArray(v.blockers) || v.blockers.length > 64 || !v.blockers.every(b => typeof b === "string" && /^[a-z_]{1,100}$/.test(b)) || !version(v.currentDraftVersion) || !version(v.currentFinalVersion) || v.automaticPayment !== false || !(v.facts === null || isQAccountingFacts(v.facts)) || !(v.regularSchedule === null || isQAccountingSchedule(v.regularSchedule))) return false;
  if (v.qReview !== null && (!record(v.qReview) || !exact(v.qReview, ["id", "version", "sourceDigest", "obligations"]) || !isUuid(v.qReview.id) || !version(v.qReview.version, 1) || !hash(v.qReview.sourceDigest) || !isQObligationsV2(v.qReview.obligations))) return false;
  if (v.draft !== null && (!record(v.draft) || !exact(v.draft, ["id", "version", "sourceDigest", "request", "facts", "current"]) || !isUuid(v.draft.id) || v.draft.version !== v.currentDraftVersion || !version(v.draft.version, 1) || !hash(v.draft.sourceDigest) || !isQAccountingDraftRequest(v.draft.request) || !isQAccountingFacts(v.draft.facts, true) || typeof v.draft.current !== "boolean" || (v.draft.current && v.draft.sourceDigest !== v.sourceDigest))) return false;
  if (v.finalization !== null && (!record(v.finalization) || !exact(v.finalization, ["id", "version", "draftId", "sourceDigest", "current", "status"]) || !isUuid(v.finalization.id) || !isUuid(v.finalization.draftId) || v.finalization.version !== v.currentFinalVersion || !version(v.finalization.version, 1) || !hash(v.finalization.sourceDigest) || typeof v.finalization.current !== "boolean" || v.finalization.status !== "unpaid" || (v.finalization.current && v.finalization.sourceDigest !== v.sourceDigest))) return false;
  const checkedQReview = v.qReview as QAccountingWorkspace["qReview"];
  if (v.facts && checkedQReview && sum(checkedQReview.obligations.map(p => p.fundMinor)) !== BigInt(v.facts.qIncomeMinor)) return false;
  if (v.facts && v.regularSchedule && v.facts.canonicalMrp.rows.length !== v.regularSchedule.awards.length) return false;
  if (v.facts && v.regularSchedule && (v.facts.baseIncomeMinor !== v.regularSchedule.grossEntryIncomeMinor || v.facts.regularAwardMinor !== v.regularSchedule.prizeBudgetMinor)) return false;
  if (v.facts && v.regularSchedule && !v.regularSchedule.awards.every(a => (v.facts as QAccountingFacts).canonicalMrp.rows.some(r => r.participantId === a.participantId && r.bandStart === a.bandStart && r.bandEnd === a.bandEnd) && (v.regularSchedule as QAccountingSchedule).rule.cohorts.some(c => c.bandStart === a.bandStart && c.bandEnd === a.bandEnd && c.weight === a.weight))) return false;
  const checkedDraft = v.draft as QAccountingWorkspace["draft"], checkedSchedule = v.regularSchedule as QAccountingWorkspace["regularSchedule"];
  if (checkedDraft?.current && (!checkedQReview || !checkedSchedule || checkedDraft.request.qReviewId !== checkedQReview.id || checkedDraft.request.scheduleVersionId !== checkedSchedule.scheduleVersionId || checkedDraft.request.sourceDigest !== v.sourceDigest)) return false;
  if (v.finalization && v.finalization.current && (!checkedDraft || !checkedDraft.current || v.finalization.draftId !== checkedDraft.id)) return false;
  return !(v.blockers.length === 0 && (!v.facts || !v.qReview || !v.regularSchedule));
}
export function isQAccountingReconciliationRequest(v: unknown): v is { operationId: string; action: QAccountingAction; request: QAccountingRequest } {
  return record(v) && exact(v, ["operationId", "action", "request"]) && isUuid(v.operationId) && (v.action === "draft" || v.action === "final") && isQAccountingRequest(v.request, v.action);
}
