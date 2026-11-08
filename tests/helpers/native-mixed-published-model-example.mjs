/** Supplied in-memory protocol models only; no database or physical play. */
import assert from 'node:assert/strict';
import {prepareNativeMixedSeatingV1 as prepare,drawNativeMixedSeatingCandidateV1 as draw} from '../../src/lib/seating/native-mixed-seating-plan-v1.ts';
import {nativeMixedReadinessExample,mixedExampleId as id}from'./native-mixed-readiness-example.mjs';
const clone=v=>structuredClone(v);
export function nativeMixedPublishedModelExample(withRequests=false){
 const input={attendance:nativeMixedReadinessExample(),lifecycle:{tournamentId:id(2),eventId:id(3),tournamentStatus:'open',registrationStatus:'closed',operationalState:'active',eventType:'main',format:'standard_singles',gameCount:12,participantCount:18,hasStarted:false,hasDraw:false,seatingPublicationId:null,schedulePublicationId:null,existingTournamentIds:[]},
 config:{tables:[{tableId:'A',seatCount:18}],activePairIds:Array.from({length:9},(_,i)=>`A:${i*2+1}-${i*2+2}`),anchor:{participantId:withRequests?id(100):null,seatId:'A-1',directorApproved:true},stationaryRequests:withRequests?[id(101),id(100)]:[],stationaryDecisions:withRequests?[{participantId:id(100),decision:'selected-anchor'},{participantId:id(101),decision:'not-accommodated'}]:[],constraints:[],maxAttempts:8}};
 const p=prepare(input),d=draw(input,n=>n-1);
 assert.equal(p.status,'prepared-not-authorized');assert.equal(d.status,'local-candidate-not-authorized');
 const c=Object.fromEntries(['algorithmVersion','anchor','assignments','matches','attempts','physicalReviewRequired','publishable'].map(k=>[k,clone(d.candidate[k])]));
 const publication={contextId:id(900),seatingReceiptId:id(901),seatingPublicationId:id(902),scheduleReceiptId:id(903),schedulePublicationId:id(904),sourceMethod:'native_mixed_simulation_v1',assignmentCount:18,roundCount:12,matchCount:108};
 const expected={attendance:input.attendance,planInput:p.localInput,plan:{planId:id(800),sourceDigest:'1'.repeat(64),config:clone(input.config)},draw:{drawId:id(801),sourceDigest:'2'.repeat(64),candidate:c},review:{reviewId:id(802),sourceDigest:'3'.repeat(64),decision:'accepted-test-simulation-only'},publication};
 const fixedAssignments=c.assignments.map((x,i)=>({assignmentId:id(1000+i),rosterEntryId:x.participantId,participantId:input.attendance.expected.roster.find(r=>r.rosterEntryId===x.participantId).participantId,fixedId:x.tournamentId}));
 const participant=roster=>fixedAssignments.find(x=>x.rosterEntryId===roster).participantId;
 const value={status:'source_available',kind:'native-mixed-simulation-schedule-source-v1',actorId:id(1),tournamentId:id(2),eventId:id(3),attendance:{sealId:id(8),sourceDigest:'f'.repeat(64)},plan:clone(expected.plan),draw:clone(expected.draw),review:clone(expected.review),publication:clone(publication),fixedAssignments,
 canonicalGames:c.matches.map((m,i)=>({gameId:id(2000+i),importRowNumber:i+1,round:m.round,sideAParticipantId:participant(m.sides[0].participantId),sideBParticipantId:participant(m.sides[1].participantId),sideATableSeat:m.sides[0].seatId,sideBTableSeat:m.sides[1].seatId})),sourceDigest:'4'.repeat(64),simulationRosterProjected:true,nativeInitialSeatingPublished:true,nativeCanonicalSchedulePublished:true,
 ordinaryAttendanceUsed:false,ordinaryInitialSeatingWriterUsed:false,ordinaryScheduleWriterUsed:false,humanPresenceVerified:false,paymentVerified:false,moneyMoved:false,normalStartAuthorized:false,payoutAuthorized:false,finalizationAuthorized:false};
 return{value,expected};
}
