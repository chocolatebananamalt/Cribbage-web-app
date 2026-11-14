import test from 'node:test';
import assert from 'node:assert/strict';
import { operatingSource, id } from './fixtures/q-operating-source.mjs';
import { customQPolicyVersionV5 } from '../src/lib/api/q-custom-policy-v5.ts';
import { customGraduatedAmountsVersionV3 } from '../src/lib/results/custom-graduated-amounts-v3.ts';
import { previewCustomQPlanV5 } from '../src/lib/results/q-custom-operating-preview-v5.ts';
import { previewCustomQAccountingV1 } from '../src/lib/results/custom-q-accounting-preview-v1.ts';
function line(slot=1){const workspace=operatingSource(17,1000);workspace.sourceDigest='c'.repeat(64);
 workspace.policies=[1,2].map(n=>({...workspace.policies[0],id:id(80+n),poolVersionId:id(5+n),method:customQPolicyVersionV5,ratio:7,scheduleId:customGraduatedAmountsVersionV3}));
 workspace.membership.pools=[1,2].map(n=>({...workspace.membership.pools[0],poolVersionId:id(5+n),slot:n,name:`TEST ONLY Q ${n}`}));
 for(const e of workspace.membership.entries){const p=e.pools[0];e.pools=[1,2].map(n=>({...p,poolVersionId:id(5+n),consentReference:`Q policy ${id(80+n)}: TEST ONLY accepted current policy`}));e.receivedMinor=5000;e.obligationMinor=5000;}
 const pool=id(5+slot),currentInput={workspace,tournamentId:id(1),eventId:id(2),poolVersionId:pool,expectedSourceDigest:workspace.sourceDigest};
 const retainedPlan=previewCustomQPlanV5(currentInput);assert.equal(retainedPlan.status,'preview');
 return{retainedPlan,currentInput,funding:{tournamentId:id(1),eventId:id(2),poolVersionId:pool,sourceDigest:workspace.sourceDigest,allocatedMinor:17000,currency:'USD'}};
}
const input=()=>({tournamentId:id(1),eventId:id(2),pools:[line()]});
test('retained source-bound custom7 awards reconcile to separately supplied current funding, unpaid only',()=>{
 const i=input(),original=JSON.stringify(i),r=previewCustomQAccountingV1(i);assert.equal(r.status,'unpaid_accounting_preview');
 assert.equal(r.totalAllocatedMinor,17000);assert.equal(r.totalAwardsMinor,17000);assert.deepEqual(r.pools[0].awards.map(a=>a.amountMinor),[8500,5500,3000]);
 assert.equal(r.reviewRequired,true);assert.equal(r.paymentsRecorded,false);assert.equal(r.moneyMoved,false);assert.equal(JSON.stringify(i),original);
 r.pools[0].awards[0].amountMinor=0;assert.equal(JSON.stringify(i),original);
 const two=previewCustomQAccountingV1({...input(),pools:[line(1),line(2)]});assert.equal(two.status,'unpaid_accounting_preview');assert.equal(two.totalAwardsMinor,34000);
});
test('no partial accounting when any pool is stale, foreign, duplicated, tampered or under/overfunded',()=>{
 for(const change of[
 i=>i.pools[0].funding.allocatedMinor+=500,i=>i.pools[0].funding.allocatedMinor-=500,
 i=>i.pools[0].funding.eventId=id(99),i=>i.pools[0].funding.sourceDigest='f'.repeat(64),
 i=>i.pools[0].retainedPlan.awards[0].amountMinor+=500,
 i=>i.pools[0].currentInput.workspace.policies[0].ratio=8,
 i=>i.pools.push(structuredClone(i.pools[0])),i=>i.pools[0].funding.currency='EUR',
 i=>i.pools[0].funding.allocatedMinor='17000',i=>i.pools[0].funding.extra=true,
 ]){const i=input();change(i);assert.equal(previewCustomQAccountingV1(i).status,'blocked');}
 const i={...input(),pools:[line(1),line(2)]};i.pools[1].funding.allocatedMinor=0;assert.equal(previewCustomQAccountingV1(i).status,'blocked');
});

test('two pools must come from one identical whole-event source observation',()=>{
 const i={...input(),pools:[line(1),line(2)]};i.pools[1].currentInput.workspace.sourceDigest='d'.repeat(64);i.pools[1].currentInput.expectedSourceDigest='d'.repeat(64);i.pools[1].retainedPlan=previewCustomQPlanV5(i.pools[1].currentInput);i.pools[1].funding.sourceDigest='d'.repeat(64);assert.equal(previewCustomQAccountingV1(i).status,'blocked');
 const sameDigest={...input(),pools:[line(1),line(2)]};sameDigest.pools[1].currentInput.workspace.membership.eventName='Changed event metadata';sameDigest.pools[1].retainedPlan=previewCustomQPlanV5(sameDigest.pools[1].currentInput);assert.equal(previewCustomQAccountingV1(sameDigest).status,'blocked');
});
