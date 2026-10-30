import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {balancedQMethodV3,isQOperatingRequestV3,isQOperatingRequestV2,isQOperatingWorkspaceV3,isQOperatingWorkspaceV2,isQOperatingResultV3,isQOperatingReconciliationRequestV3,qOperatingResultMatchesV3} from '../src/lib/api/q-operating-schedules.ts';
import {operatingWorkspacePoolPreview} from '../src/lib/results/q-operating-workspace-preview.ts';
import {operatingSource,id} from './fixtures/q-operating-source.mjs';
const request=()=>({action:'publish',poolVersionId:id(5),method:balancedQMethodV3,ratio:6,scheduleId:balancedQMethodV3,disclosureReference:'TEST ONLY exact app balanced formula disclosure',disclosed:true});
function balanced(n=16){const s=operatingSource(n,1000);Object.assign(s.policies[0],{method:balancedQMethodV3,ratio:6,scheduleId:balancedQMethodV3});return s;}
test('balanced policy uses a separate strict v3 request and full-payload reconciliation',()=>{
 assert.ok(isQOperatingRequestV3(request()));assert.equal(isQOperatingRequestV2(request()),false);
 for(const change of [{method:'graduated-paid-card-rank-v2'},{scheduleId:'friend-q-p2-10-6-v1'},{ratio:5},{ratio:null},{disclosed:false},{disclosureReference:' padded '},{extra:true}])assert.equal(isQOperatingRequestV3({...request(),...change}),false);
 assert.ok(isQOperatingReconciliationRequestV3({operationId:id(10),request:request()}));
 assert.equal(isQOperatingReconciliationRequestV3({operationId:id(10)}),false);
 assert.equal(isQOperatingReconciliationRequestV3({operationId:id(10),request:{...request(),extra:true}}),false);
 const receipt={status:'q_policy_published',policyId:id(6),poolVersionId:id(5)};
 assert.ok(isQOperatingResultV3(receipt));assert.ok(qOperatingResultMatchesV3(receipt,request()));
 assert.equal(qOperatingResultMatchesV3({...receipt,poolVersionId:id(9)},request()),false);
 assert.equal(isQOperatingResultV3({...receipt,paid:true}),false);
 assert.equal(isQOperatingResultV3({status:'rejected',code:'unexpected_private_error'}),false);
});
test('workspace accepts old and new policies without weakening the retained v2 contract',()=>{
 assert.ok(isQOperatingWorkspaceV3(balanced(),id(1)));assert.equal(isQOperatingWorkspaceV2(balanced(),id(1)),false);
 for(const s of [operatingSource(),operatingSource(16,1000,'graduated-paid-card-rank-v2')])assert.ok(isQOperatingWorkspaceV3(s,id(1)));
 const s=balanced();s.policies[0].scheduleId='wrong';assert.equal(isQOperatingWorkspaceV3(s,id(1)),false);
});
test('actual balanced Q previews use current named-pool payments and rank down beyond playoff qualifiers',()=>{
 const s=balanced();s.cards.forEach((c,i)=>{c.qualified=i<1;c.qualificationRank=i<1?1:null;});
 const p=operatingWorkspacePoolPreview(s,id(5));assert.equal(p.status,'preview');assert.deepEqual(p.awards.map(a=>a.amountMinor),[8000,5500,2500]);
 assert.deepEqual(p.awards.map(a=>a.participantId),[id(100),id(101),id(102)]);assert.equal(p.moneyMoved,false);assert.equal(p.fundMinor,16000);
 const fiftyNine=balanced(59);fiftyNine.policies[0].ratio=4;const q=operatingWorkspacePoolPreview(fiftyNine,id(5));assert.equal(q.status,'preview');
 assert.deepEqual(q.awards.map(a=>a.amountMinor),[7000,6500,6000,5500,5000,5000,4500,4000,3500,3000,2500,2000,2000,1500,1000]);
 assert.equal(q.awards.reduce((a,b)=>a+b.amountMinor,0),59000);
});
test('cash ties, stale payments, wrong acknowledgments and unsupported domains block balanced previews',()=>{
 const mutations=[s=>{s.cards[1]={...s.cards[0],participantId:id(101),qualificationRank:2};s.cuts=[{poolVersionId:id(5),sourceDigest:s.sourceDigest,participantIdsLowFirst:[id(100),id(101)],recordedBy:id(999),reason:'Old cut cannot resolve new cash policy'}];},s=>{s.membership.entries[0].allocationCurrent=false;},s=>{s.membership.entries[0].pools[0].amountAllocatedMinor=500;},s=>{s.membership.entries[0].pools[0].consentReference='Wrong policy';},s=>{s.blockers=['qualification_scores_changed'];},s=>{s.membership.pools[0].feeMinor=501;}];
 for(const mutate of mutations){const s=balanced();mutate(s);assert.equal(operatingWorkspacePoolPreview(s,id(5)).status,'blocked');}
 assert.equal(operatingWorkspacePoolPreview(balanced(0),id(5)).status,'blocked');
});
test('historical chart and equal/refund calculations retain exact separate results',()=>{
 assert.deepEqual(operatingWorkspacePoolPreview(operatingSource(16,1000,'graduated-paid-card-rank-v2'),id(5)).awards.map(a=>a.amountMinor),[8000,5000,3000]);
 assert.deepEqual(operatingWorkspacePoolPreview(operatingSource(4,500),id(5)).awards.map(a=>a.amountMinor),[667,667,666]);
 const s=operatingSource(4,501);s.cards.forEach(c=>{c.qualified=false;c.qualificationRank=null;});const p=operatingWorkspacePoolPreview(s,id(5));assert.equal(p.moneyMoved,false);assert.deepEqual(p.refunds.map(a=>a.amountMinor),[501,501,501,501]);
});
test('pre-play election is independently required even when current allocation and eligibility flags are true',()=>{
 for(const s of [balanced(),operatingSource(16,1000,'graduated-paid-card-rank-v2'),operatingSource()]){s.membership.entries[0].pools[0].prePlayElected=false;assert.equal(s.membership.entries[0].pools[0].paidEntryEligible,true);assert.deepEqual(operatingWorkspacePoolPreview(s,id(5)),{status:'blocked',code:'preplay_election_required'});}
});
test('historical matching cut evidence stays preserved but cannot resolve a current chart cash tie',()=>{
 const s=operatingSource(16,1000,'graduated-paid-card-rank-v2');s.cards[1]={...s.cards[0],participantId:id(101),qualificationRank:2};s.cuts=[{poolVersionId:id(5),sourceDigest:s.sourceDigest,participantIdsLowFirst:[id(100),id(101)],recordedBy:id(999),reason:'TEST ONLY historical observed cut'}];const before=JSON.stringify(s);
 assert.deepEqual(operatingWorkspacePoolPreview(s,id(5)),{status:'blocked',code:'cash_tie_policy_unresolved'});assert.equal(JSON.stringify(s),before);
});
test('v3 routes keep verified actors, same-origin writes and full-request private reconciliation',()=>{
 for(const suffix of ['route.ts','reconciliation/route.ts']){const source=fs.readFileSync('src/app/api/v1/tournaments/[id]/q-operating-schedules-v3/'+suffix,'utf8');for(const text of ['isSameOriginRequest','requireVerifiedSubject','createServerOnlyAdminClient','qOperatingResultMatchesV3'])assert.ok(source.includes(text));assert.ok(!source.includes('user_metadata'));}
 const recon=fs.readFileSync('src/app/api/v1/tournaments/[id]/q-operating-schedules-v3/reconciliation/route.ts','utf8');assert.ok(recon.includes('p_request: body.request'));
 const client=fs.readFileSync('src/app/tournament/[tournamentId]/q-operating-schedules/operating-client.tsx','utf8');for(const text of ['payment-obligation:q-operating-v2:','payment-obligation:q-operating-v3:','Exact legacy replay is required','setAppRecoveryItem'])assert.ok(client.includes(text));
});
