import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeMixedSimulationHandlersV1,nativeMixedSimulationRequestBodyLimitV1} from '../src/lib/api/native-mixed-simulation-handlers-v1.ts';
import {createNativeMixedSimulationProviderV1,nativeMixedSimulationUnavailableExecutorV1} from '../src/lib/api/native-mixed-simulation-provider-v1.ts';

const id=n=>`bb120000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash='a'.repeat(64),now=Date.parse('2026-11-05T20:00:00.000Z');
const projectUrl='https://example.supabase.co',projectRef='example',scope={actorId:id(1),tournamentId:id(2),eventId:id(3)};
const config={tables:[{tableId:'A',seatCount:18}],activePairIds:Array.from({length:9},(_,i)=>`A:${i*2+1}-${i*2+2}`),anchor:{participantId:null,seatId:'A-1',directorApproved:true},stationaryRequests:[],stationaryDecisions:[],constraints:[],maxAttempts:1};
const request={kind:'native-mixed-simulation-plan-v1',operationId:id(10),expectedAttendanceSealId:id(11),expectedAttendanceSourceDigest:hash,config,reason:'Prepare the reviewed rehearsal.'};
const operation={action:'plan',operationId:request.operationId,request};
const receipt={kind:'native-mixed-simulation-receipt-v1',action:'plan',status:'accepted',code:'simulation_plan_saved',...scope,operationId:request.operationId,request,planId:id(12),version:1,sourceDigest:'b'.repeat(64),normalDrawAuthorized:false,normalStartAuthorized:false};
const historicalReceipt={...receipt,historicalReceipt:true,currentSourceVerified:false};
const historical={kind:'native-mixed-simulation-operation-v1',...scope,operationId:operation.operationId,action:'plan',request,receipt:historicalReceipt,historicalReceipt:true,currentSourceVerified:false};
const session={kind:'native-mixed-director-session-v1',subjectId:scope.actorId,sessionId:'session-1',...scope,projectUrl,projectRef,allowedActions:['plan','draw','review','publish','operation','source'],expiresAt:'2026-11-05T20:01:00.000Z'};
function auth(state={actorId:scope.actorId,subjectId:scope.actorId,sessionId:'session-1',role:'director'}){return{auth:{getUser:async()=>({data:{user:state.actorId?{id:state.actorId}:null},error:null}),getClaims:async()=>({data:{claims:{sub:state.subjectId,session_id:state.sessionId}},error:null})},rpc:async name=>({data:name==='get_tournament_role'?state.role:null,error:null})};}
function executor(overrides={}){return{...nativeMixedSimulationUnavailableExecutorV1(projectUrl,projectRef),plan:async()=>({data:receipt,error:null}),readOperation:async()=>({data:historical,error:null}),...overrides};}
function sourceFixture(){
 const fixedAssignments=Array.from({length:18},(_,i)=>({assignmentId:id(100+i),rosterEntryId:id(200+i),participantId:id(300+i),fixedId:`A-${i+1}`}));
 const canonicalGames=Array.from({length:108},(_,i)=>({gameId:id(400+i),importRowNumber:i+1,round:Math.floor(i/9)+1,sideAParticipantId:id(300+(i%18)),sideBParticipantId:id(300+((i+1)%18)),sideATableSeat:`A-${i%18+1}`,sideBTableSeat:`A-${(i+1)%18+1}`}));
 return{status:'source_available',kind:'native-mixed-simulation-schedule-source-v1',...scope,attendance:{sealId:id(11),sourceDigest:hash},plan:{planId:id(12),sourceDigest:'b'.repeat(64),config},draw:{drawId:id(13),sourceDigest:'c'.repeat(64),candidate:{status:'candidate'}},review:{reviewId:id(14),sourceDigest:'d'.repeat(64),decision:'accepted-test-simulation-only'},publication:{contextId:id(15),seatingReceiptId:id(16),seatingPublicationId:id(17),scheduleReceiptId:id(18),schedulePublicationId:id(19),sourceMethod:'native_mixed_simulation_v1',assignmentCount:18,roundCount:12,matchCount:108},fixedAssignments,canonicalGames,sourceDigest:'e'.repeat(64),simulationRosterProjected:true,nativeInitialSeatingPublished:true,nativeCanonicalSchedulePublished:true,ordinaryAttendanceUsed:false,ordinaryInitialSeatingWriterUsed:false,ordinaryScheduleWriterUsed:false,humanPresenceVerified:false,paymentVerified:false,moneyMoved:false,normalStartAuthorized:false,payoutAuthorized:false,finalizationAuthorized:false};
}

test('provider is default closed and target expiry/project/action fail before auth or executor',async()=>{
 let authCalls=0,executorCalls=0;const authenticated={auth:{getUser:async()=>{authCalls++;return{data:{user:{id:scope.actorId}},error:null};},getClaims:async()=>({data:{claims:{sub:scope.actorId,session_id:'session-1'}},error:null})},rpc:async()=>({data:'director',error:null})};
 const disabled=createNativeMixedSimulationProviderV1({authenticated,executor:executor({plan:async()=>{executorCalls++;return{data:receipt,error:null};}}),now:()=>now});
 assert.equal((await disabled.execute(session,operation)).error,'disabled');assert.equal(authCalls,0);assert.equal(executorCalls,0);
 const enabled=createNativeMixedSimulationProviderV1({authenticated,executor:executor({plan:async()=>{executorCalls++;return{data:receipt,error:null};}}),enabled:()=>true,now:()=>now});
 assert.equal((await enabled.execute({...session,projectRef:'foreign'},operation)).error,'invalid_session');
 assert.equal((await enabled.execute({...session,expiresAt:'2026-11-05T19:59:59.999Z'},operation)).error,'invalid_session');
 assert.equal((await enabled.execute({...session,expiresAt:'2026-13-05T19:59:59.999Z'},operation)).error,'invalid_session');
 assert.equal((await enabled.execute({...session,allowedActions:['source']},operation)).error,'invalid_session');assert.equal(authCalls,0);assert.equal(executorCalls,0);
});

test('lease expiry is rechecked after authentication and before executor dispatch',async()=>{
 let clock=now,executorCalls=0;const authenticated={auth:{getUser:async()=>{clock=Date.parse(session.expiresAt);return{data:{user:{id:scope.actorId}},error:null};},getClaims:async()=>({data:{claims:{sub:scope.actorId,session_id:'session-1'}},error:null})},rpc:async()=>({data:'director',error:null})};
 const provider=createNativeMixedSimulationProviderV1({authenticated,executor:executor({plan:async()=>{executorCalls++;return{data:receipt,error:null};}}),enabled:()=>true,now:()=>clock});
 assert.equal((await provider.execute(session,operation)).error,'invalid_session');assert.equal(executorCalls,0);
});

test('a response arriving after lease expiry is not disclosed',async()=>{
 let clock=now,release;const gate=new Promise(resolve=>{release=resolve;});const provider=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({plan:async()=>{await gate;return{data:receipt,error:null};}}),enabled:()=>true,now:()=>clock});
 const pending=provider.execute(session,operation);clock=Date.parse(session.expiresAt);release();assert.equal((await pending).error,'invalid_session');
});

test('provider snapshots session and operation before authentication awaits',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});let first=true,args;
 const authenticated={auth:{getUser:async()=>{if(first){first=false;await gate;}return{data:{user:{id:scope.actorId}},error:null};},getClaims:async()=>({data:{claims:{sub:scope.actorId,session_id:'session-1'}},error:null})},rpc:async()=>({data:'director',error:null})};
 const provider=createNativeMixedSimulationProviderV1({authenticated,executor:executor({plan:async value=>{args=value;return{data:receipt,error:null};}}),enabled:()=>true,now:()=>now});
 const mutableSession=structuredClone(session),mutableOperation=structuredClone(operation),pending=provider.execute(mutableSession,mutableOperation);
 mutableSession.actorId=id(99);mutableSession.tournamentId=id(98);mutableOperation.operationId=id(97);mutableOperation.request.reason='Changed after dispatch';release();
 const result=await pending;assert.equal(result.error,null);assert.equal(result.data.operationId,request.operationId);assert.deepEqual(args,{actor:scope.actorId,tid:scope.tournamentId,eid:scope.eventId,request});
});

test('current Director and verified session identity are rechecked after executor response',async()=>{
 const state={actorId:scope.actorId,subjectId:scope.actorId,sessionId:'session-1',role:'co_director'},provider=createNativeMixedSimulationProviderV1({authenticated:auth(state),executor:executor(),enabled:()=>true,now:()=>now});
 assert.equal((await provider.execute(session,operation)).error,'permission_required');
 state.role='director';let release;const gate=new Promise(resolve=>{release=resolve;});const late=createNativeMixedSimulationProviderV1({authenticated:auth(state),executor:executor({plan:async()=>{await gate;return{data:receipt,error:null};}}),enabled:()=>true,now:()=>now});
 const pending=late.execute(session,operation);state.sessionId='changed';release();assert.equal((await pending).error,'identity_changed');
});

test('read recovery never invokes a mutating method and historical receipt stays non-current',async()=>{
 let draws=0,reads=0;const provider=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({draw:async()=>{draws++;return{data:null,error:null};},readOperation:async args=>{reads++;assert.deepEqual(args,{actor:scope.actorId,tid:scope.tournamentId,eid:scope.eventId,op:operation.operationId});return{data:historical,error:null};}}),enabled:()=>true,now:()=>now});
 assert.deepEqual((await provider.operation(session,operation.operationId)).data,historical);assert.equal(reads,1);assert.equal(draws,0);
 const unknown=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({readOperation:async()=>({data:null,error:null})}),enabled:()=>true,now:()=>now});
 assert.equal((await unknown.operation(session,operation.operationId)).error,'operation_outcome_unknown');assert.equal(draws,0);
});

test('source read uses only the read executor and rejects authority-shaped drift',async()=>{
 let writes=0,reads=0;const source=sourceFixture();const provider=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({plan:async()=>{writes++;return{data:null,error:null};},readSource:async()=>{reads++;return{data:source,error:null};}}),enabled:()=>true,now:()=>now});
 assert.deepEqual((await provider.source(session)).data,source);assert.equal(reads,1);assert.equal(writes,0);
 const invalid=createNativeMixedSimulationProviderV1({authenticated:auth(),executor:executor({readSource:async()=>({data:{...source,moneyMoved:true},error:null})}),enabled:()=>true,now:()=>now});
 assert.equal((await invalid.source(session)).error,'invalid_response');assert.equal(writes,0);
});

test('pure handlers enforce gate, origin, bounded body and exact target before constructing the port',async()=>{
 let identityCalls=0,authorizeCalls=0,portCalls=0,readLimit=0,executed=0;
 const port={execute:async(_session,op)=>{executed++;return{data:{kind:'native-mixed-simulation-provider-write-v1',action:'plan',...scope,operationId:op.operationId,operation:op,outcome:receipt},error:null};},operation:async()=>({data:historical,error:null}),source:async()=>({data:{source:true},error:null})};
 const base={projectUrl,projectRef,now:()=>now,verifiedIdentity:async()=>{identityCalls++;return{subjectId:scope.actorId,sessionId:'session-1'};},authorizeTarget:async input=>{authorizeCalls++;return{...session,allowedActions:[input.action]};},port:async()=>{portCalls++;return port;},readJson:async(_request,max)=>{readLimit=max;return operation;},sameOrigin:()=>true,json:(body,init)=>({body,status:init?.status??200}),boundary:run=>run()};
 const context={params:Promise.resolve({id:scope.tournamentId,eventId:scope.eventId})},requestObject={headers:new Headers({'x-expected-actor-id':scope.actorId})};
 const disabled=createNativeMixedSimulationHandlersV1({...base,enabled:()=>false});assert.equal((await disabled.operationPOST(requestObject,context)).status,404);assert.equal(identityCalls,0);assert.equal(portCalls,0);
 const wrongOrigin=createNativeMixedSimulationHandlersV1({...base,enabled:()=>true,sameOrigin:()=>false});assert.equal((await wrongOrigin.operationPOST(requestObject,context)).status,403);assert.equal(identityCalls,0);assert.equal(portCalls,0);
 const handlers=createNativeMixedSimulationHandlersV1({...base,enabled:()=>true});const response=await handlers.operationPOST(requestObject,context);assert.equal(response.status,200);assert.equal(readLimit,nativeMixedSimulationRequestBodyLimitV1);assert.equal(identityCalls,1);assert.equal(authorizeCalls,1);assert.equal(portCalls,1);assert.equal(executed,1);
});

test('handler refuses foreign, expired and missing-action target sessions with zero port calls',async()=>{
 let portCalls=0;const requestObject={headers:new Headers({'x-expected-actor-id':scope.actorId})},context={params:Promise.resolve({id:scope.tournamentId,eventId:scope.eventId})};
 const base={enabled:()=>true,projectUrl,projectRef,now:()=>now,verifiedIdentity:async()=>({subjectId:scope.actorId,sessionId:'session-1'}),port:async()=>{portCalls++;throw new Error('must not construct');},readJson:async()=>operation,sameOrigin:()=>true,json:(body,init)=>({body,status:init?.status??200}),boundary:run=>run()};
 for(const authorization of[{...session,projectUrl:'https://foreign.invalid',allowedActions:['plan']},{...session,expiresAt:'2026-11-05T19:59:00.000Z',allowedActions:['plan']},{...session,allowedActions:['source']}]){
  const handlers=createNativeMixedSimulationHandlersV1({...base,authorizeTarget:async()=>authorization});assert.equal((await handlers.operationPOST(requestObject,context)).status,403);
 }
 assert.equal(portCalls,0);
});

test('operation handler performs read-only recovery by exact route operation id',async()=>{
 let operationId,executeCalls=0;const port={execute:async()=>{executeCalls++;throw new Error('not allowed');},operation:async(_session,value)=>{operationId=value;return{data:historical,error:null};},source:async()=>({data:null,error:'invalid_response'})};
 const handlers=createNativeMixedSimulationHandlersV1({enabled:()=>true,projectUrl,projectRef,now:()=>now,verifiedIdentity:async()=>({subjectId:scope.actorId,sessionId:'session-1'}),authorizeTarget:async()=>({...session,allowedActions:['operation']}),port:async()=>port,readJson:async()=>null,sameOrigin:()=>true,json:(body,init)=>({body,status:init?.status??200}),boundary:run=>run()});
 const response=await handlers.operationGET({headers:new Headers({'x-expected-actor-id':scope.actorId})},{params:Promise.resolve({id:scope.tournamentId,eventId:scope.eventId,operationId:operation.operationId})});
 assert.equal(response.status,200);assert.equal(operationId,operation.operationId);assert.equal(executeCalls,0);assert.equal(response.body.currentSourceVerified,false);
});
