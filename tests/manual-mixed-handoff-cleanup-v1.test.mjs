import test from 'node:test';
import assert from 'node:assert/strict';
import {isAcknowledgedManualMixedResponseV1 as acknowledged} from '../src/lib/games/manual-mixed-handoff-v1.ts';
const id=n=>'a1110000-0000-4000-8000-'+String(n).padStart(12,'0');
const actor=id(1),game=id(2),submission=id(3),op=id(4);
const request=()=>({submissionId:submission,gameVersion:7,operationId:op,decision:'yes'});
const view=()=>({kind:'manual-mixed-handoff-v1',actorId:actor,gameId:game,gameVersion:7,submission:{id:submission,winnerSide:'a',margin:35},paperPlayer:{displayName:'Fictional Paper',side:'b',tableSeat:'A-2',verificationId:'A-2'},digitalPlayer:{displayName:'Fictional Digital',side:'a',tableSeat:'A-1',verificationId:'A-1'},response:{operationId:op,decision:'yes',recordedAt:'2026-11-13T00:00:00Z'},canRespond:false,tentative:true,verified:false});
test('both accepted decisions acknowledge only their exact retained operation, without granting verification',()=>{
 for(const decision of ['yes','no']){const v=view(),r=request();v.response.decision=r.decision=decision;assert.equal(acknowledged(v,actor,game,r),true);assert.equal(v.verified,false);assert.equal(v.tentative,true);}
});
test('foreign actor/game/submission, operation and decision do not retire retained work',()=>{
 for(const change of [v=>v.actorId=id(9),v=>v.gameId=id(9),v=>v.submission.id=id(9),v=>v.response.operationId=id(9),v=>v.response.decision='no']){const v=view();change(v);assert.equal(acknowledged(v,actor,game,request()),false);}
});
test('version drift, missing, invalid and authoritative-looking responses are held',()=>{
 for(const change of [v=>v.gameVersion=8,v=>v.gameVersion=6,v=>v.response=null,v=>v.response.recordedAt='bad',v=>v.verified=true,v=>v.tentative=false,v=>v.extra=true]){const v=view();change(v);assert.equal(acknowledged(v,actor,game,request()),false);}
 assert.equal(acknowledged(null,actor,game,request()),false);
});
test('malformed retained requests cannot be acknowledged',()=>{
 for(const change of [r=>r.extra=true,r=>r.gameVersion=0,r=>r.operationId='bad',r=>r.decision='approve']){const r=request();change(r);assert.equal(acknowledged(view(),actor,game,r),false);}
});
