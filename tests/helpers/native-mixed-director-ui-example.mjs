/** Supplied in-memory fictional UI example only; never a database fixture. */
import {nativeMixedReadinessExample,mixedExampleId as id} from './native-mixed-readiness-example.mjs';
import {drawNativeMixedSeatingCandidateV1} from '../../src/lib/seating/native-mixed-seating-plan-v1.ts';
export function nativeMixedDirectorUiExample(){
 const scope={actorId:id(1),tournamentId:id(2),eventId:id(3)},context={projectRef:'localtest',scope,sessionId:'local-ui-session'},attendance=nativeMixedReadinessExample();
 const config={tables:[{tableId:'A',seatCount:18}],activePairIds:Array.from({length:9},(_,i)=>`A:${i*2+1}-${i*2+2}`),anchor:{participantId:null,seatId:'A-1',directorApproved:true},stationaryRequests:[],stationaryDecisions:[],constraints:[],maxAttempts:1};
 const local=drawNativeMixedSeatingCandidateV1({attendance,config,lifecycle:{tournamentId:scope.tournamentId,eventId:scope.eventId,tournamentStatus:'open',registrationStatus:'closed',operationalState:'active',eventType:'main',format:'standard_singles',gameCount:12,participantCount:18,hasStarted:false,hasDraw:false,seatingPublicationId:null,schedulePublicationId:null,existingTournamentIds:[]}},n=>n-1);
 if(local.status!=='local-candidate-not-authorized')throw Error('Invalid supplied UI example');
 const a=attendance.value.sourceDigest,hash=c=>c.repeat(64),requests={
  plan:{kind:'native-mixed-simulation-plan-v1',operationId:id(810),expectedAttendanceSealId:id(8),expectedAttendanceSourceDigest:a,config,reason:'Local UI example plan.'},
  draw:{kind:'native-mixed-simulation-draw-v1',operationId:id(820),planId:id(811),expectedPlanDigest:hash('a'),expectedAttendanceSourceDigest:a,reason:'Local UI example draw.'},
  review:{kind:'native-mixed-simulation-review-v1',operationId:id(830),drawId:id(821),expectedDrawDigest:hash('b'),expectedAttendanceSourceDigest:a,decision:'accepted-test-simulation-only',humanPresenceNotVerified:true,simulationLayoutReviewed:true,fictionalPaperAcknowledged:true,reason:'Local UI example layout review.'},
  publish:{kind:'native-mixed-simulation-publish-v1',operationId:id(840),reviewId:id(831),expectedReviewDigest:hash('c'),expectedAttendanceSourceDigest:a,seatingOperationId:id(841),scheduleOperationId:id(842),reason:'Local UI example publication.'},
 };
 const operations=Object.fromEntries(Object.entries(requests).map(([action,request])=>[action,{action,operationId:request.operationId,request}]));
 const extras={plan:{code:'simulation_plan_saved',planId:id(811),version:1,sourceDigest:hash('a'),normalDrawAuthorized:false,normalStartAuthorized:false},draw:{code:'simulation_draw_recorded',drawId:id(821),candidate:local.candidate,sourceDigest:hash('b'),publishAuthorized:false},review:{code:'simulation_draw_reviewed',reviewId:id(831),sourceDigest:hash('c'),publishAuthorized:false}};
 const histories=Object.fromEntries(['plan','draw','review'].map(action=>{const op=operations[action],receipt={kind:'native-mixed-simulation-receipt-v1',...scope,action,status:'accepted',operationId:op.operationId,request:op.request,...extras[action],historicalReceipt:true,currentSourceVerified:false};return[action,{kind:'native-mixed-simulation-operation-v1',...scope,action,operationId:op.operationId,request:op.request,receipt,historicalReceipt:true,currentSourceVerified:false}];}));
 return{scope,context,config,operations,histories,materials:{plan:histories.plan,draw:histories.draw,review:histories.review}};
}
