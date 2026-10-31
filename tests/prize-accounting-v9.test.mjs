import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isPrizeAccountingWorkspaceV9,
  isPrizeAccountingDraftRequestV9,
  isPrizeAccountingResultV9,
  prizeAccountingResultMatchesV9,
} from '../src/lib/api/prize-accounting-v9.ts';
import { isPrizeAccountingWorkspaceV8 } from '../src/lib/api/prize-accounting-v8.ts';
import { makePrizeAccountingV8Fixture } from './fixtures/prize-accounting-v8-workspace.mjs';
import { qSide, sideOnly, upFinal, makeUnfundedUpwardFixture, makePendingSideReviewFixture, v9FixtureProvenance } from './fixtures/prize-accounting-v9-workspace.mjs';

test('v9 codec accepts portable TEST ONLY Q+Side and Q-optional Side-only workspaces', () => {
  assert.match(v9FixtureProvenance, /TEST ONLY.*synthetic.*not.*SQL dump/);
  assert.equal(isPrizeAccountingWorkspaceV9(qSide, qSide.tournamentId, qSide.eventId), true);
  assert.equal(isPrizeAccountingWorkspaceV9(sideOnly, sideOnly.tournamentId, sideOnly.eventId), true);
  assert.equal(qSide.facts.sideIncomeMinor, 17000);
  assert.equal(qSide.facts.receiptTotalMinor, qSide.facts.ledgerSnapshot.paymentTotalMinor + qSide.facts.sideIncomeMinor);
  assert.equal(sideOnly.qReview, null);
  assert.equal(sideOnly.facts.qIncomeMinor, 0);
});

test('v9 accepts upward-rounding draft, cover states and pending Side review guidance', () => {
  const unfunded = makeUnfundedUpwardFixture();
  assert.equal(isPrizeAccountingWorkspaceV9(unfunded, unfunded.tournamentId, unfunded.eventId), true);
  const invalidBalance = structuredClone(unfunded); invalidBalance.funding.shortfallMinor = 0;
  assert.equal(isPrizeAccountingWorkspaceV9(invalidBalance, invalidBalance.tournamentId, invalidBalance.eventId), false);

  const partial = structuredClone(unfunded);
  partial.funding = { version: 1, requiredMinor: 450, receivedMinor: 200, shortfallMinor: 250, unallocatedMinor: 0, records: [{ ...upFinal.funding.records[0], amountMinor: 200 }] };
  assert.equal(isPrizeAccountingWorkspaceV9(partial, partial.tournamentId, partial.eventId), true, 'synthetic decoder fixture: exact partial cover and $2.50 shortfall');
  const overage = structuredClone(unfunded);
  overage.funding = { version: 1, requiredMinor: 450, receivedMinor: 700, shortfallMinor: 0, unallocatedMinor: 250, records: [{ ...upFinal.funding.records[0], amountMinor: 700 }] };
  assert.equal(isPrizeAccountingWorkspaceV9(overage, overage.tournamentId, overage.eventId), true, 'synthetic decoder fixture: exact $2.50 unallocated cover; server acceptance is not asserted');
  const badGap = structuredClone(partial); badGap.funding.shortfallMinor = 249; badGap.funding.unallocatedMinor = 1;
  assert.equal(isPrizeAccountingWorkspaceV9(badGap, badGap.tournamentId, badGap.eventId), false);

  const pending = makePendingSideReviewFixture();
  assert.equal(isPrizeAccountingWorkspaceV9(pending, pending.tournamentId, pending.eventId), true);
  for (const change of [
    w => { w.blockers = []; },
    w => { w.sideReviews[0].obligations = []; },
    w => { w.sideReviews[0].reviewId = 'b5710000-0000-4000-8000-000000000099'; },
    w => { w.finalization = structuredClone(qSide.finalization); w.currentFinalVersion = 1; },
  ]) { const invalid = structuredClone(pending); change(invalid); assert.equal(isPrizeAccountingWorkspaceV9(invalid, invalid.tournamentId, invalid.eventId), false); }
});

