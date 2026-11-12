/** Source-only browser adapter. Construction/import never opens a database.
 * A host must explicitly enable it after its recovery/ownership protocol has
 * passed runtime acceptance. No data is expired, cleared on sign-out or rebased.
 */
export type SeriesGameRetainedPortV1={
 read:(key:string)=>Promise<string|null>;
 /** Abort must roll back an uncommitted transition, never clear newer work. */
 transition:(key:string,expected:string|null,next:string|null,archive?:{id:string;raw:string},signal?:AbortSignal)=>Promise<boolean>;
};
export function seriesGameRetainedKeyV1(actorId:string,tournamentId:string,eventId:string){
 const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
 if(![actorId,tournamentId,eventId].every(v=>uuid.test(v)))throw Error('invalid_retained_scope');
 // Deliberately NOT keyed by generation/match: a changed bracket must find and
 // block on earlier pending work for this account/event instead of hiding it.
 return `series-game-pending-v1:${actorId}:${tournamentId}:${eventId}`;
}
export function createIndexedSeriesGameRetainedV1(factory:IDBFactory|undefined=globalThis.indexedDB):SeriesGameRetainedPortV1{
 let opening:Promise<IDBDatabase>|null=null;
 const open=()=>{
  if(opening)return opening;
  opening=new Promise<IDBDatabase>((resolve,reject)=>{
   let failed=false;
   if(!factory){reject(Error('indexed_storage_unavailable'));return;}
   const request=factory.open('cribbage-playoff-pending-v1',1);
   request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('pending'))db.createObjectStore('pending');if(!db.objectStoreNames.contains('history'))db.createObjectStore('history');};
   request.onerror=()=>{failed=true;reject(Error('indexed_storage_unavailable'));};
   request.onblocked=()=>{failed=true;reject(Error('indexed_storage_blocked'));};
   request.onsuccess=()=>{const db=request.result;if(failed){db.close();return;}db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
  });
  return opening.catch(error=>{opening=null;throw error;});
 };
 return{
  async read(key){const db=await open();return new Promise<string|null>((resolve,reject)=>{
   const tx=db.transaction('pending','readonly'),request=tx.objectStore('pending').get(key);let raw:string|null=null;
   request.onsuccess=()=>{if(request.result===undefined)raw=null;else if(typeof request.result==='string')raw=request.result;else tx.abort();};
   tx.oncomplete=()=>resolve(raw);tx.onabort=tx.onerror=()=>reject(Error('indexed_read_failed'));
  });},
  async transition(key,expected,next,archive,signal){
   if(next!==null&&typeof next!=='string')throw Error('invalid_retained_write');
   if(signal?.aborted)return false;
   const db=await open();if(signal?.aborted)return false;return new Promise<boolean>((resolve,reject)=>{
    const tx=db.transaction(['pending','history'],'readwrite'),pending=tx.objectStore('pending'),history=tx.objectStore('history');let matched=false;
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
