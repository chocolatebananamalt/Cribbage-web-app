import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {isAccountingAction,acceptedAccountingAction} from '../src/lib/api/multi-event-accounting-action.ts';
import {projectAccountingWorkspace} from '../src/lib/api/multi-event-accounting-workspace.ts';
import {isTournamentResultEventSummary} from '../src/lib/api/result-event-summary.ts';
import {isUuid} from '../src/lib/api/validation.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,tid=id(1),eid=id(2),actor=id(3),hash='a'.repeat(64);
const action={action:'crosscheck',eventId:eid,operationId:id(4),request:{sourceDigest:hash,reason:'TEST ONLY SYNTHETIC: route test',reviewed:true}};
const receipt={status:'synthetic_event_crosscheck_closed',eventId:eid,closureId:id(5),sourceDigest:hash,reviewerProfileIds:[id(6)],humanReviewClaimed:false,physicalPlayClaimed:false,moneyMoved:false};
const event={tournamentId:tid,eventId:eid,currentDraftVersion:0,draft:null,closure:null,readiness:{status:'candidate_ready',eventId:eid,sourceDigest:hash,moneyMoved:false,humanReviewClaimed:false,physicalPlayClaimed:false}};
const summary={tournamentId:tid,tournamentName:'TEST ONLY',events:[{eventId:eid,name:'Main',eventType:'main',format:'standard_singles',scoringMethod:'manual',participantCount:20}]};
function harness({deployment=true,origin=true,subject=actor,outcome=receipt,rpcError=null,eventData=event}={}){
 const exports={},calls=[],auth=[];
 const deps={isSyntheticPaperDeployment:()=>deployment,isSameOriginRequest:()=>origin,isUuid,isAccountingAction,acceptedAccountingAction,projectAccountingWorkspace,isTournamentResultEventSummary,
  apiJson:(body,options={})=>({body,status:options.status??200}),readMediumJson:async r=>r.payload,requireVerifiedSubject:async()=>{auth.push(true);return subject;},withApiFailureBoundary:async f=>{try{return await f();}catch{return {status:503};}},createClient:async()=>({}),createServerOnlyAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});let data=outcome;if(name==='get_multi_event_unpaid_event_workspace_v1')data=eventData;if(name==='get_multi_event_joint_final_workspace_v1')data={status:'blocked',code:'event_draft_required'};if(name==='get_multi_event_joint_final_v1')data={status:'not_finalized',tournamentId:tid,financialClosed:false,moneyMoved:false};if(name==='get_tournament_result_events_v1')data=summary;return {data,error:rpcError};}})};
 vm.runInNewContext(ts.transpileModule(readFileSync('src/app/api/v1/tournaments/[id]/simulation-accounting/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>deps,process:{env:{}}});return {exports,calls,auth};
}
const params={params:Promise.resolve({id:tid})};
test('actual accounting POST gates deployment, origin, identity and exact payload before RPC',async()=>{
 for(const [options,status] of [[{deployment:false},404],[{origin:false},403],[{subject:null},401]]){const h=harness(options);assert.equal((await h.exports.POST({payload:action},params)).status,status);assert.equal(h.calls.length,0);}
 const bad=harness();assert.equal((await bad.exports.POST({payload:{...action,actorId:id(99)}},params)).status,400);assert.equal(bad.calls.length,0);
 const h=harness();const response=await h.exports.POST({payload:action},params);assert.equal(response.status,200);assert.equal(h.calls[0].name,'close_synthetic_event_crosscheck_v1');assert.equal(h.calls[0].args.actor,actor);assert.equal(h.calls[0].args.tid,tid);assert.equal(h.calls[0].args.eid,eid);assert.equal(h.calls[0].args.op,action.operationId);assert.equal(h.calls[0].args.req,action.request);
});
test('actual accounting POST maps rejection and malformed/uncertain acknowledgements without success',async()=>{
 for(const [options,status] of [[{rpcError:{message:'unavailable'}},503],[{outcome:{status:'anything'}},503],[{outcome:{...receipt,eventId:id(9)}},503],[{outcome:{...receipt,moneyMoved:true}},503],[{outcome:{status:'rejected',code:'source_changed',private:'not returned'}},409]]){const h=harness(options);const result=await h.exports.POST({payload:action},params);assert.equal(result.status,status);assert.equal(result.body?.private,undefined);}
});
test('actual accounting GET joins scoped facts and fails closed on cross-event or unavailable data',async()=>{
 const request={nextUrl:new URL(`https://example.invalid/path?eventId=${eid}`)};
 const h=harness();const result=await h.exports.GET(request,params);assert.equal(result.status,200);assert.equal(result.body.eventId,eid);assert.equal(result.body.readiness.sourceDigest,hash);assert.equal(result.body.moneyMoved,false);assert.equal(h.calls.length,4);assert.equal('manifest' in result.body,false);
 for(const options of [{rpcError:{message:'missing capability'}},{eventData:{...event,eventId:id(9)}}]){const bad=harness(options);assert.equal((await bad.exports.GET(request,params)).status,503);}
 const extra=harness();assert.equal((await extra.exports.GET({nextUrl:new URL(`https://example.invalid/path?eventId=${eid}&actor=other`)},params)).status,400);assert.equal(extra.calls.length,0);
});
