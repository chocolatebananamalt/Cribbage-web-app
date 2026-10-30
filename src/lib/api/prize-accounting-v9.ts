import { isUuid } from './validation.ts';
import { isQAccountingClassifications, isQAccountingFacts, type QAccountingClassification, type QAccountingFacts, type QAccountingWorkspace } from './q-accounting-v6.ts';
import { isQObligationsV2 } from './q-obligation-review-v2.ts';
import { isDirectorPrizeScheduleV3, type DirectorPrizeScheduleV3 } from '../results/prize-schedule.ts';
import { isRegularPrizeRoundingV3, type RegularPrizeRoundingResultV3 } from '../results/regular-prize-rounding-v3.ts';
export { Q_ACCOUNTING_EXPENSE_CATEGORIES } from './q-accounting-v6.ts';
export type PrizeAccountingClassificationV9 = QAccountingClassification;
export type PrizeAccountingRoundingV9 = Extract<RegularPrizeRoundingResultV3, { status: 'calculated' }>;
export type PrizeAccountingDraftRequestV9 = { expectedVersion: number; sourceDigest: string; expenseClassifications: QAccountingClassification[]; reason: string; reviewed: true };
export type PrizeAccountingFundingRequestV9 = { expectedVersion: number; sourceDigest: string; draftId: string; amountMinor: number; receivedAt: string; evidenceReference: string; reason: string; reviewed: true };
export type PrizeAccountingVoidFundingRequestV9 = { expectedVersion: number; sourceDigest: string; draftId: string; voidsId: string; reason: string; reviewed: true };
export type PrizeAccountingFinalRequestV9 = { expectedVersion: number; draftId: string; draftVersion: number; expectedFundingVersion: number; reason: string; reviewed: true };
export type PrizeAccountingActionV9 = 'draft' | 'funding' | 'void_funding' | 'final';
export type PrizeAccountingRequestV9 = PrizeAccountingDraftRequestV9 | PrizeAccountingFundingRequestV9 | PrizeAccountingVoidFundingRequestV9 | PrizeAccountingFinalRequestV9;
export type PrizeAccountingAwardV9 = { participantId: string; displayName: string; bandStart: number; bandEnd: number; weight: number; totalAwardMinor: number };
export type PrizeAccountingFundingRecordV9 = { id: string; version: number; eventType: 'received' | 'voided'; amountMinor: number; receivedAt: string | null; evidenceReference: string; reason: string; voidsId: string | null; sourceDigest: string; recordedAt: string };
export type PrizeAccountingFactsV9 = Omit<QAccountingFacts, 'receiptTotalMinor'> & { receiptTotalMinor: number; sideIncomeMinor: number };
export type PrizeAccountingSideObligationV9 = { participantId: string; displayName: string; poolRank: number; qualified: boolean; amountMinor: number; status: 'unpaid' };
export type PrizeAccountingSideReviewV9 = { poolId: string; reviewId: string | null; sourceDigest: string | null; obligations: PrizeAccountingSideObligationV9[] | null };
export type PrizeAccountingWorkspaceV9 = {
 tournamentId: string; eventId: string; sourceDigest: string; blockers: string[]; currentDraftVersion: number; currentFinalVersion: number;
 regularRule: null | { scheduleVersionId: string; scheduleVersion: number; rule: DirectorPrizeScheduleV3 };
 qReview: QAccountingWorkspace['qReview']; facts: PrizeAccountingFactsV9 | null; sideReviews: PrizeAccountingSideReviewV9[];
 draft: null | { id: string; version: number; sourceDigest: string; current: boolean; request: PrizeAccountingDraftRequestV9; rounding: PrizeAccountingRoundingV9; awards: PrizeAccountingAwardV9[] };
 funding: { version: number; requiredMinor: number; receivedMinor: number; shortfallMinor: number; unallocatedMinor: number; records: PrizeAccountingFundingRecordV9[] };
 finalization: null | { id: string; version: 1; draftId: string; draftVersion: number; sourceDigest: string; current: boolean; status: 'unpaid'; fundingVersion: number; restrictedBalanceMinor: number; fundingReceivedMinor: number };
 automaticPayment: false;
};
export type PrizeAccountingResultV9 =
 | { status: 'prize_accounting_draft_saved_v9'; draftId: string; eventId: string; version: number; sourceDigest: string }
 | { status: 'prize_rounding_funding_recorded_v9'; fundingId: string; eventId: string; version: number; sourceDigest: string; draftId: string; eventType: 'received' | 'voided'; amountMinor: number }
 | { status: 'prize_accounting_finalized_unpaid_v9'; finalizationId: string; draftId: string; eventId: string; version: 1; sourceDigest: string }
 | { status: 'rejected'; eventId: string; code: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const whole = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const version = (v: unknown, min = 0): v is number => whole(v, min) && v <= 256;
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const reference = (v: unknown): v is string => typeof v === 'string' && v.length >= 1 && v.length <= 500 && v === v.trim() && !/[\u0000-\u001f\u007f]/.test(v);
const timestamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
const sameId = (a: unknown, b: unknown) => isUuid(a) && isUuid(b) && a.toLowerCase() === b.toLowerCase();
const sum = (values: number[]) => values.reduce((n, x) => n + BigInt(x), BigInt(0));
const rejectionCodes = new Set(['invalid_request', 'not_director', 'tournament_unavailable', 'unsupported_scope', 'source_blocked', 'source_changed', 'stale_version', 'already_finalized', 'already_drafted', 'schedule_required', 'schedule_revision_required', 'q_review_required', 'funding_unreconciled', 'legacy_settlement_preserved', 'invalid_expense_classification', 'sanctioning_assessment_unfunded', 'insufficient_participant_return', 'non_conserving_ledger', 'crosscheck_incomplete', 'idempotency_conflict', 'rounding_policy_required', 'funding_shortfall', 'funding_overage', 'funding_already_voided', 'funding_not_found', 'amount_exceeds_shortfall', 'whole_five_awards_required', 'unsupported_computational_domain']);
export function isPrizeAccountingDraftRequestV9(v: unknown): v is PrizeAccountingDraftRequestV9 {
 return object(v) && exact(v, ['expectedVersion', 'sourceDigest', 'expenseClassifications', 'reason', 'reviewed']) && version(v.expectedVersion) && v.expectedVersion < 256 && digest(v.sourceDigest) && isQAccountingClassifications(v.expenseClassifications) && reference(v.reason) && v.reviewed === true;
}
export function isPrizeAccountingFundingRequestV9(v: unknown): v is PrizeAccountingFundingRequestV9 {
 return object(v) && exact(v, ['expectedVersion', 'sourceDigest', 'draftId', 'amountMinor', 'receivedAt', 'evidenceReference', 'reason', 'reviewed']) && version(v.expectedVersion) && v.expectedVersion < 256 && digest(v.sourceDigest) && isUuid(v.draftId) && whole(v.amountMinor, 1) && timestamp(v.receivedAt) && reference(v.evidenceReference) && reference(v.reason) && v.reviewed === true;
}
export function isPrizeAccountingVoidFundingRequestV9(v: unknown): v is PrizeAccountingVoidFundingRequestV9 {
 return object(v) && exact(v, ['expectedVersion', 'sourceDigest', 'draftId', 'voidsId', 'reason', 'reviewed']) && version(v.expectedVersion) && v.expectedVersion < 256 && digest(v.sourceDigest) && isUuid(v.draftId) && isUuid(v.voidsId) && reference(v.reason) && v.reviewed === true;
}
export function isPrizeAccountingFinalRequestV9(v: unknown): v is PrizeAccountingFinalRequestV9 {
 return object(v) && exact(v, ['expectedVersion', 'draftId', 'draftVersion', 'expectedFundingVersion', 'reason', 'reviewed']) && v.expectedVersion === 0 && isUuid(v.draftId) && version(v.draftVersion, 1) && version(v.expectedFundingVersion) && reference(v.reason) && v.reviewed === true;
}
export function isPrizeAccountingRequestV9(v: unknown, action: PrizeAccountingActionV9): v is PrizeAccountingRequestV9 {
 return action === 'draft' ? isPrizeAccountingDraftRequestV9(v) : action === 'funding' ? isPrizeAccountingFundingRequestV9(v) : action === 'void_funding' ? isPrizeAccountingVoidFundingRequestV9(v) : action === 'final' && isPrizeAccountingFinalRequestV9(v);
}
export function isPrizeAccountingReconciliationRequestV9(v: unknown): v is { operationId: string; action: PrizeAccountingActionV9; request: PrizeAccountingRequestV9 } {
 return object(v) && exact(v, ['operationId', 'action', 'request']) && isUuid(v.operationId) && ['draft', 'funding', 'void_funding', 'final'].includes(v.action as string) && isPrizeAccountingRequestV9(v.request, v.action as PrizeAccountingActionV9);
}
export function isPrizeAccountingResultV9(v: unknown, eid: string): v is PrizeAccountingResultV9 {
 if (!object(v) || !sameId(v.eventId, eid)) return false;
 if (v.status === 'rejected') return exact(v, ['status', 'eventId', 'code']) && typeof v.code === 'string' && rejectionCodes.has(v.code);
 if (!digest(v.sourceDigest) || !version(v.version, 1) || !isUuid(v.draftId)) return false;
 if (v.status === 'prize_accounting_draft_saved_v9') return exact(v, ['status', 'draftId', 'eventId', 'version', 'sourceDigest']);
 if (v.status === 'prize_rounding_funding_recorded_v9') return exact(v, ['status', 'fundingId', 'eventId', 'version', 'sourceDigest', 'draftId', 'eventType', 'amountMinor']) && isUuid(v.fundingId) && ['received', 'voided'].includes(v.eventType as string) && whole(v.amountMinor, 1);
 return v.status === 'prize_accounting_finalized_unpaid_v9' && exact(v, ['status', 'finalizationId', 'draftId', 'eventId', 'version', 'sourceDigest']) && isUuid(v.finalizationId) && v.version === 1;
}
export function prizeAccountingResultMatchesV9(result: PrizeAccountingResultV9, action: PrizeAccountingActionV9, request: PrizeAccountingRequestV9): boolean {
 if (result.status === 'rejected') return true;
 if (action === 'draft') return result.status === 'prize_accounting_draft_saved_v9' && isPrizeAccountingDraftRequestV9(request) && result.version === request.expectedVersion + 1 && result.sourceDigest === request.sourceDigest;
 if (action === 'funding' || action === 'void_funding') return result.status === 'prize_rounding_funding_recorded_v9' && 'sourceDigest' in request && 'draftId' in request && sameId(result.draftId, request.draftId) && result.sourceDigest === request.sourceDigest && result.version === request.expectedVersion + 1 && result.eventType === (action === 'funding' ? 'received' : 'voided') && (action !== 'funding' || isPrizeAccountingFundingRequestV9(request) && result.amountMinor === request.amountMinor);
 return result.status === 'prize_accounting_finalized_unpaid_v9' && isPrizeAccountingFinalRequestV9(request) && sameId(result.draftId, request.draftId) && result.version === request.expectedVersion + 1;
}

function isLegacyCompatibleAccountingWorkspaceV9(v: unknown, tid: string, eid: string): boolean {
 if (!object(v) || !exact(v, ['tournamentId', 'eventId', 'sourceDigest', 'blockers', 'currentDraftVersion', 'currentFinalVersion', 'regularRule', 'qReview', 'facts', 'draft', 'funding', 'finalization', 'automaticPayment']) || !sameId(v.tournamentId, tid) || !sameId(v.eventId, eid) || !digest(v.sourceDigest) || !Array.isArray(v.blockers) || v.blockers.length > 64 || !v.blockers.every(b => typeof b === 'string' && /^[a-z_]{1,100}$/.test(b)) || !version(v.currentDraftVersion) || !version(v.currentFinalVersion) || v.automaticPayment !== false || !(v.facts === null || isQAccountingFacts(v.facts))) return false;
 if (v.regularRule !== null && (!object(v.regularRule) || !exact(v.regularRule, ['scheduleVersionId', 'scheduleVersion', 'rule']) || !isUuid(v.regularRule.scheduleVersionId) || !version(v.regularRule.scheduleVersion, 1) || !isDirectorPrizeScheduleV3(v.regularRule.rule))) return false;
 if (v.qReview !== null && (!object(v.qReview) || !exact(v.qReview, ['id', 'version', 'sourceDigest', 'obligations']) || !isUuid(v.qReview.id) || !version(v.qReview.version, 1) || !digest(v.qReview.sourceDigest) || !isQObligationsV2(v.qReview.obligations))) return false;
 if (v.draft !== null && (!object(v.draft) || !exact(v.draft, ['id', 'version', 'sourceDigest', 'current', 'request', 'rounding', 'awards']) || !isUuid(v.draft.id) || v.draft.version !== v.currentDraftVersion || !version(v.draft.version, 1) || !digest(v.draft.sourceDigest) || typeof v.draft.current !== 'boolean' || !isPrizeAccountingDraftRequestV9(v.draft.request) || !isRegularPrizeRoundingV3(v.draft.rounding) || !Array.isArray(v.draft.awards) || v.draft.awards.length !== v.draft.rounding.expectedQualifierCount || new Set(v.draft.awards.map(a => object(a) ? a.participantId : null)).size !== v.draft.awards.length || !v.draft.awards.every((a, i) => object(a) && exact(a, ['participantId', 'displayName', 'bandStart', 'bandEnd', 'weight', 'totalAwardMinor']) && isUuid(a.participantId) && reference(a.displayName) && whole(a.bandStart, 1) && whole(a.bandEnd, a.bandStart) && whole(a.weight, 1) && a.totalAwardMinor === (v.draft as PrizeAccountingWorkspaceV9['draft'])!.rounding.awardsMinor[i]))) return false;
 const funding = v.funding;
 if (!object(funding) || !exact(funding, ['version', 'requiredMinor', 'receivedMinor', 'shortfallMinor', 'unallocatedMinor', 'records']) || !version(funding.version) || !whole(funding.requiredMinor) || !whole(funding.receivedMinor) || !whole(funding.shortfallMinor) || !whole(funding.unallocatedMinor) || !Array.isArray(funding.records) || funding.records.length !== funding.version || !funding.records.every(r => object(r) && exact(r, ['id', 'version', 'eventType', 'amountMinor', 'receivedAt', 'evidenceReference', 'reason', 'voidsId', 'sourceDigest', 'recordedAt']) && isUuid(r.id) && version(r.version, 1) && ['received', 'voided'].includes(r.eventType as string) && whole(r.amountMinor, 1) && (r.eventType === 'received' ? timestamp(r.receivedAt) && r.voidsId === null && reference(r.evidenceReference) : r.receivedAt === null && isUuid(r.voidsId) && (r.evidenceReference === '' || reference(r.evidenceReference))) && reference(r.reason) && digest(r.sourceDigest) && timestamp(r.recordedAt))) return false;
 if (funding.shortfallMinor !== Math.max(funding.requiredMinor - funding.receivedMinor, 0) || funding.unallocatedMinor !== Math.max(funding.receivedMinor - funding.requiredMinor, 0) || new Set(funding.records.map(r => r.id)).size !== funding.records.length || new Set(funding.records.map(r => r.version)).size !== funding.records.length) return false;
 const records = funding.records as PrizeAccountingFundingRecordV9[], receipts = records.filter(r => r.eventType === 'received'), voids = records.filter(r => r.eventType === 'voided');
 if (records.some(r => r.version > (funding.version as number)) || new Set(voids.map(r => r.voidsId)).size !== voids.length || voids.some(r => !receipts.some(original => sameId(original.id, r.voidsId) && original.amountMinor === r.amountMinor && original.version < r.version)) || sum(receipts.map(r => r.amountMinor)) - sum(voids.map(r => r.amountMinor)) !== BigInt(funding.receivedMinor)) return false;
 if (v.finalization !== null && (!object(v.finalization) || !exact(v.finalization, ['id', 'version', 'draftId', 'draftVersion', 'sourceDigest', 'current', 'status', 'fundingVersion', 'restrictedBalanceMinor', 'fundingReceivedMinor']) || !isUuid(v.finalization.id) || v.finalization.version !== 1 || v.currentFinalVersion !== 1 || !isUuid(v.finalization.draftId) || !version(v.finalization.draftVersion, 1) || !digest(v.finalization.sourceDigest) || typeof v.finalization.current !== 'boolean' || v.finalization.status !== 'unpaid' || !version(v.finalization.fundingVersion) || !whole(v.finalization.restrictedBalanceMinor) || !whole(v.finalization.fundingReceivedMinor))) return false;
 const facts = v.facts as PrizeAccountingWorkspaceV9['facts'], draft = v.draft as PrizeAccountingWorkspaceV9['draft'], rule = v.regularRule as PrizeAccountingWorkspaceV9['regularRule'], final = v.finalization as PrizeAccountingWorkspaceV9['finalization'], q = v.qReview as PrizeAccountingWorkspaceV9['qReview'];
 if (draft === null && v.currentDraftVersion !== 0 || final === null && v.currentFinalVersion !== 0) return false;
 if (draft && !draft.awards.every(a => draft.rounding.cohorts.some(c => c.bandStart === a.bandStart && c.bandEnd === a.bandEnd && c.weight === a.weight && c.awardMinor === a.totalAwardMinor))) return false;
 if (facts && (q ? sum(q.obligations.map(p => p.fundMinor)) !== BigInt(facts.qIncomeMinor) : facts.qIncomeMinor !== 0)) return false;
 if (draft?.current && (!facts || !rule || draft.sourceDigest !== v.sourceDigest || draft.request.sourceDigest !== v.sourceDigest || draft.rounding.grossBaseIncomeMinor !== facts.baseIncomeMinor || draft.rounding.expenseTotalMinor !== facts.expenseTotalMinor || draft.rounding.originalBudgetMinor !== facts.regularAwardMinor || draft.rounding.expectedQualifierCount !== rule.rule.expectedQualifierCount || funding.requiredMinor !== draft.rounding.requiredFundingMinor || !draft.awards.every(a => facts.canonicalMrp.rows.some(r => sameId(r.participantId, a.participantId) && r.bandStart === a.bandStart && r.bandEnd === a.bandEnd) && rule.rule.cohorts.some(c => c.bandStart === a.bandStart && c.bandEnd === a.bandEnd && c.weight === a.weight)))) return false;
 if (draft?.current && facts && rule) {
  const classes = draft.request.expenseClassifications, benefits = new Set(['sanctioning', 'meals', 'coffee', 'donuts', 'pastries', 'snacks', 'charity', 'trophies']);
  if (classes.length !== facts.expenseEvidence.length || classes.some(c => !facts.expenseEvidence.some(e => sameId(c.expenseEventId, e.expenseEventId))) || sum(classes.filter(c => benefits.has(c.category)).map(c => facts.expenseEvidence.find(e => sameId(c.expenseEventId, e.expenseEventId))!.amountMinor)) !== BigInt(draft.rounding.benefitExpenseMinor) || draft.rounding.minimumReturnMinor !== facts.minimumReturnMinor || !draft.rounding.cohorts.every((c, i) => c.bandStart === rule.rule.cohorts[i]?.bandStart && c.bandEnd === rule.rule.cohorts[i]?.bandEnd && c.weight === rule.rule.cohorts[i]?.weight)) return false;
 }
 if (final?.current && (!draft?.current || !sameId(final.draftId, draft.id) || final.draftVersion !== draft.version || final.sourceDigest !== v.sourceDigest || final.fundingVersion !== funding.version || final.fundingReceivedMinor !== funding.receivedMinor || funding.shortfallMinor !== 0 || funding.unallocatedMinor !== 0 || final.restrictedBalanceMinor !== draft.rounding.restrictedBalanceMinor)) return false;
 return !(v.blockers.length === 0 && (!facts || !rule));
}

export function isPrizeAccountingWorkspaceV9(v: unknown, tid: string, eid: string): v is PrizeAccountingWorkspaceV9 {
 if (!object(v) || !exact(v, ['tournamentId', 'eventId', 'sourceDigest', 'blockers', 'currentDraftVersion', 'currentFinalVersion', 'regularRule', 'qReview', 'facts', 'sideReviews', 'draft', 'funding', 'finalization', 'automaticPayment']) || !Array.isArray(v.sideReviews)) return false;
 const { sideReviews, ...baseWorkspace } = v;
 if (v.facts !== null) {
  if (!object(v.facts) || !whole(v.facts.sideIncomeMinor) || !object(v.facts.ledgerSnapshot) || !whole(v.facts.ledgerSnapshot.paymentTotalMinor) || !whole(v.facts.receiptTotalMinor)) return false;
  const { sideIncomeMinor, ...baseFacts } = v.facts;
  const normalizedFacts = { ...baseFacts, receiptTotalMinor: v.facts.ledgerSnapshot.paymentTotalMinor };
  if (!isLegacyCompatibleAccountingWorkspaceV9({ ...baseWorkspace, facts: normalizedFacts }, tid, eid)) return false;
  if (!whole(v.facts.baseIncomeMinor) || !whole(v.facts.qIncomeMinor) || BigInt(v.facts.receiptTotalMinor) !== BigInt(v.facts.ledgerSnapshot.paymentTotalMinor) + BigInt(sideIncomeMinor) || BigInt(v.facts.ledgerSnapshot.paymentTotalMinor) !== BigInt(v.facts.baseIncomeMinor) + BigInt(v.facts.qIncomeMinor)) return false;
 } else if (!isLegacyCompatibleAccountingWorkspaceV9({ ...baseWorkspace, facts: null }, tid, eid)) return false;
 const facts = object(v.facts) ? v.facts : null;
 const draft = object(v.draft) ? v.draft : null;
 const funding = object(v.funding) ? v.funding : null;
 const blockers = Array.isArray(v.blockers) ? v.blockers as string[] : [];
 const poolIds = new Set<string>(), reviewIds = new Set<string>();
 let sideMinor = BigInt(0);
 let hasPendingReview = false;
 for (const review of sideReviews) {
  if (!object(review) || !exact(review, ['poolId', 'reviewId', 'sourceDigest', 'obligations']) || !isUuid(review.poolId) || poolIds.has(review.poolId.toLowerCase())) return false;
  poolIds.add(review.poolId.toLowerCase());
  if (review.reviewId === null && review.sourceDigest === null && review.obligations === null) {
   if (!blockers.includes('side_review_required') || v.finalization !== null || v.currentFinalVersion !== 0) return false;
   hasPendingReview = true;
   continue;
  }
  if (!isUuid(review.reviewId) || !digest(review.sourceDigest) || !Array.isArray(review.obligations) || review.obligations.length < 1 || review.obligations.length > 1000 || reviewIds.has(review.reviewId.toLowerCase())) return false;
  reviewIds.add(review.reviewId.toLowerCase());
  const recipients = new Set<string>();
  for (let i = 0; i < review.obligations.length; i++) {
   const row = review.obligations[i];
   if (!object(row) || !exact(row, ['participantId', 'displayName', 'poolRank', 'qualified', 'amountMinor', 'status']) || !isUuid(row.participantId) || recipients.has(row.participantId.toLowerCase()) || !reference(row.displayName) || row.poolRank !== i + 1 || typeof row.qualified !== 'boolean' || !whole(row.amountMinor, 1) || row.status !== 'unpaid') return false;
   recipients.add(row.participantId.toLowerCase()); sideMinor += BigInt(row.amountMinor);
  }
 }
 if (facts && !hasPendingReview && blockers.length === 0 && sideMinor !== BigInt(facts.sideIncomeMinor as number)) return false;
 if (blockers.length === 0 && (v.facts === null || sideReviews.length === 0)) return false;
 const currentDraft = draft?.current === true;
 if (currentDraft && facts && object(draft.rounding) && funding) {
  const rounding = draft.rounding;
  if (!whole(rounding.roundedBudgetMinor) || !whole(rounding.restrictedBalanceMinor) || !whole(funding.receivedMinor) || !whole(funding.shortfallMinor) || !whole(funding.unallocatedMinor) || !whole(facts.expenseTotalMinor) || !whole(facts.qIncomeMinor) || !whole(facts.sideIncomeMinor)) return false;
  if (blockers.length === 0 && !hasPendingReview && BigInt(facts.receiptTotalMinor as number) + BigInt(funding.receivedMinor) + BigInt(funding.shortfallMinor) !== BigInt(facts.expenseTotalMinor) + BigInt(rounding.roundedBudgetMinor) + BigInt(facts.qIncomeMinor) + BigInt(facts.sideIncomeMinor) + BigInt(rounding.restrictedBalanceMinor) + BigInt(funding.unallocatedMinor)) return false;
 }
 return true;
}
