import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeMixedDirectorSessionV1,nativeMixedDirectorPendingKeyV1} from '../src/lib/seating/native-mixed-director-session-v1.ts';
const id=n=>`ee120000-0000-4000-8000-${String(n).padStart(12,'0')}`,scope={actorId:id(1),tournamentId:id(2),eventId:id(3)},context={projectRef:'localtest',scope,sessionId:'one'},hash='a'.repeat(64);
const request={kind:'native-mixed-simulation-draw-v1',operationId:id(10),planId:id(11),expectedPlanDigest:hash,expectedAttendanceSourceDigest:hash,reason:'One reviewed draw.'},operation={action:'draw',operationId:request.operationId,request};
const cancellation={kind:'native-mixed-simulation-cancellation-receipt-v1',status:'cancelled_no_committed_operation',code:'simulation_operation_cancelled',...scope,operationId:operation.operationId,action:'draw',request,requestHash:'b'.repeat(64),cancellationReason:'Close the uncertain rehearsal attempt.',notCommitted:true,executionNotProven:true,freshDrawAuthorized:false,normalStartAuthorized:false,currentSourceVerified:false,historicalReceipt:true};
async function fixture(options={}){
 const rows=new Map(),archives=new Map(),calls={write:0,cancel:0,readCancel:0};let current=context;
 const retained={read:async key=>rows.get(key)??null,transition:async(key,old,next,archive)=>{if((rows.get(key)??null)!==old)return false;if(archive)archives.set(archive.id,archive.raw);rows.set(key,next);return true;}};
 const session=new NativeMixedDirectorSessionV1({retained,currentContext:()=>current,canRead:()=>true,canWrite:()=>true,execute:async()=>{calls.write++;throw Error('lost_write_response');},readOperation:async()=>null,cancel:async()=>{calls.cancel++;throw Error('lost_cancel_response');},readCancellation:async()=>{calls.readCancel++;return cancellation;},...options});
 await session.activate(context);await session.submit(operation);return{session,rows,archives,calls,retained,setCurrent:value=>{current=value;}};
}
test('lost cancellation response is recovered only by exact historical read, then archived without redraw',async()=>{
 const h=await fixture();assert.equal(await h.session.cancelPending(cancellation.cancellationReason),true);assert.equal(h.calls.write,1);assert.equal(h.calls.cancel,1);assert.equal(h.session.getSnapshot().receipt.executionNotProven,true);assert.equal(h.session.getSnapshot().receipt.freshDrawAuthorized,false);
 assert.equal(await h.session.archiveResolved(),true);assert.equal(h.archives.size,1);assert.equal(h.rows.size,1);assert.equal(h.calls.cancel,1);
 await h.session.activate(context);assert.equal(h.session.getSnapshot().status,'blocked');assert.equal(await h.session.submit({...operation,operationId:id(20),request:{...request,operationId:id(20)}}),false);assert.equal(h.calls.write,1);
});
test('empty lookup, direct write reply and foreign cancellation never prove no committed operation',async()=>{
 const {historicalReceipt:ignored,...direct}=cancellation;assert.equal(ignored,true);
 for(const value of [null,direct,{...cancellation,actorId:id(99)},{...cancellation,request:{...request,reason:'Different request'}}]){
  const h=await fixture({readCancellation:async()=>value}),before=[...h.rows.values()][0];assert.equal(await h.session.cancelPending(cancellation.cancellationReason),false);assert.equal(h.session.getSnapshot().status,'pending');assert.equal(await h.session.archiveResolved(),false);assert.equal([...h.rows.values()][0],before);assert.equal(h.archives.size,0);
 }
});
test('invalid reason, other-tab changed pending and late identity change cannot close private pending',async()=>{
 const h=await fixture();assert.equal(await h.session.cancelPending('   '),false);assert.equal(h.calls.cancel,0);
 h.rows.set(nativeMixedDirectorPendingKeyV1(context),'other tab work');assert.equal(await h.session.cancelPending(cancellation.cancellationReason),false);assert.equal(h.calls.cancel,0);
 let release;const gate=new Promise(r=>{release=r;});const late=await fixture({readCancellation:async()=>{await gate;return cancellation;}}),before=[...late.rows.values()][0];const check=late.session.check();late.setCurrent({...context,sessionId:'new-session'});release();assert.equal(await check,false);assert.equal(late.session.getSnapshot().status,'inactive');assert.equal([...late.rows.values()][0],before);
});
test('already committed history wins over cancellation lookup, never relabeled as cancelled',async()=>{
 let cancelReads=0;const receipt={kind:'native-mixed-simulation-receipt-v1',...scope,operationId:operation.operationId,action:'draw',request,status:'rejected',code:'simulation_draw_failed',entropyConsumed:true,retryWithNewOperationAuthorized:false,historicalReceipt:true,currentSourceVerified:false};
 const historical={kind:'native-mixed-simulation-operation-v1',...scope,operationId:operation.operationId,action:'draw',request,receipt,historicalReceipt:true,currentSourceVerified:false};
 const h=await fixture({readOperation:async()=>historical,readCancellation:async()=>{cancelReads++;return cancellation;}});assert.equal(await h.session.check(),true);assert.equal(cancelReads,0);assert.equal(h.session.getSnapshot().receipt.kind,'native-mixed-simulation-receipt-v1');assert.match(h.session.getSnapshot().message,/do not draw again/);
});
test('failed archive CAS retains pending and cancellation proof for read-only recovery',async()=>{
 const h=await fixture();assert.equal(await h.session.check(),true);const before=[...h.rows.values()][0];h.retained.transition=async()=>false;assert.equal(await h.session.archiveResolved(),false);assert.equal([...h.rows.values()][0],before);assert.equal(h.archives.size,0);assert.equal(h.calls.write,1);assert.equal(h.calls.cancel,0);
});
