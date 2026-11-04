import test from 'node:test';
import assert from 'node:assert/strict';
import { previewSidePoolGraduatedRecipientsV3 } from '../src/lib/results/side-pool-graduated-recipients-v3.ts';
import { calculateGraduatedPoolAmountsV2, graduatedPoolAmountsVersionV2 } from '../src/lib/results/graduated-pool-amounts-v2.ts';

const id = n => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const digest = 'a'.repeat(64), cardDigest = 'b'.repeat(64);
function fixture(count = 16, ratio = 6, feeMinor = 500) {
  const participants = Array.from({ length: count }, (_, i) => ({ participantId: id(100 + i), displayName: `TEST ONLY ${i + 1}` }));
  const calculation = calculateGraduatedPoolAmountsV2({ paidCount: count, feeMinor, ratio });
  const pool = {
    definitionId: id(2), eventId: id(3), poolId: id(4), name: 'TEST ONLY Side A', feeMinor,
    policy: { id: id(5), method: graduatedPoolAmountsVersionV2, ratio, disclosureReference: 'TEST ONLY prepayment disclosure', publishedAt: '2026-10-30T00:00:00Z' },
    paidCount: count,
    entries: participants.map((p, i) => ({ participantId: p.participantId, electionId: id(200 + i), version: 1, elected: true, dueMinor: feeMinor, receivedMinor: feeMinor })),
    sourceDigest: digest, blockers: [], calculation, history: [], participants, started: true, canPublish: false, moneyMoved: false,
  };
  return {
    workspace: { tournamentId: id(1), pools: [pool], moneyMoved: false, recipientSelection: 'not_assigned' }, poolId: pool.poolId,
    cardsSource: { tournamentId: id(1), eventId: id(3), sourceDigest: cardDigest, poolSourceDigest: digest, finalizationId: id(6), blockers: [],
      cards: participants.map((p, i) => ({ participantId: p.participantId, gamePoints: 2 * (count + 1 - i), gamesWon: count + 1 - i, plusPoints: 10 * (count + 1 - i), qualified: i === count - 1, qualificationRank: i === count - 1 ? 1 : null })),
    }, expectedSourceDigest: cardDigest,
  };
}
const pool = s => s.workspace.pools[0];
const recalculate = s => {
  const p = pool(s); p.paidCount = p.entries.filter(e => e.elected && e.dueMinor === p.feeMinor && e.receivedMinor === p.feeMinor).length;
  p.calculation = p.paidCount ? calculateGraduatedPoolAmountsV2({ paidCount: p.paidCount, feeMinor: p.feeMinor, ratio: p.policy.ratio }) : null;
};
const blocked = (s, code) => assert.deepEqual(previewSidePoolGraduatedRecipientsV3(s), { status: 'blocked', code });
function preview(s) { const result = previewSidePoolGraduatedRecipientsV3(s); assert.equal(result.status, 'preview', JSON.stringify(result)); return result; }

test('Side awards rank all paid cards, including nonqualifiers, and conserve the approved exact $5 amount schedule', () => {
  const s = fixture(), before = structuredClone(s), r = preview(s);
  assert.deepEqual(r.awards, [{ participantId: id(100), amountMinor: 4000 }, { participantId: id(101), amountMinor: 2500 }, { participantId: id(102), amountMinor: 1500 }]);
  assert.equal(r.calculation.recipientCount, Math.ceil(16 / 6)); assert.equal(r.fundMinor, 8000);
  assert.equal(r.awards.reduce((n, a) => n + a.amountMinor, 0), r.fundMinor); assert.ok(r.awards.every(a => a.amountMinor % 500 === 0));
  assert.equal(r.moneyMoved, false); assert.deepEqual(r.refunds, []); assert.deepEqual(s, before);
  assert.equal(r.finalizationId, id(6)); assert.equal(r.sourceDigest, cardDigest); assert.equal(r.poolSourceDigest, digest);
});

