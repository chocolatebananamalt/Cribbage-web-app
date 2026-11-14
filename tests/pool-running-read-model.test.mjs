import test from 'node:test';import assert from 'node:assert/strict';
import {projectRunningPoolReadModels,createRunningPoolReader}from'../src/lib/results/pool-running-read-model.ts';
import{isRunningPoolWorkspace}from'../src/lib/results/pool-running-summary.ts';
import{poolReadExample,id,tid,eid,stamp}from'./helpers/pool-running-read-examples.mjs';
const project=m=>projectRunningPoolReadModels(tid,eid,m,stamp),qrow=r=>r.pools.find(p=>p.kind==='q'),srow=r=>r.pools.find(p=>p.kind==='side');
test('Q entries, recorded payments and eligible funds stay separate and aggregate only',()=>{
 const m=poolReadExample(),before=structuredClone(m),r=project(m),q=qrow(r);assert(isRunningPoolWorkspace(r));assert.deepEqual(m,before);assert.equal(q.enteredCount,3);assert.equal(q.fullyPaidCount,1);assert.equal(q.eligiblePaidEntryCount,1);assert.equal(q.recordedPoolTotalMinor,1000);assert.equal(q.eligiblePoolTotalMinor,1000);assert.equal(q.projectedIfAllEnteredPayMinor,3000);assert.equal(q.status,'available');assert.equal(r.sideState,'no-recorded-pool');
 const text=JSON.stringify(r);for(const key of ['PRIVATE','participantId','rosterEntryId','receiptId','electionId','consentReference','disclosureReference','displayName','baseAllocatedMinor'])assert(!text.includes(key));assert.equal(r.publicAccessGranted,false);assert.equal(r.awardEstimateAvailable,false);
});
test('pool fully paid but base unpaid is held, not eligible; partial allocation is recorded without rounding up',()=>{
 const m=poolReadExample(),e=m.qOperating.membership.entries[1];Object.assign(e,{allocationVersion:1,receiptId:id(31),receiptVersion:1,receivedMinor:4000,allocationCurrent:true,baseAllocatedMinor:3000});e.pools[0].amountAllocatedMinor=1000;let q=qrow(project(m));assert.equal(q.fullyPaidCount,2);assert.equal(q.eligiblePaidEntryCount,1);assert.equal(q.recordedPoolTotalMinor,2000);assert.equal(q.heldRecordedMinor,1000);assert(q.heldOrExcludedReviewRequired);
 e.baseAllocatedMinor=5000;e.receivedMinor=5500;e.pools[0].amountAllocatedMinor=500;q=qrow(project(m));assert.equal(q.fullyPaidCount,1);assert.equal(q.partiallyPaidCount,1);assert.equal(q.recordedPoolTotalMinor,1500);assert.equal(q.eligiblePoolTotalMinor,1000);
});
test('stale or voided Q allocation remains unknown even with zeroed amounts; whole receipt is never a pool share',()=>{
 for(const receivedMinor of [0,6000]){const m=poolReadExample(),e=m.qOperating.membership.entries[0];e.allocationCurrent=false;e.baseAllocatedMinor=0;e.pools[0].amountAllocatedMinor=0;e.pools[0].paidEntryEligible=false;e.receivedMinor=receivedMinor;e.reason='PRIVATE Source changed';const q=qrow(project(m));assert.equal(q.enteredCount,3);assert.equal(q.recordedPoolTotalMinor,null);assert.equal(q.eligiblePoolTotalMinor,null);assert.equal(q.fullyPaidCount,null);assert.equal(q.knownRecordedSubtotalMinor,0);assert.equal(q.heldRecordedMinor,null);assert.equal(q.unknownPaymentCount,1);assert.equal(q.status,'partial');}
});
test('active Side counts exclude withdrawn entries while retaining held money and known partial contributions',()=>{
 const r=project(poolReadExample('side')),s=srow(r);assert(isRunningPoolWorkspace(r));assert.equal(r.qState,'unavailable');assert.equal(s.enteredCount,2);assert.equal(s.fullyPaidCount,1);assert.equal(s.partiallyPaidCount,1);assert.equal(s.recordedPoolTotalMinor,2500);assert.equal(s.heldRecordedMinor,1000);assert.equal(s.eligiblePoolTotalMinor,null);assert.equal(s.eligiblePaidEntryCount,null);assert.equal(s.status,'partial');
 const m=poolReadExample('side');m.side.pools[0].entries[2].elected=false;m.side.pools[0].entries[2].dueMinor=0;m.side.pools[0].paidCount=1;const held=srow(project(m));assert.equal(held.recordedPoolTotalMinor,2500);assert.equal(held.heldRecordedMinor,1000);
});
test('one Side contribution and true zero remain visible without deciding a payout method',()=>{
 const m=poolReadExample('side'),p=m.side.pools[0];p.entries=p.entries.slice(0,1);p.paidCount=1;p.blockers=['unsupported_payout_domain'];let s=srow(project(m));assert.equal(s.enteredCount,1);assert.equal(s.recordedPoolTotalMinor,1000);assert.equal(s.eligiblePaidEntryCount,1);assert.equal(s.status,'available');
 p.entries=[];p.paidCount=0;s=srow(project(m));assert.equal(s.enteredCount,0);assert.equal(s.recordedPoolTotalMinor,0);assert.equal(s.eligiblePoolTotalMinor,0);
});
test('duplicate source identities, missing activity, wrong event and unknown source never turn into zero counts',()=>{
 const a=poolReadExample();a.qOperating.membership.entries.push(structuredClone(a.qOperating.membership.entries[0]));assert.equal(project(a).qState,'unavailable');
 const b=poolReadExample('side');b.side.pools[0].participants.push(structuredClone(b.side.pools[0].participants[0]));const r=project(b);assert.equal(srow(r).status,'unavailable');assert.equal(srow(r).enteredCount,null);
 const c=poolReadExample();c.activity.rows.pop();c.activity.rows.forEach(r=>r.tied=true);assert.equal(project(c).qState,'unavailable');
 const d=poolReadExample();d.activity.eventId=id(999);const bad=project(d);assert.equal(bad.qState,'unavailable');assert.equal(bad.sideState,'unavailable');assert.equal(bad.pools.length,0);
 const stale=projectRunningPoolReadModels(tid,eid,poolReadExample(),stamp,false);assert.equal(stale.pools.length,0);assert(stale.issues.includes('source_stale'));
});
test('current policy consent/pre-play and withdrawn participation do not masquerade as eligible contributions',()=>{
 const a=poolReadExample();a.qOperating.membership.entries[0].pools[0].consentReference='PRIVATE no selected policy';let q=qrow(project(a));assert.equal(q.recordedPoolTotalMinor,1000);assert.equal(q.eligiblePaidEntryCount,0);assert.equal(q.heldRecordedMinor,1000);
 const b=poolReadExample();b.qOperating.membership.started=true;b.qOperating.membership.entries[0].pools[0].prePlayElected=false;q=qrow(project(b));assert.equal(q.eligiblePaidEntryCount,0);assert.equal(q.recordedPoolTotalMinor,1000);
});
test('private reader role intersection and owned snapshot drift checks precede any aggregate disclosure',async()=>{
 let reads=0;const actor=id(800),m=poolReadExample();for(const roles of [['player'],['judge'],['viewer'],[]]){const read=createRunningPoolReader({access:async()=>({actorId:actor,roles}),models:async()=>{reads++;return m},now:()=>stamp});assert.equal(await read(tid,eid),null);}assert.equal(reads,0);
 let n=0;const shared=poolReadExample(),drift=createRunningPoolReader({access:async()=>({actorId:actor,roles:['director']}),models:async()=>{if(n++)shared.activity.rows[0].participantStatus='withdrawn';return shared},now:()=>stamp});const changed=await drift(tid,eid);assert.equal(changed.pools.length,0);assert.equal(changed.sourceObservation,'observed-source-drift');
 let calls=0;const revoked=createRunningPoolReader({access:async()=>({actorId:actor,roles:++calls===3?['player']:['co_director']}),models:async()=>structuredClone(m),now:()=>stamp});assert.equal(await revoked(tid,eid),null);
});

test('missing native funding flag cannot promote partial or withdrawn contributions to eligible funds',()=>{const m=poolReadExample('side');m.side.pools[0].blockers=['unsupported_payout_domain'];const s=srow(project(m));assert.equal(s.recordedPoolTotalMinor,2500);assert.equal(s.fullyPaidCount,1);assert.equal(s.eligiblePoolTotalMinor,null);assert.equal(s.eligiblePaidEntryCount,null);assert.equal(s.status,'partial');});

test('public DTO rejects private fields and contradictory counts or money without formatting them',()=>{const good=project(poolReadExample());for(const change of [x=>x.pools[0].participantId=id(1),x=>x.pools[0].fullyPaidCount=100,x=>x.pools[0].eligiblePoolTotalMinor=2000,x=>x.pools[0].projectedIfAllEnteredPayMinor=1,x=>x.pools[0].knownRecordedSubtotalMinor=0]){const bad=structuredClone(good);change(bad);assert.equal(isRunningPoolWorkspace(bad),false);}});
