import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{readSelectedStepPlayerViewV3,readSelectedStepPendingV3}from'../src/lib/playoffs/selected-step-player-v3.ts';
import{SelectedStepPlayerControllerV3}from'../src/lib/playoffs/selected-step-player-controller-v3.ts';
import{scope,playerView,id}from'./helpers/selected-step-player-view-fixture-v3.mjs';
function setup(){const values=new Map(),sent=[];let view=playerView(),online=true,readFail=false,delay=null,response=null;
 const storage={read:k=>values.get(k)??null,retain(k,expected,next,archive){assert.equal(values.get(k)??null,expected);if(archive){if(values.has(archive.key))assert.equal(values.get(archive.key),archive.raw);values.set(archive.key,archive.raw);}if(next===null)values.delete(k);else values.set(k,next);}};
 const port={read:async()=>{if(delay)await delay;if(readFail)throw Error('offline');return structuredClone(view);},send:async p=>{sent.push(structuredClone(p));if(response)return response;throw Error('lost_reply');},check:async()=>response??{authorized:true,result:null}};
 let serial=100;const c=new SelectedStepPlayerControllerV3(scope,storage,port,()=>true,()=>online);
 return{c,values,sent,makeId:()=>id(serial++),setView:v=>view=v,setOnline:v=>online=v,setFail:v=>readFail=v,setDelay:v=>delay=v,setResponse:v=>response=v};}
test('strict view rejects private/opponent fields, mismatched generation, false paper verification and inconsistent progress',()=>{
 assert(readSelectedStepPlayerViewV3(playerView(),scope));for(const change of[v=>v.opponentWinner=id(10),v=>v.generationId=id(99),v=>v.paperVerificationClaimed=true,v=>v.wins=[2,2],v=>v.gameNumber=2,v=>v.ownConfirmed=true,v=>v.sourceCapture={}]){const v=playerView();change(v);assert.equal(readSelectedStepPlayerViewV3(v,scope),null);}
 const v=playerView();v.gameId=id(30);v.gameVersion=2;v.ownSubmission={submissionId:id(31),winnerParticipantId:id(10)};v.ownConfirmed=true;assert(readSelectedStepPlayerViewV3(v,scope));
});
test('explicit retain then send; lost response and reload preserve exact request without automatic resubmission',async()=>{
 const t=setup();t.c.setActive(true);await t.c.initialize();t.c.select(id(10));await t.c.prepare('submit',t.makeId);assert.equal(t.sent.length,0);const p=t.c.getSnapshot().pending,raw=t.values.get(t.c.key);assert(p);await t.c.resolve();assert.equal(t.sent.length,1);assert.equal(t.values.get(t.c.key),raw);assert.deepEqual(t.sent[0],p);
 await t.c.initialize();assert.equal(t.sent.length,1);assert.deepEqual(t.c.getSnapshot().pending,p);assert(readSelectedStepPendingV3(JSON.parse(raw),scope));
});
test('fresh source, connectivity and active identity are required before new action retention',async()=>{
 const t=setup();t.c.setActive(true);await t.c.initialize();t.c.select(id(10));t.setOnline(false);await t.c.prepare('submit',t.makeId);assert.equal(t.values.size,0);
 t.setOnline(true);const changed=playerView();changed.gameId=id(33);changed.gameVersion=1;changed.opponentSubmitted=true;t.setView(changed);await t.c.prepare('submit',t.makeId);assert.equal(t.values.size,0);assert.equal(t.c.getSnapshot().selection,null);
 t.c.select(id(10));let release;t.setDelay(new Promise(r=>release=r));const saving=t.c.prepare('submit',t.makeId);t.c.setActive(false);release();await saving;assert.equal(t.values.size,0);assert.equal(t.c.getSnapshot().view,null);
});
test('known bound acceptance archives before pending removal, then requires a fresh read for game state',async()=>{
 const t=setup();t.c.setActive(true);await t.c.initialize();t.c.select(id(10));await t.c.prepare('submit',t.makeId);const p=t.c.getSnapshot().pending,r=p.request;
 t.setResponse({status:'playoff_series_game_action_saved_v1',actorId:scope.actorId,tournamentId:scope.tournamentId,eventId:scope.eventId,qualificationId:scope.qualificationId,slot:scope.slot,operationId:r.operationId,request:r,generationId:scope.generationId,gameId:r.gameId,gameNumber:1,gameVersion:1,action:'submit',verifiedGameId:null,completedResultId:null});
 const v=playerView();v.gameId=r.gameId;v.gameVersion=1;v.ownSubmission={submissionId:r.submissionId,winnerParticipantId:id(10)};t.setView(v);await t.c.resolve();assert.equal(t.c.getSnapshot().pending,null);assert.equal(t.values.has(t.c.key),false);assert.equal([...t.values.keys()].filter(k=>k.includes(':archive:')).length,1);assert.equal(t.c.getSnapshot().view.ownConfirmed,false);
});
test('unknown retained bytes and changed scopes block new work; current source failure keeps known pending recoverable',async()=>{
 const t=setup();t.values.set(t.c.key,'unrecognized retained work');t.c.setActive(true);await t.c.initialize();assert(t.c.getSnapshot().blocked);t.c.select(id(10));await t.c.prepare('submit',t.makeId);assert.equal(t.values.get(t.c.key),'unrecognized retained work');
 const x=setup();x.c.setActive(true);await x.c.initialize();x.c.select(id(10));await x.c.prepare('submit',x.makeId);const original=x.values.get(x.c.key);x.setFail(true);await x.c.initialize();assert(x.c.getSnapshot().pending);assert.equal(x.c.getSnapshot().blocked,false);await x.c.resolve(true);assert.equal(x.values.get(x.c.key),original);
});
test('production paths use coordinated recovery, normal auth/same-origin gates, and no source/identity impersonation',()=>{
 const ui=fs.readFileSync('src/components/selected-step-player-entry-v3.tsx','utf8'),route=fs.readFileSync('src/app/api/v1/tournaments/[id]/playoff-games/[eventId]/[generationId]/route.ts','utf8');
 assert(ui.includes('transitionAppRecoveryItem(window.sessionStorage'));assert(!ui.includes('sessionStorage.setItem'));assert(!ui.includes('sessionStorage.removeItem'));assert(ui.includes('PlayoffSeriesEntryV1'));assert(ui.includes('navigator.onLine'));assert(ui.includes('controller.getSnapshot()===state'));
 for(const s of ['isSameOriginRequest','requireVerifiedIdentity(normal)','after.sessionId!==before.sessionId','readSelectedStepPlayerViewV3','readSeriesGameWireReceiptV1','selectedStepPlayerWritesVerifiedV3','cache-control'])assert(route.includes(s),s);
 assert(!route.includes('createServerOnlyAdminClient'));assert(!route.includes('get_playoff_series_match_source'));const sql=fs.readFileSync('database/proposals/selected-step-player-transport-v3.sql','utf8');assert(sql.includes('select false'));assert(!/grant execute|insert into|update app\./i.test(sql));
});
