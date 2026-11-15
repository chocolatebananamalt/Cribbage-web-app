import assert from 'node:assert/strict';
import test from 'node:test';
import {prepareNativeMixedSeatingV1 as prepare,drawNativeMixedSeatingCandidateV1 as draw} from '../src/lib/seating/native-mixed-seating-plan-v1.ts';
import {nativeMixedReadinessExample,mixedExampleId as id} from './helpers/native-mixed-readiness-example.mjs';
function sample(){return{attendance:nativeMixedReadinessExample(),
 lifecycle:{tournamentId:id(2),eventId:id(3),tournamentStatus:'open',registrationStatus:'closed',operationalState:'active',eventType:'main',format:'standard_singles',gameCount:12,participantCount:18,hasStarted:false,hasDraw:false,seatingPublicationId:null,schedulePublicationId:null,existingTournamentIds:[]},
 config:{tables:[{tableId:'A',seatCount:18}],activePairIds:Array.from({length:9},(_,i)=>`A:${i*2+1}-${i*2+2}`),anchor:{participantId:null,seatId:'A-1',directorApproved:true},stationaryRequests:[],stationaryDecisions:[],constraints:[],maxAttempts:8}};}
const rng=seed=>n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}; // deterministic test sampling, not cryptographic entropy
function assertGraph(candidate){
 assert.equal(candidate.matches.length,108);assert.equal(candidate.assignments.length,18);
 const fixed=new Map(candidate.assignments.map(a=>[a.participantId,a.tournamentId]));
 const opponents=new Map([...fixed.keys()].map(p=>[p,new Set()]));const pairs=new Set();
 for(let round=1;round<=12;round++){
  const games=candidate.matches.filter(m=>m.round===round);assert.equal(games.length,9);
  assert.equal(new Set(games.flatMap(g=>g.sides.map(s=>s.participantId))).size,18);
  for(const g of games){const[a,b]=g.sides;const key=[a.participantId,b.participantId].sort().join(':');assert.ok(!pairs.has(key));pairs.add(key);
   opponents.get(a.participantId).add(b.participantId);opponents.get(b.participantId).add(a.participantId);
   if(round===1){assert.equal(fixed.get(a.participantId),a.seatId);assert.equal(fixed.get(b.participantId),b.seatId);}
   for(const s of g.sides)if(s.participantId===candidate.anchor.participantId)assert.equal(s.seatId,'A-1');
  }
 }
 assert.equal(pairs.size,108);for(const o of opponents.values())assert.equal(o.size,12);
}
test('simulated readiness feeds the existing 18-circle planner without ordinary check-in or publication',()=>{
 const input=sample(), p=prepare(input);assert.equal(p.status,'prepared-not-authorized');
 assert.equal(p.rosterProjection.filter(r=>r.state==='sim_ready').length,18);assert.equal(p.rosterProjection.filter(r=>r.fictional).length,12);
 assert.ok(p.rosterProjection.every(r=>r.physicalPresenceVerified===false));assert.equal(p.localInput.source.sha256,input.attendance.value.sourceDigest);
 assert.deepEqual(p.localInput.participants.map(r=>r.participantId),input.attendance.expected.roster.map(r=>r.rosterEntryId));
 for(let seed=1;seed<=24;seed++){
  const result=draw(sample(),rng(seed));assert.equal(result.status,'local-candidate-not-authorized');assertGraph(result.candidate);
  for(const key of ['rngCryptographicallyVerified','databaseSourceVerified','ordinaryCheckInUsed','normalDrawAuthorized','nativePublicationAuthorized','schedulePublicationAuthorized','normalStartAuthorized','physicalRoomVerified'])assert.equal(result[key],false,key);
  assert.equal(result.candidate.hashVerified,false);assert.equal(result.candidate.publishable,false);assert.equal(result.candidate.persistentAudit,false);
 }
 p.localInput.anchor.seatId='bad';assert.equal(input.config.anchor.seatId,'A-1');
});
test('revoked/stale consent and lifecycle block before any RNG call',()=>{
 const changes=[x=>x.attendance.expected.latestConsents[0].decision='revoked',x=>x.attendance.value.scope.fundingSourceDigest='0'.repeat(64),
  x=>x.lifecycle.registrationStatus='open',x=>x.lifecycle.tournamentStatus='draft',x=>x.lifecycle.operationalState='retired',
  x=>x.lifecycle.hasStarted=true,x=>x.lifecycle.eventId=id(999),x=>x.lifecycle.gameCount=6,x=>x.lifecycle.participantCount=17];
 let calls=0;for(const change of changes){const x=sample();change(x);assert.equal(draw(x,n=>{calls++;return n-1;}).status,'blocked');}
 assert.equal(calls,0);
});
test('retained draw, fixed Tournament IDs and existing schedule are readonly without a silent redraw',()=>{
 let calls=0;for(const change of [x=>x.lifecycle.hasDraw=true,x=>x.lifecycle.existingTournamentIds=['A-1'],x=>x.lifecycle.seatingPublicationId=id(800),x=>x.lifecycle.schedulePublicationId=id(801)]){
  const x=sample();change(x);assert.deepEqual(draw(x,n=>{calls++;return n-1;}),{status:'readonly',code:'existing_draw_or_fixed_ids_immutable'});
 }assert.equal(calls,0);
});
test('explicit stationary requests, anchor decisions and verified constraints are preserved',()=>{
 const input=sample();input.config.anchor.participantId=id(100);input.config.stationaryRequests=[id(100),id(101)];
 input.config.stationaryDecisions=[{participantId:id(100),decision:'selected-anchor'},{participantId:id(101),decision:'not-accommodated'}];
 const p=prepare(input);assert.equal(p.status,'prepared-not-authorized');assert.deepEqual(p.localInput.stationaryDecisions,input.config.stationaryDecisions);
 assert.equal(p.localInput.participants.filter(p=>p.stationaryPreference==='requested').length,2);
 const result=draw(input,rng(7));assert.equal(result.status,'local-candidate-not-authorized');assert.equal(result.candidate.anchor.participantId,id(100));assertGraph(result.candidate);
 const missing=sample();missing.config.stationaryRequests=[id(101)];assert.equal(prepare(missing).status,'blocked');
 const invalid=sample();invalid.config.constraints=[{kind:'avoid-pair-in-round',participantIds:[id(100),id(117)],round:1,verified:false,sourceReference:'fictional-unit-constraint'}];assert.equal(prepare(invalid).status,'blocked');
 const bounded=sample();bounded.config.maxAttempts=3;bounded.config.constraints=[{kind:'avoid-pair-in-round',participantIds:[id(100),id(117)],round:1,verified:true,sourceReference:'fictional-unit-constraint'}];
 let calls=0;assert.equal(draw(bounded,n=>{calls++;return n-1;}).status,'blocked');assert.equal(calls,3*17,'bounded failed samples; no infeasibility or redraw promise');
});
test('unsupported geometry, unknown config and RNG failure cannot acquire native authority',()=>{
 const changes=[x=>x.config.tables[0].seatCount=20,x=>x.config.tables[0].tableId='B',x=>x.config.anchor.seatId='A-2',
  x=>x.config.anchor.directorApproved=false,x=>x.config.stationaryRequests=[id(999)],x=>x.config.activePairIds.reverse(),
  x=>x.config.ignoreConsent=true,x=>x.config.anchor.ignoreRequests=true,x=>x.config.maxAttempts=257,
  x=>x.config.stationaryDecisions=[{participantId:id(100),decision:'not-accommodated',extra:true}],
  x=>x.config.constraints=[{kind:'avoid-pair-in-round',participantIds:[id(100),id(117)],round:1,verified:true,sourceReference:'x'.repeat(501)}]];
 let calls=0;for(const change of changes){const x=sample();change(x);assert.equal(draw(x,n=>{calls++;return n-1;}).status,'blocked');}assert.equal(calls,0);
 assert.equal(draw(sample(),()=>-1).status,'blocked');
});
test('observed consent/config mutation during local sampling blocks the result',()=>{
 const x=sample();let changed=false;
 const out=draw(x,n=>{if(!changed){x.attendance.expected.latestConsents[0].decision='revoked';changed=true;}return n-1;});
 assert.deepEqual(out,{status:'blocked',code:'simulation_plan_source_changed'});
});
