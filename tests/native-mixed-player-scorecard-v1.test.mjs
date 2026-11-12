import{readNativeMixedOwnBindingsV1}from'../src/lib/seating/native-mixed-digital-entry-view-v1.ts';
import{spawnSync}from'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';
import{projectNativeMixedPlayerCardV1 as project,loadNativeMixedPlayerCardV1 as load}from'../src/lib/seating/native-mixed-player-scorecard-v1.ts';
import{nativeMixedDigitalScreenExample as example,screenId as id}from'./helpers/native-mixed-digital-screen-example.mjs';
function cards(){return Array.from({length:12},(_,i)=>{const x=example(i%2?'paper':'digital');x.binding.gameNumber=i+1;x.binding.target.gameId=id(1000+i);x.state.gameId=x.binding.target.gameId;x.binding.opponent.participantId=id(2000+i);x.binding.opponent.fixedTournamentId='T-'+(20+i);if(x.binding.opponent.profileId)x.binding.opponent.profileId=id(3000+i);x.binding.player.currentSeat='A-'+(i+1);if(x.binding.player.currentSeat===x.binding.opponent.currentSeat)x.binding.opponent.currentSeat='B-1';x.submit();if(i%2){x.capture();x.review();}else x.submit(x.binding.opponent);x.confirm();if(i%2===0)x.confirm(x.binding.opponent);return x;});}
const make=()=>{const xs=cards();return{xs,bindings:xs.map(x=>x.binding),states:xs.map(x=>x.state)};};
test('own practice card counts only complete independent DD/PD evidence and preserves fixed IDs',()=>{
 const x=make(),c=project(x.bindings,x.states);assert(c);assert.equal(c.completedGames,12);assert.deepEqual(c.totals,{gamePoints:36,plus:480,minus:0,net:480});assert.equal(c.officialResultVerified,false);assert.equal(c.qualificationAuthorized,false);assert.equal(c.payoutAuthorized,false);assert.equal(c.rows[0].opponentTournamentId,'T-20');
});
test('missing, pending, mismatch and bad source never become completed zero scores',()=>{
 const x=make();x.states[0]=null;x.states[1].entries.pop();x.states[1].revision--;x.states[1].playOrder='current';x.states[2].startSourceDigest='b'.repeat(64);const c=project(x.bindings,x.states);assert.equal(c.completedGames,9);assert.equal(c.rows[0].status,'unavailable');assert.equal(c.rows[0].gamePoints,null);assert.equal(c.rows[1].status,'pending');assert.equal(c.allSourcesAvailable,false);
});
test('foreign actor/event/Start/player and repeated game/round/opponent reject entire projection',()=>{
 for(const mutate of [b=>b[1].target.actorId=id(99),b=>b[1].target.eventId=id(99),b=>b[1].target.startId=id(99),b=>b[1].player.fixedTournamentId='other',b=>b[1].target.gameId=b[0].target.gameId,b=>b[1].gameNumber=1,b=>b[1].opponent.participantId=b[0].opponent.participantId,b=>b[1].opponent.fixedTournamentId=b[0].opponent.fixedTournamentId]){const x=make();mutate(x.bindings);assert.equal(project(x.bindings,x.states),null);}
 const x=make();assert.equal(project(x.bindings.slice(1),x.states.slice(1)),null);
});
test('own transport loader fails closed on account change, preserves unavailable state, and is default off',async()=>{
 const x=make();let count=0,current=true;const transport={state:async t=>{const i=x.bindings.findIndex(b=>b.target.gameId===t.gameId);count++;return i===0?{data:null,error:'provider_unavailable'}:{data:x.states[i],error:null};}};
 assert.equal(await load({...x,transport,enabled:()=>false,current:()=>true}),null);assert.equal(count,0);
 const c=await load({...x,transport,enabled:()=>true,current:()=>true});assert.equal(c.completedGames,11);assert.equal(c.rows[0].status,'unavailable');
 const changed=await load({...x,transport:{state:async()=>{current=false;return{data:x.states[0],error:null};}},enabled:()=>true,current:()=>current});assert.equal(changed,null);
});

test('actual practice card React renders compact rows, separate total/net and no official claim',()=>{const r=spawnSync(process.execPath,['--experimental-strip-types','tests/helpers/render-native-mixed-player-scorecard.mjs'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);assert.match(r.stdout,/practice scorecard SSR passed/);});

test('provider metadata decoder binds own actor/session/Start and twelve distinct assigned games',()=>{
 const x=make(),t=x.bindings[0].target,v={kind:'native-mixed-own-player-bindings-v1',actorId:t.actorId,sessionId:t.sessionId,tournamentId:t.tournamentId,eventId:t.eventId,startId:t.startId,startSourceDigest:t.startSourceDigest,tournamentName:x.bindings[0].tournamentName,eventName:x.bindings[0].eventName,simulationOnly:true,bindings:x.bindings.map(b=>({gameId:b.target.gameId,gameNumber:b.gameNumber,ownSide:b.ownSide,player:b.player,opponent:{...b.opponent,profileId:null}}))};
 assert.equal(readNativeMixedOwnBindingsV1(v,t).length,12);for(const patch of [{actorId:id(99)},{sessionId:id(99)},{startSourceDigest:'b'.repeat(64)},{extra:true}])assert.equal(readNativeMixedOwnBindingsV1({...v,...patch},t),null);
 const duplicate=structuredClone(v);duplicate.bindings[1].gameId=duplicate.bindings[0].gameId;assert.equal(readNativeMixedOwnBindingsV1(duplicate,t),null);assert.equal(readNativeMixedOwnBindingsV1({...v,bindings:v.bindings.slice(1)},t),null);
});

test('card exposes exactly one authoritative current game, fails closed on contradictions, none after finish',()=>{
 const x=make();assert.equal(project(x.bindings,x.states).currentGameId,null);
 function pending(i,order){x.states[i].entries=[];x.states[i].revision=0;x.states[i].evidenceVisibility='metadata-only';x.states[i].playOrder=order;}
 pending(0,'current');pending(1,'upcoming');assert.equal(project(x.bindings,x.states).currentGameId,x.bindings[0].target.gameId);assert.equal(project(x.bindings,x.states).rows[1].status,'upcoming');pending(1,'current');assert.equal(project(x.bindings,x.states),null);pending(0,'upcoming');pending(1,'upcoming');assert.equal(project(x.bindings,x.states),null);
});
