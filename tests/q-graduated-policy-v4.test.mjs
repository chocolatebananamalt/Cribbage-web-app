import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {graduatedQMethodV4,isQGraduatedPolicyRequestV4,isQOperatingWorkspaceV4,isQGraduatedReconciliationRequestV4,qGraduatedPolicyResultMatchesV4}from'../src/lib/api/q-graduated-policy-v4.ts';
import {isQOperatingRequestV3,isQOperatingWorkspaceV3}from'../src/lib/api/q-operating-schedules.ts';
import {isQReviewV2Result}from'../src/lib/api/q-obligation-review-v2.ts';
import {qGraduatedOperatingPreviewV4}from'../src/lib/results/q-graduated-operating-preview-v4.ts';
import {operatingSource,id}from'./fixtures/q-operating-source.mjs';
const request=()=>({action:'publish',poolVersionId:id(5),method:graduatedQMethodV4,ratio:6,scheduleId:graduatedQMethodV4,disclosureReference:'TEST ONLY new shared $5 method',disclosed:true});
const source=()=>{const s=operatingSource(16,500);Object.assign(s.policies[0],{method:graduatedQMethodV4,ratio:6,scheduleId:graduatedQMethodV4});return s;};
test('new Q shared method has a separate exact contract; old methods and recovery are not expanded',()=>{
 assert.equal(isQGraduatedPolicyRequestV4(request()),true);assert.equal(isQOperatingRequestV3(request()),false);
 for(const bad of[{ratio:2},{method:'acc-weighted-largest-remainder-5usd-v1'},{scheduleId:'wrong'},{disclosed:false},{disclosureReference:' padded '},{extra:true}])assert.equal(isQGraduatedPolicyRequestV4({...request(),...bad}),false);
 assert.ok(isQGraduatedReconciliationRequestV4({operationId:id(40),request:request()}));assert.equal(isQGraduatedReconciliationRequestV4({operationId:id(40)}),false);
 assert.equal(qGraduatedPolicyResultMatchesV4({status:'q_policy_published',policyId:id(6),poolVersionId:id(90)},request()),false);
});
test('workspace new literal accepts $5 fees, preserves old workspace codecs, rejects mismatched schedules and nonlattice fees',()=>{
 assert.ok(isQOperatingWorkspaceV4(source(),id(1)));assert.equal(isQOperatingWorkspaceV3(source(),id(1)),false);assert.ok(isQOperatingWorkspaceV4(operatingSource(),id(1)));
 const s=source();s.membership.pools[0].feeMinor=501;assert.equal(isQOperatingWorkspaceV4(s,id(1)),false);s.membership.pools[0].feeMinor=500;s.policies[0].scheduleId='wrong';assert.equal(isQOperatingWorkspaceV4(s,id(1)),false);
});
test('new $5 Q amount policy ranks paid cards independently of playoff cutoff and preserves old $10 chart history',()=>{
 const s=source();s.cards.forEach((c,i)=>{c.qualified=i===0;c.qualificationRank=i===0?1:null;});const p=qGraduatedOperatingPreviewV4(s,id(5));assert.equal(p.status,'preview');assert.deepEqual(p.awards.map(r=>r.amountMinor),[4000,2500,1500]);assert.equal(p.fundMinor,8000);assert.equal(p.moneyMoved,false);assert.equal(p.awards[1].participantId,id(101));
 const old=operatingSource(16,1000,'graduated-paid-card-rank-v2');assert.deepEqual(qGraduatedOperatingPreviewV4(old,id(5)).awards.map(r=>r.amountMinor),[8000,5000,3000]);
});
test('late/partial/stale/incorrect-policy funding and unresolved cash ties remain blocked',()=>{
 for(const change of[s=>s.membership.entries[0].pools[0].prePlayElected=false,s=>s.membership.entries[0].pools[0].amountAllocatedMinor=0,s=>s.membership.entries[0].allocationCurrent=false,s=>s.membership.entries[0].pools[0].consentReference='wrong',s=>s.cards[1]={...s.cards[0],participantId:id(101),qualificationRank:2}]){const s=source();change(s);assert.equal(qGraduatedOperatingPreviewV4(s,id(5)).status,'blocked');}
});
test('whole-five review rejection is explicit while old obligation history codecs remain readable',()=>{
 assert.ok(isQReviewV2Result({status:'rejected',code:'whole_five_awards_required'}));assert.equal(isQReviewV2Result({status:'rejected',code:'unknown_private_error'}),false);
 const old=operatingSource(4,500),before=JSON.stringify(old);assert.deepEqual(qGraduatedOperatingPreviewV4(old,id(5)),{status:'blocked',code:'whole_five_awards_required'});assert.equal(JSON.stringify(old),before);
});
test('new endpoints use current subject, same origin, server-only RPCs and full request reconciliation',()=>{
 for(const path of['route.ts','reconciliation/route.ts']){const s=fs.readFileSync('src/app/api/v1/tournaments/[id]/q-graduated-policy-v4/'+path,'utf8');for(const needle of['requireVerifiedSubject','isSameOriginRequest','createServerOnlyAdminClient','qGraduatedPolicyResultMatchesV4'])assert.ok(s.includes(needle));assert.ok(!s.includes('user_metadata'));}
 const r=fs.readFileSync('src/app/api/v1/tournaments/[id]/q-graduated-policy-v4/reconciliation/route.ts','utf8');assert.ok(r.includes('p_request:body.request'));
});
test('operational client preserves prior v2/v3 recovery identities while new graduated writes use v4',()=>{
 const s=fs.readFileSync('src/app/tournament/[tournamentId]/q-operating-schedules/operating-client.tsx','utf8');
 for(const text of['payment-obligation:q-operating-v2:','payment-obligation:q-operating-v3:','payment-obligation:q-operating-v4:','isQOperatingRequestV3(v.request)','qOperatingResultMatchesV3(result, e.request)','isQGraduatedPolicyRequestV4(requestV4)',"kind: 'q-operating-v4'",'request: e.request'])assert.ok(s.includes(text),text);
 assert.ok(s.includes('q-graduated-policy-v4'));assert.ok(!s.includes('request: requestV3'));
});
