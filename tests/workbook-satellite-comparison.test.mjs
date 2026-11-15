import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {calculateWorkbookSatelliteComparisonV1 as calc,workbookSatelliteEvidenceV1 as evidence,workbookSatelliteComparisonVersionV1 as version}from'../src/lib/results/workbook-satellite-comparison-v1.ts';
const input=(patch={})=>({entrantCount:18,feeMinor:4000,ratio:6,fundMinor:30000,rankingState:'individual_ranks',...patch});
const fixtureFiles=['src/lib/results/custom-graduated-amounts-v3.ts','src/lib/results/workbook-side-comparison-v1.ts','src/lib/api/satellite-results.ts'];
const hashes=fixtureFiles.map(f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'));

test('Satellite uses its own fixed 125 percent model at equality and strict linear branch above it',()=>{
 const equal=calc(input());assert.equal(equal.status,'comparison');assert.equal(equal.sourceModel.branch,'entry_125pct_baseline');
 assert.deepEqual(equal.sourceModel.rawAwards,[{numeratorMinor:'15000',denominator:'1'},{numeratorMinor:'10000',denominator:'1'},{numeratorMinor:'5000',denominator:'1'}]);
 assert.deepEqual(equal.awardsMinor,[15000,10000,5000]);assert.equal(equal.sourceModel.reconstructedNearestDifferenceMinor,0);
 const above=calc(input({fundMinor:30001}));assert.equal(above.status,'blocked');assert.equal(above.code,'fund_not_multiple_of_5');assert.equal(above.sourceModel.branch,'descending_linear');
 const linear=calc(input({fundMinor:48000}));assert.equal(linear.status,'comparison');assert.equal(linear.sourceModel.branch,'descending_linear');assert.deepEqual(linear.awardsMinor,[24000,16000,8000]);
});

test('nearest-rounded reconstruction is diagnostic when $5 awards cannot conserve the supplied fund',()=>{
 // Reconstructed from the supplied formula, not an independent live Sheet run.
 const r=calc(input({entrantCount:35,feeMinor:3000,fundMinor:100300}));
 assert.equal(r.status,'blocked');assert.equal(r.code,'fund_not_multiple_of_5');assert.equal(r.sourceModel.recipientCount,6);
 assert.deepEqual(r.sourceModel.reconstructedNearestAwardsMinor,[29500,24500,19500,14000,9000,4000]);
 assert.equal(r.sourceModel.reconstructedNearestDifferenceMinor,200);assert.ok(!Object.hasOwn(r,'awardsMinor'));
});

test('Custom ratios affect paid-place count and conserve only the separate supplied event fund',()=>{
 for(const ratio of[1,2,3,5,7,11,17]){
  const r=calc(input({entrantCount:30,ratio,feeMinor:1000,fundMinor:1000000}));assert.equal(r.status,'comparison');
  assert.equal(r.sourceModel.recipientCount,Math.ceil(30/ratio));assert.equal(r.awardsMinor.reduce((a,b)=>a+b,0),1000000);
  assert.ok(r.awardsMinor.every((v,i)=>v>0&&v%500===0&&(i===0||v<=r.awardsMinor[i-1])));
  assert.equal(r.comparisonVersion,version);assert.equal(r.operationalPolicyAdopted,false);assert.equal(r.recipientSelectionPerformed,false);assert.equal(r.moneyMoved,false);
 }
 assert.equal(calc(input({entrantCount:30,ratio:1,fundMinor:3000000})).sourceModel.recipientCount,30);
 assert.equal(calc(input({entrantCount:31,ratio:1})).code,'source_row_limit');
 assert.equal(calc(input({entrantCount:10,ratio:10})).code,'one_recipient_undefined');
});

test('undefined low-fund, tie, baseline and zero-rounded-award behavior stays blocked',()=>{
 assert.equal(calc(input({fundMinor:14999})).code,'fund_below_source_baseline');
 assert.equal(calc(input({rankingState:'unresolved_ties'})).code,'unresolved_ties');
 const below=calc(input({feeMinor:3000}));assert.equal(below.code,'rounded_baseline_unresolved');assert.ok(!Object.hasOwn(below,'awardsMinor'));
 assert.deepEqual(below.sourceModel.baselineMinor,{numeratorMinor:'3750',denominator:'1'});
 const fractional=calc(input({feeMinor:2999}));assert.equal(fractional.code,'rounded_baseline_unresolved');assert.deepEqual(fractional.sourceModel.baselineMinor,{numeratorMinor:'14995',denominator:'4'});
 const feasibleFractional=calc(input({feeMinor:3001}));assert.equal(feasibleFractional.status,'comparison');assert.deepEqual(feasibleFractional.sourceModel.baselineMinor,{numeratorMinor:'15005',denominator:'4'});assert.deepEqual(feasibleFractional.awardsMinor,[16000,10000,4000]);
 assert.equal(calc(input({entrantCount:2,ratio:1,feeMinor:1,fundMinor:500})).code,'zero_rounded_award_unresolved');
});

test('strict safe inputs reject forged recipients, overrides, funds and coercion without policy adoption',()=>{
 for(const patch of[{entrantCount:0},{entrantCount:-1},{entrantCount:NaN},{entrantCount:Infinity},{entrantCount:Number.MAX_SAFE_INTEGER+1},{feeMinor:0},{feeMinor:-1},{ratio:0},{ratio:2.5},{ratio:'6'},{fundMinor:-1},{fundMinor:0.5},{fundMinor:Number.MAX_SAFE_INTEGER+1},{rankingState:{}},{rankingState:{toString:()=> 'individual_ranks'}},{winner:'A'},{overrides:[1]},{qFundMinor:1000},{sideFundMinor:1000}])assert.equal(calc(input(patch)).status,'blocked');
 const symbolInput=input();symbolInput[Symbol('hidden')]=1;assert.equal(calc(symbolInput).code,'invalid_input');
 assert.equal(calc({...input(),fundMinor:0}).code,'fund_below_source_baseline');
 const huge=calc(input({entrantCount:Number.MAX_SAFE_INTEGER,ratio:Math.floor(Number.MAX_SAFE_INTEGER/2),feeMinor:Number.MAX_SAFE_INTEGER,fundMinor:Number.MAX_SAFE_INTEGER}));assert.equal(huge.code,'unsafe_result');
 const original=input();const copy=structuredClone(original);calc(original);assert.deepEqual(original,copy);
 assert.deepEqual(fixtureFiles.map(f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')),hashes);
 assert.equal(evidence.localLiveRecalculation,false);assert.equal(evidence.fullObservedInputOutputArraysReceived,false);assert.equal(evidence.ratioMinimumPolicyEstablished,false);assert.ok(Object.isFrozen(evidence));
});
