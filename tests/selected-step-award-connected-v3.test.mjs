import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{selectedStepAwardViewFixtureV3 as fixture}from'./helpers/selected-step-award-view-fixture-v3.mjs';
import{projectSelectedStepAwardWorkspaceV3 as project}from'../src/lib/finance/selected-step-award-view-v3.ts';
import{createSelectedStepAwardTransportV3 as transport}from'../src/lib/api/selected-step-award-transport-v3.ts';
test('actual V3 shape independently reconstructs separate regular fund, completed sporting identities and amount groups',()=>{
 const c=fixture(),r=project(c.value,c.scope);assert(r);assert.equal(r.workspace.status,'review');assert.equal(r.workspace.review.totalMinor,10000);assert.equal(r.workspace.review.groups.length,3);assert.equal(r.results,null);
 const out=JSON.stringify(r);for(const privateKey of['profileId','sourceCapture','ownershipLedger','sportingSource','sessionId','income'])assert(!out.includes(privateKey),privateKey);
 const f=fixture(true),record=project(f.value,f.scope);assert.equal(record.workspace.status,'recorded');assert.equal(record.results.moneyMoved,false);assert.equal(record.results.groups.flatMap(g=>g.members).length,4);
});
test('stale policy/fund/sporting/recipient evidence and unproved historical records hold rather than display zero/current awards',()=>{
 for(const mutate of[v=>v.currentSourceVerified=false,v=>v.source.totalMinor+=1000,v=>v.source.fundSource.capture.income.activeMinor=1,v=>v.source.groups[0].perPersonMinor+=500,
  v=>v.source.recipients[0].profileId=v.source.recipients[1].profileId,v=>v.source.fundSource.capture.sportingSource.playoff.matches[0].games[0].confirmations.pop(),
  v=>v.record.sourceDigest='0'.repeat(64),v=>v.source.prizeWorkspace.stale=true]){const c=fixture(true);mutate(c.value);assert.equal(project(c.value,c.scope),null);}
 const c=fixture();assert.equal(project(c.value,c.scope,'ab130000-0000-4000-8000-000000000099'),null);
});
test('server port checks normal role/session around only V3 RPC and withholds source if identity changes',async()=>{
 const c=fixture();let sid='ab130000-0000-4000-8000-000000000011',calls=0;
 const normal={auth:{getClaims:async()=>({data:{claims:{sub:c.scope.actorId,session_id:sid}},error:null}),getUser:async()=>({data:{user:{id:c.scope.actorId}},error:null})},rpc:async()=>({data:'director',error:null})};
 const port=transport(normal,async(name,args)=>{calls++;assert.equal(name,'get_selected_step_award_workspace_provider_v3');assert.equal(args.actor,c.scope.actorId);assert.equal(args.sid,sid);return{data:c.value,error:null};},c.scope,{read:()=>true,write:()=>false});
 assert.equal((await port.read()).status,'review');assert.equal(calls,1);
 const drifting=transport(normal,async()=>{sid='ab130000-0000-4000-8000-000000000012';return{data:c.value,error:null};},c.scope,{read:()=>true,write:()=>false});await assert.rejects(()=>drifting.read(),/identity_changed/);
});
test('pages/routes are default off, stored V3 requests are namespaced, current Results use actual qualification binding',()=>{
 const ui=fs.readFileSync('src/components/selected-step-award-section-v3.tsx','utf8');for(const token of ['ModernPrizeJournalSectionV2','selected-step-awards','selected-step-award-v3:','selected-step-award-accepted-v3:','trackAppRecoveryWrite'])assert(ui.includes(token),token);
 const results=fs.readFileSync('src/app/tournament/[tournamentId]/results/page.tsx','utf8');assert(results.includes('port.results(finalized.resultVersionId)'));assert(results.includes('!showSelectedStepPrizes'));
 const sql=fs.readFileSync('database/proposals/selected-step-award-transport-v3.sql','utf8');for(const token of ['select false','current_selected_step_award_source_v3','record->\'sourceCapture\'is distinct from source','record_source_changed','from public,anon,authenticated,service_role'])assert(sql.includes(token),token);assert(!/grant execute/i.test(sql));
});

test('owned immutable award outcome recovers after current sources drift without another write',async()=>{
 const c=fixture(true),workspace=project(c.value,c.scope).workspace,review=workspace.review;
 const attempt={scope:c.scope,operationId:'ab130000-0000-4000-8000-000000000099',request:{expectedSourceDigest:review.sourceDigest,expectedPrizeRevisionId:review.prizeRevisionId,expectedFundReviewId:review.fundReviewId,reason:'Reviewed amounts',reviewed:true},review};
 const receipt={kind:'selected-step-award-receipt-v3',status:'accepted',...c.scope,operationId:attempt.operationId,request:attempt.request,sourceDigest:review.sourceDigest,prizeRevisionId:review.prizeRevisionId,fundReviewId:review.fundReviewId,totalMinor:review.totalMinor,awardSetId:workspace.awardSetId,moneyMoved:false,payoutAuthorized:false,recordedUnpaid:true,historicalReceipt:true,currentSourceVerified:false};
 const normal={auth:{getClaims:async()=>({data:{claims:{sub:c.scope.actorId,session_id:'ab130000-0000-4000-8000-000000000011'}},error:null}),getUser:async()=>({data:{user:{id:c.scope.actorId}},error:null})},rpc:async()=>({data:'director',error:null})};let calls=0;
 const port=transport(normal,async(name)=>{calls++;assert.equal(name,'get_selected_step_award_operation_provider_v3');return{data:{kind:'selected-step-award-operation-v3',...c.scope,operationId:attempt.operationId,request:attempt.request,result:receipt,record:c.value.record,historicalReceipt:true,currentSourceVerified:false},error:null};},c.scope,{read:()=>true,write:()=>true});
 const saved=await port.save(attempt);assert.equal(saved.status,'accepted');assert.equal(calls,1);assert.deepEqual(saved.record,review);
});
