import test from 'node:test';import assert from 'node:assert/strict';
import{createPrivateResultsView}from'../src/lib/results/private-results-view.ts';
import{projectPlayerPlayoff}from'../src/lib/results/player-playoff-display.ts';
import{projectRunningPoolReadModels}from'../src/lib/results/pool-running-read-model.ts';
import{poolReadExample,id,tid,eid,stamp}from'./helpers/pool-running-read-examples.mjs';
const scope={tournamentId:tid,eventId:eid,mode:'main-v4',audience:'existing-official'},access={actorId:id(777),roles:['director']};
function bracket(){const input={kind:'player-playoff-display-input-v2',tournamentId:tid,eventId:eid,qualificationVersionId:id(902),sourceDigest:'a'.repeat(64),sourceCurrent:true,qualificationReviewed:true,tiesResolved:true,eventType:'main',entrantCount:18,qualifierCount:5,players:Array.from({length:5},(_,i)=>({participantId:id(i+1),displayName:`Fictional Qualifier ${i+1}`,tournamentId:`A-${i+1}`,seed:i+1})),results:[]};return{status:'available',input,display:projectPlayerPlayoff(input),origin:'synthetic-event',notice:'PRIVATE source note',sourceObservation:'matching-double-read-not-atomic',publicAccessGranted:false,independentPlayEstablished:false};}
function pools(){return{...projectRunningPoolReadModels(tid,eid,poolReadExample(),stamp),sourceObservation:'matching-double-read-not-atomic'};}
const deps=()=>({access:async()=>access,bracket:async()=>bracket(),pools:async()=>pools()});
test('player and public audiences never invoke identity or private readers',async()=>{
 let reads=0;const fail=async()=>{reads++;throw Error('must not read')},read=createPrivateResultsView({access:fail,bracket:fail,pools:fail});
 for(const audience of['player','public',undefined,'director'])assert.equal((await read({...scope,audience})).code,'audience_not_authorized');assert.equal(reads,0);
});
test('ordinary player, judge and cross-checker alone cannot inherit private-reader access',async()=>{
 for(const roles of[[],['player'],['judge'],['cross_checker']]){let reads=0;const d=deps();d.access=async()=>({...access,roles});d.bracket=async()=>{reads++;return bracket()};d.pools=async()=>{reads++;return pools()};assert.equal((await createPrivateResultsView(d)(scope)).code,'existing_read_permission_required');assert.equal(reads,0);}
});
test('official view owns only validated display/aggregate fields and makes no global freshness claim',async()=>{
 const b=bracket(),p=pools(),d=deps();d.bracket=async()=>b;d.pools=async()=>p;const r=await createPrivateResultsView(d)(scope);assert.equal(r.status,'available');assert.equal(r.bracket.status,'available');assert.equal(r.pools.status,'available');assert.equal(r.sourceObservation,'independent-section-reads-not-atomic');assert.equal(r.publicAccessGranted,false);assert.equal(r.playerAccessGranted,false);assert.doesNotMatch(JSON.stringify(r),/PRIVATE|consentReference|receiptId|rosterEntryId|evidenceNote/);assert(!Object.hasOwn(r.bracket,'input'));
 b.input.players[0].displayName='changed';p.pools[0].name='changed';assert.equal(r.bracket.display.players[0].displayName,'Fictional Qualifier 1');assert.notEqual(r.pools.workspace.pools[0].name,'changed');
 const co=deps();co.access=async()=>({...access,roles:['co_director']});assert.equal((await createPrivateResultsView(co)(scope)).status,'available');
});
test('role revocation, actor replacement and access errors discard all section data',async()=>{
 for(const next of[null,{...access,roles:['player']},{...access,actorId:id(778)}]){let n=0;const d=deps();d.access=async()=>++n===1?access:next;const r=await createPrivateResultsView(d)(scope);assert.deepEqual(r,{status:'blocked',code:'existing_read_permission_required'});}
 const d=deps();d.access=async()=>{throw Error('PRIVATE credential failure')};assert.equal((await createPrivateResultsView(d)(scope)).code,'existing_read_permission_required');
});
test('one unavailable section does not invent or erase the other section',async()=>{
 let d=deps();d.bracket=async()=>{throw Error('PRIVATE')};let r=await createPrivateResultsView(d)(scope);assert.equal(r.bracket.status,'unavailable');assert.equal(r.pools.status,'available');
 d=deps();d.pools=async()=>null;r=await createPrivateResultsView(d)(scope);assert.equal(r.bracket.status,'available');assert.deepEqual(r.pools,{status:'unavailable',code:'source_unavailable'});
});
test('cross-event, stale, unsupported and injected private data fail closed per section',async()=>{
 for(const mutate of[b=>b.input.eventId=id(999),b=>b.input.sourceCurrent=false,b=>b.input.qualifierCount=65,b=>b.input.players[0].email='PRIVATE',b=>b.sourceObservation='provided-models-not-atomic',b=>b.publicAccessGranted=true]){const d=deps(),b=bracket();mutate(b);d.bracket=async()=>b;assert.equal((await createPrivateResultsView(d)(scope)).bracket.status,'unavailable');}
 for(const mutate of[p=>p.eventId=id(999),p=>p.sourceObservation='observed-source-drift',p=>p.sourceObservation='provided-models-not-atomic',p=>p.pools[0].receiptId=id(9)]){const d=deps(),p=pools();mutate(p);d.pools=async()=>p;assert.equal((await createPrivateResultsView(d)(scope)).pools.status,'unavailable');}
});
test('dependency-supplied display and notice cannot override revalidated bracket input',async()=>{
 const d=deps(),b=bracket();b.display={PRIVATE:'private-model'};d.bracket=async()=>b;const r=await createPrivateResultsView(d)(scope);assert.equal(r.bracket.display.status,'available');assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
});
test('invalid request scope is rejected before private dependencies',async()=>{
 let n=0;const d={access:async()=>{n++;return access},bracket:async()=>{n++;return bracket()},pools:async()=>{n++;return pools()}};
 for(const s of[null,{...scope,eventId:'bad'},{...scope,tournamentId:tid.toUpperCase()},{...scope,mode:'unknown'}])assert.equal((await createPrivateResultsView(d)(s)).code,'invalid_scope');assert.equal(n,0);
});
