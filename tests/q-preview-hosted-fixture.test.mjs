import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseScheduleCsv,validateScheduleForEvent} from '../src/lib/api/event-schedule.ts';
import {previewQualification} from '../src/lib/qualification.ts';
import {previewQPools} from '../src/lib/results/q-pool-preview.ts';
import {sourceFixture,id} from './fixtures/q-policy-source.mjs';
const f=JSON.parse(fs.readFileSync('docs/quality/2026-10-28-q-preview-hosted-fixture.json','utf8'));
test('proposed sixteen-player schedule passes actual CSV validation, 96 matches and 12 games per player',()=>{
 const csv=['Game,Player A ID,Player B ID,Player A Table/Seat,Player B Table/Seat',...f.matches.map(m=>[m.round,m.aId,m.bId,m.aSeat,m.bSeat].join(','))].join('\n');
 const parsed=parseScheduleCsv(csv);assert.deepEqual(parsed.errors,[]);assert.deepEqual(validateScheduleForEvent(parsed.matches,12,f.players.map(p=>p.verificationId),4,4),[]);assert.equal(f.matches.length,96);
 for(const p of f.players)assert.equal(f.matches.filter(m=>m.a===p.number||m.b===p.number).length,12);
 for(let r=1;r<=12;r++)assert.equal(new Set(f.matches.filter(m=>m.round===r).flatMap(m=>[m.a,m.b])).size,16);
});
test('independent score accumulation gives untied four-player final qualification without byes',()=>{
 const stats=f.players.map(p=>({id:String(p.number),displayName:p.name,gamePoints:0,gamesWon:0,netSpreadPoints:0,positiveSpreadPoints:0,minus:0}));
 for(const m of f.matches){if(m.round===1){assert.equal(m.margin,15);}else{assert.equal(m.winner,Math.min(m.a,m.b));assert.equal(m.margin,10+m.winner);}assert.ok(m.margin<31);assert.ok(m.sideAReference.startsWith('TEST ONLY SYNTHETIC'));assert.ok(m.sideBReference.startsWith('TEST ONLY SYNTHETIC'));
  const w=stats[m.winner-1],l=stats[(m.winner===m.a?m.b:m.a)-1];w.gamePoints+=2;w.gamesWon++;w.netSpreadPoints+=m.margin;w.positiveSpreadPoints+=m.margin;l.netSpreadPoints-=m.margin;l.minus+=m.margin;
 }
 for(const e of f.expected){const a=stats[e.player-1];assert.deepEqual([a.gamePoints,a.gamesWon,a.positiveSpreadPoints,a.minus,a.netSpreadPoints],[e.points,e.wins,e.plus,e.minus,e.net]);}
 const q=previewQualification(stats);assert.equal(q.qualifierCount,4);assert.equal(q.finalizable,true);assert.equal(q.firstRoundByes,0);assert.deepEqual(q.ranked.filter(x=>x.qualificationStatus==='qualified').map(x=>Number(x.id)),[2,1,4,3]);assert.equal(q.unresolvedTies.length,0);
 assert.equal(stats.reduce((n,p)=>n+p.gamePoints,0),192);assert.equal(stats.reduce((n,p)=>n+p.gamesWon,0),96);assert.equal(stats.reduce((n,p)=>n+p.netSpreadPoints,0),0);
});
test('explicit receipts conserve base and named pools without hidden funding or payment duplication',()=>{
 assert.equal(f.players.reduce((n,p)=>n+p.receiptMinor,0),51000);assert.equal(f.players.reduce((n,p)=>n+p.baseMinor,0),48000);
 assert.equal(f.players.filter(p=>p.q1).length*500,2000);assert.equal(f.players.filter(p=>p.q2).length*1000,1000);assert.equal(48000+2000+1000,51000);
});
test('actual preview calculator produces odd-cent qualifier awards and Q-only no-qualifier refund obligations',()=>{
 const s=sourceFixture(16,500),q2=id(50),policy2=id(51);s.qualification.qualifiers=f.qualifiers.map((n,i)=>({participantId:id(99+n),qualificationRank:i+1,tied:false}));s.membership.pools.push({poolVersionId:q2,slot:2,name:'TEST ONLY second Q',feeMinor:1000});s.policies.push({id:policy2,poolVersionId:q2,version:1,method:'equal-paid-qualifiers-v1',disclosureReference:'TEST ONLY second flyer',publishedAt:s.policies[0].publishedAt});
 s.membership.entries.forEach((e,i)=>{const p=f.players[i];e.obligationMinor=p.receiptMinor;e.receivedMinor=p.receiptMinor;e.pools[0]={...e.pools[0],elected:p.q1,prePlayElected:p.q1,amountOwedMinor:p.q1?500:0,amountAllocatedMinor:p.q1?500:0,paidEntryEligible:p.q1,consentReference:p.q1?e.pools[0].consentReference:''};e.pools.push({poolVersionId:q2,elected:p.q2,prePlayElected:p.q2,amountOwedMinor:p.q2?1000:0,amountAllocatedMinor:p.q2?1000:0,paidEntryEligible:p.q2,consentReference:p.q2?`Q policy ${policy2}: TEST ONLY acknowledged`:''});});
 const [a,b]=previewQPools(s);assert.equal(a.status,'awards_preview');assert.equal(a.fundMinor,2000);assert.deepEqual(a.awards.map(r=>r.amountMinor),[667,667,666]);assert.deepEqual(a.awards.map(r=>r.participantId),[id(101),id(100),id(103)]);assert.equal(b.status,'refund_obligations_preview');assert.equal(b.refundObligations.length,1);assert.equal(b.refundObligations[0].participantId,id(114));assert.equal(b.refundObligations[0].amountMinor,1000);assert.equal(b.awards.length,0);
});
