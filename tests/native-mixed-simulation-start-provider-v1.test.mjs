import test from 'node:test';import assert from 'node:assert/strict';
import{createNativeMixedSimulationProviderV1,nativeMixedSimulationUnavailableExecutorV1}from'../src/lib/api/native-mixed-simulation-provider-v1.ts';
import{startScope as scope,startRequest as request,startReceipt,startId as id}from'./helpers/native-mixed-simulation-start-example.mjs';
const now=Date.parse('2026-11-06T20:00:00.000Z'),projectUrl='https://localtest.supabase.co',projectRef='localtest';
const session={kind:'native-mixed-director-session-v1',subjectId:scope.actorId,sessionId:'session-1',...scope,projectUrl,projectRef,allowedActions:['simulation-start','simulation-start-operation','simulation-start-source'],expiresAt:'2026-11-06T20:01:00.000Z'};
function harness(overrides={}){
 const calls={users:0,writes:0,reads:0,sources:0};let role='director',clock=now;
 const authenticated={auth:{getUser:async()=>{calls.users++;return{data:{user:{id:scope.actorId}},error:null};},getClaims:async()=>({data:{claims:{sub:scope.actorId,session_id:'session-1'}},error:null})},rpc:async()=>({data:role,error:null})};
 const source={kind:'native-mixed-simulation-start-source-v1',...scope,receipt:startReceipt(),currentSourceVerified:true,normalStartAuthorized:false,scoringAuthorized:false};
 const executor={...nativeMixedSimulationUnavailableExecutorV1(projectUrl,projectRef),startSimulation:async()=>{calls.writes++;return{data:startReceipt(),error:null};},readStartOperation:async()=>{calls.reads++;return{data:startReceipt(true),error:null};},readStartedSource:async()=>{calls.sources++;return{data:source,error:null};},...overrides.executor};
 const provider=createNativeMixedSimulationProviderV1({authenticated,executor,enabled:()=>true,simulatedStartEnabled:()=>true,simulatedStartRecoveryEnabled:()=>true,now:()=>clock,...overrides.options});
 return{provider,calls,executor,source,setRole:v=>{role=v;},setClock:v=>{clock=v;}};
}
test('Start is independently default closed, old leases and foreign scopes do not dispatch',async()=>{
 const h=harness({options:{simulatedStartEnabled:undefined,simulatedStartRecoveryEnabled:undefined}});
 assert.equal((await h.provider.startSimulation(session,request)).error,'disabled');assert.equal((await h.provider.startOperation(session,request)).error,'disabled');assert.equal(h.calls.users,0);
 const active=harness();for(const changed of [{allowedActions:['publish']},{projectRef:'other'},{actorId:id(9)},{expiresAt:'2026-11-06T19:59:59.000Z'}])assert.equal((await active.provider.startSimulation({...session,...changed},request)).error,'invalid_session');assert.equal(active.calls.writes,0);
});
test('authenticated Start snapshots its scope/request and preserves simulated-only flags',async()=>{
 let release;const gate=new Promise(r=>{release=r;});let captured;
 const h=harness({executor:{startSimulation:async args=>{captured=args;await gate;return{data:startReceipt(),error:null};}}});
 const mutable=structuredClone(request),lease=structuredClone(session),pending=h.provider.startSimulation(lease,mutable);mutable.reason='mutated';lease.actorId=id(9);release();
 const result=await pending;assert.equal(result.error,null);assert.equal(captured.actor,scope.actorId);assert.deepEqual(captured.request,request);assert.equal(result.data.scoringAuthorized,false);assert.equal(result.data.normalStartAuthorized,false);
});
test('lost write response stays unknown and recovery never resubmits',async()=>{
 let writes=0;const h=harness({executor:{startSimulation:async()=>{writes++;throw Error('lost acknowledgment');}}});
 assert.equal((await h.provider.startSimulation(session,request)).error,'operation_outcome_unknown');
 const recovered=await h.provider.startOperation(session,request);assert.equal(recovered.data.historicalReceipt,true);assert.equal(recovered.data.currentSourceVerified,false);assert.equal(writes,1);assert.equal(h.calls.reads,1);
 const absent=harness({executor:{readStartOperation:async()=>({data:null,error:null})}});assert.equal((await absent.provider.startOperation(session,request)).error,'operation_outcome_unknown');assert.equal(absent.calls.writes,0);
});
test('recovery works with Start disabled but rejects current or foreign receipts',async()=>{
 const h=harness({options:{simulatedStartEnabled:()=>false}});assert.equal((await h.provider.startOperation(session,request)).error,null);assert.equal(h.calls.writes,0);
 for(const data of [startReceipt(),{...startReceipt(true),actorId:id(9)},{...startReceipt(true),scoringAuthorized:true}]){const bad=harness({executor:{readStartOperation:async()=>({data,error:null})}});assert.equal((await bad.provider.startOperation(session,request)).error,'operation_outcome_unknown');}
});
test('identity, expiry and capability disable are checked after executor awaits',async()=>{
 const role=harness({executor:{startSimulation:async()=>{role.setRole('player');return{data:startReceipt(),error:null};}}});assert.equal((await role.provider.startSimulation(session,request)).error,'permission_required');
 const expired=harness({executor:{startSimulation:async()=>{expired.setClock(Date.parse(session.expiresAt));return{data:startReceipt(),error:null};}}});assert.equal((await expired.provider.startSimulation(session,request)).error,'invalid_session');
 let on=true;const disabled=harness({options:{simulatedStartEnabled:()=>on},executor:{startSimulation:async()=>{on=false;return{data:startReceipt(),error:null};}}});assert.equal((await disabled.provider.startSimulation(session,request)).error,'disabled');
});
test('current Start observation remains simulation-only and rejects revoked or mismatched state',async()=>{
 const h=harness();assert.equal((await h.provider.startedSource(session,request,id(6))).error,null);assert.equal(h.calls.writes,0);
 for(const data of [{status:'blocked',code:'publication_or_readiness_changed'},{...h.source,scoringAuthorized:true},{...h.source,receipt:startReceipt(true)}]){const bad=harness({executor:{readStartedSource:async()=>({data,error:null})}});assert.equal((await bad.provider.startedSource(session,request,id(6))).error,'invalid_response');}
 const bad=harness();assert.equal((await bad.provider.startedSource(session,request,'bad')).error,'invalid_response');assert.equal(bad.calls.sources,0);
});
test('malformed inputs and authority-bearing outputs fail closed without accidental resubmission',async()=>{
 const h=harness();assert.equal((await h.provider.startSimulation(session,{...request,normalStartAuthorized:true})).error,'invalid_response');assert.equal(h.calls.writes,0);
 const bad=harness({executor:{startSimulation:async()=>({data:{...startReceipt(),scoringAuthorized:true},error:null})}});assert.equal((await bad.provider.startSimulation(session,request)).error,'operation_outcome_unknown');
});

test('executor response is snapshotted before post-call authentication awaits',async()=>{
 let release,reached;const blocked=new Promise(r=>{release=r;}),secondAuth=new Promise(r=>{reached=r;});let users=0;const response=startReceipt();
 const authenticated={auth:{getUser:async()=>{if(++users===2){reached();await blocked;}return{data:{user:{id:scope.actorId}},error:null};},getClaims:async()=>({data:{claims:{sub:scope.actorId,session_id:'session-1'}},error:null})},rpc:async()=>({data:'director',error:null})};
 const h=harness({options:{authenticated},executor:{startSimulation:async()=>({data:response,error:null})}});
 const pending=h.provider.startSimulation(session,request);await secondAuth;response.scoringAuthorized=true;response.request.reason='mutated response';release();const result=await pending;assert.equal(result.error,null);assert.equal(result.data.scoringAuthorized,false);assert.equal(result.data.request.reason,request.reason);
});
