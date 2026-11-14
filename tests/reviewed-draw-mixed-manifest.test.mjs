// Pure supplied-model examples; no draw, publication, game record or DB fixture.
import test from'node:test';import assert from'node:assert/strict';
import {example,id,stamp}from'./helpers/reviewed-schedule-example.mjs';
import {prepareReviewedDrawSchedule}from'../src/lib/seating/reviewed-draw-schedule.ts';
import {prepareReviewedDrawMixedManifest as prepare,createReviewedDrawMixedManifestReader}from'../src/lib/seating/reviewed-draw-mixed-manifest.ts';
import {buildMixedMockManifest,tallyMixedMock}from'../src/lib/mixed-mock-plan.ts';
function input(){
 const draw=example(),plan=prepareReviewedDrawSchedule(draw);assert.equal(plan.status,'prepared-not-authorized');
 const publishedWorkspace=structuredClone(draw.eventWorkspace),e=publishedWorkspace.events[0];
 Object.assign(e,{schedulePublished:true,schedulePublicationId:id(5000),participantSnapshotDigest:'e'.repeat(64),publishedMatchCount:108,playState:'in_progress',startedAt:stamp,startedBy:'Fictional Director'});
 publishedWorkspace.matches=plan.matches.map((m,i)=>({...m,eventId:draw.eventId,canonicalGameId:id(6000+i),sideADisplayName:'Fictional name',sideBDisplayName:'Fictional name',state:'pending'}));
 const status=structuredClone(draw.eventStatusWorkspace);status.events[0].playState='in_progress';
 const life=structuredClone(draw.eventLifecycleWorkspace);life.events[0].hasStarted=true;
 return{draw,publishedWorkspace,nativeWorkspace:structuredClone(draw.nativeWorkspace),eventStatusWorkspace:status,eventLifecycleWorkspace:life,loadedScope:structuredClone(draw.loadedScope)};
}

test('reviewed one-table publication binds existing canonical UUIDs to a complete A-1..A-18 mixed manifest',()=>{
 const x=input(),before=structuredClone(x),r=prepare(x);assert.equal(r.status,'prepared-not-authorized');assert.deepEqual(x,before);
 assert.equal(r.manifest.participants.length,18);assert.equal(r.manifest.matches.length,108);
 assert.deepEqual(r.manifest.matches.map(g=>g.gameId),x.publishedWorkspace.matches.map(g=>g.canonicalGameId));
 assert.deepEqual(new Set(r.manifest.participants.map(p=>p.tournamentPlayerId)),new Set(Array.from({length:18},(_,i)=>'A-'+(i+1))));
 assert.equal(r.manifest.participants.filter(p=>p.mode==='digital').length,6);
 assert.equal(r.enrollmentAuthorized,false);assert.equal(r.financeWriteAuthorized,false);assert.equal(r.normalStartReceiptVerified,false);assert.equal(r.physicalMovementCertified,false);
 assert.equal(r.sourceObservation,'provided-models-not-atomic');
 const tally=tallyMixedMock(r.manifest,r.manifest.matches.map(g=>({gameId:g.gameId,winnerParticipantId:g.sideA.participantId,spreadPoints:20,
  evidence:g.pairing==='digital-digital'?'observed-digital-play':g.pairing==='paper-digital'?'scripted-mixed':'scripted-paper'})));
 assert.ok(tally.every(p=>p.recordedGames===12));assert.equal(tally.reduce((n,p)=>n+p.gamePoints,0),216);assert.equal(tally.reduce((n,p)=>n+p.netSpreadPoints,0),0);
});

test('planner accepts only the complete native domain, not mixed/partial/foreign physical identifiers',()=>{
 const r=prepare(input());assert.equal(r.status,'prepared-not-authorized');
 for(const change of[m=>m.participants[17].tournamentPlayerId='B-2',m=>m.participants[17].tournamentPlayerId='A-19',m=>m.participants[17].tournamentPlayerId='A-17',m=>m.matches[100].sideA.currentSeat='B-1',m=>m.matches[0].sideA.currentSeat='A-18']){
  const m=structuredClone(r.manifest);change(m);assert.throws(()=>buildMixedMockManifest(m.participants,m.matches));
 }
});

test('a candidate or prepared schedule never stands in for a published/started canonical source',()=>{
 for(const change of[x=>x.publishedWorkspace=structuredClone(x.draw.eventWorkspace),x=>x.publishedWorkspace.events[0].playState='ready_to_start',x=>x.publishedWorkspace.events[0].startedAt=null,x=>x.publishedWorkspace.events[0].schedulePublicationId=null,x=>x.publishedWorkspace.events[0].participantSnapshotDigest=null,x=>x.publishedWorkspace.matches[0].canonicalGameId='',x=>x.publishedWorkspace.matches[1].canonicalGameId=x.publishedWorkspace.matches[0].canonicalGameId,x=>x.publishedWorkspace.matches[0].state='verified']){
  const x=input();change(x);assert.equal(prepare(x).status,'blocked');
 }
});

