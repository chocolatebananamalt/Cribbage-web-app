import test from 'node:test';
import assert from 'node:assert/strict';
import {twentyPlayerMultiPoolPlan} from './fixtures/twenty-player-multi-pool-plan.mjs';
import {calculateGraduatedPoolAmountsV2} from '../src/lib/results/graduated-pool-amounts-v2.ts';
import {validateScheduleForEvent} from '../src/lib/api/event-schedule.ts';
import {validateInitialGameSeats} from '../src/lib/initial-game-seats.ts';
import {orderQCardsV2} from '../src/lib/results/q-operating-schedule.ts';

test('local20-player plan has120 actual pairings,12 games each, five qualifiers and exact Q backfill',()=>{
 const p=twentyPlayerMultiPoolPlan();
 assert.equal(p.matches.length,120);assert.ok(p.players.every(x=>x.played===12));
 const ids=Array.from({length:20},(_,i)=>`${String.fromCharCode(65+Math.floor(i/4))}-${i%4+1}`);
 assert.deepEqual(validateInitialGameSeats(p.matches),[]);
 assert.deepEqual(validateScheduleForEvent(p.matches,12,ids,5,4),[]);
 for(let r=1;r<=12;r++)assert.equal(new Set(p.matches.filter(x=>x.gameNumber===r).flatMap(x=>[x.a,x.b])).size,20);
 assert.equal(p.ranking.filter(x=>x.qualified).length,5);assert.equal(p.paidIds.length,16);
 assert.ok(p.ranking.slice(0,3).every(x=>x.gamePoints>=14),'three first-round byes require the existing minimum game-points source condition');
 assert.deepEqual(p.qAwards.map(x=>x.participantId),[p.ranking[0],p.ranking[2],p.ranking[4],p.ranking[5]].map(x=>x.participantId));
 assert.deepEqual(p.qAwards.map(x=>x.qualified),[true,true,true,false]);
 assert.deepEqual(p.qAwards.map(x=>x.amountMinor),[6500,5000,3000,1500]);
 assert.equal(p.qAwards.reduce((n,x)=>n+x.amountMinor,0),16000);assert.equal(p.plannedBaseMinor,100000);
 assert.equal(p.players.reduce((n,x)=>n+x.plusPoints,0),p.players.reduce((n,x)=>n+x.minusPoints,0));
 assert.equal(p.players.reduce((n,x)=>n+x.gamePoints,0),240);
});

test('ratio uses paid count with ceiling and rejects non-$5 contributions; does not count qualifiers as entrants',()=>{
 assert.equal(calculateGraduatedPoolAmountsV2({paidCount:16,feeMinor:1000,ratio:4}).recipientCount,4);
 assert.equal(calculateGraduatedPoolAmountsV2({paidCount:17,feeMinor:1000,ratio:4}).recipientCount,5);
 assert.deepEqual(calculateGraduatedPoolAmountsV2({paidCount:16,feeMinor:1050,ratio:4}),{status:'blocked',code:'unsupported_lattice'});
 const p=twentyPlayerMultiPoolPlan();
 for(const rank of [2,4])assert.ok(!p.qAwards.some(x=>x.participantId===p.ranking[rank-1].participantId));
 assert.ok(!p.qAwards.some(x=>x.participantId===p.ranking[6].participantId));
 const qCards=[{participantId:'higher-positive-lower-net',gamePoints:16,gamesWon:8,plusPoints:200,minusPoints:180,qualified:false,qualificationRank:null},{participantId:'lower-positive-higher-net',gamePoints:16,gamesWon:8,plusPoints:150,minusPoints:20,qualified:false,qualificationRank:null}];
 assert.equal(orderQCardsV2(qCards,[])[0].participantId,'higher-positive-lower-net','Q ranks positive spread points, separately from qualification net spread points');
});
