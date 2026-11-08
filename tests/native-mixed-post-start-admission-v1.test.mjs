import test from 'node:test';import assert from 'node:assert/strict';
import{observeNativeMixedPostStartAdmissionV1 as observe}from'../src/lib/seating/native-mixed-post-start-admission-v1.ts';
import{nativeMixedPublishedModelExample}from'./helpers/native-mixed-published-model-example.mjs';
import{mixedExampleId as id}from'./helpers/native-mixed-readiness-example.mjs';
import{startReceipt,startRequest}from'./helpers/native-mixed-simulation-start-example.mjs';
const checker=id(700),reviewer=id(701),outcome={winnerSide:'a',margin:40};
function sample(index=0){
 const schedule=nativeMixedPublishedModelExample();schedule.expected.attendance.expected.officials.push({profileId:checker,roles:['cross_checker']},{profileId:reviewer,roles:['cross_checker']});
 const v=schedule.value,scope={actorId:v.actorId,tournamentId:v.tournamentId,eventId:v.eventId};
 const request={...structuredClone(startRequest),expectedContextId:v.publication.contextId,expectedScheduleSourceDigest:v.sourceDigest,expectedAttendanceSourceDigest:v.attendance.sourceDigest};
 const receipt={...startReceipt(),...scope,request,contextId:v.publication.contextId,startId:id(990)};
 const start={value:{kind:'native-mixed-simulation-start-source-v1',...scope,receipt,currentSourceVerified:true,normalStartAuthorized:false,scoringAuthorized:false},expected:{scope,request,startId:receipt.startId}};
 const game=v.canonicalGames[index];const input={start,schedule,gameId:game.gameId,actor:{profileId:checker,subjectId:checker},
 history:{kind:'native-mixed-simulation-game-history-v1',status:'known',tournamentId:scope.tournamentId,eventId:scope.eventId,startId:receipt.startId,gameId:game.gameId,startSourceDigest:receipt.sourceDigest,revision:0,entries:[]},
 ordinaryState:{status:'observed',tournamentId:scope.tournamentId,eventId:scope.eventId,startId:receipt.startId,gameId:game.gameId,canonicalState:'pending',allCanonicalGamesPending:true,ordinaryScoreHistory:{checker:'app.native_mixed_admission_score_history_empty_v1',empty:true},ordinaryStartCount:0,ordinaryRosterCheckInCount:0,ordinaryEventCheckInCount:0,ordinaryCheckInWindowCount:0,ordinaryCheckInRequestCount:0,ordinaryParticipantStatusCount:0}};
 const roster=schedule.expected.attendance.expected.roster;const people=[game.sideAParticipantId,game.sideBParticipantId].map((p,i)=>({...roster.find(r=>r.participantId===p),side:i===0?'a':'b'}));let seq=0;
 const base=actorId=>({id:id(5000+(++seq)*3),operationId:id(5001+seq*3),receiptId:id(5002+seq*3),payloadDigest:'e'.repeat(64),sequence:seq,actorId,tournamentId:scope.tournamentId,eventId:scope.eventId,startId:receipt.startId,gameId:game.gameId,startSourceDigest:receipt.sourceDigest});
 const add=e=>{input.history.entries.push(e);input.history.revision=input.history.entries.length;return e;};
 const submit=(p,result=outcome)=>add({...base(p.profileId),action:'digital-submit',participantId:p.participantId,result:structuredClone(result),statement:'simulation-own-result-v1'});
 const capture=(actor=checker)=>add({...base(actor),action:'paper-capture',artifactId:id(850),artifactDigest:'d'.repeat(64),claims:people.filter(p=>p.mode==='paper').map(p=>({side:p.side,result:structuredClone(outcome)})),physicalOriginal:false,fictionalOpponentPlayed:false,independentHumanPlayClaimed:false,statement:'fictional-paper-capture-v1'});
 const review=(actor=reviewer)=>{const c=input.history.entries.find(e=>e.action==='paper-capture');return add({...base(actor),action:'paper-review',captureId:c.id,artifactId:c.artifactId,artifactDigest:c.artifactDigest,reenteredClaims:structuredClone(c.claims),decision:'accepted-simulation-only',statement:'fictional-paper-review-v1'});};
 const confirm=p=>add({...base(p.profileId),action:'digital-confirm',participantId:p.participantId,result:structuredClone(outcome),references:input.history.entries.filter(e=>['digital-submit','paper-capture','paper-review'].includes(e.action)).map(e=>e.id),statement:'simulation-own-confirmation-v1'});
 const as=actor=>{input.actor={profileId:actor,subjectId:actor};return observe(input);};
 return{input,people,submit,capture,review,confirm,as,add,base};
}
function pairingOf(i){return i.people.filter(p=>p.mode==='digital').length===2?'DD':i.people.some(p=>p.mode==='digital')?'PD':'PP';}
const examples={};for(let n=0;n<108&&Object.keys(examples).length<3;n++){const h=sample(n);examples[pairingOf(h)]??=n;}

