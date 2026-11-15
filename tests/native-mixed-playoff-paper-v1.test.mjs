import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{readPlayoffPaperWorkspaceV1 as read,buildPlayoffPaperRequestV1 as build}from'../src/lib/playoffs/native-mixed-playoff-paper-v1.ts';
const id=n=>`aaaa0000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash='a'.repeat(64),token='b'.repeat(64);
const target={actorId:id(1),sessionId:id(2),projectUrl:'https://test.supabase.co',projectRef:'test',tournamentId:id(3),eventId:id(4),contextId:id(5),slot:1,gameNumber:2};
function fixture(mode='review',pp=false){const{projectUrl,projectRef,...scope}=target;void projectUrl;void projectRef;return{kind:'native-mixed-playoff-paper-workspace-v1',...scope,sourceDigest:hash,matchDigest:hash,revision:mode==='review'?1:0,historyDigest:mode==='review'?token:hash,sideA:{participantId:id(6),tournamentIdNumber:'A-1',displayName:'Fictional A',mode:'paper'},sideB:{participantId:id(7),tournamentIdNumber:'B-1',displayName:'Fictional B',mode:pp?'paper':'digital'},phase:mode,capture:mode==='review'?{id:id(8),artifactId:id(9),artifactDigest:token}:null,ownEvidence:null,blockedCode:null,simulationOnly:true,ordinaryQualificationRecorded:false,mrpAwarded:false,moneyMoved:false};}
test('blind review contract admits only metadata and opaque equal head binding, never capture claims or authority',()=>{
 const w=fixture();assert(read(w,target));for(const mutate of[w=>w.capture.claims=[],w=>w.capture.artifactDigest=hash,w=>w.entries=[],w=>w.actorId=id(99),w=>w.sideA.profileId=id(1),w=>w.moneyMoved=true,w=>w.revision=-1]){const x=fixture();mutate(x);assert.equal(read(x,target),null);}
 const absent=fixture();absent.capture=null;assert.equal(read(absent,target),null);assert.equal(read(fixture('capture'),target)?.phase,'capture');
});
test('independent re-entry preserves its exact reading without deciding whether it agrees',()=>{
 for(const pp of[false,true])for(const winner of[id(6),id(7)]){const w=fixture('review',pp),values={[id(6)]:winner,...(pp?{[id(7)]:id(7)}:{})},r=build(w,values);assert(r);assert.equal(r.data.entry.statement,'fictional-playoff-blind-paper-review-v1');assert(!Object.hasOwn(r.data.entry,'decision'));assert.equal(r.data.expectedHistoryDigest,token);assert.equal(r.data.entry.artifactDigest,token);assert.equal(r.data.entry.reenteredClaims[0].winnerParticipantId,winner);assert.equal(r.data.contextId,target.contextId);assert(!Object.hasOwn(r.data,'startId'));values[id(6)]=id(99);assert.equal(r.data.entry.reenteredClaims[0].winnerParticipantId,winner);}
});
test('capture accepts different fictional card readings without fabricating agreement; every paper side is required',()=>{
 const w=fixture('capture',true),r=build(w,{[id(6)]:id(6),[id(7)]:id(7)},id(9));assert(r);assert.equal(r.data.entry.type,'paper-capture');assert.equal(r.data.entry.claims.length,2);assert(!Object.hasOwn(r.data.entry,'artifactDigest'));assert.equal(build(w,{[id(6)]:id(6)},id(9)),null);assert.equal(build(w,{[id(6)]:id(6),[id(7)]:id(99)},id(9)),null);assert.equal(build(w,{[id(6)]:id(6),[id(7)]:id(7)}),null);
});
test('waiting, dispute, complete, stale or malformed data never manufactures a paper command',()=>{
 for(const phase of['waiting','disputed','complete'])assert.equal(build(fixture(phase),{[id(6)]:id(6)},id(9)),null);const blocked=fixture();blocked.blockedCode='review_unavailable';assert.equal(build(blocked,{[id(6)]:id(6)}),null);
 let touched=0;const answers={};Object.defineProperty(answers,id(6),{enumerable:true,get(){touched++;return id(6);}});assert.equal(build(fixture(),answers),null);assert.equal(touched,0);const w=fixture();Object.defineProperty(w.capture,'artifactDigest',{enumerable:true,get(){touched++;return token;}});assert.equal(read(w,target),null);assert.equal(touched,0);
});
test('form remains default-off, separates disconnected preview and retained connection, and never loads other answers',()=>{
 const s=fs.readFileSync('src/components/native-mixed-playoff-paper-v1.tsx','utf8');assert(s.includes('!props.enabled'));assert(s.includes('This screen does not load the preparer answers'));assert(s.includes('Authorized administrative access elsewhere is unchanged'));assert(s.includes('Submit Independent Reading'));assert(s.includes('Saving, recovery and the tournament connection are not implemented'));assert(!/supabase|fetch\(|paper_official|native-mixed-game-evidence|LocalPaperCardPhoto/.test(s));
});