test('monetary card order is game points, wins, then gross positive spread, independent of playoff status, place and net spread', () => {
  const s = fixture(8, 2), cards = s.cardsSource.cards;
  Object.assign(cards[0], { gamePoints: 21, gamesWon: 7, plusPoints: 1, netSpreadPoints: -999, qualified: false, finalPlayoffPlace: 999 });
  Object.assign(cards[1], { gamePoints: 20, gamesWon: 10, plusPoints: 1000, netSpreadPoints: 999, qualified: true, qualificationRank: 1, finalPlayoffPlace: 1 });
  Object.assign(cards[2], { gamePoints: 18, gamesWon: 8, plusPoints: 1 });
  Object.assign(cards[3], { gamePoints: 18, gamesWon: 7, plusPoints: 999 });
  Object.assign(cards[4], { gamePoints: 16, gamesWon: 7, plusPoints: 100, netSpreadPoints: -100 });
  Object.assign(cards[5], { gamePoints: 16, gamesWon: 7, plusPoints: 99, netSpreadPoints: 100 });
  const r = preview(s); assert.deepEqual(r.awards.map(a => a.participantId), [id(100), id(101), id(102), id(103)]);
  const six = fixture(8, 2); six.cardsSource.cards = [cards[4], cards[5], ...six.cardsSource.cards.filter(c => ![id(104), id(105)].includes(c.participantId))];
  // Make gross positive spread decide a cash position while net spread points point the other way.
  six.cardsSource.cards.filter(c => ![id(104), id(105)].includes(c.participantId)).forEach((c, i) => Object.assign(c, { gamePoints: 2 * (6 - i), gamesWon: 6 - i }));
  assert.deepEqual(preview(six).awards.slice(0, 2).map(a => a.participantId), [id(104), id(105)]);
  const changed = structuredClone(s); changed.cardsSource.cards.reverse(); changed.cardsSource.cards.forEach(c => Object.assign(c, { qualified: true, qualificationRank: 1, finalPlayoffPlace: 1 }));
  assert.deepEqual(preview(changed).awards, r.awards);
});

test('each named Side Pool uses its own fully paid entrants and selected one-in-N count', () => {
  const s = fixture(16, 6, 1000), second = structuredClone(pool(s));
  Object.assign(second, { poolId: id(40), definitionId: id(41), name: 'TEST ONLY Side B' });
  second.policy.id = id(42); second.policy.ratio = 4; second.entries = second.entries.slice(10); second.participants = second.participants.slice(10); second.paidCount = 6;
  second.calculation = calculateGraduatedPoolAmountsV2({ paidCount: 6, feeMinor: 1000, ratio: 4 });
  s.workspace.pools.push(second);
  assert.deepEqual(preview(s).awards.map(a => a.amountMinor), [8000, 5500, 2500]);
  s.poolId = second.poolId; const r = preview(s);
  assert.equal(r.calculation.recipientCount, 2); assert.equal(r.fundMinor, 6000);
  assert.deepEqual(r.awards, [{ participantId: id(110), amountMinor: 4000 }, { participantId: id(111), amountMinor: 2000 }]);
});

test('unpaid and other-pool cards never enlarge the fund, win an award or introduce a cash tie', () => {
  const s = fixture(16); pool(s).entries[0].elected = false; pool(s).entries[0].receivedMinor = 0; recalculate(s);
  s.cardsSource.cards.push({ ...s.cardsSource.cards[0], participantId: id(900) });
  const r = preview(s); assert.equal(r.fundMinor, 7500); assert.equal(r.calculation.paidCount, 15); assert.equal(r.awards[0].participantId, id(101));
  assert.ok(r.awards.every(a => ![id(100), id(900)].includes(a.participantId)));
});

test('unresolved monetary ties block, including ties at the last paid place; Q cuts cannot grant Side authority', () => {
  for (const [left, right] of [[0, 1], [2, 3], [14, 15]]) {
    const s = fixture(); const target = s.cardsSource.cards[right]; s.cardsSource.cards[right] = { ...s.cardsSource.cards[left], participantId: target.participantId };
    blocked(s, 'cash_tie_policy_unresolved');
    s.cuts = [{ participantIdsLowFirst: [id(left + 100), id(right + 100)], recordedBy: id(800), reason: 'TEST ONLY Q cut' }];
    blocked(s, 'invalid_input');
  }
});

