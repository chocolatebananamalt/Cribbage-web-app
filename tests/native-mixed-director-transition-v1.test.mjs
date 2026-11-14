import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readNativeMixedDirectorTransitionV1,nativeMixedNextOperationMatchesV1} from '../src/lib/seating/native-mixed-director-transition-v1.ts';
import {NativeMixedDirectorSessionV1,nativeMixedDirectorPendingKeyV1} from '../src/lib/seating/native-mixed-director-session-v1.ts';
const id=n=>`dd120000-0000-4000-8000-${String(n).padStart(12,'0')}`,scope={actorId:id(1),tournamentId:id(2),eventId:id(3)},context={projectRef:'localtest',scope,sessionId:'one'},hash='a'.repeat(64),now=Date.parse('2026-11-05T20:00:00.000Z');
const config={tables:[{tableId:'A',seatCount:18}],activePairIds:Array.from({length:9},(_,i)=>`A:${i*2+1}-${i*2+2}`),anchor:{participantId:null,seatId:'A-1',directorApproved:true},stationaryRequests:[],stationaryDecisions:[],constraints:[],maxAttempts:1};
const request={kind:'native-mixed-simulation-plan-v1',operationId:id(10),expectedAttendanceSealId:id(11),expectedAttendanceSourceDigest:hash,config,reason:'Prepare the rehearsal.'},plan={action:'plan',operationId:request.operationId,request};
const receipt={kind:'native-mixed-simulation-receipt-v1',...scope,action:'plan',status:'accepted',code:'simulation_plan_saved',operationId:plan.operationId,request,planId:id(12),version:1,sourceDigest:'b'.repeat(64),normalDrawAuthorized:false,normalStartAuthorized:false,historicalReceipt:true,currentSourceVerified:false};
const prior={kind:'native-mixed-simulation-operation-v1',...scope,operationId:plan.operationId,action:'plan',request,receipt,historicalReceipt:true,currentSourceVerified:false};
const proof={kind:'native-mixed-director-transition-v1',...scope,prior,nextAction:'draw',parentId:receipt.planId,parentDigest:receipt.sourceDigest,attendanceDigest:hash,observedAt:new Date(now).toISOString(),currentSourceVerified:true,writeAuthorized:false,normalStartAuthorized:false};
const drawRequest={kind:'native-mixed-simulation-draw-v1',operationId:id(20),planId:receipt.planId,expectedPlanDigest:receipt.sourceDigest,expectedAttendanceSourceDigest:hash,reason:'Draw the reviewed rehearsal.'},draw={action:'draw',operationId:drawRequest.operationId,request:drawRequest};
const expected={scope,prior:plan,now};
test('fresh exact observation binds prior historical receipt and the next request chain',()=>{
 assert.deepEqual(readNativeMixedDirectorTransitionV1(proof,expected),proof);assert.equal(nativeMixedNextOperationMatchesV1(draw,proof),true);
 for(const bad of [{...proof,extra:true},{...proof,actorId:id(99)},{...proof,nextAction:'publish'},{...proof,parentDigest:hash},{...proof,attendanceDigest:'c'.repeat(64)},{...proof,writeAuthorized:true},{...proof,currentSourceVerified:false},{...proof,observedAt:'2026-13-05T20:00:00.000Z'}])assert.equal(readNativeMixedDirectorTransitionV1(bad,expected),null);
 for(const time of [now+30001,now-1,NaN])assert.equal(readNativeMixedDirectorTransitionV1(proof,{...expected,now:time}),null);
 assert.equal(nativeMixedNextOperationMatchesV1({...draw,request:{...draw.request,planId:id(99)}},proof),false);
 assert.equal(nativeMixedNextOperationMatchesV1({...draw,operationId:plan.operationId,request:{...draw.request,operationId:plan.operationId}},proof),false);
});
test('failed draw and already published operation cannot be advanced',()=>{
 const failed={...prior,action:'draw',request:drawRequest,operationId:draw.operationId,receipt:{kind:'native-mixed-simulation-receipt-v1',...scope,action:'draw',status:'rejected',code:'simulation_draw_failed',operationId:draw.operationId,request:drawRequest,entropyConsumed:true,retryWithNewOperationAuthorized:false,historicalReceipt:true,currentSourceVerified:false}};
 assert.equal(readNativeMixedDirectorTransitionV1({...proof,prior:failed},{scope,prior:draw,now}),null);
 assert.equal(readNativeMixedDirectorTransitionV1(proof,{...expected,prior:{...plan,action:'publish'}}),null);
});
async function fixture(options={}){
 const rows=new Map(),archives=new Map(),sent=[];let current=context,clock=now;
 const retained={read:async key=>rows.get(key)??null,transition:async(key,old,next,archive)=>{if((rows.get(key)??null)!==old)return false;if(archive)archives.set(archive.id,archive.raw);rows.set(key,next);return true;}};
 const session=new NativeMixedDirectorSessionV1({retained,currentContext:()=>current,canRead:()=>true,canWrite:()=>true,now:()=>clock,execute:async op=>{sent.push(op);throw Error('lost_response');},readOperation:async()=>prior,readTransition:async()=>proof,...options});
 await session.activate(context);await session.submit(plan);assert.equal(await session.archiveResolved(),true);
 return{session,rows,archives,sent,retained,setCurrent:v=>{current=v;},setClock:v=>{clock=v;}};
}
test('closed to next pending is atomic, read back before one dispatch; unknown cannot advance again',async()=>{
 const h=await fixture();const closed=[...h.rows.values()][0];assert.equal(await h.session.advance(draw),false);assert.equal(h.sent.length,2);assert.equal(h.sent[1].action,'draw');assert.equal(h.archives.size,1);assert.notEqual([...h.rows.values()][0],closed);assert.equal(h.session.getSnapshot().status,'pending');assert.equal(await h.session.advance(draw),false);assert.equal(h.sent.length,2);
 await h.session.activate(context);assert.equal(h.session.getSnapshot().status,'pending');assert.equal(h.sent.length,2);
});
test('expired, missing or foreign fresh source leaves exact closed marker unchanged',async()=>{
 for(const source of [null,{...proof,actorId:id(99)},{...proof,observedAt:new Date(now-30001).toISOString()}]){
  const h=await fixture({readTransition:async()=>source}),before=[...h.rows.values()][0];assert.equal(await h.session.advance(draw),false);assert.equal([...h.rows.values()][0],before);assert.equal(h.sent.length,1);
 }
});
test('CAS conflict, identity change and expiry during persistence prevent dispatch',async()=>{
 const h=await fixture(),key=nativeMixedDirectorPendingKeyV1(context);h.rows.set(key,'newer other-tab work');assert.equal(await h.session.advance(draw),false);assert.equal(h.rows.get(key),'newer other-tab work');assert.equal(h.sent.length,1);
 let release;const gate=new Promise(r=>{release=r;});const late=await fixture({readTransition:async()=>{await gate;return proof;}}),before=[...late.rows.values()][0];const pending=late.session.advance(draw);late.setCurrent({...context,sessionId:'changed'});release();assert.equal(await pending,false);assert.equal([...late.rows.values()][0],before);assert.equal(late.sent.length,1);
 const expired=await fixture();const original=expired.retained.transition;expired.retained.transition=async(...args)=>{const result=await original(...args);expired.setClock(now+30001);return result;};assert.equal(await expired.session.advance(draw),false);assert.equal(expired.sent.length,1);assert.equal(expired.session.getSnapshot().status,'pending');
});
test('private transition SQL checks current lifecycle and exact chain, never mutates or draws',async()=>{
 const sql=(await fs.readFile('database/proposals/native-mixed-simulation-transition-v1.sql','utf8')).replace(/\s+/g,' ').toLowerCase();
 for(const part of ['as $$select false$$','from public,anon,authenticated,service_role',"current_setting('transaction_isolation')<>'read committed'","role='director'for key share nowait",'app.get_native_mixed_simulation_operation_v1(actor,tid,eid,op)','app.native_mixed_simulation_lifecycle_v1(actor,tid,eid)',"action='draw'","r->>'status'is distinct from'accepted'","p.attendance_capture is distinct from a-'actorid'","'writeauthorized',false","'normalstartauthorized',false",'in share mode nowait'])assert.ok(sql.includes(part),part);
 assert.doesNotMatch(sql,/\b(insert into|update app\.|delete from|grant execute|random_seating_candidate_v1\(|draw_native_mixed_simulation_v1\()\b/u);
});
