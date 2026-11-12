import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {previewQPools,isQPreviewSources,Q_POLICY_METHOD,qPolicyPrefix} from '../src/lib/results/q-pool-preview.ts';
import {isQPolicyRequest,isQPolicyResult} from '../src/lib/api/q-pool-policy.ts';
import {id,sourceFixture} from './fixtures/q-policy-source.mjs';
test('equal preview funds all paid members, pays only final qualifiers and assigns pennies by final order',()=>{
 const s=sourceFixture(5,501);s.qualification.qualifiers.reverse();
 assert.ok(isQPreviewSources(s,id(1)));const p=previewQPools(s)[0];
 assert.equal(p.status,'awards_preview');assert.equal(p.fundMinor,2505);assert.deepEqual(p.awards.map(x=>x.amountMinor),[835,835,835]);
 const r=previewQPools(sourceFixture(4,500))[0];assert.deepEqual(r.awards.map(x=>x.amountMinor),[667,667,666]);
 assert.deepEqual(r.awards.map(x=>x.qualificationRank),[1,2,3]);
});
test('no eligible qualifier yields Q-only refund obligations, no payment and no base refund',()=>{
 const s=sourceFixture();s.qualification.qualifiers=[{participantId:id(999),qualificationRank:1,tied:false}];
 const p=previewQPools(s)[0];assert.equal(p.status,'refund_obligations_preview');assert.equal(p.awards.length,0);assert.deepEqual(p.refundObligations.map(x=>x.amountMinor),[501,501,501,501]);
});
test('integer conservation across contributor and recipient populations with deterministic odd cents',()=>{
 for(let n=1;n<=100;n++)for(let k=1;k<=Math.min(n,10);k++)for(const fee of [1,2,99,501,9999]){
  const s=sourceFixture(n,fee);s.qualification.qualifiers=Array.from({length:k},(_,i)=>({participantId:id(100+i),qualificationRank:i+1,tied:false}));
  const p=previewQPools(s)[0];assert.equal(p.status,'awards_preview');assert.equal(p.awards.reduce((a,b)=>a+b.amountMinor,0),n*fee);
  assert.ok(p.awards.every((x,i)=>i===0||p.awards[i-1].amountMinor>=x.amountMinor));assert.ok(p.awards[0].amountMinor-p.awards.at(-1).amountMinor<=1);
 }
});
test('partial, stale, unbound, missing qualification, tie and dispute states fail closed independently',()=>{
 for(const change of [s=>s.membership.entries[0].allocationCurrent=false,s=>s.membership.entries[0].pools[0].paidEntryEligible=false,s=>s.membership.entries[0].pools[0].consentReference='legacy consent',s=>s.policies=[],s=>s.qualification=null,s=>s.qualification.qualifiers[0].tied=true,s=>s.blockers=['qualification_disputed']]){
  const s=sourceFixture();change(s);const p=previewQPools(s)[0];assert.equal(p.status,'blocked');assert.equal(p.awards.length,0);assert.equal(p.refundObligations.length,0);
 }
});
test('policies and sources reject duplicate identities, unknown methods and malformed envelopes',()=>{
 const s=sourceFixture();assert.ok(isQPreviewSources(s,id(1)));assert.equal(isQPreviewSources({...s,extra:true},id(1)),false);
 assert.equal(isQPreviewSources({...s,policies:[...s.policies,...s.policies]},id(1)),false);
 assert.equal(isQPreviewSources({...s,qualification:{...s.qualification,qualifiers:[s.qualification.qualifiers[0],s.qualification.qualifiers[0]]}},id(1)),false);
 assert.equal(isQPreviewSources({...s,sourceDigest:'wrong'},id(1)),false);
 const duplicate=structuredClone(s);duplicate.membership.entries.push(structuredClone(duplicate.membership.entries[0]));assert.equal(isQPreviewSources(duplicate,id(1)),false);
 const gap=structuredClone(s);gap.qualification.qualifiers[0].qualificationRank=9;assert.equal(isQPreviewSources(gap,id(1)),false);
 const request={poolVersionId:id(5),method:Q_POLICY_METHOD,disclosed:true,disclosureReference:'TEST ONLY flyer'};
 assert.ok(isQPolicyRequest(request));assert.equal(isQPolicyRequest({...request,disclosed:false}),false);assert.equal(isQPolicyRequest({...request,method:'graduated'}),false);assert.equal(isQPolicyRequest({...request,disclosureReference:'\n'}),false);
 assert.ok(isQPolicyResult({status:'q_policy_published',poolVersionId:id(5),policyId:id(6),version:1}));assert.equal(qPolicyPrefix(id(6)),`Q policy ${id(6)}: `);
 assert.equal(isQPolicyResult({status:'rejected',code:'unknown_failure'}),false);
});
test('declined participants with unreconciled positive receipt cannot silently disappear from funds',()=>{
 const s=sourceFixture();const e=s.membership.entries[3];e.allocationCurrent=false;e.pools[0]={...e.pools[0],elected:false,prePlayElected:false,amountAllocatedMinor:0,amountOwedMinor:0,paidEntryEligible:false};e.obligationMinor=3000;
 const p=previewQPools(s)[0];assert.equal(p.status,'blocked');assert.ok(p.blockers.includes('unresolved_receipt_allocation'));
});
test('policy routes retain same-origin verified actor/service-only boundaries; canonical Q settlement stays disabled',()=>{
 const route=fs.readFileSync('src/app/api/v1/tournaments/[id]/q-pool-policy/route.ts','utf8');
 for(const text of ['isSameOriginRequest','requireVerifiedSubject','createServerOnlyAdminClient','isQPreviewSources','isQPolicyRequest'])assert.ok(route.includes(text));
 const settlement=fs.readFileSync('src/lib/api/settlement-v5.ts','utf8');assert.ok(settlement.includes('qPoolClaims: false'));assert.ok(settlement.includes('noQPoolClaimsRecorded: true'));
 const client=fs.readFileSync('src/app/tournament/[tournamentId]/q-pool-policy/policy-client.tsx','utf8');assert.ok(client.includes('setAppRecoveryItem'));assert.ok(client.includes('payment-obligation:q-policy:'));assert.ok(!client.includes('localStorage.clear'));
});
