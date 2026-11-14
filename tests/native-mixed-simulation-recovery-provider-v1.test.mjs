import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeMixedSimulationProviderV1,nativeMixedSimulationUnavailableExecutorV1} from '../src/lib/api/native-mixed-simulation-provider-v1.ts';
import {createNativeMixedSimulationHandlersV1,nativeMixedSimulationRequestBodyLimitV1} from '../src/lib/api/native-mixed-simulation-handlers-v1.ts';

const id=n=>`de110000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash='a'.repeat(64),now=Date.parse('2026-11-05T21:00:00.000Z');
const projectUrl='https://example.supabase.co',projectRef='example',scope={actorId:id(1),tournamentId:id(2),eventId:id(3)};
const config={tables:[{tableId:'A',seatCount:18}],activePairIds:Array.from({length:9},(_,i)=>`A:${i*2+1}-${i*2+2}`),anchor:{participantId:null,seatId:'A-1',directorApproved:true},stationaryRequests:[],stationaryDecisions:[],constraints:[],maxAttempts:1};
const request={kind:'native-mixed-simulation-plan-v1',operationId:id(10),expectedAttendanceSealId:id(11),expectedAttendanceSourceDigest:hash,config,reason:'Prepare the reviewed rehearsal.'};
const operation={action:'plan',operationId:request.operationId,request};
const accepted={kind:'native-mixed-simulation-receipt-v1',action:'plan',status:'accepted',code:'simulation_plan_saved',...scope,operationId:operation.operationId,request,planId:id(12),version:1,sourceDigest:'b'.repeat(64),normalDrawAuthorized:false,normalStartAuthorized:false};
const historicalReceipt={...accepted,historicalReceipt:true,currentSourceVerified:false};
const historicalOperation={kind:'native-mixed-simulation-operation-v1',...scope,operationId:operation.operationId,action:'plan',request,receipt:historicalReceipt,historicalReceipt:true,currentSourceVerified:false};
const cancellationRequest={kind:'native-mixed-simulation-cancellation-v1',operationId:operation.operationId,action:'plan',operationRequest:request,reason:'Resolve the uncertain operation without retrying it.'};
const cancellationReceipt={kind:'native-mixed-simulation-cancellation-receipt-v1',status:'cancelled_no_committed_operation',code:'simulation_operation_cancelled',...scope,operationId:operation.operationId,action:'plan',request,requestHash:'c'.repeat(64),cancellationReason:cancellationRequest.reason,notCommitted:true,executionNotProven:true,freshDrawAuthorized:false,normalStartAuthorized:false,currentSourceVerified:false};
const historicalCancellation={...cancellationReceipt,historicalReceipt:true};
const transition={kind:'native-mixed-director-transition-v1',...scope,prior:historicalOperation,nextAction:'draw',parentId:accepted.planId,parentDigest:accepted.sourceDigest,attendanceDigest:request.expectedAttendanceSourceDigest,observedAt:new Date(now).toISOString(),currentSourceVerified:true,writeAuthorized:false,normalStartAuthorized:false};
const allActions=['plan','draw','review','publish','operation','source','cancel','cancellation','transition'];
const session={kind:'native-mixed-director-session-v1',subjectId:scope.actorId,sessionId:'session-1',...scope,projectUrl,projectRef,allowedActions:allActions,expiresAt:'2026-11-05T21:01:00.000Z'};

function auth(state={actorId:scope.actorId,subjectId:scope.actorId,sessionId:'session-1',role:'director',calls:0}){return{auth:{getUser:async()=>{state.calls++;return{data:{user:state.actorId?{id:state.actorId}:null},error:null};},getClaims:async()=>({data:{claims:{sub:state.subjectId,session_id:state.sessionId}},error:null})},rpc:async()=>({data:state.role,error:null})};}
function executor(overrides={}){return{...nativeMixedSimulationUnavailableExecutorV1(projectUrl,projectRef),...overrides};}

test('new capabilities are default closed and absent from an old lease before auth or executor',async()=>{
 let executorCalls=0;const state={actorId:scope.actorId,subjectId:scope.actorId,sessionId:'session-1',role:'director',calls:0};
 const disabled=createNativeMixedSimulationProviderV1({authenticated:auth(state),executor:executor({cancel:async()=>{executorCalls++;return{data:cancellationReceipt,error:null};}})});
 assert.equal((await disabled.cancel(session,cancellationRequest)).error,'disabled');assert.equal(state.calls,0);assert.equal(executorCalls,0);
 const enabled=createNativeMixedSimulationProviderV1({authenticated:auth(state),executor:executor({readCancellation:async()=>{executorCalls++;return{data:historicalCancellation,error:null};}}),enabled:()=>true,now:()=>now});
 const oldLease={...session,allowedActions:['plan','operation','source']};
 assert.equal((await enabled.cancellation(oldLease,operation)).error,'invalid_session');assert.equal(state.calls,0);assert.equal(executorCalls,0);
});

test('cancel snapshots the request, dispatches once, and accepts only exact typed outcomes',async()=>{
 let release,args,calls=0;const gate=new Promise(resolve=>{release=resolve;});
 const provider=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({cancel:async value=>{calls++;args=value;await gate;return{data:cancellationReceipt,error:null};}}),enabled:()=>true,now:()=>now});
 const mutable=structuredClone(cancellationRequest),pending=provider.cancel(session,mutable);mutable.reason='Changed after dispatch';mutable.operationRequest.reason='Changed too';release();
 assert.deepEqual((await pending).data,cancellationReceipt);assert.equal(calls,1);assert.deepEqual(args,{actor:scope.actorId,tid:scope.tournamentId,eid:scope.eventId,request:cancellationRequest});
 for(const data of[historicalOperation,{status:'retry_exact',code:'source_busy'},{status:'rejected',code:'draw_not_cancellable'},{status:'blocked',code:'cancellation_history_unavailable'}]){
  const value=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({cancel:async()=>({data,error:null})}),enabled:()=>true,now:()=>now});assert.deepEqual((await value.cancel(session,cancellationRequest)).data,data);
 }
 const invalid=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({cancel:async()=>({data:{...cancellationReceipt,freshDrawAuthorized:true},error:null})}),enabled:()=>true,now:()=>now});
 assert.equal((await invalid.cancel(session,cancellationRequest)).error,'invalid_response');
});

test('cancel snapshots executor output before asynchronous post-authorization',async()=>{
 let authCalls=0,release,leaveStarted;const gate=new Promise(resolve=>{release=resolve;}),atLeave=new Promise(resolve=>{leaveStarted=resolve;});
 const authenticated={auth:{getUser:async()=>{authCalls++;if(authCalls===2){leaveStarted();await gate;}return{data:{user:{id:scope.actorId}},error:null};},getClaims:async()=>({data:{claims:{sub:scope.actorId,session_id:'session-1'}},error:null})},rpc:async()=>({data:'director',error:null})};
 const mutableOutput=structuredClone(cancellationReceipt),mutableRpc={data:mutableOutput,error:null},configured=executor({cancel:async()=>mutableRpc});
 const provider=createNativeMixedSimulationProviderV1({authenticated,executor:configured,enabled:()=>true,now:()=>now});configured.projectUrl='https://mutated.invalid';
 const pending=provider.cancel(session,cancellationRequest);await atLeave;mutableOutput.freshDrawAuthorized=true;mutableRpc.error={code:'late-mutation'};release();
 assert.deepEqual((await pending).data,cancellationReceipt);
});

test('existing write output is also snapshotted before asynchronous post-authorization',async()=>{
 let authCalls=0,release,leaveStarted;const gate=new Promise(resolve=>{release=resolve;}),atLeave=new Promise(resolve=>{leaveStarted=resolve;});
 const authenticated={auth:{getUser:async()=>{authCalls++;if(authCalls===2){leaveStarted();await gate;}return{data:{user:{id:scope.actorId}},error:null};},getClaims:async()=>({data:{claims:{sub:scope.actorId,session_id:'session-1'}},error:null})},rpc:async()=>({data:'director',error:null})};
 const mutableOutput=structuredClone(accepted),provider=createNativeMixedSimulationProviderV1({authenticated,executor:executor({plan:async()=>({data:mutableOutput,error:null})}),enabled:()=>true,now:()=>now});
 const pending=provider.execute(session,operation);await atLeave;mutableOutput.normalStartAuthorized=true;release();
 assert.deepEqual((await pending).data.outcome,accepted);
});

test('every recovery port has pre/post identity, Director and lease checks including provider errors',async()=>{
 const state={actorId:scope.actorId,subjectId:scope.actorId,sessionId:'session-1',role:'director',calls:0};
 const provider=createNativeMixedSimulationProviderV1({authenticated:auth(state),executor:executor({cancel:async()=>({data:null,error:{code:'down'}})}),enabled:()=>true,now:()=>now});
 assert.equal((await provider.cancel(session,cancellationRequest)).error,'provider_unavailable');assert.equal(state.calls,2);
 let release;const gate=new Promise(resolve=>{release=resolve;});const late=createNativeMixedSimulationProviderV1({authenticated:auth(state),executor:executor({readCancellation:async()=>{await gate;return{data:historicalCancellation,error:null};}}),enabled:()=>true,now:()=>now});
 const pending=late.cancellation(session,operation);state.sessionId='changed';release();assert.equal((await pending).error,'identity_changed');
});

test('cancellation read requires the historical exact tombstone and never calls a mutation',async()=>{
 let writes=0,reads=0;const provider=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({cancel:async()=>{writes++;return{data:null,error:null};},readCancellation:async args=>{reads++;assert.deepEqual(args,{actor:scope.actorId,tid:scope.tournamentId,eid:scope.eventId,op:operation.operationId});return{data:historicalCancellation,error:null};}}),enabled:()=>true,now:()=>now});
 assert.deepEqual((await provider.cancellation(session,operation)).data,historicalCancellation);assert.equal(reads,1);assert.equal(writes,0);
 const direct=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({readCancellation:async()=>({data:cancellationReceipt,error:null})}),enabled:()=>true,now:()=>now});
 assert.equal((await direct.cancellation(session,operation)).error,'operation_outcome_unknown');
});

test('transition read is fresh, exact, read-only and rejects stale proof',async()=>{
 let writes=0,reads=0;const provider=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({draw:async()=>{writes++;return{data:null,error:null};},readTransition:async args=>{reads++;assert.deepEqual(args,{actor:scope.actorId,tid:scope.tournamentId,eid:scope.eventId,op:operation.operationId});return{data:transition,error:null};}}),enabled:()=>true,now:()=>now});
 assert.deepEqual((await provider.transition(session,operation)).data,transition);assert.equal(reads,1);assert.equal(writes,0);
 const stale=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({readTransition:async()=>({data:{...transition,observedAt:new Date(now-30001).toISOString()},error:null})}),enabled:()=>true,now:()=>now});
 assert.equal((await stale.transition(session,operation)).error,'invalid_response');
});

function handlerPort(overrides={}){return{execute:async()=>({data:null,error:'not_used'}),cancel:async()=>({data:cancellationReceipt,error:null}),operation:async()=>({data:historicalOperation,error:null}),cancellation:async()=>({data:historicalCancellation,error:null}),transition:async()=>({data:transition,error:null}),source:async()=>({data:null,error:'not_used'}),...overrides};}
function handlerBase(overrides={}){return{enabled:()=>true,projectUrl,projectRef,now:()=>now,verifiedIdentity:async()=>({subjectId:scope.actorId,sessionId:'session-1'}),authorizeTarget:async input=>({...session,allowedActions:[input.action]}),port:async()=>handlerPort(),readJson:async()=>operation,sameOrigin:()=>true,json:(body,init)=>({body,status:init?.status??200}),boundary:run=>run(),...overrides};}
const requestObject={headers:new Headers({'x-expected-actor-id':scope.actorId})},context={params:Promise.resolve({id:scope.tournamentId,eventId:scope.eventId,operationId:operation.operationId})};

test('handlers require same-origin bounded exact bodies and route operation binding for all recovery POSTs',async()=>{
 let maxBytes=0,portCalls=0;const handlers=createNativeMixedSimulationHandlersV1(handlerBase({readJson:async(_request,max)=>{maxBytes=max;return cancellationRequest;},port:async()=>{portCalls++;return handlerPort();}}));
 assert.equal((await handlers.cancelPOST(requestObject,context)).status,200);assert.equal(maxBytes,nativeMixedSimulationRequestBodyLimitV1);assert.equal(portCalls,1);
 const wrongOrigin=createNativeMixedSimulationHandlersV1(handlerBase({sameOrigin:()=>false,port:async()=>{portCalls++;return handlerPort();}}));assert.equal((await wrongOrigin.cancelPOST(requestObject,context)).status,403);assert.equal(portCalls,1);
 const foreignContext={params:Promise.resolve({id:scope.tournamentId,eventId:scope.eventId,operationId:id(99)})};assert.equal((await handlers.cancelPOST(requestObject,foreignContext)).status,400);
 const readHandlers=createNativeMixedSimulationHandlersV1(handlerBase());
 assert.equal((await readHandlers.cancellationPOST(requestObject,context)).status,200);assert.equal((await readHandlers.transitionPOST(requestObject,context)).status,200);
});

test('handler authorization must return the exact new capability before constructing a port',async()=>{
 let portCalls=0;const denied=createNativeMixedSimulationHandlersV1(handlerBase({authorizeTarget:async()=>({...session,allowedActions:['operation']}),port:async()=>{portCalls++;return handlerPort();},readJson:async()=>cancellationRequest}));
 assert.equal((await denied.cancelPOST(requestObject,context)).status,403);assert.equal(portCalls,0);
 const unavailable=createNativeMixedSimulationHandlersV1(handlerBase({enabled:()=>false,port:async()=>{portCalls++;return handlerPort();},readJson:async()=>cancellationRequest}));
 assert.equal((await unavailable.cancelPOST(requestObject,context)).status,404);assert.equal(portCalls,0);
});
