import test from 'node:test';import assert from 'node:assert/strict';
import {createIndexedFinanceDraftRetainedV1} from '../src/lib/finance/event-finance-draft-retained-v1.ts';
const id=n=>`c1230000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(1),tournamentId:id(2),eventId:id(3)};
const key=(family,suffix,s=scope)=>`prize-proposal-${family}-v2:${s.actorId}:${s.tournamentId}:${s.eventId}:${suffix}`;
const compare=(a,b)=>a<b?-1:a>b?1:0;

/** Local IndexedDB contract mock: asynchronous request dispatch, cursor
 * continuation within the request task, transaction completion only after all
 * queued handlers finish, and abort rejects even after successful requests.
 * No browser/origin/disk persistence is represented. */
function indexed(entries=[],options={}){
 const data=new Map(entries),calls={opens:0,transactions:[],stores:[],ranges:[],keyRequests:[],keyVisits:[],gets:[],writes:0,completes:0,aborts:0};
 const keyRanges={bound(lower,upper,lowerOpen=false,upperOpen=false){assert.equal(typeof lower,'string');assert.equal(typeof upper,'string');assert(lower<upper);const range={lower,upper,lowerOpen,upperOpen};calls.ranges.push(range);return range;}};
 class Transaction{
  constructor(){this.pending=0;this.aborted=false;this.finished=false;this.generation=0;this.snapshot=new Map(data);}
  check(){const generation=++this.generation;if(this.pending!==0||this.aborted||this.finished)return;queueMicrotask(()=>{if(generation!==this.generation||this.pending!==0||this.aborted||this.finished)return;if(options.abortAtCompletion){this.abort();return;}this.finished=true;calls.completes++;this.oncomplete?.();});}
  abort(){if(this.finished||this.aborted)throw Error('TransactionInactiveError');this.aborted=true;calls.aborts++;queueMicrotask(()=>this.onabort?.());}
  enqueue(request,result,fail=false){if(this.aborted||this.finished)throw Error('TransactionInactiveError');this.pending++;this.generation++;queueMicrotask(()=>{try{if(this.aborted)return;if(fail){request.error=Error('mock_request_error');request.onerror?.();if(!this.aborted)this.abort();}else{request.result=result();request.onsuccess?.();}}catch{if(!this.aborted)this.abort();}finally{this.pending--;this.check();}});return request;}
  objectStore(name){calls.stores.push(name);assert.equal(name,'history','archive must never access drafts');const enqueue=this.enqueue.bind(this),snapshot=this.snapshot;return{
   openKeyCursor(range,direction){assert.equal(direction,'next');calls.keyRequests.push(range);const keys=[...snapshot.keys()].filter(k=>typeof k==='string'&&(range.lowerOpen?k>range.lower:k>=range.lower)&&(range.upperOpen?k<range.upper:k<=range.upper)).sort(compare);let position=0;const request={};const deliver=()=>{if(position>=keys.length)return null;const current=keys[position];calls.keyVisits.push(current);let continued=false;return{key:current,get value(){throw Error('key cursor has no value');},continue(){if(continued)throw Error('InvalidStateError');continued=true;position++;enqueue(request,deliver);}};};enqueue(request,deliver,options.keyRequestError===true);return request;},
   get(keyValue){calls.gets.push(keyValue);return enqueue({},()=>snapshot.get(keyValue),options.getRequestError===keyValue);},
   getAll(){throw Error('broad_getAll_forbidden');},getAllKeys(){throw Error('broad_keys_forbidden');},openCursor(){throw Error('value_cursor_forbidden');},
   put(){calls.writes++;throw Error('archive_write_forbidden');},delete(){calls.writes++;throw Error('archive_delete_forbidden');}
  };}
 }
 const db={objectStoreNames:{contains:()=>true},close(){},transaction(store,mode){calls.transactions.push({store,mode});assert.equal(store,'history');assert.equal(mode,'readonly');return new Transaction();}};
 const factory={open(name,version){calls.opens++;assert.equal(name,'cribbage-finance-device-drafts-v1');assert.equal(version,1);const request={result:db};queueMicrotask(()=>{if(options.openError)request.onerror?.();else request.onsuccess?.();});return request;}};
 return{calls,data,port:createIndexedFinanceDraftRetainedV1(factory,keyRanges)};
}

test('construction and malformed scope/cursor/limit never open a local database or invoke scope getters',async()=>{
 const f=indexed();assert.equal(f.calls.opens,0);assert.equal(typeof f.port.readPrizeArchives,'function');
 for(const s of[null,{}, {...scope,extra:true},{...scope,actorId:id(1).toUpperCase()},{...scope,eventId:'bad'}])await assert.rejects(()=>f.port.readPrizeArchives(s,null,5),/invalid_prize_archive_query/);
 for(const limit of[0,-1,11,1.5,Infinity,NaN,'5'])await assert.rejects(()=>f.port.readPrizeArchives(scope,null,limit),/invalid_prize_archive_query/);
 for(const cursor of['',id(10),key('receipt',id(10),{...scope,actorId:id(99)}),key('receipt',id(10),{...scope,tournamentId:id(99)}),key('receipt',id(10),{...scope,eventId:id(99)}),key('other',id(10)),key('receipt','x'.repeat(101)),key('receipt','\ud83d\ude00'.repeat(51)),42,undefined])await assert.rejects(()=>f.port.readPrizeArchives(scope,cursor,5),/invalid_prize_archive_query/);
 let calls=0;const getter={...scope};Object.defineProperty(getter,'actorId',{enumerable:true,get(){calls++;throw Error();}});await assert.rejects(()=>f.port.readPrizeArchives(getter,null,5),/invalid_prize_archive_query/);assert.equal(calls,0);assert.equal(f.calls.opens,0);assert.equal(f.calls.transactions.length,0);
});
test('only exact owned history families are queried readonly; malformed UUID suffix stays raw and pagination uses code-unit ordering',async()=>{
 const own=[key('receipt','Z_bad_UUID'),key('receipt',id(20)),key('receipt','a_pending'),key('rejection','not-a-uuid'),key('rejection',id(10))];
 const unrelated=[key('receipt',id(10),{...scope,actorId:id(99)}),key('receipt',id(10),{...scope,tournamentId:id(99)}),key('receipt',id(10),{...scope,eventId:id(99)}),key('other',id(10)),`finance-device-draft-v1:${scope.actorId}:${scope.tournamentId}:${scope.eventId}`,42];
 const entries=[...own.map((k,i)=>[k,` RAW\n${i} `]),...unrelated.map(k=>[k,'UNRELATED PRIVATE DATA'])],f=indexed(entries),expected=own.slice().sort(compare),actual=[];let after=null;
 do{const page=await f.port.readPrizeArchives(scope,after,2);assert(page.entries.length<=2);actual.push(...page.entries.map(e=>e.id));for(const entry of page.entries)assert.equal(entry.raw,f.data.get(entry.id));if(page.nextCursor)assert.equal(page.nextCursor,page.entries.at(-1).id);after=page.nextCursor;}while(after!==null);
 assert.deepEqual(actual,expected);assert(actual.includes(key('rejection','not-a-uuid')));assert(f.calls.gets.every(k=>own.includes(k)));assert(f.calls.keyVisits.every(k=>own.includes(k)));assert(f.calls.stores.every(s=>s==='history'));assert(f.calls.transactions.every(t=>t.store==='history'&&t.mode==='readonly'));assert.equal(f.calls.writes,0);assert.equal(f.calls.opens,1);assert.equal(f.calls.completes,3);
 assert(f.calls.ranges.every(r=>['receipt','rejection'].some(family=>{const prefix=key(family,'');return r.lower.startsWith(prefix)&&r.upper===prefix.slice(0,-1)+';';})));
});
test('key-only lookahead is bounded and values are fetched solely for returned IDs, with exact family range successor',async()=>{
 const receipt=Array.from({length:30},(_,i)=>key('receipt',id(i+10))),rejection=Array.from({length:30},(_,i)=>key('rejection',id(i+100))),f=indexed([...receipt,...rejection].map(k=>[k,'opaque']));const page=await f.port.readPrizeArchives(scope,null,3);
 assert.deepEqual(page.entries.map(e=>e.id),receipt.slice(0,3));assert.equal(page.nextCursor,receipt[2]);assert.equal(f.calls.keyRequests.length,2);assert.equal(f.calls.keyVisits.length,8);assert.deepEqual(f.calls.gets,receipt.slice(0,3));
 for(const range of f.calls.ranges){assert.equal(range.lowerOpen,false);assert.equal(range.upperOpen,true);assert(range.lower.endsWith(':'));assert.equal(range.upper,range.lower.slice(0,-1)+';');}
 const before=f.calls.keyRequests.length,second=await f.port.readPrizeArchives(scope,rejection[3],3);assert.equal(f.calls.keyRequests.length-before,1,'a rejection cursor must never rescan earlier receipt family');assert.deepEqual(second.entries.map(e=>e.id),rejection.slice(4,7));const range=f.calls.ranges.at(-1);assert.equal(range.lower,rejection[3]);assert.equal(range.lowerOpen,true);
});
test('empty and final pages resolve only after readonly transaction completion with null next cursor',async()=>{
 const empty=indexed(),page=await empty.port.readPrizeArchives(scope,null,10);assert.deepEqual(page,{entries:[],nextCursor:null});assert.equal(empty.calls.completes,1);assert.equal(empty.calls.gets.length,0);
 const only=key('rejection','x'.repeat(100)),f=indexed([[only,'unaltered raw']]);assert.deepEqual(await f.port.readPrizeArchives(scope,null,1),{entries:[{id:only,raw:'unaltered raw'}],nextCursor:null});assert.deepEqual(await f.port.readPrizeArchives(scope,only,1),{entries:[],nextCursor:null});
});
test('transaction abort/request errors fail closed without returning partial entries',async()=>{
 const a=key('receipt',id(10)),b=key('rejection',id(11));
 for(const options of[{abortAtCompletion:true},{keyRequestError:true},{getRequestError:b}]){const f=indexed([[a,'first'],[b,'second']],options);await assert.rejects(()=>f.port.readPrizeArchives(scope,null,2),/indexed_archive_read_failed/);assert.equal(f.calls.completes,0);assert(f.calls.aborts>=1);assert.equal(f.calls.writes,0);}
 const f=indexed([[a,'first'],[b,'second']],{openError:true});await assert.rejects(()=>f.port.readPrizeArchives(scope,null,2),/indexed_storage_unavailable/);assert.equal(f.calls.transactions.length,0);
});
test('oversized suffix keys fail closed without reading their value; unreturned malformed values are not fetched',async()=>{
 const bad=key('receipt','a'.repeat(101)),f=indexed([[bad,{mustNeverRead:'private'}],[key('receipt','z_valid'),'valid']]);await assert.rejects(()=>f.port.readPrizeArchives(scope,null,1),/indexed_archive_read_failed/);assert.equal(f.calls.gets.length,0);
 const a=key('receipt','A'),b=key('receipt','B'),lookahead=indexed([[a,'valid'],[b,{notAString:true}]]);assert.deepEqual(await lookahead.port.readPrizeArchives(scope,null,1),{entries:[{id:a,raw:'valid'}],nextCursor:a});assert.deepEqual(lookahead.calls.gets,[a]);assert.deepEqual(await lookahead.port.readPrizeArchives(scope,a,1),{entries:[{id:b,raw:null}],nextCursor:null});
});
test('all bounded owned suffixes including empty, punctuation, whitespace, NUL and Unicode remain pageable by code units',async()=>{
 const suffixes=['',' ','.','a:b','\u0000','\ud800','\uffff','\ufffftail','e\u0301','\u00e9','\ud83d\ude00','Z','_','\ud83d\ude00'.repeat(50)],keys=suffixes.flatMap(s=>[key('receipt',s),key('rejection',s)]),f=indexed(keys.map(k=>[k,'unverified raw'])),expected=keys.slice().sort(compare),actual=[];let after=null;
 do{const page=await f.port.readPrizeArchives(scope,after,1);actual.push(...page.entries.map(e=>e.id));if(page.nextCursor){if(after!==null)assert(page.nextCursor>after);assert.equal(page.nextCursor,page.entries[0].id);}after=page.nextCursor;assert(actual.length<=expected.length);}while(after!==null);
 assert.deepEqual(actual,expected);assert(actual.includes(key('receipt','\ufffftail')),'exclusive prefix successor must include suffixes beyond a leading U+FFFF');assert.equal(f.calls.writes,0);assert(f.calls.ranges.every(r=>r.upper.endsWith(';')&&r.upperOpen));
});
test('nonstrings return null without exposing or changing stored objects and later history remains reachable',async()=>{
 const a=key('receipt','A'),b=key('receipt','B'),c=key('receipt','C');let getterCalls=0;const secret={get secret(){getterCalls++;throw Error('must not inspect stored object');}};
 for(const value of[undefined,null,secret,5,['private'],new Uint8Array([1,2])]){const f=indexed([[a,'first'],[b,value],[c,'last']]);assert.deepEqual(await f.port.readPrizeArchives(scope,a,1),{entries:[{id:b,raw:null}],nextCursor:b});assert.deepEqual(await f.port.readPrizeArchives(scope,b,1),{entries:[{id:c,raw:'last'}],nextCursor:null});assert.equal(f.data.get(b),value);assert.equal(f.calls.writes,0);}assert.equal(getterCalls,0);
});
test('returned raw plus ID UTF-8 bytes are bounded at 32MiB, including multibyte and cumulative pages',async()=>{
 const cap=32*1024*1024,a=key('receipt','A'),b=key('receipt','B'),fits='x'.repeat(cap-a.length),ok=indexed([[a,fits]]);assert.equal((await ok.port.readPrizeArchives(scope,null,1)).entries[0].raw.length,fits.length);
 for(const entries of[[[a,'x'.repeat(cap+1)]],[[a,'é'.repeat(cap/2)]],[[a,'x'.repeat(17*1024*1024)],[b,'y'.repeat(17*1024*1024)]]]){const f=indexed(entries);await assert.rejects(()=>f.port.readPrizeArchives(scope,null,2),/indexed_archive_read_failed/);assert.equal(f.calls.writes,0);}
});
test('missing key-range support rejects before DB open while preserving existing constructor compatibility',async()=>{
 let opens=0;const port=createIndexedFinanceDraftRetainedV1({open(){opens++;throw Error('must not open');}},{bound:undefined});await assert.rejects(()=>port.readPrizeArchives(scope,null,5),/indexed_archive_unavailable/);assert.equal(opens,0);
 assert.doesNotThrow(()=>createIndexedFinanceDraftRetainedV1({open(){throw Error('construction must stay lazy');}}));
});
