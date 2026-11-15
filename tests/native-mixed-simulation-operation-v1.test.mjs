import test from 'node:test';
import assert from 'node:assert/strict';
import {
 isNativeMixedSimulationOperationV1,
 isNativeMixedSimulationScopeV1,
 readNativeMixedSimulationOperationV1,
 readNativeMixedSimulationOutcomeV1,
 readNativeMixedSimulationProviderWriteV1,
 readNativeMixedSimulationReceiptV1,
 readNativeMixedSimulationScheduleSourceV1,
} from '../src/lib/seating/native-mixed-simulation-operation-v1.ts';

const id=n=>`aa110000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash=c=>c.repeat(64);
const scope={actorId:id(1),tournamentId:id(2),eventId:id(3)};
const config={tables:[{tableId:'A',seatCount:18}],activePairIds:Array.from({length:9},(_,i)=>`A:${i*2+1}-${i*2+2}`),anchor:{participantId:null,seatId:'A-1',directorApproved:true},stationaryRequests:[],stationaryDecisions:[],constraints:[],maxAttempts:1};
const requests={
 plan:{kind:'native-mixed-simulation-plan-v1',operationId:id(10),expectedAttendanceSealId:id(11),expectedAttendanceSourceDigest:hash('a'),config,reason:'Prepare the reviewed rehearsal.'},
 draw:{kind:'native-mixed-simulation-draw-v1',operationId:id(20),planId:id(21),expectedPlanDigest:hash('b'),expectedAttendanceSourceDigest:hash('a'),reason:'Commit one bounded draw attempt.'},
 review:{kind:'native-mixed-simulation-review-v1',operationId:id(30),drawId:id(31),expectedDrawDigest:hash('c'),expectedAttendanceSourceDigest:hash('a'),decision:'accepted-test-simulation-only',humanPresenceNotVerified:true,simulationLayoutReviewed:true,fictionalPaperAcknowledged:true,reason:'Review the simulated layout.'},
 publish:{kind:'native-mixed-simulation-publish-v1',operationId:id(40),reviewId:id(41),expectedReviewDigest:hash('d'),expectedAttendanceSourceDigest:hash('a'),seatingOperationId:id(42),scheduleOperationId:id(43),reason:'Publish the reviewed simulation graph.'},
};
const operation=action=>({action,operationId:requests[action].operationId,request:structuredClone(requests[action])});
const receipt=action=>{
 const common={kind:'native-mixed-simulation-receipt-v1',action,status:'accepted',code:{plan:'simulation_plan_saved',draw:'simulation_draw_recorded',review:'simulation_draw_reviewed',publish:'native_mixed_simulation_published'}[action],...scope,operationId:requests[action].operationId,request:structuredClone(requests[action])};
 if(action==='plan')return{...common,planId:id(50),version:1,sourceDigest:hash('e'),normalDrawAuthorized:false,normalStartAuthorized:false};
 if(action==='draw')return{...common,drawId:id(51),candidate:{status:'candidate'},sourceDigest:hash('f'),publishAuthorized:false};
 if(action==='review')return{...common,reviewId:id(52),sourceDigest:hash('1'),publishAuthorized:false};
 return{...common,contextId:id(53),seatingPublicationId:id(54),schedulePublicationId:id(55),assignmentCount:18,roundCount:12,matchCount:108,currentSourceVerified:true,ordinaryAttendanceUsed:false,normalStartAuthorized:false};
};

test('four operation requests are exact and action bound',()=>{
 assert.equal(isNativeMixedSimulationScopeV1(scope),true);assert.equal(isNativeMixedSimulationScopeV1({...scope,extra:true}),false);
 for(const action of ['plan','draw','review','publish'])assert.equal(isNativeMixedSimulationOperationV1(operation(action)),true);
 const extra=operation('draw');extra.request.future=true;assert.equal(isNativeMixedSimulationOperationV1(extra),false);
 const mismatch=operation('review');mismatch.action='publish';assert.equal(isNativeMixedSimulationOperationV1(mismatch),false);
 const reused=operation('publish');reused.request.scheduleOperationId=reused.operationId;assert.equal(isNativeMixedSimulationOperationV1(reused),false);
 const badReference=operation('plan');badReference.request.config.constraints=[{kind:'avoid-pair-in-round',participantIds:[id(60),id(61)],round:1,verified:true,sourceReference:'free text'}];assert.equal(isNativeMixedSimulationOperationV1(badReference),false);
 const tooMany=operation('plan');tooMany.request.config.stationaryRequests=Array.from({length:19},(_,i)=>id(70+i));tooMany.request.config.stationaryDecisions=tooMany.request.config.stationaryRequests.map(participantId=>({participantId,decision:'not-accommodated'}));assert.equal(isNativeMixedSimulationOperationV1(tooMany),false);
});

test('accepted and persisted terminal receipts require exact scope, request and false authority',()=>{
 for(const action of ['plan','draw','review','publish'])assert.deepEqual(readNativeMixedSimulationReceiptV1(receipt(action),{scope,operation:operation(action)}),receipt(action));
 assert.equal(readNativeMixedSimulationReceiptV1({...receipt('publish'),normalStartAuthorized:true},{scope,operation:operation('publish')}),null);
 assert.equal(readNativeMixedSimulationReceiptV1({...receipt('plan'),eventId:id(99)},{scope,operation:operation('plan')}),null);
 const terminal={kind:'native-mixed-simulation-receipt-v1',action:'draw',status:'rejected',code:'bounded_search_exhausted',...scope,operationId:requests.draw.operationId,request:requests.draw,entropyConsumed:true,retryWithNewOperationAuthorized:false};
 assert.deepEqual(readNativeMixedSimulationOutcomeV1(terminal,{scope,operation:operation('draw')}),terminal);
 assert.equal(readNativeMixedSimulationOutcomeV1({...terminal,retryWithNewOperationAuthorized:true},{scope,operation:operation('draw')}),null);
});

test('historical operation read is exact, non-current and cannot carry extra authority',()=>{
 const op=operation('publish'),historicalReceipt={...receipt('publish'),historicalReceipt:true,currentSourceVerified:false};
 const record={kind:'native-mixed-simulation-operation-v1',...scope,operationId:op.operationId,action:op.action,request:op.request,receipt:historicalReceipt,historicalReceipt:true,currentSourceVerified:false};
 assert.deepEqual(readNativeMixedSimulationOperationV1(record,{scope,operationId:op.operationId,operation:op}),record);
 assert.deepEqual(readNativeMixedSimulationOperationV1(record,{scope,operationId:op.operationId}),record);
 assert.equal(readNativeMixedSimulationOperationV1({...record,currentSourceVerified:true},{scope,operationId:op.operationId}),null);
 assert.equal(readNativeMixedSimulationOperationV1({...record,receipt:{...historicalReceipt,payoutAuthorized:true}},{scope,operationId:op.operationId}),null);
});

test('provider write preserves known blocks and never upgrades retry to a receipt',()=>{
 const op=operation('review'),known={status:'rejected',code:'draw_or_source_changed'};
 const write={kind:'native-mixed-simulation-provider-write-v1',action:'review',...scope,operationId:op.operationId,operation:op,outcome:known};
 assert.deepEqual(readNativeMixedSimulationProviderWriteV1(write,{scope,operation:op}),write);
 assert.equal(readNativeMixedSimulationProviderWriteV1({...write,outcome:{status:'rejected',code:'invented'}},{scope,operation:op}),null);
 assert.deepEqual(readNativeMixedSimulationOutcomeV1({status:'retry_exact',code:'source_busy'},{scope,operation:op}),{status:'retry_exact',code:'source_busy'});
});

test('published source decoder accepts exact frozen DTO shape and rejects authority drift',()=>{
 const assignments=Array.from({length:18},(_,i)=>({assignmentId:id(100+i),rosterEntryId:id(200+i),participantId:id(300+i),fixedId:`A-${i+1}`}));
 const games=Array.from({length:108},(_,i)=>({gameId:id(400+i),importRowNumber:i+1,round:Math.floor(i/9)+1,sideAParticipantId:id(300+(i%18)),sideBParticipantId:id(300+((i+1)%18)),sideATableSeat:`A-${i%18+1}`,sideBTableSeat:`A-${(i+1)%18+1}`}));
 const source={status:'source_available',kind:'native-mixed-simulation-schedule-source-v1',...scope,attendance:{sealId:id(11),sourceDigest:hash('a')},plan:{planId:id(50),sourceDigest:hash('b'),config},draw:{drawId:id(51),sourceDigest:hash('c'),candidate:{status:'candidate'}},review:{reviewId:id(52),sourceDigest:hash('d'),decision:'accepted-test-simulation-only'},publication:{contextId:id(53),seatingReceiptId:id(54),seatingPublicationId:id(55),scheduleReceiptId:id(56),schedulePublicationId:id(57),sourceMethod:'native_mixed_simulation_v1',assignmentCount:18,roundCount:12,matchCount:108},fixedAssignments:assignments,canonicalGames:games,sourceDigest:hash('e'),simulationRosterProjected:true,nativeInitialSeatingPublished:true,nativeCanonicalSchedulePublished:true,ordinaryAttendanceUsed:false,ordinaryInitialSeatingWriterUsed:false,ordinaryScheduleWriterUsed:false,humanPresenceVerified:false,paymentVerified:false,moneyMoved:false,normalStartAuthorized:false,payoutAuthorized:false,finalizationAuthorized:false};
 assert.deepEqual(readNativeMixedSimulationScheduleSourceV1(source,scope),source);
 assert.equal(readNativeMixedSimulationScheduleSourceV1({...source,moneyMoved:true},scope),null);
 assert.equal(readNativeMixedSimulationScheduleSourceV1({...source,unexpected:true},scope),null);
});
