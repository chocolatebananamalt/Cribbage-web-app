import { customGraduatedAmountsVersionV3 } from '../src/lib/results/custom-graduated-amounts-v3.ts';
import { createCustomPayoutIntentV1 } from '../src/lib/api/custom-payout-intent-v1.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { operatingSource, id } from './fixtures/q-operating-source.mjs';
import { customQPolicyVersionV5, isQCustomPolicyRequestV5, isQCustomReconciliationRequestV5, isQCustomWorkspaceV5 } from '../src/lib/api/q-custom-policy-v5.ts';
import { graduatedQMethodV4, isQGraduatedPolicyRequestV4 } from '../src/lib/api/q-graduated-policy-v4.ts';
import { qGraduatedOperatingPreviewV4 } from '../src/lib/results/q-graduated-operating-preview-v4.ts';
import { previewCustomQPlanV5, verifyRetainedCustomQPlanV5 } from '../src/lib/results/q-custom-operating-preview-v5.ts';
const request = ratio => ({action:'publish',poolVersionId:id(5),method:customQPolicyVersionV5,ratio,amountMethod:customGraduatedAmountsVersionV3,disclosureReference:'TEST ONLY retained custom ratio',disclosed:true,intent:createCustomPayoutIntentV1('q',ratio,{tournamentId:id(1),eventClientRowId:id(2),setupRevisionId:id(80),setupVersion:1,poolSlot:1,sourceDigest:'a'.repeat(64)})});
function input(ratio=7,count=28){const workspace=operatingSource(count,1000);Object.assign(workspace.policies[0],{method:customQPolicyVersionV5,ratio,scheduleId:customGraduatedAmountsVersionV3});return{workspace,tournamentId:id(1),eventId:id(2),poolVersionId:id(5),expectedSourceDigest:'a'.repeat(64)};}
test('new exact custom request and replay namespace preserve old v4 contracts',()=>{
 for(const ratio of[1,2,3,5,7,11,99,100,101,2147483647])assert.ok(isQCustomPolicyRequestV5(request(ratio)));
 for(const ratio of[0,-7,7.5,'7',2147483648,NaN,Infinity])assert.equal(isQCustomPolicyRequestV5(request(ratio)),false);
 assert.equal(isQCustomPolicyRequestV5({...request(7),extra:true}),false);
 assert.equal(isQCustomPolicyRequestV5({...request(7),ratio:8}),false);
 assert.equal(isQCustomPolicyRequestV5({...request(7),intent:undefined}),false);
 assert.equal(isQCustomPolicyRequestV5({...request(7),amountMethod:'unapproved'}),false);
 assert.ok(isQCustomReconciliationRequestV5({operationId:id(90),request:request(7)}));
 assert.equal(isQCustomReconciliationRequestV5({operationId:id(90),request:{...request(7),ratio:'7'}}),false);
 assert.equal(isQGraduatedPolicyRequestV4({action:'publish',poolVersionId:id(5),method:graduatedQMethodV4,ratio:7,scheduleId:graduatedQMethodV4,disclosureReference:'prior exact method',disclosed:true}),false);
});
test('custom7 pays exactly ceil28/7 paid cards, backfills nonqualifier and conserves $5 units',()=>{
 const i=input(),before=JSON.stringify(i);assert.ok(isQCustomWorkspaceV5(i.workspace,i.tournamentId));
 const p=previewCustomQPlanV5(i);assert.equal(p.status,'preview');assert.equal(p.fundMinor,28000);
 assert.equal(p.awards.length,4);assert.deepEqual(p.awards.map(a=>a.participantId),[id(100),id(101),id(102),id(103)]);
 assert.equal(i.workspace.cards[3].qualified,false);assert.equal(p.awards.reduce((s,a)=>s+a.amountMinor,0),28000);
 assert.ok(p.awards.every(a=>a.amountMinor>0&&a.amountMinor%500===0));assert.equal(p.moneyMoved,false);
 assert.equal(JSON.stringify(i),before);assert.ok(verifyRetainedCustomQPlanV5(JSON.parse(JSON.stringify(p)),i));
 const tampered=structuredClone(p);tampered.awards[0].amountMinor+=500;assert.equal(verifyRetainedCustomQPlanV5(tampered,i),false);
 const stale=structuredClone(i);stale.workspace.sourceDigest='b'.repeat(64);assert.equal(verifyRetainedCustomQPlanV5(p,stale),false);
});
test('existing preset amount and paid ranking are identical, and N greater than paid count has one award',()=>{
 for(const ratio of[4,6]){const i=input(ratio,20),p=previewCustomQPlanV5(i),old=structuredClone(i.workspace);old.policies[0].method=graduatedQMethodV4;old.policies[0].scheduleId=graduatedQMethodV4;
 const prior=qGraduatedOperatingPreviewV4(old,id(5));assert.equal(p.status,'preview');assert.equal(prior.status,'preview');assert.deepEqual(p.awards,prior.awards);assert.deepEqual({...p.calculation,policyVersion:graduatedQMethodV4},prior.calculation);}
 const p=previewCustomQPlanV5(input(100,3));assert.equal(p.status,'preview');assert.deepEqual(p.awards,[{participantId:id(100),amountMinor:3000}]);
});
test('wrong event, stale source, unpaid/late entries and unresolved cash ties remain blocked',()=>{
 for(const change of[
 i=>i.eventId=id(99),i=>i.expectedSourceDigest='b'.repeat(64),
 i=>i.workspace.membership.started=false,i=>i.workspace.membership.entries[0].allocationCurrent=false,
 i=>i.workspace.membership.entries[0].pools[0].prePlayElected=false,
 i=>i.workspace.membership.entries[0].pools[0].consentReference='Q policy wrong: not accepted',
 i=>i.workspace.membership.entries[0].pools[0].amountAllocatedMinor=500,
 i=>Object.assign(i.workspace.cards[1],{gamePoints:i.workspace.cards[0].gamePoints,gamesWon:i.workspace.cards[0].gamesWon,plusPoints:i.workspace.cards[0].plusPoints}),
 i=>i.workspace.policies[0].ratio=2147483648,
 i=>i.workspace.membership.entries.push(structuredClone(i.workspace.membership.entries[0])),
 ]){const i=input();change(i);assert.equal(previewCustomQPlanV5(i).status,'blocked');}
 const i=input(),e=i.workspace.membership.entries[0];Object.assign(e,{receivedMinor:3000,obligationMinor:3000});Object.assign(e.pools[0],{elected:false,amountAllocatedMinor:0,amountOwedMinor:0,paidEntryEligible:false});
 const p=previewCustomQPlanV5(i);assert.equal(p.status,'preview');assert.equal(p.fundMinor,27000);assert.equal(p.awards.some(a=>a.participantId===id(100)),false);
});
test('PostgreSQL UUID case aliases cannot create two paid identities or awards',()=>{
 const i=input(1,4),entry=i.workspace.membership.entries[0];
 entry.participantId='abcdef00-0000-4000-8000-000000000001';entry.rosterEntryId='fedcba00-0000-4000-8000-000000000001';
 i.workspace.cards[0].participantId=entry.participantId;
 assert.equal(previewCustomQPlanV5(i).status,'preview');
 const alias=structuredClone(entry);alias.participantId=alias.participantId.toUpperCase();alias.rosterEntryId=alias.rosterEntryId.toUpperCase();
 i.workspace.membership.entries.push(alias);i.workspace.cards.push({...i.workspace.cards[0],participantId:alias.participantId,qualified:false,qualificationRank:null,plusPoints:1});
 assert.equal(isQCustomWorkspaceV5(i.workspace,i.tournamentId),false);assert.equal(previewCustomQPlanV5(i).status,'blocked');
});
test('a known empty contribution fund produces no Q obligations, not a fabricated receipt or refund',()=>{
 const i=input(7,4);for(const e of i.workspace.membership.entries){Object.assign(e,{receivedMinor:3000,obligationMinor:3000});Object.assign(e.pools[0],{elected:false,amountAllocatedMinor:0,amountOwedMinor:0,paidEntryEligible:false});}
 const p=previewCustomQPlanV5(i);assert.equal(p.status,'preview');assert.equal(p.fundMinor,0);assert.deepEqual(p.awards,[]);assert.deepEqual(p.refunds,[]);assert.equal(p.calculation.branch,'empty_pool');assert.equal(p.moneyMoved,false);
});
