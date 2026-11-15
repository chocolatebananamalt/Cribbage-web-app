import test from 'node:test';import assert from 'node:assert/strict';
import{createNativeMixedSimulationHandlersV1}from'../src/lib/api/native-mixed-simulation-handlers-v1.ts';
import{startScope as scope,startRequest as body,startReceipt,startId as id}from'./helpers/native-mixed-simulation-start-example.mjs';
const projectUrl='https://localtest.supabase.co',projectRef='localtest',now=Date.parse('2026-11-06T20:00:00.000Z');
const context=(op=body.operationId)=>({params:Promise.resolve({id:scope.tournamentId,eventId:scope.eventId,operationId:op})});
const request=()=>new Request('https://test.invalid/private-start',{method:'POST',headers:{'x-expected-actor-id':scope.actorId}});
function harness(changes={}){
 const calls={body:0,auth:0,writes:0,reads:0,sources:0};let captured;const raw=structuredClone(body);
 const port={execute:async()=>({data:null,error:'disabled'}),cancel:async()=>({data:null,error:'disabled'}),operation:async()=>({data:null,error:'disabled'}),cancellation:async()=>({data:null,error:'disabled'}),transition:async()=>({data:null,error:'disabled'}),source:async()=>({data:null,error:'disabled'}),
 startSimulation:async(_lease,b)=>{calls.writes++;captured=b;return{data:startReceipt(),error:null};},startOperation:async()=>{calls.reads++;return{data:startReceipt(true),error:null};},startedSource:async()=>{calls.sources++;return{data:{kind:'native-mixed-simulation-start-source-v1',...scope,receipt:startReceipt(),currentSourceVerified:true,normalStartAuthorized:false,scoringAuthorized:false},error:null};}};
 const d={enabled:()=>true,simulatedStartEnabled:()=>true,simulatedStartRecoveryEnabled:()=>true,projectUrl,projectRef,now:()=>now,verifiedIdentity:async()=>{calls.auth++;return{subjectId:scope.actorId,sessionId:'session-1'};},authorizeTarget:async input=>({kind:'native-mixed-director-session-v1',...scope,subjectId:scope.actorId,sessionId:'session-1',projectUrl,projectRef,allowedActions:[input.action],expiresAt:'2026-11-06T20:01:00.000Z'}),port:async()=>port,readJson:async(_r,max)=>{assert.equal(max,16384);calls.body++;return raw;},sameOrigin:()=>true,json:(data,init)=>({status:init?.status??200,data}),boundary:async f=>f(),...changes};
 return{h:createNativeMixedSimulationHandlersV1(d),calls,raw,port,captured:()=>captured};
}
test('new Start handlers independently default disabled before body/auth/ports',async()=>{
 const x=harness({simulatedStartEnabled:undefined,simulatedStartRecoveryEnabled:undefined});
 for(const key of ['simulatedStartPOST','simulatedStartOperationPOST','simulatedStartedSourcePOST'])assert.equal((await x.h[key](request(),context())).status,404);assert.equal(x.calls.body,0);assert.equal(x.calls.auth,0);
});
test('Start transport enforces origin, exact request and operation-bound target',async()=>{
 const origin=harness({sameOrigin:()=>false});assert.equal((await origin.h.simulatedStartPOST(request(),context())).status,403);assert.equal(origin.calls.auth,0);
 const mismatch=harness();assert.equal((await mismatch.h.simulatedStartPOST(request(),context(id(90)))).status,400);assert.equal(mismatch.calls.writes,0);
 const extra=harness();extra.raw.scoringAuthorized=true;assert.equal((await extra.h.simulatedStartPOST(request(),context())).status,400);assert.equal(extra.calls.auth,0);
 const valid=harness();assert.equal((await valid.h.simulatedStartPOST(request(),context())).status,200);assert.equal(valid.calls.writes,1);assert.deepEqual(valid.captured(),body);
});
test('validated request is frozen before authorization waits',async()=>{
 let release;const gate=new Promise(r=>{release=r;});const x=harness({verifiedIdentity:async()=>{await gate;return{subjectId:scope.actorId,sessionId:'session-1'};}});
 const pending=x.h.simulatedStartPOST(request(),context());await new Promise(r=>setImmediate(r));x.raw.reason='mutated';release();assert.equal((await pending).status,200);assert.equal(x.captured().reason,body.reason);
});
test('recovery is read-only with writer disabled and current read has exact two-field envelope',async()=>{
 const recovery=harness({simulatedStartEnabled:()=>false});assert.equal((await recovery.h.simulatedStartOperationPOST(request(),context())).status,200);assert.equal(recovery.calls.writes,0);assert.equal(recovery.calls.reads,1);
 const current=harness({readJson:async()=>({request:structuredClone(body),startId:id(6)})});assert.equal((await current.h.simulatedStartedSourcePOST(request(),context())).status,200);assert.equal(current.calls.sources,1);
 const extra=harness({readJson:async()=>({request:structuredClone(body),startId:id(6),normalStartAuthorized:true})});assert.equal((await extra.h.simulatedStartedSourcePOST(request(),context())).status,400);assert.equal(extra.calls.sources,0);
});
test('identity or target mismatch never reaches Start port',async()=>{
 const identity=harness({verifiedIdentity:async()=>({subjectId:id(90),sessionId:'session-1'})});assert.equal((await identity.h.simulatedStartPOST(request(),context())).status,403);assert.equal(identity.calls.writes,0);
 const denied=harness({authorizeTarget:async()=>null});assert.equal((await denied.h.simulatedStartPOST(request(),context())).status,403);assert.equal(denied.calls.writes,0);
});

test('handler stops disclosure when its independent Start switch closes during port access',async()=>{
 let on=true;const x=harness({simulatedStartEnabled:()=>on});x.port.startSimulation=async()=>{on=false;return{data:startReceipt(),error:null};};
 const result=await x.h.simulatedStartPOST(request(),context());assert.equal(result.status,404);assert.deepEqual(result.data,{error:'not_found'});
});
