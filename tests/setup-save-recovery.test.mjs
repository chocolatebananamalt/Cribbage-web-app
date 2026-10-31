import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptedSetupKey,parseAcceptedSetupReceipt,clearVerifiedSetupRecovery}from'../src/lib/setup-save-recovery.ts';
import {qSetupPrizeWorkspace}from'./fixtures/q-setup-prize-workspace.mjs';
const id='10000000-0000-4000-8000-000000000001',key=`tournament-setup:${id}:${id}`;
function fixture(){
 const payload=structuredClone(qSetupPrizeWorkspace(id).current);for(const k of['revisionId','version','createdAt'])delete payload[k];for(const e of payload.events){delete e.sourceStatus;}
 const request={expectedVersion:0,idempotencyKey:id,payload},receipt={revisionId:id,version:1};
 const original=JSON.stringify({kind:'tournament-setup',request}),ack=JSON.stringify({kind:'tournament-setup-accepted',operationId:id,...receipt}),ackKey=acceptedSetupKey(key,id),map=new Map([[key,original],[ackKey,ack]]),removed=[];
 const storage={getItem:k=>map.get(k)??null,removeItem:k=>{removed.push(k);map.delete(k);}};
 return{request,receipt,original,ack,ackKey,map,removed,storage};
}
test('accepted metadata is bounded, operation-bound and never changes the original request',()=>{
 const f=fixture();assert.deepEqual(parseAcceptedSetupReceipt(f.ack,f.request),f.receipt);assert.equal(f.map.get(key),f.original);
 for(const raw of['{broken',null,JSON.stringify({kind:'tournament-setup-accepted',operationId:id,revisionId:id,version:2}),JSON.stringify({kind:'tournament-setup-accepted',operationId:id,revisionId:id,version:1,extra:true})])assert.equal(parseAcceptedSetupReceipt(raw,f.request),null);
});
test('verified cleanup removes acknowledgement before original and confirms both are absent',()=>{
 const f=fixture();assert.equal(clearVerifiedSetupRecovery(f.storage,key,f.request,f.receipt),'cleared');assert.deepEqual(f.removed,[f.ackKey,key]);assert.equal(f.map.size,0);
});
test('acknowledgement cleanup failure preserves the exact retry request',()=>{
 for(const mode of['throw','ignored']){const f=fixture();f.storage.removeItem=k=>{if(k===f.ackKey){if(mode==='throw')throw Error('blocked');return;}f.map.delete(k);};assert.equal(clearVerifiedSetupRecovery(f.storage,key,f.request,f.receipt),'unavailable');assert.equal(f.map.get(key),f.original);}
});
test('malformed or conflicting sidecars and newer requests are retained without deletion',()=>{
 for(const mutate of[f=>f.map.set(f.ackKey,'{bad'),f=>f.map.set(f.ackKey,JSON.stringify({kind:'tournament-setup-accepted',operationId:id,revisionId:id.replace(/1$/,'2'),version:1})),f=>f.map.set(key,JSON.stringify({kind:'tournament-setup',request:{...f.request,idempotencyKey:id.replace(/1$/,'2')}}))]){
  const f=fixture();mutate(f);const before=[...f.map];assert.equal(clearVerifiedSetupRecovery(f.storage,key,f.request,f.receipt),'conflict');assert.deepEqual([...f.map],before);assert.deepEqual(f.removed,[]);
 }
});
test('an original operation without acknowledgement still reconciles through its verified server receipt',()=>{
 const f=fixture();f.map.delete(f.ackKey);assert.equal(clearVerifiedSetupRecovery(f.storage,key,f.request,f.receipt),'cleared');assert.equal(f.map.size,0);
});
