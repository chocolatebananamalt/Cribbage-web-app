import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import ts from'typescript';import vm from'node:vm';
import{isSyntheticEventContext,syntheticEventArtifactId}from'../src/lib/api/synthetic-event-evidence.ts';
import{isQualificationTieRequest,isQualificationTieOutcome,isQualificationTieWorkspace,qualificationTieOutcomeMatches}from'../src/lib/api/qualification-ties.ts';
import{isPlayoffV4Request,isPlayoffV4Result,isPlayoffV4Workspace}from'../src/lib/api/playoff-outcome-v4.ts';
import{isEventPlayCloseRequest,isEventPlayCloseResult}from'../src/lib/api/event-control.ts';
const id=n=>`f2670000-0000-4000-8000-${String(n).padStart(12,'0')}`,tid=id(1),eid=id(2),sha='a'.repeat(64),ref=`SYNTHETIC-EVENT-v1:${id(3)}:${sha}`;
const payload={expectedSourceFingerprint:sha,participantIds:[id(4),id(5)],winnerId:id(4),method:'one_game_playoff'};
const artifact={artifactId:id(3),eventId:eid,kind:'qualification_tie',sourceDigest:sha,payload,text:'SYNTHETIC EVENT EVIDENCE\nNo physical play; no human review; no actual money received or moved.\n',sha256:sha,reference:ref};
const context={tournamentId:tid,projectRef:'nnhcnvksxgxnpvdqjgpg',eventIds:[eid],artifacts:[artifact],actualMoneyReceived:false,physicalPlay:false,humanReviewClaimed:false};
test('event context is typed, exact-scoped and rejects real-money/physical claims or malformed plans',()=>{
 assert.ok(isSyntheticEventContext(context,tid));assert.equal(syntheticEventArtifactId(ref),id(3));assert.equal(syntheticEventArtifactId('TEST ONLY SYNTHETIC: close '+ref),id(3));assert.equal(syntheticEventArtifactId('original-paper'),null);
 for(const c of[{...context,actualMoneyReceived:true},{...context,physicalPlay:true},{...context,humanReviewClaimed:true},{...context,projectRef:'production'},{...context,eventIds:[eid,eid]},{...context,artifacts:[artifact,artifact]},{...context,artifacts:[{...artifact,payload:{...payload,winnerId:id(99)}}]},{...context,artifacts:[{...artifact,reference:ref+'bad'}]}])assert.equal(isSyntheticEventContext(c,tid),false);
 const close={...artifact,kind:'close',payload:{scheduledGames:102,verifiedGames:102,structuredSyntheticGames:87,legacyVerifiedGamesWithoutStructuredProof:15}};assert.ok(isSyntheticEventContext({...context,artifacts:[close]},tid));assert.equal(isSyntheticEventContext({...context,artifacts:[{...close,payload:{...close.payload,legacyVerifiedGamesWithoutStructuredProof:0}}]},tid),false);
});
function loadRoute(kind,{synthetic=context,actor=id(9),origin=true,outcome=null}={}){
 const calls=[],reads=[],exports={},file=`src/app/api/v1/tournaments/[id]/events/[eventId]/${kind}/route.ts`;
 const dependencies={getSyntheticEventContext:async(a,t)=>{reads.push({actor:a,tid:t});return synthetic;},syntheticEventArtifactId,apiJson:(body,options={})=>({body,status:options.status??200}),readSmallJson:async r=>r.payload,readMediumJson:async r=>r.payload,requireVerifiedSubject:async()=>actor,isSameOriginRequest:()=>origin,isUuid:v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v),withApiFailureBoundary:async f=>{try{return await f();}catch{return{status:503};}},createClient:async()=>({}),createServerOnlyAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:outcome??{status:'rejected',...(kind==='play-close'?{}:{eventId:eid}),code:'invalid_request'},error:null};}}),isQualificationTieRequest,isQualificationTieOutcome,isQualificationTieWorkspace,qualificationTieOutcomeMatches,isPlayoffV4Request,isPlayoffV4Result,isPlayoffV4Workspace,isEventPlayCloseRequest,isEventPlayCloseResult};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require:()=>dependencies});return{exports,calls,reads};
}
const tieRequest={...payload,reason:'TEST ONLY SYNTHETIC: simulated outcome',evidenceReference:ref};
const series=Array.from({length:4},(_,i)=>({winnerId:id(10+i),loserId:id(20+i),evidenceNote:ref+':'+(i+1)}));
const bodies={'qualification-ties':tieRequest,'playoff-v4':{qualificationResultVersionId:id(8),expectedVersion:0,sourceDigest:sha,series,reason:'TEST ONLY SYNTHETIC: simulated bracket',reviewed:true},'play-close':{action:'close',reason:'TEST ONLY SYNTHETIC: software count '+ref,confirmed:true,idempotencyKey:id(90)}};
const wrappers={'qualification-ties':'save_synthetic_qualification_tie_v1','playoff-v4':'record_synthetic_playoff_v1','play-close':'close_synthetic_event_v1'};
const normal={'qualification-ties':'save_qualification_tie_resolution_v1','playoff-v4':'record_standard_singles_playoff_outcomes_v4','play-close':'close_event_play_v1'};
test('only server-enrolled events select three narrow synthetic writers; ordinary routes stay canonical',async()=>{
 for(const kind of Object.keys(bodies))for(const enrolled of[true,false]){
  const r=loadRoute(kind,{synthetic:enrolled?context:null}),request={payload:bodies[kind],headers:{get:()=>id(90)}};
  assert.equal((await r.exports.POST(request,{params:Promise.resolve({id:tid,eventId:eid})})).status,409);assert.equal(r.calls.length,1);assert.equal(r.calls[0].name,enrolled?wrappers[kind]:normal[kind]);assert.equal(r.calls[0].args.p_actor_id,id(9));assert.equal(r.calls[0].args.p_tournament_id,tid);assert.equal(r.calls[0].args.p_event_id,eid);assert.equal(r.calls[0].args.p_artifact_id,enrolled?id(3):undefined);
 }
});
test('unauthenticated, cross-origin and malformed event requests cannot query context or write',async()=>{
 for(const kind of Object.keys(bodies))for(const[options,status,payload]of[[{actor:null},401,bodies[kind]],[{origin:false},403,bodies[kind]],[{},400,{...bodies[kind],simulation:true}]]){
  const r=loadRoute(kind,options),result=await r.exports.POST({payload,headers:{get:()=>id(90)}},{params:Promise.resolve({id:tid,eventId:eid})});assert.equal(result.status,status);assert.equal(r.reads.length,0);assert.equal(r.calls.length,0);
 }
});
test('event migration has no seeds or human grants; fresh ledger provenance is atomic and funding unavailable',()=>{
 const s=fs.readFileSync('database/migrations/0267_synthetic_event_evidence_v1.sql','utf8');assert.doesNotMatch(s,/insert into app\.synthetic_paper_(fixtures|deployments)_v1/);assert.doesNotMatch(s,/grant .*to (anon|authenticated)/i);assert.match(s,/after insert on app\.%I/);assert.match(s,/synthetic_financial_memo_required/);assert.match(s,/synthetic_actual_funding_unsupported/);assert.match(s,/legacyVerifiedGamesWithoutStructuredProof/);assert.match(s,/Canonical|canonical/);assert.doesNotMatch(s,/execute\s+p_(request|function|sql)/i);
});

test('old accepted close POST keeps its exact response through enrolled wrapper with null artifact',async()=>{
 const outcome={status:'event_play_closed',eventId:eid,closeState:'closed',scheduledGames:102,resolvedGames:102,unresolvedGames:0};
 const r=loadRoute('play-close',{outcome}),body={...bodies['play-close'],reason:'Legacy original request'};
 const result=await r.exports.POST({payload:body,headers:{get:()=>id(90)}},{params:Promise.resolve({id:tid,eventId:eid})});
 assert.equal(r.calls[0].name,'close_synthetic_event_v1');assert.equal(r.calls[0].args.p_artifact_id,null);assert.deepEqual(result.body,outcome);
});
