import test from 'node:test';
import assert from 'node:assert/strict';
import {nextOneTableSeat,projectOneTableMovement} from '../src/lib/seating/one-table-movement.ts';
import {buildFacingGeometry,planLocalRandomSeating} from '../src/lib/seating/local-random-plan.ts';
const clone=v=>JSON.parse(JSON.stringify(v));
function draw(seed=1,tableId='A'){
 const tables=[{tableId,seatCount:18}],config={tables,activePairIds:buildFacingGeometry(tables).pairs.map(p=>p.pairId)};
 const input={...config,source:{version:1,sha256:'a'.repeat(64)},registration:'closed',seating:'unpublished',existingTournamentIds:[],participants:Array.from({length:18},(_,i)=>({participantId:`anonymous-${i+1}`,stationaryPreference:'none'})),anchor:{participantId:null,seatId:`${tableId}-1`,directorApproved:true},stationaryDecisions:[],constraints:[]};
 let state=seed;const candidate=planLocalRandomSeating(input,n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%n;});assert.equal(candidate.status,'candidate');return {config,candidate};
}
test('independent physical seat oracle includes both ends and anchor bypass',()=>{
 const manualExpected=[1,3,5,2,7,4,9,6,11,8,13,10,15,12,17,14,18,16];
 assert.deepEqual(Array.from({length:18},(_,i)=>nextOneTableSeat(i+1)),manualExpected);
 assert.equal(new Set(manualExpected).size,18);
 for(const invalid of [0,19,1.5,NaN])assert.throws(()=>nextOneTableSeat(invalid));
});
test('multiple anonymous pure draws validate actual twelve-round movement without changing fixed IDs',()=>{
 for(let seed=1;seed<=25;seed++){
  const {config,candidate}=draw(seed,seed%2?'A':'Z'),before=JSON.stringify({config,candidate}),result=projectOneTableMovement(config,candidate);
  assert.equal(result.status,'verified');assert.equal(JSON.stringify({config,candidate}),before);assert.equal(result.rounds.length,12);assert.equal(result.physicalRoomVerified,false);assert.equal(result.publishable,false);
  const stable=new Map(candidate.assignments.map(a=>[a.participantId,a.tournamentId])),opponents=new Map([...stable.keys()].map(id=>[id,new Set()]));
  for(const round of result.rounds){assert.equal(round.players.length,18);assert.equal(new Set(round.players.map(p=>p.currentSeat)).size,18);
   for(const p of round.players){assert.equal(p.tournamentId,stable.get(p.participantId));assert.equal(p.opponentTournamentId,stable.get(p.opponentId));opponents.get(p.participantId).add(p.opponentId);if(round.round===12)assert.equal(p.movement,null);else assert(p.movement);}
  }
  assert([...opponents.values()].every(s=>s.size===12));
  const first=result.rounds[0].players;assert.equal(first[0].movement.kind,'stay');assert.equal(first[1].movement.kind,'anchor-bypass');assert.equal(first[16].movement.kind,'far-end');assert.equal(first[17].movement.kind,'advance');
 }
});
test('input ordering is irrelevant when actual transitions are coherent',()=>{
 const {config,candidate}=draw();config.activePairIds.reverse();candidate.matches.reverse();candidate.assignments.reverse();for(const m of candidate.matches)m.sides.reverse();
 assert.equal(projectOneTableMovement(config,candidate).status,'verified');
});
test('unsupported capacity, mixed tables, gaps and other anchors block rather than repair',()=>{
 const {config,candidate}=draw();
 for(const altered of [{...config,tables:[{tableId:'A',seatCount:20}]},{...config,tables:[{tableId:'A',seatCount:18},{tableId:'B',seatCount:2}]},{...config,activePairIds:[...config.activePairIds.slice(0,8),'A:19-20']},{...config,tables:[{tableId:'room',seatCount:18}]}])assert.equal(projectOneTableMovement(altered,candidate).status,'blocked');
 const alternate=clone(candidate);alternate.anchor.seatId='A-2';assert.equal(projectOneTableMovement(config,alternate).code,'unsupported_anchor');
 const wrongId=clone(candidate);wrongId.assignments[1].tournamentId='A-20';assert.equal(projectOneTableMovement(config,wrongId).code,'invalid_assignments');
});
test('independent transition mutation rejects even when each round still faces the same opponents',()=>{
 const {config,candidate}=draw(),mutated=clone(candidate),m=mutated.matches.find(m=>m.round===2&&m.pairId==='A:3-4');
 [m.sides[0].participantId,m.sides[1].participantId]=[m.sides[1].participantId,m.sides[0].participantId];
 assert.equal(projectOneTableMovement(config,mutated).code,'movement_mismatch');
 const wrongFixed=clone(candidate);[wrongFixed.assignments[3].tournamentId,wrongFixed.assignments[4].tournamentId]=[wrongFixed.assignments[4].tournamentId,wrongFixed.assignments[3].tournamentId];assert.equal(projectOneTableMovement(config,wrongFixed).code,'first_id_mismatch');
 const repeated=clone(candidate);const first=repeated.matches.filter(m=>m.round===1);repeated.matches=repeated.matches.filter(m=>m.round!==2).concat(first.map(m=>({...m,round:2})));assert.equal(projectOneTableMovement(config,repeated).code,'repeated_opponent');
});
test('read-only frozen candidate with extra operation metadata remains untouched; malformed rounds fail closed',()=>{
 const {config,candidate}=draw();candidate.operationId='same-operation';
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};freeze(config);freeze(candidate);
 assert.equal(projectOneTableMovement(config,candidate).status,'verified');assert.equal(candidate.operationId,'same-operation');
 for(const bad of [null,{...candidate,matches:candidate.matches.slice(1)},{...candidate,matches:candidate.matches.map((m,i)=>i===0?{...m,round:13}:m)},{...candidate,assignments:[]}])assert.equal(projectOneTableMovement(config,bad).status,'blocked');
});
