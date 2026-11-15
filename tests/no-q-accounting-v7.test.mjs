import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{isNoQAccountingDraftRequest,isNoQAccountingFinalRequest,isNoQAccountingWorkspace,isNoQAccountingResult,noQAccountingResultMatches,isNoQAccountingReconciliationRequest}from'../src/lib/api/no-q-accounting-v7.ts';
import{accountingEntryForMembership,getAccountingEntry}from'../src/lib/api/accounting-entry.ts';
import{workspace,withDraft,finalized,request,finalRequest,membership,tid,eid,id,digest}from'./fixtures/no-q-accounting-v7-workspace.mjs';
test('no-Q accounting validates real five-qualifier bye awards and conserved base-only funding without a fake Q review',()=>{
 for(const w of[workspace,withDraft,finalized])assert.equal(isNoQAccountingWorkspace(w,tid,eid),true);
 assert.equal(isNoQAccountingDraftRequest(request),true);assert.equal(isNoQAccountingFinalRequest(finalRequest),true);
 for(const change of[w=>w.qReview=null,w=>w.facts.qIncomeMinor=100,w=>w.facts.baseIncomeMinor+=100,w=>w.regularSchedule.awards[0].totalAwardMinor++,w=>w.regularSchedule.awards[2].bandStart=2,w=>w.facts.canonicalMrp.rows[0].byeWins=0,w=>w.facts.minimumReturnMinor=1,w=>w.automaticPayment=true]){const w=structuredClone(workspace);change(w);assert.equal(isNoQAccountingWorkspace(w,tid,eid),false);}
 for(const change of[w=>w.draft.request.scheduleVersionId=id(999),w=>w.draft.facts.qIncomeMinor=1,w=>w.draft.sourceDigest='b'.repeat(64),w=>w.draft.facts.participantReturnMinor=43349,w=>w.draft.facts.source.kind='playoff_outcome_v3']){const w=structuredClone(withDraft);change(w);assert.equal(isNoQAccountingWorkspace(w,tid,eid),false);}
});
test('no-Q requests reject payment/Q fields and preserve exact version, reason, classifications and source guards',()=>{
 for(const extra of[{qReviewId:id(99)},{paid:true},{qAwards:[]},{retainedMinor:0}])assert.equal(isNoQAccountingDraftRequest({...request,...extra}),false);
 for(const change of[r=>r.expenseClassifications[0].category='unknown',r=>r.expenseClassifications.push(r.expenseClassifications[0]),r=>r.reviewed=false,r=>r.reason=' ',r=>r.expectedVersion=-1]){const r=structuredClone(request);change(r);assert.equal(isNoQAccountingDraftRequest(r),false);}
 const saved={status:'no_q_accounting_draft_saved_v7',draftId:id(51),eventId:eid,version:1,sourceDigest:digest},done={status:'no_q_accounting_finalized_unpaid_v7',finalizationId:id(52),draftId:id(51),eventId:eid,version:1,sourceDigest:digest};
 assert.ok(isNoQAccountingResult(saved,eid)&&noQAccountingResultMatches(saved,'draft',request));assert.ok(isNoQAccountingResult(done,eid)&&noQAccountingResultMatches(done,'final',finalRequest));
 assert.equal(noQAccountingResultMatches({...saved,sourceDigest:'b'.repeat(64)},'draft',request),false);assert.equal(noQAccountingResultMatches({...done,draftId:id(99)},'final',finalRequest),false);
 assert.equal(isNoQAccountingReconciliationRequest({operationId:id(99),action:'draft',request}),true);assert.equal(isNoQAccountingReconciliationRequest({operationId:id(99),action:'final',request}),false);
});
test('accounting navigation uses explicit zero pools, preserves unknown failures and rejects cross-event facts',async()=>{
 assert.equal(accountingEntryForMembership(membership,tid,eid),'no-q-accounting-v7');assert.equal(accountingEntryForMembership(membership,tid,id(99)),null);assert.equal(accountingEntryForMembership(null,tid,eid),null);
 assert.equal(accountingEntryForMembership({...membership,pools:undefined},tid,eid),null);
 const named={...membership,supported:true,blockedReason:null,pools:[{poolVersionId:id(70),slot:1,name:'TEST Q Pool',feeMinor:500}]};assert.equal(accountingEntryForMembership(named,tid,eid),'q-accounting-v6');assert.equal(accountingEntryForMembership({...named,supported:false},tid,eid),null);
 assert.equal(await getAccountingEntry({rpc:async()=>({data:null,error:Error('unavailable')})},id(1),tid,eid),null);
 assert.equal(await getAccountingEntry({rpc:async()=>({data:membership,error:null})},id(1),tid,eid),'no-q-accounting-v7');
});
test('no-Q API and UI retain financial origin/role/replay protections and never synthesize Q records',()=>{
 const base='src/app/api/v1/tournaments/[id]/events/[eventId]/no-q-accounting-v7';for(const action of['draft','finalize','reconciliation']){const s=readFileSync(`${base}/${action}/route.ts`,'utf8');assert.match(s,/isSameOriginRequest/);assert.match(s,/requireVerifiedSubject/);assert.match(s,/createServerOnlyAdminClient/);assert.match(s,/isNoQAccounting/);assert.match(s,/readLargeJson/);}
 const client=readFileSync('src/app/tournament/[tournamentId]/events/[eventId]/no-q-accounting-v7/accounting-client.tsx','utf8');assert.doesNotMatch(client,/qReview/);assert.match(client,/payment-obligation:no-q-accounting-v7/);assert.match(client,/setAppRecoveryItem/);assert.match(client,/if \(!isActive\(\)\) return true/);assert.match(client,/sessionStorage.getItem\(key\) !== raw/);assert.match(client,/idempotency_conflict/);assert.match(client,/No person is marked paid/);
});
