import test from 'node:test';
import assert from 'node:assert/strict';
import { mixedRecoveryKey, readMixedRecovery, removeExactMixedRecovery, isMixedPending } from '../src/lib/mixed-rehearsal-recovery.ts';
import { countAppSessionStorageRecords, isAppRecoveryStorageKey } from '../src/lib/client-session-storage.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(1),tournamentId:id(2),eventId:id(3),gameId:id(4),phase:'own-ack'};
const request={artifactId:id(5),expectedGameVersion:2,digitalSubmissionId:id(6),confirmed:true,idempotencyKey:id(7)};
const pending={...scope,protocol:'synthetic-mixed-ui-v1',artifactId:id(5),expectedGameVersion:2,idempotencyKey:id(7),request};
const valid=v=>!!v&&v.confirmed===true&&typeof v.idempotencyKey==='string';
const storage=()=>{const data=new Map();return {get length(){return data.size},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
test('mixed retry is scoped to exact actor/event/game/phase and full request metadata',()=>{
 assert.equal(isMixedPending(pending,scope,valid),true);
 for(const field of ['actorId','tournamentId','eventId','gameId','phase'])assert.equal(isMixedPending({...pending,[field]:field==='phase'?'paper-review':id(99)},scope,valid),false);
 for(const field of ['artifactId','idempotencyKey','expectedGameVersion'])assert.equal(isMixedPending({...pending,[field]:field==='expectedGameVersion'?3:id(99)},scope,valid),false);
 assert.equal(isMixedPending({...pending,extra:true},scope,valid),false);
 assert.equal(isMixedPending({...pending,request:{...request,confirmed:false}},scope,valid),false);
});
test('malformed, unavailable or mismatched recovery is blocked and never erased',()=>{
 const s=storage(),key=mixedRecoveryKey(scope);assert.equal(readMixedRecovery(s,scope,valid).kind,'empty');
 for(const value of ['{','null',JSON.stringify({...pending,actorId:id(9)})]){s.setItem(key,value);assert.equal(readMixedRecovery(s,scope,valid).kind,'blocked');assert.equal(s.getItem(key),value)}
 assert.equal(readMixedRecovery({getItem(){throw Error('denied')}},scope,valid).kind,'blocked');
});
test('late accepted or rejected response cannot remove a newer retained operation',()=>{
 const s=storage(),key=mixedRecoveryKey(scope),old=JSON.stringify(pending),newer=JSON.stringify({...pending,idempotencyKey:id(9),request:{...request,idempotencyKey:id(9)}});
 s.setItem(key,newer);assert.equal(removeExactMixedRecovery(s,scope,old),false);assert.equal(s.getItem(key),newer);
 s.setItem(key,old);assert.equal(readMixedRecovery(s,scope,valid).serialized,old);assert.equal(removeExactMixedRecovery(s,scope,old),true);assert.equal(s.getItem(key),null);
});
test('official request metadata and sign-out inventory include mixed recovery',()=>{
 const s=storage(),p={...pending,phase:'paper-capture',request:{gameId:id(4),request:{artifactId:id(5),expectedGameVersion:2,gameId:id(4)},idempotencyKey:id(7)}},key=mixedRecoveryKey(p);
 assert.equal(isMixedPending(p,p,()=>true),true);assert.equal(isMixedPending({...p,gameId:id(90)},{...p,gameId:id(90)},()=>true),false);assert.equal(isMixedPending({...p,request:{...p.request,request:{...p.request.request,gameId:id(91)}}},p,()=>true),false);s.setItem(key,JSON.stringify(p));assert.equal(isAppRecoveryStorageKey(key),true);assert.equal(countAppSessionStorageRecords(s),1);
 assert.throws(()=>mixedRecoveryKey({...scope,actorId:'unknown'}));
});
