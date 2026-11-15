/** Source-only browser adapter. Construction/import never opens a database.
 * A host must explicitly enable it after its recovery/ownership protocol has
 * passed runtime acceptance. Device proposals only: no ledger/remote save or payment. No data is expired, cleared on sign-out or rebased.
 */
export type FinancePrizeArchiveScopeV2={actorId:string;tournamentId:string;eventId:string};
export type FinancePrizeArchivePageV2={entries:Array<{id:string;raw:string|null}>;nextCursor:string|null};
export type FinanceDraftRetainedPortV1={
 read:(key:string)=>Promise<string|null>;
 /** Abort must roll back an uncommitted transition, never clear newer work. */
 transition:(key:string,expected:string|null,next:string|null,archive?:{id:string;raw:string},signal?:AbortSignal)=>Promise<boolean>;
 /** Raw local history only. Any owned suffix of 0..100 UTF-16 code units may
  * be returned for the archive codec to mark unverified; longer keys fail the
  * page closed. Nonstrings return raw:null, never their stored value. */
 readPrizeArchives?:(scope:FinancePrizeArchiveScopeV2,afterId:string|null,limit:number)=>Promise<FinancePrizeArchivePageV2>;
};
export function financeDraftRetainedKeyV1(actorId:string,tournamentId:string,eventId:string){
 const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
 if(![actorId,tournamentId,eventId].every(v=>uuid.test(v)))throw Error('invalid_retained_scope');
 // Deliberately not keyed by source revision: changed event facts must find
 // the same retained draft and require review, never hide earlier work.
 return `finance-device-draft-v1:${actorId}:${tournamentId}:${eventId}`;
}
export function createIndexedFinanceDraftRetainedV1(factory:IDBFactory|undefined=globalThis.indexedDB,keyRanges:Pick<typeof IDBKeyRange,'bound'>|undefined=globalThis.IDBKeyRange):FinanceDraftRetainedPortV1{
 let opening:Promise<IDBDatabase>|null=null;
 // Existing shared first-open initialization may create empty stores. Archive
 // transactions below never read drafts or mutate either store's record data.
 const open=()=>{
  if(opening)return opening;
  opening=new Promise<IDBDatabase>((resolve,reject)=>{
   let failed=false;
   if(!factory){reject(Error('indexed_storage_unavailable'));return;}
   const request=factory.open('cribbage-finance-device-drafts-v1',1);
   request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('drafts'))db.createObjectStore('drafts');if(!db.objectStoreNames.contains('history'))db.createObjectStore('history');};
   request.onerror=()=>{failed=true;reject(Error('indexed_storage_unavailable'));};
   request.onblocked=()=>{failed=true;reject(Error('indexed_storage_blocked'));};
   request.onsuccess=()=>{const db=request.result;if(failed){db.close();return;}db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
  });
  return opening.catch(error=>{opening=null;throw error;});
 };
 return{
  async readPrizeArchives(scope,afterId,limit){
   // Validate descriptors, scope and cursor BEFORE opening any local database.
   const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
   if(!scope||typeof scope!=='object'||Object.getPrototypeOf(scope)!==Object.prototype||Reflect.ownKeys(scope).length!==3||!Number.isSafeInteger(limit)||limit<1||limit>10)throw Error('invalid_prize_archive_query');
   const descriptors=Object.getOwnPropertyDescriptors(scope),ids=['actorId','tournamentId','eventId'].map(k=>descriptors[k]);
   if(ids.some(d=>!d||!('value'in d)||!d.enumerable||typeof d.value!=='string'||!uuid.test(d.value)))throw Error('invalid_prize_archive_query');
   const suffix=ids.map(d=>d.value).join(':')+':',prefixes=['prize-proposal-receipt-v2:','prize-proposal-rejection-v2:'].map(f=>f+suffix);
   const owned=(key:unknown):key is string=>typeof key==='string'&&prefixes.some(p=>key.startsWith(p)&&key.length>=p.length&&key.length<=p.length+100);
   if(afterId!==null&&!owned(afterId))throw Error('invalid_prize_archive_query');
   if(!keyRanges||typeof keyRanges.bound!=='function')throw Error('indexed_archive_unavailable');
   const ranges=prefixes.flatMap(prefix=>{
    // ':' -> ';' gives an exclusive exact prefix successor, including every
    // possible suffix without crossing into another family/account/event.
    const upper=prefix.slice(0,-1)+';';if(afterId!==null&&afterId>=upper)return[];
    const lower=afterId!==null&&afterId>=prefix?afterId:prefix;
    return[{prefix,upper,lower,range:keyRanges.bound(lower,upper,lower===afterId,true)}];
   });
   const db=await open();return new Promise<FinancePrizeArchivePageV2>((resolve,reject)=>{
    const tx=db.transaction('history','readonly');let failed=false,remaining=ranges.length,bytes=0;
    const keys:string[]=[],values=new Map<string,string|null>();let pageKeys:string[]=[],nextCursor:string|null=null;
    const fail=()=>{failed=true;try{tx.abort();}catch{reject(Error('indexed_archive_read_failed'));}};
    tx.onabort=tx.onerror=()=>{failed=true;reject(Error('indexed_archive_read_failed'));};
    tx.oncomplete=()=>{if(failed||pageKeys.some(k=>!values.has(k))){reject(Error('indexed_archive_read_failed'));return;}resolve({entries:pageKeys.map(id=>({id,raw:values.get(id)??null})),nextCursor});};
    try{
     const history=tx.objectStore('history');
     const readPage=()=>{
      if(failed||--remaining!==0)return;
      keys.sort((a,b)=>a<b?-1:a>b?1:0);pageKeys=keys.slice(0,limit);nextCursor=keys.length>limit?pageKeys.at(-1)!:null;
      let index=0;const nextValue=()=>{if(failed||index===pageKeys.length)return;const key=pageKeys[index++],request=history.get(key);request.onerror=fail;request.onsuccess=()=>{try{
       const raw=typeof request.result==='string'?request.result:null;if(raw!==null&&raw.length>32*1024*1024-bytes){fail();return;}
       const encoder=new TextEncoder();bytes+=encoder.encode(key).byteLength+(raw===null?0:encoder.encode(raw).byteLength);if(bytes>32*1024*1024){fail();return;}values.set(key,raw);nextValue();
      }catch{fail();}};};nextValue();
     };
     for(const {prefix,upper,lower,range}of ranges){
      const request=history.openKeyCursor(range,'next');let count=0,previous:string|null=null;
      request.onerror=fail;request.onsuccess=()=>{if(failed)return;try{
       const cursor=request.result;if(!cursor){readPage();return;}const key=cursor.key;
       if(!owned(key)||!key.startsWith(prefix)||key<lower||key>=upper||(afterId!==null&&key<=afterId)||(previous!==null&&key<=previous)){fail();return;}
       previous=key;keys.push(key);if(++count>limit){readPage();return;}cursor.continue();
      }catch{fail();}};
     }
    }catch{fail();}
   });
  },
  async read(key){const db=await open();return new Promise<string|null>((resolve,reject)=>{
   const tx=db.transaction('drafts','readonly'),request=tx.objectStore('drafts').get(key);let raw:string|null=null;
   request.onsuccess=()=>{if(request.result===undefined)raw=null;else if(typeof request.result==='string')raw=request.result;else tx.abort();};
   tx.oncomplete=()=>resolve(raw);tx.onabort=tx.onerror=()=>reject(Error('indexed_read_failed'));
  });},
  async transition(key,expected,next,archive,signal){
   if(next!==null&&typeof next!=='string')throw Error('invalid_retained_write');
   if(signal?.aborted)return false;
   const db=await open();if(signal?.aborted)return false;return new Promise<boolean>((resolve,reject)=>{
    const tx=db.transaction(['drafts','history'],'readwrite'),pending=tx.objectStore('drafts'),history=tx.objectStore('history');let matched=false;
    const abort=()=>{try{tx.abort();}catch{/* Already completed. */}};
    signal?.addEventListener('abort',abort,{once:true});
    const cleanup=()=>signal?.removeEventListener('abort',abort);
    const request=pending.get(key);
    request.onsuccess=()=>{
     const before=request.result===undefined?null:request.result;
     if(before!==expected||signal?.aborted)return;
     const apply=()=>{if(next===null)pending.delete(key);else pending.put(next,key);matched=true;};
     if(!archive){apply();return;}
     // Keep a full immutable copy atomically with clearing/replacing pending.
     const retained=history.get(archive.id);
     retained.onsuccess=()=>{if(retained.result!==undefined&&retained.result!==archive.raw){tx.abort();return;}history.put(archive.raw,archive.id);apply();};
    };
    tx.oncomplete=()=>{cleanup();resolve(matched);};tx.onabort=tx.onerror=()=>{cleanup();if(signal?.aborted)resolve(false);else reject(Error('indexed_transition_failed'));};
   });
  },
 };
}