test('native IDs, roster modes, event identities and review scope remain exact after publication',()=>{
 for(const change of[x=>x.loadedScope.actorId=id(999),x=>x.loadedScope.eventId=id(999),x=>x.nativeWorkspace.publication.publicationId=id(999),x=>x.nativeWorkspace.publication.assignments[0].verificationId='A-18',x=>x.nativeWorkspace.checkIn[0].state='withdrawn',x=>x.nativeWorkspace.checkIn.pop(),x=>x.nativeWorkspace.checkIn[1].rosterEntryId=x.nativeWorkspace.checkIn[0].rosterEntryId,x=>x.publishedWorkspace.participants[0].participantId=id(999),x=>x.publishedWorkspace.participants[0].profileLinked=!x.publishedWorkspace.participants[0].profileLinked,x=>x.eventStatusWorkspace.events[0].participants[0].status='absent',x=>x.eventStatusWorkspace.events[0].eventId=id(999),x=>x.publishedWorkspace.matches[0].eventId=id(999),x=>x.eventLifecycleWorkspace.events[0].operationalState='retired',x=>x.eventLifecycleWorkspace.events[0].hasStarted=false,x=>x.publishedWorkspace.matches[107].sideATableSeat='A-1']){
  const x=input();change(x);assert.equal(prepare(x).status,'blocked');
 }
});

test('schedule ordering is irrelevant; supplied valid UUIDs/digests are not claimed as database provenance',()=>{
 const extra=input();extra.nativeWorkspace.checkIn.push({...extra.nativeWorkspace.checkIn[0],rosterEntryId:id(999),state:'withdrawn'});assert.equal(prepare(extra).status,'blocked');
 const x=input();x.publishedWorkspace.matches.reverse();const r=prepare(x);assert.equal(r.status,'prepared-not-authorized');
 x.publishedWorkspace.matches[0].canonicalGameId=id(999);x.publishedWorkspace.events[0].participantSnapshotDigest='f'.repeat(64);
 const supplied=prepare(x);assert.equal(supplied.status,'prepared-not-authorized');
 assert.equal(supplied.normalStartReceiptVerified,false);assert.equal(supplied.enrollmentAuthorized,false);
 // Only a backend FK/Start re-read can detect a UUID or digest borrowed from
 // another source. This DTO projection must never be treated as that proof.
});

test('private reader denies roles before reads and observes changed source/identity without a lease claim',async()=>{
 const x=input(),{actorId,tournamentId,eventId}=x.loadedScope,op=x.draw.operation.operationId;let reads=0;
 const denied=createReviewedDrawMixedManifestReader({access:async()=>({actorId,roles:['player']}),models:async()=>{reads++;return x;}});
 assert.equal((await denied(tournamentId,eventId,op)).code,'existing_read_permission_required');assert.equal(reads,0);
 let access=0;const revoked=createReviewedDrawMixedManifestReader({access:async()=>++access===1?{actorId,roles:['director']}:null,models:async()=>{reads++;return x;}});
 assert.equal((await revoked(tournamentId,eventId,op)).status,'blocked');assert.equal(reads,1);
 reads=0;const shared=input(),drift=createReviewedDrawMixedManifestReader({access:async()=>({actorId,roles:['director']}),models:async()=>{if(reads++)shared.publishedWorkspace.events[0].participantSnapshotDigest='f'.repeat(64);return shared;}});
 assert.equal((await drift(tournamentId,eventId,op)).code,'observed_source_changed');
 const ready=createReviewedDrawMixedManifestReader({access:async()=>({actorId,roles:['co_director']}),models:async()=>input()});
 const r=await ready(tournamentId,eventId,op);assert.equal(r.status,'prepared-not-authorized');assert.equal(r.sourceObservation,'matching-double-read-not-atomic');assert.equal(r.enrollmentAuthorized,false);
 const foreign=createReviewedDrawMixedManifestReader({access:async()=>({actorId,roles:['director']}),models:async()=>input()});
 assert.equal((await foreign(tournamentId,eventId,id(999))).code,'loader_scope_mismatch');
});

test('the supported 18-seat movement retains all three pairings for every six-Digital placement',()=>{
 const candidate=example().operation.request.reviewedCandidate,ids=candidate.assignments.map(a=>a.participantId);
 const edges=candidate.matches.map(m=>m.sides.map(s=>ids.indexOf(s.participantId)));
 let min=100,max=0,checked=0;
 for(let a=0;a<13;a++)for(let b=a+1;b<14;b++)for(let c=b+1;c<15;c++)for(let d=c+1;d<16;d++)for(let e=d+1;e<17;e++)for(let f=e+1;f<18;f++){
  const digital=new Set([a,b,c,d,e,f]);const dd=edges.filter(([x,y])=>digital.has(x)&&digital.has(y)).length;
  const pd=72-2*dd,pp=108-dd-pd;assert.ok(dd>0&&pd>0&&pp>0);
  min=Math.min(min,dd);max=Math.max(max,dd);checked++;
 }
 assert.equal(checked,18564);assert.equal(min,4);assert.equal(max,15);
 // Graph proof only. It neither executes RNG nor selects human positions,
 // certifies a room layout, or guarantees every real-person pairing.
});
