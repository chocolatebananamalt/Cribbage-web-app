import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isQAccountingDraftRequest,isQAccountingFinalRequest,isQAccountingWorkspace,isQAccountingFacts,isQAccountingResult,isQAccountingReconciliationRequest,qAccountingResultMatches} from '../src/lib/api/q-accounting-v6.ts';
import {workspace,withDraft,finalized,request,finalRequest,tid,eid,id,digest,facts,reviewedFacts} from './fixtures/q-accounting-v6-workspace.mjs';
import {readLargeJson,largeJsonRequestBodyLimit} from '../src/lib/api/bounded-json.ts';
const copy=v=>structuredClone(v);
test('maximum multibyte accounting references remain sendable for exact retry and reconciliation',async()=>{
 const large={...request,reason:'界'.repeat(500),expenseClassifications:Array.from({length:256},(_,i)=>({expenseEventId:id(i+100),category:'supplies',evidenceReference:'界'.repeat(500)}))};
 assert.ok(isQAccountingDraftRequest(large));
 const envelope={operationId:id(900),action:'draft',request:large},body=JSON.stringify(envelope);
 assert.ok(Buffer.byteLength(body)<largeJsonRequestBodyLimit);
 assert.deepEqual(await readLargeJson(new Request('http://localhost/local-only',{method:'POST',headers:{'content-type':'application/json'},body})),envelope);
});
test('Q accounting contracts keep base/Q funding and regular prize conservation separate',()=>{
 for(const w of [workspace,withDraft,finalized])assert.equal(isQAccountingWorkspace(w,tid,eid),true);
 assert.equal(isQAccountingDraftRequest(request),true);assert.equal(isQAccountingFinalRequest(finalRequest),true);
 assert.equal(isQAccountingFacts(facts),true);assert.equal(isQAccountingFacts(reviewedFacts,true),true);
 for(const change of [w=>w.facts.baseIncomeMinor+=3000,w=>w.facts.qIncomeMinor=0,w=>w.facts.minimumReturnMinor=43350,w=>w.regularSchedule.awards[0].totalAwardMinor++,w=>w.qReview.obligations[0].rows[0].amountMinor++]){const w=copy(workspace);change(w);assert.equal(isQAccountingWorkspace(w,tid,eid),false);}
 for(const change of [w=>w.regularSchedule.awards[0].participantId=id(99),w=>w.regularSchedule.awards[0].bandStart=2,w=>w.regularSchedule.awards[0].weight=9,w=>w.draft.request.qReviewId=id(99),w=>w.draft.request.scheduleVersionId=id(99),w=>w.draft.request.sourceDigest='c'.repeat(64)]){const w=copy(withDraft);change(w);assert.equal(isQAccountingWorkspace(w,tid,eid),false);}
});
test('Q accounting rejects paid flags, arbitrary claims, unknown fields and classifications',()=>{
 for(const extra of [{paid:true},{qAwards:[]},{eventIncomeMinor:51000},{prizeClaims:[]}])assert.equal(isQAccountingDraftRequest({...request,...extra}),false);
 for(const change of [r=>r.expenseClassifications[0].category='unknown',r=>r.expenseClassifications.push(r.expenseClassifications[0]),r=>r.reason=' ',r=>r.sourceDigest='x',r=>r.reviewed=false,r=>r.expectedVersion=-1]){const r=copy(request);change(r);assert.equal(isQAccountingDraftRequest(r),false);}
 assert.equal(isQAccountingFinalRequest({...finalRequest,paid:true}),false);
 assert.equal(isQAccountingWorkspace({...workspace,automaticPayment:true},tid,eid),false);
 assert.equal(isQAccountingWorkspace(workspace,id(99),eid),false);assert.equal(isQAccountingWorkspace(workspace,tid,id(99)),false);
});
test('reviewed facts cannot include Q money in 85 percent base return or lose expense classifications',()=>{
 for(const change of [f=>f.participantReturnMinor+=3000,f=>f.expenseClassifications.pop(),f=>f.benefitExpenseMinor+=7200,f=>f.operatingExpenseMinor=0,f=>f.canonicalMrp.rows[0].byeWins=1,f=>f.canonicalMrp.rows[0].totalMrp++]){const f=copy(reviewedFacts);change(f);assert.equal(isQAccountingFacts(f,true),false);}
});
test('accepted accounting receipts are bound to action, event, source and exact draft identity',()=>{
 const saved={status:'q_accounting_draft_saved_v6',draftId:id(24),eventId:eid,version:1,sourceDigest:digest};
 const done={status:'q_accounting_finalized_unpaid_v6',finalizationId:id(25),draftId:id(24),eventId:eid,version:1,sourceDigest:digest};
 assert.equal(isQAccountingResult(saved,eid),true);assert.equal(isQAccountingResult(done,eid),true);
 assert.equal(qAccountingResultMatches(saved,'draft',request),true);assert.equal(qAccountingResultMatches(done,'final',finalRequest),true);
 assert.equal(qAccountingResultMatches({...saved,sourceDigest:'c'.repeat(64)},'draft',request),false);
 assert.equal(qAccountingResultMatches({...done,draftId:id(99)},'final',finalRequest),false);
 assert.equal(qAccountingResultMatches(saved,'final',finalRequest),false);
 assert.equal(isQAccountingResult({...done,status:'paid'},eid),false);
 assert.equal(isQAccountingResult(saved,id(99)),false);
 assert.equal(isQAccountingReconciliationRequest({operationId:id(90),action:'draft',request}),true);
 assert.equal(isQAccountingReconciliationRequest({operationId:id(90),action:'draft'}),false);
 assert.equal(isQAccountingReconciliationRequest({operationId:id(90),action:'final',request}),false);
});
test('v6 API mutation/reconciliation routes verify origin, subject, full request and result',()=>{
 const base='src/app/api/v1/tournaments/[id]/events/[eventId]/q-accounting-v6';
 for(const action of ['draft','finalize','reconciliation']){const s=readFileSync(`${base}/${action}/route.ts`,'utf8');assert.match(s,/isSameOriginRequest/);assert.match(s,/requireVerifiedSubject/);assert.match(s,/createServerOnlyAdminClient/);assert.match(s,/isQAccounting/);assert.doesNotMatch(s,/request\.json\(\)/);}
 const r=readFileSync(`${base}/reconciliation/route.ts`,'utf8');assert.match(r,/p_request: body.request/);assert.match(r,/p_action: body.action/);
 const client=readFileSync('src/app/tournament/[tournamentId]/events/[eventId]/q-accounting-v6/accounting-client.tsx','utf8');
 assert.match(client,/setAppRecoveryItem/);assert.match(client,/sessionStorage.getItem\(key\) !== raw/);assert.match(client,/idempotency_conflict/);assert.match(client,/await reconcile\(operation, raw\)/);assert.match(client,/No person is marked paid/);
 assert.match(client,/if \(!isActive\(\)\) return true/);assert.match(client,/reconcile\(operation, raw, \(\) => active\)/);
});
