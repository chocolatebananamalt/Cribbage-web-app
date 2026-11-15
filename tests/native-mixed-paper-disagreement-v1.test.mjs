import test from'node:test';import assert from'node:assert/strict';
import{nativeMixedPaperScreenExample as example}from'./helpers/native-mixed-paper-screen-example.mjs';
import{screenId as id}from'./helpers/native-mixed-digital-screen-example.mjs';
import{projectNativeMixedPaperEntryV1 as paper,buildNativeMixedPaperEntryRequestV1 as build}from'../src/lib/seating/native-mixed-paper-entry-view-v1.ts';
import{projectNativeMixedDigitalEntryV1 as digital,buildNativeMixedDigitalEntryRequestV1 as digitalRequest}from'../src/lib/seating/native-mixed-digital-entry-view-v1.ts';
import{isNativeMixedGameWriteRequestV1 as valid,readNativeMixedGameStateV1 as readState,readNativeMixedGameOutcomeV1 as outcome}from'../src/lib/seating/native-mixed-game-evidence-v1.ts';
import{NativeMixedGamePendingControllerV1 as Controller}from'../src/lib/seating/native-mixed-game-pending-v1.ts';
const reviewer=x=>{x.binding.target.actorId=id(51);x.state.actorId=id(51);x.binding.official.roles=['co_director'];};
const ownBinding=x=>{const{actorRef:profileId,...person}=x.binding.sideB,{actorRef:otherId,...other}=x.binding.sideA;assert.equal(otherId,null);return{target:{...x.binding.target,actorId:profileId},tournamentName:x.binding.tournamentName,eventName:x.binding.eventName,gameNumber:x.binding.gameNumber,ownSide:'b',player:{...person,profileId},opponent:{...other,profileId:null}};};
test('consistent PP capture retains different independent re-entry as a disputed review, never approval',()=>{
 const x=example();x.capture();reviewer(x);const original=structuredClone(x.state.entries[0]);
 const claims=x.claims();claims[0].result.margin=41;const r=build(x.binding,x.state,id(71),null,claims);
 assert(valid(r));assert.equal(r.payload.decision,'disputed-simulation-only');assert.deepEqual(r.payload.reenteredClaims,claims);assert.deepEqual(x.state.entries[0],original);
 const e=x.review();e.decision=r.payload.decision;e.reenteredClaims=structuredClone(claims);
 assert(readState(x.state,x.binding.target));assert.equal(paper(x.binding,x.state).phase,'mismatch');assert.equal(build(x.binding,x.state,id(72),null,x.claims()),null);
});
test('disagreement preserves capture binding, all sides and nonself independence; forged decisions fail closed',()=>{
 for(const pairing of['PP','PD']){
  const x=example(pairing);x.capture();reviewer(x);assert.equal(build(x.binding,x.state,id(71),null,x.claims()).payload.decision,'accepted-simulation-only');
  const changed=x.claims();changed[0].result.winnerSide='a';const r=build(x.binding,x.state,id(71),null,changed);assert.equal(r.payload.decision,'disputed-simulation-only');
  assert.equal(build(x.binding,x.state,id(71),null,[{side:'z',result:x.result}]),null);
  const e=x.review();e.reenteredClaims=changed;assert.equal(paper(x.binding,x.state),null,'disagreement cannot claim accepted');e.decision='disputed-simulation-only';assert.equal(paper(x.binding,x.state).phase,'mismatch');
  for(const mutate of[e=>e.reenteredClaims=x.claims(),e=>e.captureId=id(999),e=>e.artifactDigest='b'.repeat(64),e=>e.actorId=id(50)]){const old=structuredClone(e);mutate(e);assert.equal(paper(x.binding,x.state),null);Object.assign(e,old);}
 }
});
test('PD disputed re-entry blocks own confirmation without manufacturing a verified result',()=>{
 const x=example('PD');x.capture();x.submit();reviewer(x);const r=x.review();r.decision='disputed-simulation-only';r.reenteredClaims[0].result.margin=41;
 const b=ownBinding(x),state={...structuredClone(x.state),actorId:b.target.actorId,playOrder:'current'};
 const v=digital(b,state);assert.equal(v.phase,'mismatch');assert.deepEqual(v.references,[]);assert.equal(digitalRequest(b,state,'digital-confirm',id(71),x.result),null);
});
test('blind current DP review reports only a block, never capture values or an offered submission',()=>{
 const x=example('PD'),b=ownBinding(x);const state={...structuredClone(x.state),actorId:b.target.actorId,revision:2,playOrder:'review',evidenceVisibility:'metadata-only',entries:[]};
 const v=digital(b,state);assert.equal(v.phase,'mismatch');assert.equal(v.ownResult,null);assert.deepEqual(v.references,[]);assert.deepEqual(v.state.entries,[]);
 for(const action of['digital-submit','digital-confirm'])assert.equal(digitalRequest(b,state,action,id(71),x.result),null);
 assert.equal(digital(b,{...state,playOrder:'upcoming'}).phase,'upcoming');for(const revision of[0,1,3,4])assert.equal(digital(b,{...state,revision}),null);assert.equal(digital(b,{...state,evidenceVisibility:'evidence'}),null);
});
test('closed disagreement mode retains an exact retry without clearing or silently resending',async()=>{
 const x=example();x.capture();reviewer(x);const claims=x.claims();claims[0].result.margin=41;const request=build(x.binding,x.state,id(71),null,claims),reply={status:'retry_exact',code:'paper_disagreement_unavailable'};
 assert(outcome(reply,x.binding.target,request));assert.equal(outcome(reply,x.binding.target,build(x.binding,x.state,id(71),null,x.claims())),null);
 const rows=new Map(),archives=new Map(),calls=[],retained={read:async k=>rows.get(k)??null,transition:async(k,old,next,archive,signal)=>{if(signal?.aborted||(rows.get(k)??null)!==old)return false;if(archive)archives.set(archive.id,archive.raw);next===null?rows.delete(k):rows.set(k,next);return true;}};
 const options={target:x.binding.target,ownParticipantId:null,enabled:()=>true,online:()=>true,retained,transport:{write:async(_t,r)=>{calls.push(structuredClone(r));return{data:reply,error:null};},recover:async()=>({data:null,error:null})}};
 const first=new Controller(options);await first.initialize();assert(await first.save(request,x.state));await first.sendExact();assert.equal(first.getSnapshot().pending.phase,'retryable');assert.match(first.getSnapshot().message,/not enabled/);assert.equal(rows.size,1);assert.equal(archives.size,0);first.dispose();
 const second=new Controller(options);await second.initialize();assert.equal(calls.length,1);await second.checkOutcome();assert.equal(rows.size,1);assert.equal(second.getSnapshot().pending.phase,'retryable');await second.sendExact();assert.equal(calls.length,2);assert.deepEqual(calls,[request,request]);assert.equal(archives.size,0);
});
