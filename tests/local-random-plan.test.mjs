import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFacingGeometry, shuffleWithRandomInt, validateLocalRandomPlanInput, planLocalRandomSeating } from '../src/lib/seating/local-random-plan.ts';

function input() {
  const tables = ['A','B','C','D','E'].map(tableId => ({ tableId, seatCount: 5 }));
  return { source:{version:3,sha256:'a'.repeat(64)}, registration:'closed',seating:'unpublished',existingTournamentIds:[],
    participants:Array.from({length:18},(_,i)=>({participantId:`p${i}`,stationaryPreference:'none'})), tables,
    activePairIds:buildFacingGeometry(tables).pairs.slice(0,9).map(p=>p.pairId),
    anchor:{participantId:'p7',seatId:'B-2',directorApproved:true},stationaryDecisions:[],constraints:[] };
}
test('odd physical chair counts expose unused seats, never incomplete opponents',()=>{
  const g=buildFacingGeometry([{tableId:'A',seatCount:5},{tableId:'B',seatCount:1}]);
  assert.deepEqual(g.pairs.map(p=>p.seats.map(s=>s.seat)),[[1,2],[3,4]]);
  assert.deepEqual(g.unpairedSeats.map(s=>s.seatId),['A-5','B-1']);
  assert.throws(()=>buildFacingGeometry([{tableId:'A',seatCount:21}]));
});
test('18 anonymous entrants have108 distinct matches and12 distinct opponents/card rounds',()=>{
  const source=input(), before=JSON.stringify(source), calls=[];
  const r=planLocalRandomSeating(source,n=>(calls.push(n),0));
  assert.equal(r.status,'candidate'); assert.equal(JSON.stringify(source),before);
  assert.equal(r.matches.length,108);assert.equal(calls.length,16); assert.equal(r.attempts,1);
  const unordered=new Set();
  for(const m of r.matches) unordered.add(m.sides.map(s=>s.participantId).sort().join('|'));
  assert.equal(unordered.size,108);
  for(const p of source.participants){
    const games=r.matches.filter(m=>m.sides.some(s=>s.participantId===p.participantId));
    assert.equal(games.length,12);assert.equal(new Set(games.map(m=>m.round)).size,12);
    assert.equal(new Set(games.flatMap(m=>m.sides.filter(s=>s.participantId!==p.participantId).map(s=>s.participantId))).size,12);
  }
  for(const m of r.matches.filter(m=>m.round===1))for(const s of m.sides)assert.equal(r.assignments.find(a=>a.participantId===s.participantId).tournamentId,s.seatId);
  assert(r.matches.every(m=>!m.sides.some(s=>s.participantId==='p7')||m.sides.find(s=>s.participantId==='p7').seatId==='B-2'));
  assert.equal(r.publishable,false);assert.equal(r.physicalReviewRequired,true);assert.equal(r.hashVerified,false);assert.equal(r.persistentAudit,false);
  source.source.version=9;assert.equal(r.source.version,3);assert.equal(r.inputSnapshot.source.version,3);
});
test('published/fixed IDs are read-only before RNG and never renumbered',()=>{
  for(const change of [{seating:'published'},{existingTournamentIds:['A-1']}])assert.equal(planLocalRandomSeating({...input(),...change},()=>{throw Error('must not draw');}).status,'readonly');
});
test('registration, unresolved anchor/preferences, incomplete pairs and unknown scopes block before RNG',()=>{
  const cases=[{registration:'open'},{anchor:{participantId:'p7',seatId:'A-5',directorApproved:true}},
    {anchor:{participantId:'p7',seatId:'A-1',directorApproved:false}},
    {participants:input().participants.map((p,i)=>i===1?{...p,stationaryPreference:'requested'}:p)},
    {activePairIds:[...input().activePairIds.slice(0,8),'A:5-6']},
    {constraints:[{kind:'all-human-pairs',verified:true}]}, {maxAttempts:257}];
  for(const c of cases)assert.equal(planLocalRandomSeating({...input(),...c},()=>{throw Error('must not draw');}).status,'blocked');
  const x=input();x.participants[7].stationaryPreference='requested';x.stationaryDecisions=[{participantId:'p7',decision:'selected-anchor'}];assert.deepEqual(validateLocalRandomPlanInput(x),[]);
});
test('Fisher-Yates validates each injected random integer and leaves inputs intact',()=>{
  const a=[1,2,3,4];assert.deepEqual(shuffleWithRandomInt(a,()=>0),[2,3,4,1]);assert.deepEqual(a,[1,2,3,4]);
  for(const value of [-1,4,0.5,NaN,Infinity])assert.throws(()=>shuffleWithRandomInt(a,()=>value));
});
test('only explicit verified pair-round constraints trigger bounded redraw; exhaustion is not impossible',()=>{
  const x=input(), baseline=planLocalRandomSeating(x,()=>0);assert.equal(baseline.status,'candidate');
  const m=baseline.matches[0];x.constraints=[{kind:'avoid-pair-in-round',participantIds:m.sides.map(s=>s.participantId),round:2,verified:true,sourceReference:'director-confirmed-avoidance'}];
  assert.equal(planLocalRandomSeating(x,()=>0).status,'candidate');
  x.constraints[0].round=1;x.maxAttempts=2;let calls=0;
  const r=planLocalRandomSeating(x,()=>{calls++;return 0;});assert.equal(r.status,'blocked');assert.equal(r.attempts,2);assert.equal(calls,32);assert.match(r.reasons[0],/infeasibility is not established/);
  x.constraints.push({...x.constraints[0]});calls=0;assert.equal(planLocalRandomSeating(x,()=>{calls++;return 0;}).attempts,0);assert.equal(calls,0);
});
test('avoidance permits repeated exclusions across rounds but detects all opponents forbidden',()=>{
  const x=input();
  const c={kind:'avoid-pair-in-round',participantIds:['p0','p1'],round:1,verified:true,sourceReference:'explicit-director-verification'};
  x.constraints=[c,{...c,round:2}];assert.deepEqual(validateLocalRandomPlanInput(x),[]);
  x.constraints=Array.from({length:17},(_,i)=>({...c,participantIds:['p0',`p${i+1}`]}));
  let calls=0;const r=planLocalRandomSeating(x,()=>{calls++;return 0;});
  assert.equal(r.status,'blocked');assert.match(r.reasons.join(),/no permitted opponent/);assert.equal(calls,0);
  x.constraints=[{...c,kind:'verified-pair-in-round'}];assert.match(validateLocalRandomPlanInput(x).join(),/Unknown/);
});
test('blind anchor draws all18 and transparently identifies random fixed-slot occupant',()=>{
  const x=input();x.anchor.participantId=null;const calls=[];
  const r=planLocalRandomSeating(x,n=>(calls.push(n),0));
  assert.equal(r.status,'candidate');assert.deepEqual(calls,Array.from({length:17},(_,i)=>18-i));
  assert.deepEqual(r.anchor,{seatId:'B-2',participantId:'p1',selection:'blind-draw'});
  assert(r.matches.every(m=>!m.sides.some(s=>s.participantId===r.anchor.participantId)||m.sides.find(s=>s.participantId===r.anchor.participantId).seatId==='B-2'));
  const pinned=planLocalRandomSeating(input(),()=>0);assert.equal(pinned.anchor.selection,'approved-person');assert.equal(pinned.anchor.participantId,'p7');
  x.participants[0].stationaryPreference='requested';assert.equal(planLocalRandomSeating(x,()=>{throw Error('no draw');}).status,'blocked');
  x.stationaryDecisions=[{participantId:'p0',decision:'not-accommodated'}];assert.equal(planLocalRandomSeating(x,()=>0).status,'candidate');
  x.seating='published';assert.equal(planLocalRandomSeating(x,()=>{throw Error('no draw');}).status,'readonly');
  assert.throws(()=>buildFacingGeometry([{tableId:'Room-A',seatCount:4}]));
});
test('Fisher-Yates exhaustive small draw paths are equally distributed; blind18 accepts every first random prefix',()=>{
  const permutations=new Set(),occupants=new Map();
  for(let a=0;a<3;a++)for(let b=0;b<2;b++){
    const choices=[a,b];const p=shuffleWithRandomInt(['x','y','z'],()=>choices.shift());
    permutations.add(p.join());occupants.set(p[0],(occupants.get(p[0])??0)+1);
  }
  assert.equal(permutations.size,6);assert.deepEqual([...occupants.values()],[2,2,2]);
  for(let prefix=0;prefix<18;prefix++){
    const x=input();x.anchor.participantId=null;let first=true;
    const r=planLocalRandomSeating(x,n=>{assert(n>=2);if(first){first=false;assert.equal(n,18);return prefix;}return n-1;});
    assert.equal(r.status,'candidate');assert.equal(new Set(r.assignments.map(a=>a.participantId)).size,18);
  }
});