test('v9 payloads are version-separated from v8 and reject altered Side identities, rank, status and conservation', () => {
  const old = makePrizeAccountingV8Fixture().workspace;
  assert.equal(isPrizeAccountingWorkspaceV9(old, old.tournamentId, old.eventId), false);
  assert.equal(isPrizeAccountingWorkspaceV8(qSide, qSide.tournamentId, qSide.eventId), false);
  for (const change of [
    w => { delete w.sideReviews; },
    w => { w.sideReviews[0].obligations[0].amountMinor++; },
    w => { w.sideReviews[0].obligations[0].poolRank = 2; },
    w => { w.sideReviews[0].obligations[0].status = 'paid'; },
    w => { w.sideReviews[0].obligations[0].paid = true; },
    w => { w.facts.receiptTotalMinor++; },
    w => { w.facts.sideIncomeMinor++; },
    w => { w.facts.ledgerSnapshot.paymentTotalMinor++; },
    w => { w.finalization.restrictedBalanceMinor++; },
  ]) {
    const mutated = structuredClone(qSide);
    change(mutated);
    assert.equal(isPrizeAccountingWorkspaceV9(mutated, mutated.tournamentId, mutated.eventId), false);
  }
});

test('v9 requests and receipts keep exact versioned types and bind action to the retained request', () => {
  const request = structuredClone(qSide.draft.request);
  assert.ok(isPrizeAccountingDraftRequestV9(request));
  assert.equal(isPrizeAccountingDraftRequestV9({ ...request, paid: true }), false);
  const receipt = { status: 'prize_accounting_draft_saved_v9', draftId: qSide.draft.id, eventId: qSide.eventId, version: 1, sourceDigest: request.sourceDigest };
  assert.ok(isPrizeAccountingResultV9(receipt, qSide.eventId));
  assert.equal(prizeAccountingResultMatchesV9(receipt, 'draft', request), true);
  assert.equal(prizeAccountingResultMatchesV9({ ...receipt, status: 'prize_accounting_draft_saved_v8' }, 'draft', request), false);
});

test('v9 route and UI are director-authenticated, same-origin, source-bound and never offer payment/disbursement', () => {
  const base = 'src/app/api/v1/tournaments/[id]/events/[eventId]/prize-accounting-v9';
  for (const action of ['draft', 'funding', 'void-funding', 'finalize', 'reconciliation']) {
    const source = readFileSync(`${base}/${action}/route.ts`, 'utf8');
    assert.match(source, /isSameOriginRequest/);
    assert.match(source, /requireVerifiedSubject/);
    assert.match(source, /createServerOnlyAdminClient/);
    assert.match(source, /isPrizeAccounting.*V9/);
  }
  const page = readFileSync('src/app/tournament/[tournamentId]/events/[eventId]/prize-accounting-v9/page.tsx', 'utf8');
  assert.match(page, /access\.role !== "director"/);
  const client = readFileSync('src/app/tournament/[tournamentId]/events/[eventId]/prize-accounting-v9/accounting-client.tsx', 'utf8');
  assert.match(client, /payment-obligation:prize-accounting-v9:\$\{actorId\}:\$\{tournamentId\}:\$\{eventId\}/);
  assert.match(client, /setAppRecoveryItem/);
  assert.match(client, /sessionStorage\.getItem\(key\) !== raw/);
  assert.match(client, /idempotency_conflict/);
  assert.match(client, /Graduated Side Pool obligations - unpaid/);
  assert.match(client, /Side Pool recipient review required/);
  assert.match(client, /Open this Side Pool recipient review/);
  assert.match(client, /cannot be retrofitted with recipient rankings/);
  assert.match(client, /No person is marked paid/);
  assert.doesNotMatch(client, /Payment issued|Disbursement recorded|Mark participant as paid/i);
  const sideClient = readFileSync('src/app/tournament/[tournamentId]/side-pools/recipients/[eventId]/[poolId]/side-pool-recipient-v3-client.tsx', 'utf8');
  assert.match(sideClient, /prize-accounting-v9/);
  assert.match(sideClient, /Q Pool accounting is optional/);
});
