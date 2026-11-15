import test from 'node:test';import assert from 'node:assert/strict';
import {calculatePlayoffPrizeProposalsV2 as review,isPlayoffPrizeProposalExtensionV2 as extension} from '../src/lib/results/playoff-prize-proposals-v2.ts';
import {newPlayoffPrizePlanDraftV2} from '../src/lib/playoffs/playoff-prize-plan-v2.ts';
const id=n=>`a4890000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function current(q,method,step){const plan=newPlayoffPrizePlanDraftV2();plan.method=method;plan.rounding.regular=step;return{source:{tournamentId:id(1),eventId:id(2),eventClientRowId:id(3),eventKind:'main',setupRevisionId:id(4),settingsSnapshotId:id(5),settingsDigest:'a'.repeat(64),prizeSnapshotId:id(6),prizeDigest:'b'.repeat(64),allocationRevisionId:id(7),qualificationResultVersionId:id(8),ledgerDigest:'c'.repeat(64),resultsDigest:'d'.repeat(64)},input:{plan,field:{status:'known',qualifierCount:q,firstRoundLoserPlaces:[],entryFeeMinor:null},fundMinor:300000}};}
function independentGroups(count){const groups=[];let first=1,last=1;while(first<=count){last=Math.min(count,last);groups.push([first,last]);first=last+1;last=last===1?2:last*2;}return groups;}
const record=(index,firstPlace,lastPlace,amount,extra={})=>({recordId:id(100+index),firstPlace,lastPlace,priorRecordId:null,perPersonMinor:amount,voided:false,reason:' Independent manual amount ',...extra});

test('independent constant-group overrides conserve exact manual totals across methods, increments and uneven fields',()=>{
 for(const q of[1,2,5,10,129])for(const method of['graduated','equal','winner-multiplier','winner-takes-all'])for(const step of['1','5','10']){
  const c=current(q,method,step),count=method==='winner-takes-all'?1:q,amount=Number(step)*700,groups=independentGroups(count),history=groups.map(([a,b],i)=>record(i,a,b,amount)),p={...structuredClone(c),overrideHistory:history},before=structuredClone(p),r=review(p,c);
  assert.equal(r.status,'proposal_review');assert.equal(r.actualPaidPlaces,count);assert.equal(r.proposedTotalMinor,count*amount);assert.equal(r.discrepancyMinor,count*amount-300000);assert.equal(r.rankOrderViolation,false);assert.equal(r.equalTreatmentViolation,false);assert.equal(r.comparison,'not_applicable');assert.equal(r.finalizationAllowed,false);assert.equal(r.paymentAuthorized,false);assert.deepEqual(p,before);
 }
});

test('void restores original suggestion and reopening does not erase immutable correction history',()=>{
 const c=current(5,'equal','1'),a=record(1,3,4,0),b=record(2,3,4,100,{priorRecordId:a.recordId}),v=record(3,3,4,200,{priorRecordId:b.recordId,voided:true}),reopen=record(4,3,4,0,{priorRecordId:v.recordId}),p={...structuredClone(c),overrideHistory:[a,b,v]},next={...structuredClone(c),overrideHistory:[a,b,v,reopen]};
 const restored=review(p,c),zero=review(next,c);assert.equal(restored.proposedBands[2].perPersonMinor,60000);assert.equal(restored.proposedBands[2].overrideState,'voided');assert.equal(zero.proposedBands[2].perPersonMinor,0);assert.equal(zero.positiveAwardPlaces,3);assert.equal(zero.historyRecordCount,4);assert.equal(extension(p,next,c),true);assert.equal(extension(p,{...next,overrideHistory:[a,v,reopen]},c),false);
});

test('one paid first-round loser is checked within its whole group, while an unpaid one is not included',()=>{
 const c=current(10,'winner-multiplier','1');c.input.plan.firstRoundComparison='less';c.input.field.firstRoundLoserPlaces=[3,9];c.input.field.entryFeeMinor=5000;c.input.plan.recipients='top-4';
 const p={...structuredClone(c),overrideHistory:[record(1,3,4,4900)]},r=review(p,c);assert.equal(r.status,'proposal_review');assert.equal(r.comparison,'satisfied');assert.equal(r.actualPaidPlaces,4);assert.equal(r.proposedBands[2].bandTotalMinor,9800);
 p.overrideHistory.push(record(2,3,4,5000,{priorRecordId:p.overrideHistory[0].recordId}));assert.equal(review(p,c).comparison,'not_satisfied');
});
