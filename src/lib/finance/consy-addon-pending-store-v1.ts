/** One per-record exclusive lease plus the app's account/document owner lease. */
export function createConsyPendingStoreV1(o:{key:string;get:(k:string)=>string|null;set:(k:string,v:string)=>void;remove:(k:string)=>void;exclusive:<T>(name:string,work:()=>Promise<T>)=>Promise<T>;track:<T>(work:()=>Promise<T>)=>Promise<T>;current:()=>boolean;recoveryCurrent:()=>boolean}){
 const key=o.key;
 return{read:()=>o.get(key),retry:<T>(raw:string,work:()=>Promise<T>)=>o.exclusive(`acc-consy-pending:${key}`,()=>o.track(async()=>{if(!o.recoveryCurrent()||o.get(key)!==raw)return null;return work();})),stage:(raw:string)=>o.exclusive(`acc-consy-pending:${key}`,()=>o.track(async()=>{if(!o.current()||o.get(key)!==null)return false;o.set(key,raw);return o.current()&&o.get(key)===raw;})),resolve:(raw:string)=>o.exclusive(`acc-consy-pending:${key}`,()=>o.track(async()=>{if(!o.recoveryCurrent()||o.get(key)!==raw)return false;o.remove(key);return o.get(key)===null;}))};
}
export type ConsyPendingStoreV1=ReturnType<typeof createConsyPendingStoreV1>;
