import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import ts from 'typescript';import vm from 'node:vm';
import{isConsolationWorkspace,isConsolationRequest,isConsolationResult,isReconciliation,isReconciliationRequest,resultMatches,validBracket}from'../src/lib/api/consolation-playoff.ts';
import{isSyntheticEventContext}from'../src/lib/api/synthetic-event-evidence.ts';
import{workspace,recorded,request,receipt,context,tid,eid,id}from'./fixtures/consolation-playoff-workspace.mjs';
test('workspace checks event identity, bracket, same-round bands, win credit and truthful source fields',()=>{
 assert.ok(isConsolationWorkspace(workspace,tid,eid));assert.ok(isConsolationWorkspace(recorded,tid,eid));assert.ok(validBracket(workspace.qualifiers,request.series));
 for(const change of[w=>w.result.outcomes[2].bandEnd=3,w=>w.result.outcomes[3].playoffMrp=12,w=>w.result.outcomes[0].byeWins=1,w=>w.result.series[2].winnerId=id(12),w=>w.result.physicalPlayAttested=true,w=>w.result.sourceDigest='c'.repeat(64),w=>w.result.outcomes[0].extra=true]){const w=structuredClone(recorded);change(w);assert.equal(isConsolationWorkspace(w,tid,eid),false);}
 assert.equal(isConsolationWorkspace(workspace,tid,id(80)),false);
});
test('only exact synthetic requests and source/version-matched receipts are accepted',()=>{
 assert.ok(isConsolationRequest(request));assert.ok(isConsolationResult(receipt,tid,eid));assert.ok(resultMatches(receipt,request));assert.ok(isReconciliation({authorized:true,result:receipt},tid,eid));
 for(const change of[r=>r.physicalPlayAttested=true,r=>r.artifactId=null,r=>r.reviewed=false,r=>r.series.pop(),r=>r.reason='not synthetic',r=>r.actorId=id(90),r=>r.expectedVersion=-1]){const r=structuredClone(request);change(r);assert.equal(isConsolationRequest(r),false);}
 assert.equal(resultMatches({...receipt,sourceDigest:'c'.repeat(64)},request),false);assert.equal(isConsolationResult(receipt,tid,id(80)),false);
});
test('joint finalization returns bounded known rejections',()=>{
 for(const code of ['joint_financially_closed','joint_finalization_in_progress']) assert.ok(isConsolationResult({status:'rejected',eventId:eid,code},tid,eid));
 assert.equal(isConsolationResult({status:'rejected',eventId:eid,code:'unknown'},tid,eid),false);
});
test('context accepts only the matching three-series artifact format and preserves v4 validation',()=>{
 assert.ok(isSyntheticEventContext(context,tid));for(const change of[c=>c.physicalPlay=true,c=>c.artifacts[0].payload.series.push(c.artifacts[0].payload.series[0]),c=>c.artifacts[0].text='SYNTHETIC EVENT EVIDENCE\nwrong',c=>c.artifacts[0].reference+='x']){const c=structuredClone(context);change(c);assert.equal(isSyntheticEventContext(c,tid),false);}
});
test('routes use verified actor, same origin and exact bound request; recovery preserves source and operation',()=>{
 const base='src/app/api/v1/tournaments/[id]/events/[eventId]/consolation-playoffs';for(const f of['route.ts','reconciliation/route.ts']){const s=readFileSync(`${base}/${f}`,'utf8');assert.match(s,/isSameOriginRequest/);assert.match(s,/requireVerifiedSubject/);assert.match(s,/createServerOnlyAdminClient/);assert.doesNotMatch(s,/request\.json\(\)/);}
 const s=readFileSync('src/app/tournament/[tournamentId]/events/[eventId]/consolation-playoffs/playoff-client.tsx','utf8');assert.match(s,/payment-obligation:consolation-playoff-v1/);assert.match(s,/setAppRecoveryItem/);assert.match(s,/sessionStorage\.getItem\(key\)!==raw/);assert.match(s,/artifactMatches\(operation\.request,current\)/);assert.match(s,/reconcile\(operation,raw/);
});
function route(kind,{actor=id(1),origin=true,synthetic=context,data=receipt}={}){const exports={},calls=[],reads=[];const deps={apiJson:(body,options={})=>({body,status:options.status??200}),readMediumJson:async r=>r.payload,requireVerifiedSubject:async()=>actor,withApiFailureBoundary:async f=>{try{return await f();}catch{return{status:503};}},isSameOriginRequest:()=>origin,isUuid:v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v),isConsolationRequest,isConsolationResult,isConsolationWorkspace,isReconciliation,isReconciliationRequest,getSyntheticEventContext:async(a,t)=>{reads.push({a,t});return synthetic;},createClient:async()=>({}),createServerOnlyAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data,error:null};}})};const path=`src/app/api/v1/tournaments/[id]/events/[eventId]/consolation-playoffs/${kind}route.ts`;vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>deps});return{exports,calls,reads};}
test('actual server route binds verified actor and rejects missing or mismatched artifacts before writing',async()=>{
 const args={params:Promise.resolve({id:tid,eventId:eid})},call={payload:request,headers:{get:()=>id(99)}};
 for(const [opts,status] of [[{actor:null},401],[{origin:false},403],[{synthetic:null},403],[{synthetic:{...context,artifacts:[]}},403]]){const r=route('',opts);assert.equal((await r.exports.POST(call,args)).status,status);assert.equal(r.calls.length,0);}
 const bad=structuredClone(request);bad.series[0].evidenceNote='bad';const r=route('');assert.equal((await r.exports.POST({...call,payload:bad},args)).status,403);assert.equal(r.calls.length,0);
 const good=route('');assert.equal((await good.exports.POST(call,args)).status,200);assert.equal(good.calls[0].name,'record_consolation_playoff_outcomes_v1');assert.equal(good.calls[0].args.actor,id(1));assert.equal(good.calls[0].args.req,request);assert.equal(good.calls[0].args.tid,tid);assert.equal(good.calls[0].args.eid,eid);
 const rec=route('reconciliation/',{data:{authorized:true,result:receipt}});assert.equal((await rec.exports.POST({payload:{operationId:id(99),request}},args)).status,200);assert.equal(rec.calls[0].args.actor,id(1));assert.equal(rec.calls[0].args.req,request);
});