test('all 108 actual modeled pairings retain fixed IDs and require pairing-specific independent evidence',()=>{
 const counts={DD:0,PD:0,PP:0};for(let n=0;n<108;n++){const h=sample(n),kind=pairingOf(h);counts[kind]++;const digital=h.people.filter(p=>p.mode==='digital');
  for(const p of digital)h.submit(p);if(kind!=='DD'){h.capture();h.review();}for(const p of digital)h.confirm(p);
  const result=observe(h.input);assert.equal(result.status,'simulation-game-admission-observation');assert.equal(result.pairing,kind);assert.equal(result.phase,'simulation-evidence-complete');assert.deepEqual(result.simulatedResult,outcome);assert.equal(result.sides.length,2);
  for(const side of result.sides){const pinned=h.input.schedule.value.fixedAssignments.find(p=>p.participantId===side.participantId);assert.equal(side.fixedTournamentId,pinned.fixedId);assert(!Object.hasOwn(side,'profileId'));}
  for(const flag of ['databaseProvenanceVerified','identitySubjectVerified','writeAuthorized','normalStartAuthorized','scoringAuthorized','officialResultVerified','humanPlayVerified','physicalOriginalVerified','moneyMoved','payoutAuthorized'])assert.equal(result[flag],false);
 }assert.equal(counts.DD+counts.PD+counts.PP,108);for(const count of Object.values(counts))assert(count>0);
});
test('DD requires two own submissions and two exact confirmations, never one acknowledgement per side',()=>{
 const h=sample(examples.DD),[a,b]=h.people;assert.deepEqual(h.as(a.profileId).suggestedActions,['digital-submit']);h.submit(a);assert.equal(h.as(a.profileId).phase,'awaiting-evidence');
 h.submit(b);assert.deepEqual(h.as(a.profileId).suggestedActions,['digital-confirm']);h.confirm(a);assert.equal(h.as(b.profileId).phase,'awaiting-confirmation');h.confirm(b);assert.equal(observe(h.input).phase,'simulation-evidence-complete');
 const early=sample(examples.DD);early.submit(early.people[0]);early.confirm(early.people[0]);assert.equal(observe(early.input).status,'blocked');
 const swapped=sample(examples.DD);const entry=swapped.submit(swapped.people[0]);entry.actorId=swapped.people[1].profileId;assert.equal(observe(swapped.input).status,'blocked');
});
test('PD requires own submission/confirmation plus fictional capture and independent nonself review',()=>{
 const h=sample(examples.PD),digital=h.people.find(p=>p.mode==='digital');h.submit(digital);h.capture();assert(!h.as(digital.profileId).suggestedActions.includes('paper-review'));h.review();assert.deepEqual(h.as(digital.profileId).suggestedActions,['digital-confirm']);h.confirm(digital);assert.equal(observe(h.input).phase,'simulation-evidence-complete');
 const self=sample(examples.PD);self.capture();self.review(checker);assert.equal(observe(self.input).status,'blocked');
 const own=sample(examples.PD),p=own.people.find(p=>p.mode==='digital');if(!own.input.schedule.expected.attendance.expected.officials.some(o=>o.profileId===p.profileId))own.input.schedule.expected.attendance.expected.officials.push({profileId:p.profileId,roles:['cross_checker']});own.capture(p.profileId);assert.equal(observe(own.input).code,'fictional_paper_capture_required');
});
test('PP needs both side claims and separate review; an official playing elsewhere may review',()=>{
 const h=sample(examples.PP);h.capture();assert.deepEqual(h.as(reviewer).suggestedActions,['paper-review']);h.review();assert.equal(observe(h.input).phase,'simulation-evidence-complete');
 const missing=sample(examples.PP);missing.capture().claims.pop();assert.equal(observe(missing.input).status,'blocked');
 const physical=sample(examples.PP);physical.capture().physicalOriginal=true;assert.equal(observe(physical.input).status,'blocked');
 const elsewhere=sample(examples.PP),official=elsewhere.input.schedule.expected.attendance.expected.roster.find(r=>r.mode==='digital').profileId;if(!elsewhere.input.schedule.expected.attendance.expected.officials.some(o=>o.profileId===official))elsewhere.input.schedule.expected.attendance.expected.officials.push({profileId:official,roles:['cross_checker']});elsewhere.capture();elsewhere.review(official);assert.equal(observe(elsewhere.input).phase,'simulation-evidence-complete');
});
test('mismatches stop for reviewed correction and cannot be overwritten by a later result',()=>{
 const h=sample(examples.DD);h.submit(h.people[0]);h.submit(h.people[1],{winnerSide:'b',margin:15});const mismatch=observe(h.input);assert.equal(mismatch.phase,'mismatch-needs-review');assert.equal(mismatch.simulatedResult,null);assert.deepEqual(mismatch.suggestedActions,[]);
 h.submit(h.people[1]);assert.equal(observe(h.input).status,'blocked');
 const pp=sample(examples.PP);const c=pp.capture();c.claims[1].result.margin=42;assert.equal(observe(pp.input).phase,'mismatch-needs-review');pp.review();assert.equal(observe(pp.input).status,'blocked');
});
test('revocation, stale Start/publication, changed graph or any ordinary state fail closed',()=>{
 const changes=[h=>h.input.schedule.expected.attendance.expected.latestConsents[0].decision='revoked',h=>h.input.start.value.receipt.historicalReceipt=true,
 h=>h.input.start.value.receipt.contextId=id(991),h=>h.input.schedule.value.sourceDigest='f'.repeat(64),h=>h.input.schedule.value.canonicalGames[0].sideATableSeat='A-19',
 h=>h.input.ordinaryState.ordinaryStartCount=1,h=>h.input.ordinaryState.ordinaryScoreHistory.empty=false,h=>h.input.ordinaryState.ordinaryScoreHistory.checker='partial-score-count',h=>h.input.ordinaryState.canonicalState='verified',h=>h.input.ordinaryState.allCanonicalGamesPending=false,
 h=>h.input.ordinaryState.gameId=id(991),h=>h.input.actor.subjectId=id(991)];
 for(const change of changes){const h=sample();change(h);assert.equal(observe(h.input).status,'blocked');}
});
test('unknown history is not zero, borrowed evidence and unsupported producers never gain authority',()=>{
 for(const value of [null,undefined,{status:'unavailable'},{kind:'native-mixed-simulation-game-history-v1',status:'known'}]){const h=sample();h.input.history=value;assert.equal(observe(h.input).status,'blocked');}
 const changes=[e=>e.gameId=id(991),e=>e.startId=id(991),e=>e.sequence=2,e=>e.payloadDigest='bad',e=>e.action='score_submissions',e=>e.normalStartAuthorized=true];
 for(const change of changes){const h=sample(examples.DD),e=h.submit(h.people[0]);change(e);assert.equal(observe(h.input).status,'blocked');}
 const refs=sample(examples.DD);refs.people.forEach(p=>refs.submit(p));refs.confirm(refs.people[0]).references=[id(991)];assert.equal(observe(refs.input).status,'blocked');
});

test('per-game review preserves Director/co-director roles without changing capture policy',()=>{
 for(const role of ['director','co_director']){const h=sample(examples.PP),actor=id(role==='director'?1:702);if(role==='co_director')h.input.schedule.expected.attendance.expected.officials.push({profileId:actor,roles:[role]});
  assert(!h.as(actor).suggestedActions.includes('paper-capture'));h.capture();assert.deepEqual(h.as(actor).suggestedActions,['paper-review']);h.review(actor);assert.equal(observe(h.input).phase,'simulation-evidence-complete');}
 const human=sample(examples.PP);human.capture().independentHumanPlayClaimed=true;assert.equal(observe(human.input).code,'fictional_paper_capture_required');
});
