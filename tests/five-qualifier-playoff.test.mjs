import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveFiveQualifierPlayoff } from '../src/lib/results/five-qualifier-playoff.ts';
const ids = [1,2,3,4,5].map(n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
const q = ids.map((participantId,i) => ({participantId,qualificationRank:i+1,gamePoints:24-i}));
const match = (w,l) => ({winnerId:ids[w-1],loserId:ids[l-1],evidenceNote:'Fictional played series; no game scores asserted.'});
test('five qualifiers: three bye credits, four actual series, equal semifinal band',()=>{
 const rows = deriveFiveQualifierPlayoff(q,[match(4,5),match(1,4),match(2,3),match(1,2)]);
 assert.ok(rows);assert.equal(rows.reduce((n,r)=>n+r.playedMatchWins,0),4);
 assert.equal(rows.reduce((n,r)=>n+r.byeWins,0),3);
 assert.deepEqual(rows.map(r=>r.playoffMrp),[70,42,21,21,7]);
 assert.deepEqual(rows.map(r=>[r.bandStart,r.bandEnd]),[[1,1],[2,2],[3,4],[3,4],[5,5]]);
 assert.deepEqual(q.map(r=>r.gamePoints),[24,23,22,21,20]);
});
test('lower seed champion earns three actual wins without a bye',()=>{
 const rows=deriveFiveQualifierPlayoff(q,[match(5,4),match(5,1),match(3,2),match(5,3)]);
 assert.ok(rows);assert.equal(rows[4].playedMatchWins,3);assert.equal(rows[4].byeWins,0);assert.equal(rows[4].playoffMrp,70);
 assert.equal(rows[0].playedMatchWins,0);assert.equal(rows[0].byeWins,1);assert.equal(rows[0].playoffMrp,21);
});
test('bye cannot be supplied as phantom game; seeding and advancement are enforced',()=>{
 const valid=[match(4,5),match(1,4),match(2,3),match(1,2)];
 assert.equal(deriveFiveQualifierPlayoff(q,[match(1,5),...valid]),null);
 assert.equal(deriveFiveQualifierPlayoff(q,[match(4,5),match(1,5),match(2,3),match(1,2)]),null);
 assert.equal(deriveFiveQualifierPlayoff(q,[match(4,5),match(1,4),match(2,3),match(1,3)]),null);
 assert.equal(deriveFiveQualifierPlayoff(q.map((r,i)=>({...r,qualificationRank:i===4?4:i+1})),valid),null);
});
