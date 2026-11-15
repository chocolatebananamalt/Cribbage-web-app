import assert from 'node:assert/strict';
import test from 'node:test';
import {calculatePlayoffPrizeComparisonV2 as calculate} from '../src/lib/results/playoff-prize-comparison-v2.ts';
import {newPlayoffPrizePlanDraftV2} from '../src/lib/playoffs/playoff-prize-plan-v2.ts';
const input=(q=10,fundMinor=28000)=>({plan:newPlayoffPrizePlanDraftV2(),field:{status:'known',qualifierCount:q,firstRoundLoserPlaces:null,entryFeeMinor:1000},fundMinor});
test('independent supplied MainCon example retains geometric equal bands and visible $5 excess',()=>{
 const v=input(),before=structuredClone(v),r=calculate(v);assert.equal(r.status,'calculated_comparison');assert.deepEqual(r.bands.map(b=>[b.people,b.perPersonMinor]),[[1,7000],[1,4500],[2,3000],[4,2000],[2,1500]]);assert.equal(r.roundedAwardsTotalMinor,28500);assert.equal(r.discrepancyMinor,500);assert.equal(r.balanced,false);assert.equal(r.reviewRequired,true);assert.equal(r.comparison,'pending_field_evidence');assert.deepEqual(v,before);
});
test('Equal and Winner Multiplier preserve equal people and do not reuse graduated weights',()=>{
 const v=input(6,20000);v.plan.method='equal';let r=calculate(v);assert.deepEqual(r.bands.map(b=>b.perPersonMinor),[3500,3500,3500,3500]);assert.equal(r.roundedAwardsTotalMinor,21000);assert.equal(r.comparison,'not_applicable');
 const w=input(5,60000);w.plan.method='winner-multiplier';w.plan.firstRoundComparison='more';w.field.firstRoundLoserPlaces=[5];w.field.entryFeeMinor=5000;r=calculate(w);assert.deepEqual(r.bands.map(b=>b.perPersonMinor),[20000,10000,10000,10000]);assert.equal(r.balanced,true);assert.equal(r.comparison,'satisfied');
});
test('Winner Takes All and separate rounding increments are explicit comparisons, never redistribution',()=>{
 for(const [step,amount]of[['1',10300],['5',10500],['10',10000]]){const v=input(5,10300);v.plan.method='winner-takes-all';v.plan.rounding.regular=step;v.plan.rounding.qPool='10';v.plan.rounding.sidePool='1';const r=calculate(v);assert.equal(r.actualPaidPlaces,1);assert.equal(r.bands[0].perPersonMinor,amount);assert.equal(r.discrepancyMinor,amount-10300);assert.equal(r.comparison,'not_applicable');assert.equal(r.roundingStepMinor,Number(step)*100);}
 const v=input(2,100);v.plan.method='equal';v.plan.rounding.regular='1';const r=calculate(v);assert.deepEqual(r.bands.map(b=>b.perPersonMinor),[100,100]);assert.equal(r.discrepancyMinor,100,'positive half rounds up independently');
});
test('paid cutoff does not change qualifiers or invent payments above field',()=>{
 const v=input(10,57500);v.plan.recipients='top-4';const r=calculate(v);assert.equal(r.qualifierCount,10);assert.equal(r.actualPaidPlaces,4);assert.deepEqual(r.bands.map(b=>b.perPersonMinor),[22500,15000,10000]);assert.equal(r.balanced,true);assert.equal(r.qualificationChanged,false);
 const x=input(5);x.plan.recipients='top-8';assert.equal(calculate(x).code,'payments_beyond_qualifiers_policy_unresolved');
});
test('entry-fee intent is checked after calculation, never silently forces an award',()=>{
 const v=input(5,60000);v.plan.method='winner-multiplier';v.field.firstRoundLoserPlaces=[5];v.field.entryFeeMinor=1050;v.plan.firstRoundComparison='equal';let r=calculate(v);assert.equal(r.comparison,'incompatible_increment');assert.equal(r.bands.at(-1).perPersonMinor,10000);
 v.field.entryFeeMinor=5000;r=calculate(v);assert.equal(r.comparison,'not_satisfied');v.plan.firstRoundComparison='unset';assert.equal(calculate(v).comparison,'choice_required');v.plan.recipients='top-2';assert.equal(calculate(v).comparison,'not_applicable');
});
test('unknown field, malformed data and extreme fund fail closed without touching historical methods',()=>{
 const v=input();v.field={status:'unknown',qualifierCount:null,firstRoundLoserPlaces:null,entryFeeMinor:null};assert.equal(calculate(v).code,'known_playoff_field_required');
 for(const bad of[null,{}, {...input(),fundMinor:-1},{...input(),fundMinor:Number.MAX_SAFE_INTEGER},{...input(),extra:true}])assert.equal(calculate(bad).status,'blocked');
 const z=input(5,0);z.plan.method='equal';const r=calculate(z);assert.equal(r.zeroAwardBand,true);assert.equal(r.reviewRequired,true);for(const key of['authoritative','recipientAssignmentAllowed','finalizationAllowed','payoutAuthorized','moneyMoved'])assert.equal(r[key],false);
});
