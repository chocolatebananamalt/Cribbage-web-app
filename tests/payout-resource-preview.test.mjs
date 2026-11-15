import test from 'node:test';
import assert from 'node:assert/strict';
import {payoutReferenceCases,payoutReferenceMetadata,reconcilePayoutReference,compareSideReference,calculateApprovedPoolWhatIf,projectPoolSummary} from '../src/lib/results/payout-resource-preview.ts';
test('immutable parent reference amounts retain independently detected fund conflicts',()=>{
  assert(Object.isFrozen(payoutReferenceCases));assert(Object.isFrozen(payoutReferenceCases[0].bands[0].amountsMinor));
  assert.throws(()=>payoutReferenceCases[0].bands[0].amountsMinor.push(1));
  const amounts=Object.fromEntries(payoutReferenceCases.map(c=>[c.id,reconcilePayoutReference(c)]));
  assert.equal(amounts['main-40'].awardsTotalMinor,28500);assert.equal(amounts['main-40'].differenceMinor,500);assert.equal(amounts['main-40'].equalCohortCompliance,true);assert.equal(amounts['main-40'].fiveDollarCompliance,true);
  for(const id of ['side-17-ratio-6','q-six-graduated','q-six-stairstep'])assert.equal(amounts[id].balance,'balanced');
  assert.equal(amounts['q-six-equal'].differenceMinor,1000);assert.equal(amounts['q-six-equal'].methodCompliance,true);
  assert.equal(amounts['q-six-top-double'].differenceMinor,1000);assert.equal(amounts['q-six-top-double'].methodCompliance,true);
  assert.equal(amounts['q-nine-equal'].differenceMinor,-2000);assert.equal(amounts['q-nine-equal'].methodCompliance,true);
  assert.equal(amounts['satellite-total'].differenceMinor,200);assert.equal(amounts['satellite-total'].fiveDollarCompliance,null);assert.equal(amounts['satellite-total'].methodCompliance,null);
  assert.equal(payoutReferenceMetadata.operationalPolicyAdopted,false);
});
test('fund balance, equal treatment and $5 compliance are separate checks',()=>{
  const base=payoutReferenceCases.find(c=>c.id==='q-six-equal');
  const balancedUnequal={...base,fundMinor:20000,bands:[{label:'Edited',amountsMinor:[3500,3500,3500,3500,3500,2500]}]};
  const x=reconcilePayoutReference(balancedUnequal);assert.equal(x.balance,'balanced');assert.equal(x.methodCompliance,false);assert.equal(x.fiveDollarCompliance,true);
  const nonLattice=reconcilePayoutReference({...base,fundMinor:1202,bands:[{label:'Equal',amountsMinor:[601,601]}]});assert.equal(nonLattice.balance,'balanced');assert.equal(nonLattice.methodCompliance,true);assert.equal(nonLattice.fiveDollarCompliance,false);
  assert.throws(()=>reconcilePayoutReference({...base,fundMinor:Number.MAX_SAFE_INTEGER+1}));
});
test('approved kernel stays a separately labeled what-if, not workbook repair',()=>{
  const c=compareSideReference();assert.deepEqual(c.workbookAwardsMinor,[9500,5500,2000]);assert.deepEqual(c.approvedAwardsMinor,[8500,5500,3000]);assert.equal(c.roundingOnly,false);assert.equal(c.conflict,'distribution-policy-difference');
  assert.deepEqual(calculateApprovedPoolWhatIf({paidCount:20,feeMinor:1000,ratio:4}).awardsMinor,[6500,5500,4000,2500,1500]);
  assert.equal(calculateApprovedPoolWhatIf({paidCount:20,feeMinor:1000,ratio:1}).status,'blocked');
});
const entry=(id,extra={})=>({entryId:id,eventId:'event-1',poolId:'pool-1',currency:'USD',electionVersion:1,status:'entered',feeWaived:false,current:true,allocationState:'verified-current',allocationId:`allocation-${id}`,allocatedMinor:1000,...extra});
const input=entries=>({eventId:'event-1',poolId:'pool-1',policyVersion:'disclosed-v2',asOf:'2026-11-04T12:00:00Z',currency:'USD',feeMinor:1000,sourceCurrent:true,entries});
test('latest stable election, exact duplicate, waiver and partial payment cannot inflate fund',()=>{
  const rows=[entry('a'),entry('a'),entry('b',{allocatedMinor:500}),entry('c',{feeWaived:true,allocationId:null,allocatedMinor:0}),entry('d'),entry('d',{electionVersion:2,status:'withdrawn',allocationId:null,allocatedMinor:0}),entry('e',{status:'superseded',allocationId:null,allocatedMinor:0})];
  const before=JSON.stringify(rows),r=projectPoolSummary(input(rows));assert.equal(r.status,'available');assert.equal(r.enteredCount,3);assert.equal(r.fullyPaidCount,1);assert.equal(r.waivedCount,1);assert.equal(r.projectedBillableFundMinor,2000);assert.equal(r.eligibleFullyPaidFundMinor,1000);assert.equal(JSON.stringify(rows),before);
  assert.deepEqual(Object.keys(r).sort(),['asOf','currency','eligibleFullyPaidFundMinor','enteredCount','estimate','eventId','excludedAllocationReviewRequired','fullyPaidCount','issues','moneyMoved','policyVersion','poolId','projectedBillableFundMinor','status','waivedCount'].sort());
});
test('unknown/stale allocations preserve known participation, not pretend zero paid funds',()=>{
  for(const allocationState of ['unknown','stale']){const r=projectPoolSummary(input([entry('a'),entry('b',{allocationState,allocatedMinor:null,allocationId:null})]));assert.equal(r.status,'partial');assert.equal(r.enteredCount,2);assert.equal(r.projectedBillableFundMinor,2000);assert.equal(r.fullyPaidCount,null);assert.equal(r.eligibleFullyPaidFundMinor,null);}
  const r=projectPoolSummary(input([entry('a',{status:'withdrawn',allocatedMinor:1000})]));assert.equal(r.status,'partial');assert.equal(r.enteredCount,0);assert.equal(r.projectedBillableFundMinor,0);assert.equal(r.excludedAllocationReviewRequired,true);assert.equal(r.eligibleFullyPaidFundMinor,null);
});
test('cross-scope/currency, conflicting duplicates and reused allocations fail unavailable',()=>{
  for(const fields of [{eventId:'event-2'},{poolId:'pool-2'},{currency:'EUR'}])assert.equal(projectPoolSummary(input([entry('a',fields)])).code,'cross_scope');
  assert.equal(projectPoolSummary(input([entry('a'),entry('a',{feeWaived:true})])).code,'conflicting_duplicate');
  assert.equal(projectPoolSummary(input([entry('a'),entry('b',{allocationId:'allocation-a'})])).code,'reused_allocation');
  assert.equal(projectPoolSummary(input([entry('a',{current:false})])).code,'stale_election');
  assert.equal(projectPoolSummary({...input([]),sourceCurrent:false}).code,'stale_source');
  assert.equal(projectPoolSummary({...input([]),asOf:'2026-02-30T12:00:00Z'}).code,'invalid_input');
  assert.equal(projectPoolSummary(input([entry('a',{personName:'must not enter'})])).code,'invalid_input');
});
test('integer-cent and funding inconsistencies remain explicit without policy changes',()=>{
  assert.equal(projectPoolSummary(input([entry('a',{allocatedMinor:1000.5})])).status,'unavailable');
  for(const fields of [{allocatedMinor:1001},{allocatedMinor:1000,allocationId:null},{feeWaived:true,allocatedMinor:1000}]){const r=projectPoolSummary(input([entry('a',fields)]));assert.equal(r.status,'partial');assert.equal(r.eligibleFullyPaidFundMinor,null);assert(r.issues.includes('inconsistent_allocation'));}
  assert.equal(projectPoolSummary({...input([entry('a'),entry('b')]),feeMinor:Number.MAX_SAFE_INTEGER}).status,'unavailable');
  const empty=projectPoolSummary(input([]));assert.equal(empty.status,'available');assert.equal(empty.enteredCount,0);assert.equal(empty.eligibleFullyPaidFundMinor,0);
});

test('latest stale withdrawal/supersession is unknown, while older stale history does not override current election',()=>{
  for(const status of ['withdrawn','superseded']){
    const result=projectPoolSummary(input([entry('a',{status,current:false,allocatedMinor:0,allocationId:null})]));
    assert.equal(result.status,'unavailable');assert.equal(result.code,'stale_election');assert.equal(Object.hasOwn(result,'enteredCount'),false);assert.equal(Object.hasOwn(result,'eligibleFullyPaidFundMinor'),false);
  }
  const current=projectPoolSummary(input([entry('a',{status:'withdrawn',current:false,allocatedMinor:0,allocationId:null}),entry('a',{electionVersion:2,current:true})]));
  assert.equal(current.status,'available');assert.equal(current.enteredCount,1);assert.equal(current.eligibleFullyPaidFundMinor,1000);
});
