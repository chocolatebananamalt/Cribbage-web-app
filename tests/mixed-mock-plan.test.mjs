import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMixedMockManifest, tallyMixedMock, reconcileSimulatedFunds } from '../src/lib/mixed-mock-plan.ts';
import { startingSeatAlignedOddFieldFixture } from './fixtures/odd-field-makeup.mjs';
import { deriveOddFieldMakeupPlan } from '../src/lib/results/odd-field-makeup.ts';
import { eighteenFixture } from './eighteen-qualifying-local-acceptance.mjs';
const id = n => `a2930000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function fixture() {
  const f = startingSeatAlignedOddFieldFixture();
  const rounds=[1,2,3,4,5,6,8,9,10,11,12,7];
  f.regularMatches=rounds.flatMap((round,i)=>f.regularMatches.filter(m=>m.gameNumber===round).map(m=>({...m,gameNumber:i+1})));
  const p = deriveOddFieldMakeupPlan(f.regularMatches, f.verificationIds, f.makeupSeats, 5, 4);
  const participants = f.verificationIds.map((v, i) => ({ participantId: id(i + 1), tournamentPlayerId: v, mode: i < 6 ? 'digital' : 'paper' }));
  const lookup = v => participants.find(p => p.tournamentPlayerId === v).participantId;
  const matches = [...f.regularMatches, ...p.makeupMatches].map((m, i) => ({ gameId: id(i + 100), batchNumber: m.gameNumber,
    sideA: { participantId: lookup(m.sideAVerificationId), currentSeat: m.sideATableSeat, cardGameNumber: m.sideACardGameNumber ?? m.gameNumber },
    sideB: { participantId: lookup(m.sideBVerificationId), currentSeat: m.sideBTableSeat, cardGameNumber: m.sideBCardGameNumber ?? m.gameNumber } }));
  return { participants, matches };
}
const build = f => buildMixedMockManifest(f.participants, f.matches);

test('18-player plan has no sit-outs or makeups, 108 unique pairs, and six digital participants in arbitrary starting positions',()=>{
 const f=eighteenFixture();const ids=Array.from({length:18},(_,i)=>f.seat(i+1));
 for(const humanSeats of [[0,1,2,3,4,5],[1,5,8,11,14,17]]){
  const participants=ids.map((v,i)=>({participantId:id(i+1),tournamentPlayerId:v,mode:humanSeats.includes(i)?'digital':'paper'}));
  const matches=f.matches.map((m,i)=>({gameId:id(100+i),batchNumber:m.gameNumber,
   sideA:{participantId:id(ids.indexOf(m.sideAVerificationId)+1),currentSeat:m.sideATableSeat,cardGameNumber:m.gameNumber},
   sideB:{participantId:id(ids.indexOf(m.sideBVerificationId)+1),currentSeat:m.sideBTableSeat,cardGameNumber:m.gameNumber}}));
  const manifest=buildMixedMockManifest(participants,matches);assert.equal(manifest.matches.length,108);
  assert.ok(Object.values(manifest.counts).every(n=>n>0));assert.equal(manifest.matches.filter(m=>m.batchNumber===13).length,0);
  const rows=tallyMixedMock(manifest,manifest.matches.map(m=>({gameId:m.gameId,winnerParticipantId:m.sideA.participantId,spreadPoints:20,evidence:m.pairing==='digital-digital'?'observed-digital-play':m.pairing==='paper-digital'?'scripted-mixed':'scripted-paper'})));
  assert.ok(rows.every(r=>r.recordedGames===12));assert.equal(rows.reduce((n,r)=>n+r.netSpreadPoints,0),0);
 }
});
test('17-player manifest preserves identity, all pairings, twelve lines including six makeup games', () => {
  const f = fixture(), m = build(f);
  assert.equal(m.matches.length, 102);
  assert.equal(Object.values(m.counts).reduce((a,b) => a+b, 0), 102);
  assert.ok(Object.values(m.counts).every(n => n > 0));
  for (const p of m.participants) {
    const games = m.matches.filter(g => [g.sideA.participantId, g.sideB.participantId].includes(p.participantId));
    assert.equal(games.length, 12);
    assert.equal(new Set(games.map(g => g.sideA.participantId === p.participantId ? g.sideA.cardGameNumber : g.sideB.cardGameNumber)).size, 12);
  }
  const sitout = m.participants.find(p => !m.matches.some(g => g.batchNumber === 1 && [g.sideA.participantId,g.sideB.participantId].includes(p.participantId)));
  assert.ok(sitout, 'First-game sit-out does not need a fictitious initial played game.');
  f.participants[0].tournamentPlayerId = 'E-4'; f.matches[0].sideA.currentSeat = 'E-4';
  assert.notEqual(m.participants[0].tournamentPlayerId, 'E-4');
  assert.ok(Object.isFrozen(m.matches[0].sideA));
});
test('manifest rejects wrong modes, duplicate identities, unknown players, seat and card conflicts', () => {
  const cases = [
    f => f.participants[0].mode = 'paper',
    f => f.participants[0].mode = 'unknown',
    f => f.participants[1].participantId = f.participants[0].participantId.toUpperCase(),
    f => f.participants[1].tournamentPlayerId = f.participants[0].tournamentPlayerId,
    f => f.matches[1].gameId = f.matches[0].gameId.toUpperCase(),
    f => f.matches[0].sideA.participantId = id(999),
    f => f.matches[0].sideA.participantId = f.matches[0].sideB.participantId,
    f => f.matches[0].sideA.currentSeat = f.matches[0].sideB.currentSeat,
    f => f.matches[0].sideA.currentSeat = 'E-4',
    f => f.matches[0].sideA.cardGameNumber = 2,
    f => f.matches[96].sideA.cardGameNumber = 0,
    f => f.matches[96].sideA.cardGameNumber = 12,
    f => f.matches[96].batchNumber = 12,
  ];
  for (const corrupt of cases) { const f = fixture(); corrupt(f); assert.throws(() => build(f), TypeError); }
});
test('historical reverse-sitout makeup is rejected because fictional opponents count too', () => {
  const f=fixture(), original=startingSeatAlignedOddFieldFixture();
  const p=deriveOddFieldMakeupPlan(original.regularMatches,original.verificationIds,original.makeupSeats,5,4);
  const lookup=v => f.participants.find(x => x.tournamentPlayerId===v).participantId;
  for(let i=0;i<6;i++) { const m=p.makeupMatches[i]; f.matches[96+i]={gameId:id(196+i),batchNumber:13,
    sideA:{participantId:lookup(m.sideAVerificationId),currentSeat:m.sideATableSeat,cardGameNumber:m.sideACardGameNumber},
    sideB:{participantId:lookup(m.sideBVerificationId),currentSeat:m.sideBTableSeat,cardGameNumber:m.sideBCardGameNumber}}; }
  assert.throws(() => build(f), /repeat an opponent/);
});
test('raw evidence explicitly distinguishes actual digital play from scripted mixed/paper results', () => {
  const m = build(fixture());
  for (const pairing of ['digital-digital','paper-digital','paper-paper']) {
    const g = m.matches.find(x => x.pairing === pairing);
    const evidence = pairing === 'digital-digital' ? 'observed-digital-play' : pairing === 'paper-digital' ? 'scripted-mixed' : 'scripted-paper';
    const o = { gameId:g.gameId, winnerParticipantId:g.sideA.participantId, spreadPoints:20, evidence };
    const rows = tallyMixedMock(m, [o], false);
    const win = rows.find(r => r.participantId === g.sideA.participantId), lose = rows.find(r => r.participantId === g.sideB.participantId);
    assert.deepEqual([win.recordedGames,win.wins,win.gamePoints,win.positiveSpreadPoints,win.negativeSpreadPoints,win.netSpreadPoints], [1,1,2,20,0,20]);
    assert.deepEqual([lose.recordedGames,lose.wins,lose.gamePoints,lose.positiveSpreadPoints,lose.negativeSpreadPoints,lose.netSpreadPoints], [1,0,0,0,20,-20]);
    assert.throws(() => tallyMixedMock(m,[{...o,evidence:'genuine-paper-play'}],false));
    assert.throws(() => tallyMixedMock(m,[{...o,evidence:evidence === 'observed-digital-play' ? 'scripted-paper' : 'observed-digital-play'}],false));
    assert.throws(() => tallyMixedMock(m,[o]));
    assert.throws(() => tallyMixedMock(m,[o,o],false));
    assert.throws(() => tallyMixedMock(m,[{...o,winnerParticipantId:id(999)}],false));
  }
});
test('independent point oracle uses hand-checked ACC single-game boundaries and reciprocal spread', () => {
  const m = build(fixture()), g = m.matches.find(x => x.pairing === 'digital-digital');
  for (const [spreadPoints,expected] of [[1,2],[30,2],[31,3],[60,3],[61,3],[90,3],[91,3],[121,3]]) {
    const rows = tallyMixedMock(m,[{gameId:g.gameId,winnerParticipantId:g.sideB.participantId,spreadPoints,evidence:'observed-digital-play'}],false);
    assert.equal(rows.find(r => r.participantId === g.sideB.participantId).gamePoints, expected);
    assert.equal(rows.reduce((sum,r) => sum+r.netSpreadPoints,0),0);
  }
  for (const spreadPoints of [0,122,-10,1.5,NaN,Infinity]) assert.throws(() => tallyMixedMock(m,[{gameId:g.gameId,winnerParticipantId:g.sideA.participantId,spreadPoints,evidence:'observed-digital-play'}],false));
});
test('complete raw result tally conserves spread and counts all 204 scoring sides without claiming verification', () => {
  const m = build(fixture());
  const outcomes = m.matches.map(g => ({ gameId:g.gameId,winnerParticipantId:g.sideA.participantId,spreadPoints:10,
    evidence:g.pairing === 'digital-digital' ? 'observed-digital-play' : g.pairing === 'paper-digital' ? 'scripted-mixed' : 'scripted-paper' }));
  const rows = tallyMixedMock(m,outcomes);
  assert.equal(rows.reduce((s,r) => s+r.recordedGames,0),204);
  assert.equal(rows.reduce((s,r) => s+r.gamePoints,0),204);
  assert.equal(rows.reduce((s,r) => s+r.wins,0),102);
  assert.equal(rows.reduce((s,r) => s+r.positiveSpreadPoints,0),1020);
  assert.equal(rows.reduce((s,r) => s+r.negativeSpreadPoints,0),1020);
  assert.equal(rows.reduce((s,r) => s+r.netSpreadPoints,0),0);
  assert.ok(!('verified' in rows[0]) && !('qualified' in rows[0]));
});
test('simulated fund arithmetic keeps separate funds, catches over/under and never approves method or payment', () => {
  const f = {fundId:'base',incomingMinor:50000,expensesMinor:5100,retainedMinor:0,awards:[{participantId:id(1),amountMinor:44900}]};
  const [balanced,over,under] = reconcileSimulatedFunds([f,{...f,fundId:'Q',incomingMinor:20000,expensesMinor:0,awards:[{participantId:id(2),amountMinor:21000}]},
    {...f,fundId:'Side',incomingMinor:17000,expensesMinor:0,awards:[{participantId:id(3),amountMinor:15000}]}]);
  assert.equal(balanced.balanced,true); assert.equal(over.unallocatedMinor,-1000); assert.equal(under.unallocatedMinor,2000);
  assert.equal(balanced.paid,false); assert.equal(balanced.simulated,true); assert.equal(balanced.methodCompliance,'not-established');
  for (const broken of [[f,f],[{...f,incomingMinor:1.5}],[{...f,expensesMinor:-1}],[{...f,awards:[f.awards[0],f.awards[0]]}],
    [{...f,incomingMinor:Number.MAX_SAFE_INTEGER+1}],[{...f,awards:[{participantId:id(1),amountMinor:Number.MAX_SAFE_INTEGER},{participantId:id(2),amountMinor:1}]}]])
    assert.throws(() => reconcileSimulatedFunds(broken));
});
