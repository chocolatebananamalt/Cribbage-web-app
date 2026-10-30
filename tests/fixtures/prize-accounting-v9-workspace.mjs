// TEST ONLY: portable synthetic fixtures for the v9 workspace codec/UI.
// Generated from the existing fictional V8 base-accounting fixture and the
// captured local SQL contract. All identities, amounts and evidence are fake;
// no hosted data, personal information, secrets or actual payments are used.
import { makePrizeAccountingV8Fixture, id } from './prize-accounting-v8-workspace.mjs';

const sidePoolId = id(730), sideReviewId = id(731), qReviewId = id(732);
const sideDigest = 'c'.repeat(64), qDigest = 'd'.repeat(64);
function sideRecipients(baseFacts) {
  return [
    { participantId: baseFacts.canonicalMrp.rows[0].participantId, displayName: baseFacts.canonicalMrp.rows[0].displayName, poolRank: 1, qualified: true, amountMinor: 8500, status: 'unpaid' },
    { participantId: baseFacts.canonicalMrp.rows[1].participantId, displayName: baseFacts.canonicalMrp.rows[1].displayName, poolRank: 2, qualified: true, amountMinor: 5500, status: 'unpaid' },
    { participantId: baseFacts.canonicalMrp.rows[2].participantId, displayName: baseFacts.canonicalMrp.rows[2].displayName, poolRank: 3, qualified: true, amountMinor: 3000, status: 'unpaid' },
  ];
}
function qReview(baseFacts, noQ) {
  if (noQ) return null;
  const rows = baseFacts.canonicalMrp.rows;
  return { id: qReviewId, version: 1, sourceDigest: qDigest, obligations: [
    { poolVersionId: id(740), policyId: id(750), name: 'TEST ONLY Q Graduated', fundMinor: 16000, kind: 'award', status: 'unpaid', rows: [
      { participantId: rows[0].participantId, displayName: rows[0].displayName, amountMinor: 8000, qualificationRank: 1, qRank: 1 },
      { participantId: rows[1].participantId, displayName: rows[1].displayName, amountMinor: 5500, qualificationRank: 2, qRank: 2 },
      { participantId: rows[2].participantId, displayName: rows[2].displayName, amountMinor: 2500, qualificationRank: 3, qRank: 3 },
    ] },
    { poolVersionId: id(741), policyId: id(751), name: 'TEST ONLY Q Equal', fundMinor: 1000, kind: 'refund', status: 'unpaid', rows: [
      { participantId: id(770), displayName: 'TEST ONLY nonqualifying Q entrant', amountMinor: 1000, qualificationRank: null, qRank: null },
    ] },
  ] };
}
function makeV9(base, { noQ = false } = {}) {
  const workspace = structuredClone(base);
  const facts = workspace.facts;
  facts.qIncomeMinor = noQ ? 0 : 17000;
  facts.sideIncomeMinor = 17000;
  facts.ledgerSnapshot.paymentTotalMinor = facts.baseIncomeMinor + facts.qIncomeMinor;
  facts.receiptTotalMinor = facts.ledgerSnapshot.paymentTotalMinor + facts.sideIncomeMinor;
  workspace.qReview = qReview(facts, noQ);
  workspace.sideReviews = [{ poolId: sidePoolId, reviewId: sideReviewId, sourceDigest: sideDigest, obligations: sideRecipients(facts) }];
  return workspace;
}

const down = makePrizeAccountingV8Fixture({ down: true, fresh: true });
const up = makePrizeAccountingV8Fixture();
export const qSide = makeV9(down.finalized);
export const qSideFinal = qSide;
export const sideOnly = makeV9(down.withDraft, { noQ: true });
export const upFinal = makeV9(up.finalized);
export const v9FixtureProvenance = 'TEST ONLY portable synthetic workspace; not a retained SQL dump or server-accepted record.';

export function makeUnfundedUpwardFixture() {
  const workspace = structuredClone(upFinal);
  workspace.finalization = null; workspace.currentFinalVersion = 0;
  workspace.funding = { version: 0, requiredMinor: 450, receivedMinor: 0, shortfallMinor: 450, unallocatedMinor: 0, records: [] };
  return workspace;
}

export function makePendingSideReviewFixture() {
  const workspace = structuredClone(qSide);
  workspace.blockers = ['side_review_required']; workspace.draft = null; workspace.currentDraftVersion = 0;
  workspace.finalization = null; workspace.currentFinalVersion = 0;
  workspace.sideReviews = [{ poolId: sidePoolId, reviewId: null, sourceDigest: null, obligations: null }];
  return workspace;
}
