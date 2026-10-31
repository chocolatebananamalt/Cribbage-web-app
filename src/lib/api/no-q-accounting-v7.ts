import { isUuid } from './validation.ts';
import { isQAccountingClassifications, isQAccountingFacts, isQAccountingFinalRequest, isQAccountingSchedule, type QAccountingClassification, type QAccountingFacts, type QAccountingReviewedFacts, type QAccountingSchedule, type QAccountingFinalRequest } from './q-accounting-v6.ts';
export { Q_ACCOUNTING_EXPENSE_CATEGORIES } from './q-accounting-v6.ts';
export type NoQAccountingClassification = QAccountingClassification;

export type NoQAccountingDraftRequest = { expectedVersion: number; sourceDigest: string; scheduleVersionId: string; reason: string; expenseClassifications: QAccountingClassification[]; reviewed: true };
export type NoQAccountingFinalRequest = QAccountingFinalRequest;
export type NoQAccountingAction = 'draft' | 'final';
export type NoQAccountingRequest = NoQAccountingDraftRequest | NoQAccountingFinalRequest;
export type NoQAccountingWorkspace = { tournamentId: string; eventId: string; sourceDigest: string; blockers: string[]; currentDraftVersion: number; currentFinalVersion: number; regularSchedule: QAccountingSchedule | null; facts: QAccountingFacts | null; draft: null | { id: string; version: number; sourceDigest: string; request: NoQAccountingDraftRequest; facts: QAccountingReviewedFacts; current: boolean }; finalization: null | { id: string; version: number; draftId: string; sourceDigest: string; current: boolean; status: 'unpaid' }; automaticPayment: false };
export type NoQAccountingResult = { status: 'no_q_accounting_draft_saved_v7'; draftId: string; eventId: string; version: number; sourceDigest: string } | { status: 'no_q_accounting_finalized_unpaid_v7'; finalizationId: string; draftId: string; eventId: string; version: number; sourceDigest: string } | { status: 'rejected'; eventId: string; code: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join() === [...keys].sort().join();
const version = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= 256;
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const reference = (v: unknown): v is string => typeof v === 'string' && v.length >= 1 && v.length <= 500 && v === v.trim() && !/[\u0000-\u001f\u007f]/.test(v);
const sameId = (a: unknown, b: unknown) => isUuid(a) && isUuid(b) && a.toLowerCase() === b.toLowerCase();
const rejectionCodes = new Set(['whole_five_awards_required', 'invalid_request', 'not_director', 'tournament_unavailable', 'unsupported_scope', 'source_blocked', 'source_changed', 'stale_version', 'already_finalized', 'already_drafted', 'schedule_required', 'schedule_revision_required', 'funding_unreconciled', 'legacy_settlement_preserved', 'invalid_expense_classification', 'sanctioning_assessment_unfunded', 'insufficient_participant_return', 'non_conserving_ledger', 'crosscheck_incomplete', 'idempotency_conflict']);
export function isNoQAccountingDraftRequest(v: unknown): v is NoQAccountingDraftRequest { return object(v) && exact(v, ['expectedVersion', 'sourceDigest', 'scheduleVersionId', 'reason', 'expenseClassifications', 'reviewed']) && version(v.expectedVersion) && v.expectedVersion < 256 && digest(v.sourceDigest) && isUuid(v.scheduleVersionId) && reference(v.reason) && isQAccountingClassifications(v.expenseClassifications) && v.reviewed === true; }
export const isNoQAccountingFinalRequest = isQAccountingFinalRequest;
export function isNoQAccountingRequest(v: unknown, action: NoQAccountingAction): v is NoQAccountingRequest { return action === 'draft' ? isNoQAccountingDraftRequest(v) : isNoQAccountingFinalRequest(v); }
export function isNoQAccountingReconciliationRequest(v: unknown): v is { operationId: string; action: NoQAccountingAction; request: NoQAccountingRequest } { return object(v) && exact(v, ['operationId', 'action', 'request']) && isUuid(v.operationId) && (v.action === 'draft' || v.action === 'final') && isNoQAccountingRequest(v.request, v.action); }
export function isNoQAccountingResult(v: unknown, eid: string): v is NoQAccountingResult {
 if (!object(v) || !sameId(v.eventId, eid)) return false;
 if (v.status === 'rejected') return exact(v, ['status', 'eventId', 'code']) && typeof v.code === 'string' && rejectionCodes.has(v.code);
 if (v.status === 'no_q_accounting_draft_saved_v7') return exact(v, ['status', 'draftId', 'eventId', 'version', 'sourceDigest']) && isUuid(v.draftId) && version(v.version, 1) && digest(v.sourceDigest);
 return v.status === 'no_q_accounting_finalized_unpaid_v7' && exact(v, ['status', 'finalizationId', 'draftId', 'eventId', 'version', 'sourceDigest']) && isUuid(v.finalizationId) && isUuid(v.draftId) && v.version === 1 && digest(v.sourceDigest);
}
export function noQAccountingResultMatches(result: NoQAccountingResult, action: NoQAccountingAction, request: NoQAccountingRequest) {
 if (result.status === 'rejected') return true;
 if (action === 'draft') return result.status === 'no_q_accounting_draft_saved_v7' && result.version === request.expectedVersion + 1 && 'sourceDigest' in request && result.sourceDigest === request.sourceDigest;
 return result.status === 'no_q_accounting_finalized_unpaid_v7' && 'draftId' in request && sameId(result.draftId, request.draftId) && result.version === request.expectedVersion + 1;
}
export function isNoQAccountingWorkspace(v: unknown, tid: string, eid: string): v is NoQAccountingWorkspace {
 if (!object(v) || !exact(v, ['tournamentId', 'eventId', 'sourceDigest', 'blockers', 'currentDraftVersion', 'currentFinalVersion', 'regularSchedule', 'facts', 'draft', 'finalization', 'automaticPayment']) || !sameId(v.tournamentId, tid) || !sameId(v.eventId, eid) || !digest(v.sourceDigest) || !Array.isArray(v.blockers) || v.blockers.length > 64 || !v.blockers.every(b => typeof b === 'string' && /^[a-z_]{1,100}$/.test(b)) || !version(v.currentDraftVersion) || !version(v.currentFinalVersion) || v.automaticPayment !== false || !(v.facts === null || isQAccountingFacts(v.facts) && v.facts.qIncomeMinor === 0) || !(v.regularSchedule === null || isQAccountingSchedule(v.regularSchedule))) return false;
 if (v.draft !== null && (!object(v.draft) || !exact(v.draft, ['id', 'version', 'sourceDigest', 'request', 'facts', 'current']) || !isUuid(v.draft.id) || v.draft.version !== v.currentDraftVersion || !version(v.draft.version, 1) || !digest(v.draft.sourceDigest) || !isNoQAccountingDraftRequest(v.draft.request) || !isQAccountingFacts(v.draft.facts, true) || v.draft.facts.qIncomeMinor !== 0 || typeof v.draft.current !== 'boolean' || v.draft.current && v.draft.sourceDigest !== v.sourceDigest)) return false;
 if (v.finalization !== null && (!object(v.finalization) || !exact(v.finalization, ['id', 'version', 'draftId', 'sourceDigest', 'current', 'status']) || !isUuid(v.finalization.id) || !isUuid(v.finalization.draftId) || v.finalization.version !== v.currentFinalVersion || v.finalization.version !== 1 || !digest(v.finalization.sourceDigest) || typeof v.finalization.current !== 'boolean' || v.finalization.status !== 'unpaid' || v.finalization.current && v.finalization.sourceDigest !== v.sourceDigest)) return false;
 const facts = v.facts as NoQAccountingWorkspace['facts'], schedule = v.regularSchedule as NoQAccountingWorkspace['regularSchedule'], draft = v.draft as NoQAccountingWorkspace['draft'];
 if (facts && schedule && (facts.canonicalMrp.rows.length !== schedule.awards.length || facts.baseIncomeMinor !== schedule.grossEntryIncomeMinor || facts.regularAwardMinor !== schedule.prizeBudgetMinor || facts.expenseTotalMinor !== schedule.expenseTotalMinor || !schedule.awards.every(a => facts.canonicalMrp.rows.some(r => sameId(r.participantId, a.participantId) && r.bandStart === a.bandStart && r.bandEnd === a.bandEnd) && schedule.rule.cohorts.some(c => c.bandStart === a.bandStart && c.bandEnd === a.bandEnd && c.weight === a.weight)))) return false;
 if (draft?.current && (!schedule || !sameId(draft.request.scheduleVersionId, schedule.scheduleVersionId) || draft.request.sourceDigest !== v.sourceDigest)) return false;
 if (v.finalization && v.finalization.current && (!draft?.current || !sameId(v.finalization.draftId, draft.id))) return false;
 return !(v.blockers.length === 0 && (!facts || !schedule));
}
