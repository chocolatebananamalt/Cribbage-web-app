import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isQReviewV2Request,isQReviewV2Result,isQObligationsV2,isQReviewV2Workspace,qReviewV2ResultMatches} from '../src/lib/api/q-obligation-review-v2.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash='a'.repeat(64);
const request={expectedVersion:0,sourceDigest:hash,reason:'TEST ONLY reviewed source',reviewed:true};
const obligations=[{poolVersionId:id(1),policyId:id(2),name:'Q test',fundMinor:16000,kind:'award',status:'unpaid',rows:[{participantId:id(3),displayName:'Fictional third paid card',amountMinor:8000,qualificationRank:4,qRank:1},{participantId:id(4),displayName:'Fictional paid nonqualifier',amountMinor:5000,qualificationRank:null,qRank:2},{participantId:id(5),displayName:'Fictional paid nonqualifier',amountMinor:3000,qualificationRank:null,qRank:3}]}];
const accepted={status:'q_obligations_recorded_v2',reviewId:id(9),eventId:id(8),version:1,sourceDigest:hash};
test('Q v2 request cannot submit money, recipients or paid state',()=>{
 assert.ok(isQReviewV2Request(request));for(const extra of [{paid:true},{amountMinor:1},{recipients:[]},{actorId:id(4)}])assert.equal(isQReviewV2Request({...request,...extra}),false);
 for(const bad of [{...request,reviewed:false},{...request,expectedVersion:-1},{...request,sourceDigest:'bad'},{...request,reason:'\nprivate'}])assert.equal(isQReviewV2Request(bad),false);
});
test('Q v2 graduated nonqualifiers are valid unpaid obligations, conserving exact cents',()=>{
 assert.ok(isQObligationsV2(obligations));assert.equal(isQObligationsV2([{...obligations[0],fundMinor:15999}]),false);assert.equal(isQObligationsV2([{...obligations[0],status:'paid'}]),false);
 const bad=structuredClone(obligations);bad[0].rows[0].amountMinor=8000.5;assert.equal(isQObligationsV2(bad),false);
});
test('Q v2 refunds are explicitly unpaid with no invented qualification or Q rank',()=>{
 const refund=[{...obligations[0],fundMinor:1000,kind:'refund',rows:[{participantId:id(15),displayName:'Fictional contributor',amountMinor:1000,qualificationRank:null,qRank:null}]}];assert.ok(isQObligationsV2(refund));refund[0].rows[0].qRank=1;assert.equal(isQObligationsV2(refund),false);
});
test('Q v2 receipt matching rejects another source and unexpected response fields',()=>{
 assert.ok(isQReviewV2Result(accepted));assert.ok(qReviewV2ResultMatches(accepted,request));assert.equal(qReviewV2ResultMatches({...accepted,sourceDigest:'b'.repeat(64)},request),false);assert.equal(isQReviewV2Result({...accepted,paid:true}),false);
});
test('Q v2 current history must match exact preview/source and append-only chain',()=>{
 const w={tournamentId:id(7),eventId:id(8),sourceDigest:hash,preview:obligations,blockers:[],currentVersion:1,current:true,history:[{id:id(9),version:1,supersedesId:null,reason:'TEST ONLY',recordedAt:'2026-10-29T00:00:00Z',actorId:id(10),sourceDigest:hash,status:'unpaid',obligations}],automaticPayout:false,canonicalSettlement:false};
 assert.ok(isQReviewV2Workspace(w,id(7)));assert.equal(isQReviewV2Workspace(w,id(99)),false);assert.equal(isQReviewV2Workspace({...w,automaticPayout:true},id(7)),false);assert.equal(isQReviewV2Workspace({...w,blockers:['source_changed']},id(7)),false);assert.equal(isQReviewV2Workspace({...w,history:[{...w.history[0],supersedesId:id(11)}]},id(7)),false);
});
test('Q v2 API keeps auth/service boundary and full original reconciliation request',()=>{
 const route=fs.readFileSync('src/app/api/v1/tournaments/[id]/q-obligation-reviews-v2/route.ts','utf8'),reconcile=fs.readFileSync('src/app/api/v1/tournaments/[id]/q-obligation-reviews-v2/reconciliation/route.ts','utf8');
 for(const s of [route,reconcile]){assert.match(s,/isSameOriginRequest/);assert.match(s,/requireVerifiedSubject/);assert.match(s,/createServerOnlyAdminClient/);assert.match(s,/p_actor_id: actor/);}
 assert.match(reconcile,/isQReviewV2Request/);assert.match(reconcile,/p_request:/);assert.match(reconcile,/operationId,request/);assert.doesNotMatch(route,/p_actor_id: body/);
});
