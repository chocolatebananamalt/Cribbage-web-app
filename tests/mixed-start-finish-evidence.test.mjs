// Fabricated DTO/unit tests only: no database, actual Start or human evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {eighteenFixture}from'./eighteen-qualifying-local-acceptance.mjs';
import {buildMixedMockManifest}from'../src/lib/mixed-mock-plan.ts';
import {assertMixedNormalStartEvidence,captureMixedNormalStartEvidence}from'./mixed-normal-start-evidence.mjs';
import {assertMixedQualifyingFinishEvidence,captureMixedQualifyingFinishEvidence}from'./mixed-qualifying-finish-evidence.mjs';
const id=n=>`0da10000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(){
 const f=eighteenFixture(),scope={actor:id(900),tid:id(901),eid:id(902)};
 const participants=Array.from({length:18},(_,i)=>({participantId:id(i+1),tournamentPlayerId:f.seat(i+1),mode:i<6?'digital':'paper',profileId:i<6?id(30+i):null,status:'checked_in'}));
 const lookup=seat=>participants.find(p=>p.tournamentPlayerId===seat).participantId;
 const manifest=buildMixedMockManifest(participants,f.matches.map((m,i)=>({gameId:id(100+i),batchNumber:m.gameNumber,
  sideA:{participantId:lookup(m.sideAVerificationId),currentSeat:m.sideATableSeat,cardGameNumber:m.gameNumber},
  sideB:{participantId:lookup(m.sideBVerificationId),currentSeat:m.sideBTableSeat,cardGameNumber:m.gameNumber}})));
 const start={id:id(903),tournament_id:scope.tid,event_id:scope.eid,start_source:'official',started_by_profile_id:scope.actor,
  schedule_publication_id:id(904),participant_count:18,game_count:12,schedule_match_count:108,
  participant_snapshot_digest:'a'.repeat(64),operation_receipt_id:id(905)};
 const response={status:'event_started',eventId:scope.eid,startId:start.id,participantCount:18,gameCount:12,scheduleMatchCount:108,playState:'in_progress'};
 const value={startCount:1,sanctionCount:1,start,schedule:{id:id(904),tournament_id:scope.tid,event_id:scope.eid,participant_count:18,game_count:12,match_count:108},
  receipt:{id:id(905),operation_type:'start_event_play_v1',outcome:'accepted',actor_profile_id:scope.actor,tournament_id:scope.tid,target_id:start.id,client_operation_id:id(906),response_payload:response},
  sanction:{event_play_start_id:start.id,tournament_id:scope.tid,event_id:scope.eid,event_kind:'main',eligible_participant_count:18,rate_cents:300,total_cents:5400},
  currentParticipantDigest:'a'.repeat(64),receiptHashValid:true,matchingAuditCount:1,participants,
  games:manifest.matches.map(g=>({gameId:g.gameId,state:'pending',winnerSide:null,margin:null})),scoreActivityCount:0};
 const normalStart={capture:value,proof:assertMixedNormalStartEvidence(value,scope)};
 let receipt=1000;
 const provenance=[];
 const games=manifest.matches.map(g=>{
  const own=g.sideA.participantId,other=g.sideB.participantId;
  const pairing=g.pairing==='digital-digital'?'DD':g.pairing==='paper-paper'?'PP':'PD';
  if(pairing!=='DD'){
   const officials=participants.filter(p=>p.mode==='digital'&&![own,other].includes(p.participantId));
   for(const[phase,p]of[['capture',officials[0]],['review',officials[1]]])provenance.push({gameId:g.gameId,pairing,phase,actorId:p.profileId,artifactId:id(2000+Number(g.gameId.slice(-12))),receiptId:id(receipt++),receiptAccepted:true,nativeBinding:true,physicalOriginal:false,fictionalOpponentPlayed:false,independentHumanPlayClaimed:false});
  }
  return{gameId:g.gameId,sideAId:own,sideBId:other,state:'verified',scorelines:2,submissions:pairing==='DD'?2:pairing==='PD'?1:0,confirmations:pairing==='DD'?2:0,syntheticArtifactCount:pairing==='DD'?0:1};
 });
 return{scope,value,manifest,normalStart,finish:{startId:start.id,schedulePublicationId:start.schedule_publication_id,participants:structuredClone(participants),games,provenance}};
}

test('normal Start evidence requires an accepted exact receipt/audit and automatic count-bound snapshot',()=>{
 const{value,scope}=fixture();const p=assertMixedNormalStartEvidence(value,scope);
 assert.equal(p.normalStartReceiptVerified,true);assert.equal(p.automaticAssessmentBound,true);assert.equal(p.providerVerified,false);
 for(const change of[v=>v.receipt.operation_type='fixture_seed',v=>v.receipt.target_id=id(999),v=>v.receiptHashValid=false,v=>v.matchingAuditCount=0,v=>v.start.start_source='legacy_scoring_backfill',v=>v.startCount=2,v=>v.sanction.total_cents=5300,v=>v.sanction.event_play_start_id=id(999),v=>v.sanction.eligible_participant_count=17,v=>v.currentParticipantDigest='b'.repeat(64),v=>v.scoreActivityCount=1,v=>v.games[0].state='verified']){
  const bad=structuredClone(value);change(bad);assert.throws(()=>assertMixedNormalStartEvidence(bad,scope));
 }
});

test('Start capture only reads rows and exactly replays the existing public Start operation',()=>{
 const{value,scope}=fixture(),queries=[];
 const read=q=>{queries.push(q);return queries.length===1?value:queries.length===2?value.receipt.response_payload:{starts:1,snapshots:1};};
 const result=captureMixedNormalStartEvidence(read,scope);assert.equal(result.proof.exactReplay,true);
 assert.equal(queries.length,3);assert.match(queries[1],/public\.start_event_play_v1/);assert.ok(queries[1].includes(value.receipt.client_operation_id));
 assert.ok(queries.every(q=>!/(?:insert into|update app\.|delete from|create |alter |drop )/i.test(q)));
 assert.throws(()=>captureMixedNormalStartEvidence(()=>{throw Error('must not query');},{...scope,eid:"x';delete"}));
 const responses=[value,{status:'event_started',startId:id(999)}];assert.throws(()=>captureMixedNormalStartEvidence(()=>responses.shift(),scope));
});

test('complete mixed qualifying binds fixed IDs to Start and distinct nonself synthetic review on every PP/PD game',()=>{
 const f=fixture(),p=assertMixedQualifyingFinishEvidence(f.finish,f.manifest,f.normalStart);
 assert.equal(p.verifiedMatches,108);assert.equal(p.scorelines,216);assert.equal(p.distinctNonselfReview,true);
 assert.equal(p.qualificationFinalized,false);assert.equal(p.actualHumanSessions,false);
 for(const change of[v=>v.participants[0].tournamentPlayerId='Z-9',v=>v.participants[0].profileId=id(999),v=>v.startId=id(999),v=>v.games[0].state='pending',v=>v.games[0].scorelines=1,v=>v.provenance[0].physicalOriginal=true,v=>v.provenance[0].independentHumanPlayClaimed=true,v=>v.provenance[0].receiptAccepted=false,v=>v.provenance[0].nativeBinding=false,v=>v.provenance.pop(),v=>v.provenance[1].actorId=v.provenance[0].actorId,v=>v.provenance[1].artifactId=id(999),v=>v.provenance[1].receiptId=v.provenance[0].receiptId]){
  const bad=structuredClone(f.finish);change(bad);assert.throws(()=>assertMixedQualifyingFinishEvidence(bad,f.manifest,f.normalStart));
 }
 const mixed=f.finish.games.find(g=>g.submissions===1),bad=structuredClone(f.finish);
 const actor=f.finish.participants.find(p=>[mixed.sideAId,mixed.sideBId].includes(p.participantId)&&p.profileId).profileId;
 bad.provenance.find(p=>p.gameId===mixed.gameId&&p.phase==='review').actorId=actor;
 assert.throws(()=>assertMixedQualifyingFinishEvidence(bad,f.manifest,f.normalStart),/No participant/);
});

test('qualifying readback issues no completion or qualification write and refuses another scope',()=>{
 const f=fixture(),queries=[];
 const result=captureMixedQualifyingFinishEvidence(q=>{queries.push(q);return f.finish;},f.scope,f.manifest,f.normalStart);
 assert.equal(result.proof.distinctNonselfReview,true);assert.equal(queries.length,1);
 assert.match(queries[0],/synthetic_mixed_provenance_v1/);
 assert.ok(!/(?:insert into|update app\.|delete from|create |alter |drop )/i.test(queries[0]));
 assert.throws(()=>captureMixedQualifyingFinishEvidence(()=>{throw Error('must not query');},{...f.scope,eid:id(999)},f.manifest,f.normalStart));
});