test('unfinalized, missing, stale, foreign-event and source-blocked scorecards fail closed', () => {
  for (const change of [s => s.cardsSource.finalizationId = null, s => s.cardsSource.cards = [], s => s.cardsSource.cards.pop()]) { const s = fixture(); change(s); blocked(s, 'current_finalized_sources_required'); }
  for (const change of [s => s.expectedSourceDigest = 'c'.repeat(64), s => s.cardsSource.poolSourceDigest = 'c'.repeat(64)]) { const s = fixture(); change(s); blocked(s, 'source_changed'); }
  for (const change of [s => s.cardsSource.eventId = id(999), s => s.cardsSource.tournamentId = id(999), s => s.poolId = id(999)]) { const s = fixture(); change(s); blocked(s, 'pool_unavailable'); }
  const s = fixture(); s.cardsSource.blockers = ['eligibility_changed']; blocked(s, 'source_blocked');
});

test('preplay disclosure, started entries, fully paid elections and refund resolution remain necessary', () => {
  const missingPolicy = fixture(); pool(missingPolicy).policy = null; pool(missingPolicy).calculation = null; blocked(missingPolicy, 'disclosed_policy_required');
  const notStarted = fixture(); pool(notStarted).started = false; blocked(notStarted, 'entries_not_locked');
  const sourceBlocked = fixture(); pool(sourceBlocked).blockers = ['eligibility_changed']; pool(sourceBlocked).calculation = null; blocked(sourceBlocked, 'source_blocked');
  for (const change of [e => e.receivedMinor = 0, e => e.receivedMinor = 499, e => e.receivedMinor = 501, e => e.dueMinor = 1000]) {
    const s = fixture(); change(pool(s).entries[0]); recalculate(s); blocked(s, 'partial_or_stale_contribution');
  }
  const refund = fixture(); pool(refund).entries[0].elected = false; recalculate(refund); blocked(refund, 'refund_resolution_required');
  const empty = fixture(); pool(empty).entries.forEach(e => { e.elected = false; e.receivedMinor = 0; }); recalculate(empty); blocked(empty, 'source_blocked');
});

test('malformed cards and forged or mismatched existing amount sources cannot become recipient previews', () => {
  for (const change of [s => s.cardsSource.cards.push(s.cardsSource.cards[0]), s => s.cardsSource.cards[0].gamePoints = 1,
    s => s.cardsSource.cards[0].gamesWon = -1, s => s.cardsSource.cards[0].plusPoints = 0.5,
    s => s.cardsSource.cards[0].participantId = 'unknown', s => s.cardsSource.sourceDigest = 'bad', s => s.cardsSource.finalizationId = 'bad',
    s => s.cardsSource.cards[0] = null, s => pool(s).calculation.awardsMinor[0] += 500, s => pool(s).paidCount++,
    s => pool(s).entries.push(pool(s).entries[0]), s => pool(s).participants = [], s => s.extra = true,
    s => s.cardsSource[Symbol('authority')] = true]) { const s = fixture(); change(s); blocked(s, 'invalid_input'); }
  for (const s of [null, [], {}, Object.create(fixture())]) blocked(s, 'invalid_input');
});

test('immutable historical Side amount reviews are readable and remain untouched by recipient calculation', () => {
  const s = fixture(); pool(s).history = [{ id: id(70), version: 1, sourceDigest: digest, current: true, reason: 'TEST ONLY prior amounts review', calculation: structuredClone(pool(s).calculation), status: 'unpaid_amount_schedule', recordedAt: '2026-10-30T00:00:00Z' }];
  const before = structuredClone(s); preview(s); assert.deepEqual(s, before);
  const changed = structuredClone(s); pool(changed).history[0].calculation.awardsMinor[0] += 500; blocked(changed, 'invalid_input');
});
