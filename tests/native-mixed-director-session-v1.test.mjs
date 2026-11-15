import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeMixedDirectorSessionV1,nativeMixedDirectorPendingKeyV1} from '../src/lib/seating/native-mixed-director-session-v1.ts';
const id=n=>`cc120000-0000-4000-8000-${String(n).padStart(12,'0')}`,scope={actorId:id(1),tournamentId:id(2),eventId:id(3)};
const context={projectRef:'localtest',scope,sessionId:'session-1'},hash='a'.repeat(64);
const request={kind:'native-mixed-simulation-draw-v1',operationId:id(10),planId:id(11),expectedPlanDigest:hash,expectedAttendanceSourceDigest:hash,reason:'One bounded rehearsal draw.'};
const operation={action:'draw',operationId:request.operationId,request};
const receipt={kind:'native-mixed-simulation-receipt-v1',action:'draw',status:'rejected',code:'bounded_search_exhausted',...scope,operationId:operation.operationId,request,entropyConsumed:true,retryWithNewOperationAuthorized:false,historicalReceipt:true,currentSourceVerified:false};
const historical={kind:'native-mixed-simulation-operation-v1',...scope,operationId:operation.operationId,action:'draw',request,receipt,historicalReceipt:true,currentSourceVerified:false};
function harness(overrides={}){
 const rows=new Map(),archives=new Map(),calls={writes:0,reads:0};let active=structuredClone(context),readAllowed=true;
 const retained={read:async key=>rows.get(key)??null,transition:async(key,expected,next,archive)=>{if((rows.get(key)??null)!==expected)return false;if(archive)archives.set(archive.id,archive.raw);if(next===null)rows.delete(key);else rows.set(key,next);return true;}};
 const session=new NativeMixedDirectorSessionV1({retained,currentContext:()=>active,canRead:()=>readAllowed,canWrite:()=>true,execute:async()=>{calls.writes++;throw Error('connection_lost');},readOperation:async()=>{calls.reads++;return historical;},...overrides});
 return{session,rows,archives,calls,retained,setActive:value=>{active=value;},deny:()=>{readAllowed=false;}};
}
test('default closed controller does not open storage or execute',async()=>{
 let calls=0;const s=new NativeMixedDirectorSessionV1({retained:{read:async()=>{calls++;return null;},transition:async()=>{calls++;return true;}},currentContext:()=>context});
 await s.activate(context);assert.equal(s.getSnapshot().status,'inactive');assert.equal(await s.submit(operation),false);assert.equal(calls,0);
});
test('malformed runtime context fails closed before storage and cannot collide with valid keys',async()=>{
 for(const value of [null,{}, {...context,scope:{a:id(1),b:id(2),c:id(3)}},{...context,sessionId:null},{...context,projectRef:3},{...context,scope:{...scope,extra:id(4)}}]){
  let reads=0;const h=harness({retained:{read:async()=>{reads++;return null;},transition:async()=>{throw Error('unexpected');}}});h.setActive(value);await h.session.activate(value);assert.equal(h.session.getSnapshot().status,'inactive');assert.equal(reads,0);assert.equal(await h.session.submit(operation),false);
 }
});
test('persist before dispatch; interrupted outcome can only be read and archived, never redrawn',async()=>{
 const h=harness();await h.session.activate(context);assert.equal(await h.session.submit(operation),false);assert.equal(h.calls.writes,1);assert.equal(h.rows.size,1);assert.equal(h.session.getSnapshot().status,'pending');
 assert.equal(await h.session.submit({...operation,operationId:id(20)}),false);assert.equal(h.calls.writes,1);
 assert.equal(await h.session.check(),true);assert.equal(h.session.getSnapshot().receipt.retryWithNewOperationAuthorized,false);
 assert.equal(await h.session.archiveResolved(),true);assert.equal(h.rows.size,1);assert.equal(h.archives.size,1);assert.equal(h.session.getSnapshot().status,'blocked');assert.equal(h.calls.writes,1);assert.equal(h.calls.reads,2);
 await h.session.activate(context);assert.equal(h.session.getSnapshot().status,'blocked');assert.equal(await h.session.submit({...operation,operationId:id(20),request:{...request,operationId:id(20)}}),false);assert.equal(h.calls.writes,1);
});
test('corrupt or foreign own-key saved work stays untouched and blocks dispatch',async()=>{
 for(const raw of ['not json','x'.repeat(131073),JSON.stringify({kind:'native-mixed-director-pending-v1',projectRef:'foreign',scope,operation})]){
  const h=harness(),key=nativeMixedDirectorPendingKeyV1(context);h.rows.set(key,raw);await h.session.activate(context);assert.equal(h.session.getSnapshot().status,'blocked');assert.equal(await h.session.submit(operation),false);assert.equal(h.rows.get(key),raw);assert.equal(h.calls.writes,0);
 }
});
test('account/session loss hides late response without purging pending or another account work',async()=>{
 let release;const wait=new Promise(r=>{release=r;});const h=harness({readOperation:async()=>{await wait;return historical;}});await h.session.activate(context);await h.session.submit(operation);
 const other={...context,scope:{...scope,actorId:id(99)}};const otherKey=nativeMixedDirectorPendingKeyV1(other);h.rows.set(otherKey,'other account pending');const checking=h.session.check();h.setActive({...context,sessionId:'session-2'});release();assert.equal(await checking,false);assert.equal(h.session.getSnapshot().status,'inactive');assert.equal(h.rows.size,2);assert.equal(h.rows.get(otherKey),'other account pending');
 h.setActive(context);await h.session.activate(context);assert.equal(h.session.getSnapshot().status,'pending');h.deny();assert.equal(h.session.getSnapshot().operation,null);assert.equal(h.rows.size,2);
});
test('storage failure or CAS conflict never sends a draw',async()=>{
 for(const retained of [{read:async()=>null,transition:async()=>false},{read:async()=>null,transition:async()=>{throw Error('disk_full');}}]){
  const h=harness({retained});await h.session.activate(context);assert.equal(await h.session.submit(operation),false);assert.equal(h.calls.writes,0);
 }
});
test('foreign malformed recovery and failed archive preserve exact pending',async()=>{
 const h=harness({readOperation:async()=>({...historical,actorId:id(99)})});await h.session.activate(context);await h.session.submit(operation);const before=[...h.rows.values()][0];assert.equal(await h.session.check(),false);assert.equal(await h.session.archiveResolved(),false);assert.equal([...h.rows.values()][0],before);assert.equal(h.archives.size,0);
});
