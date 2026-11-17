import test from 'node:test';import assert from 'node:assert/strict';
import{reconcileRetainedPaperOperationV35 as reconcile}from'../src/lib/paper-games/reconcile-retained-v35.ts';
function fixture(){let raw='exact retained bytes',live=true,release;const calls={lookup:0,remove:0};const response=new Promise(r=>release=r);const port={raw,current:()=>live,read:()=>raw,lookup:()=>{calls.lookup++;return response},accepted:v=>v?.historical===true,remove:expected=>{calls.remove++;assert.equal(raw,expected);raw=null;return true}};return{port,calls,release,setRaw:v=>raw=v,getRaw:()=>raw,cancel:()=>live=false};}
test('only current exact retained request and recognized historical outcome permit removal',async()=>{
 const f=fixture(),work=reconcile(f.port);f.release({historical:true});assert.equal(await work,true);assert.equal(f.getRaw(),null);assert.equal(f.calls.remove,1);
 for(const reply of[null,undefined,{},false,{historical:false}]){const f=fixture(),work=reconcile(f.port);f.release(reply);assert.equal(await work,false);assert.equal(f.getRaw(),'exact retained bytes');assert.equal(f.calls.remove,0)}
});
test('cancellation, replacement and unavailable storage preserve bytes across awaited lookup',async()=>{
 for(const kind of['cancel','replaced','malformed']){const f=fixture(),work=reconcile(f.port);if(kind==='cancel')f.cancel();else f.setRaw(kind==='malformed'?'{broken':'new valid request bytes');const raw=f.getRaw();f.release({historical:true});assert.equal(await work,false);assert.equal(f.getRaw(),raw);assert.equal(f.calls.remove,0)}
 for(const kind of['cancel','replaced']){const f=fixture();if(kind==='cancel')f.cancel();else f.setRaw('new bytes');assert.equal(await reconcile(f.port),false);assert.equal(f.calls.lookup,0)}
});
test('lookup failure, coordinator denial and CAS false never report resolution',async()=>{
 for(const change of[{lookup:async()=>{throw Error('provider')}},{read:()=>{throw Error('denied')}},{remove:()=>false},{remove:()=>{throw Error('switch in progress')}}]){const f=fixture(),work=reconcile({...f.port,...change});f.release({historical:true});assert.equal(await work,false);assert.equal(f.getRaw(),'exact retained bytes')}
});
