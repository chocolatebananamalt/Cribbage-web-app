import assert from 'node:assert/strict';
import test from 'node:test';
import {prepareNativeMixedSeatingV1,drawNativeMixedSeatingCandidateV1} from '../src/lib/seating/native-mixed-seating-plan-v1.ts';
import {observeNativeMixedPublishedScheduleV1 as observe} from '../src/lib/seating/native-mixed-published-schedule-v1.ts';
import {nativeMixedReadinessExample,mixedExampleId as id} from './helpers/native-mixed-readiness-example.mjs';
const clone=v=>structuredClone(v);
function sample(withRequests=false){
 const input={attendance:nativeMixedReadinessExample(),lifecycle:{tournamentId:id(2),eventId:id(3),tournamentStatus:'open',registrationStatus:'closed',operationalState:'active',eventType:'main',format:'standard_singles',gameCount:12,participantCount:18,hasStarted:false,hasDraw:false,seatingPublicationId:null,schedulePublicationId:null,existingTournamentIds:[]},
 config:{tables:[{tableId:'A',seatCount:18}],activePairIds:Array.from({length:9},(_,i)=>`A:${i*2+1}-${i*2+2}`),anchor:{participantId:withRequests?id(100):null,seatId:'A-1',directorApproved:true},stationaryRequests:withRequests?[id(101),id(100)]:[],stationaryDecisions:withRequests?[{participantId:id(100),decision:'selected-anchor'},{participantId:id(101),decision:'not-accommodated'}]:[],constraints:[],maxAttempts:8}};
 const p=prepareNativeMixedSeatingV1(input),d=drawNativeMixedSeatingCandidateV1(input,n=>n-1);
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
const blocked=x=>assert.equal(x.status,'blocked');
test('private test source maps 18 fixed IDs and 108 supplied game UUIDs without claiming DB proof or Start',()=>{
 const {value,expected}=sample();const out=observe(value,expected);assert.equal(out.status,'simulation-schedule-observation');
 assert.equal(out.fixedAssignments.length,18);assert.equal(out.canonicalGames.length,108);assert.equal(out.nativePublicationClaimed,true);
 for(const k of ['databaseProvenanceVerified','ordinaryAttendanceUsed','humanPresenceVerified','paymentVerified','moneyMoved','normalStartAuthorized','publicationWriteAuthorized','payoutAuthorized','physicalRoomVerified'])assert.equal(out[k],false,k);
 assert.equal(out.publication.sourceMethod,'native_mixed_simulation_v1');assert.equal(out.sourceObservation,'provided-models-not-atomic');
 out.fixedAssignments[0].fixedId='wrong';assert.notEqual(value.fixedAssignments[0].fixedId,'wrong');
 const shuffled=clone(value);shuffled.fixedAssignments.reverse();shuffled.canonicalGames.reverse();assert.equal(observe(shuffled,expected).canonicalGames[0].importRowNumber,1);
 const reorderedRequests=sample(true);assert.equal(observe(reorderedRequests.value,reorderedRequests.expected).status,'simulation-schedule-observation');
});
test('current revocation, wrong scope, changed review and ordinary source methods never acquire test authority',()=>{
 const changes=[x=>x.actorId=id(999),x=>x.eventId=id(999),x=>x.attendance.sealId=id(999),x=>x.plan.sourceDigest='0'.repeat(64),x=>x.draw.drawId=id(999),x=>x.review.decision='approved-physical-attendance',
  x=>x.publication.seatingPublicationId=id(999),x=>x.publication.scheduleReceiptId=x.publication.seatingReceiptId,x=>x.publication.sourceMethod='director_entry',x=>x.publication.matchCount=107];
 for(const flag of ['ordinaryAttendanceUsed','ordinaryInitialSeatingWriterUsed','ordinaryScheduleWriterUsed','humanPresenceVerified','paymentVerified','moneyMoved','normalStartAuthorized','payoutAuthorized','finalizationAuthorized'])changes.push(x=>x[flag]=true);
 for(const change of changes){const {value,expected}=sample();change(value);blocked(observe(value,expected));}
 const revoked=sample();revoked.expected.attendance.expected.latestConsents[0].decision='revoked';blocked(observe(revoked.value,revoked.expected));
 const missing=sample();blocked(observe({status:'pending'},missing.expected));
});
test('missing, duplicate or relabeled fixed assignments are rejected while UUID namespaces remain separate',()=>{
 const changes=[x=>x.fixedAssignments.pop(),x=>x.fixedAssignments[1]=clone(x.fixedAssignments[0]),x=>x.fixedAssignments[0].fixedId='A-19',x=>x.fixedAssignments[0].participantId=id(999),x=>x.fixedAssignments[0].rosterEntryId=id(999),x=>x.fixedAssignments[0].assignmentId='bad'];
 for(const change of changes){const {value,expected}=sample();change(value);blocked(observe(value,expected));}
});
test('canonical graph must match each supplied UUID slot, participant side, round and physical seat',()=>{
 const changes=[x=>x.canonicalGames.pop(),x=>x.canonicalGames[1].gameId=x.canonicalGames[0].gameId,x=>x.canonicalGames[1].importRowNumber=1,x=>x.canonicalGames[0].round=12,
  x=>x.canonicalGames[0].sideATableSeat='A-3',x=>x.canonicalGames[0].sideAParticipantId=id(999),x=>x.canonicalGames[0].importRowNumber=109,x=>x.canonicalGames[0].gameId='bad'];
 for(const change of changes){const {value,expected}=sample();change(value);blocked(observe(value,expected));}
 const borrowed=sample();borrowed.value.canonicalGames[0].gameId=id(999);const result=observe(borrowed.value,borrowed.expected);
 assert.equal(result.status,'simulation-schedule-observation');assert.equal(result.databaseProvenanceVerified,false,'DTO shape cannot establish foreign game ownership');
});
test('retained draw cannot evade anchor, graph, participant, family or stationary constraints',()=>{
 const changes=[e=>e.draw.candidate.anchor.participantId=id(999),e=>e.draw.candidate.matches[0].sides.reverse(),e=>e.draw.candidate.assignments[0].participantId=id(999),e=>e.draw.candidate.physicalReviewRequired=false,
  e=>e.draw.candidate.assignments[0].logicalSlot=99,e=>e.planInput.participants[0].stationaryPreference='requested'];
 for(const change of changes){const {value,expected}=sample();change(expected);value.plan=clone(expected.plan);value.draw=clone(expected.draw);blocked(observe(value,expected));}
 const rule=sample();const m=rule.expected.draw.candidate.matches[0];const constraint={kind:'avoid-pair-in-round',participantIds:m.sides.map(s=>s.participantId),round:1,verified:true,sourceReference:'fictional-unit-constraint'};
 rule.expected.planInput.constraints=[constraint];rule.expected.plan.config.constraints=[clone(constraint)];rule.value.plan=clone(rule.expected.plan);blocked(observe(rule.value,rule.expected));
});
