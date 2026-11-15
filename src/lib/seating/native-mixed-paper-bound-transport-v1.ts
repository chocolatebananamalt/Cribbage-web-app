import type {createNativeMixedGameEvidenceTransportV1}from'../api/native-mixed-game-evidence-transport-v1.ts';
import type {NativeMixedGameTargetV1}from'./native-mixed-game-evidence-v1.ts';
type Transport=ReturnType<typeof createNativeMixedGameEvidenceTransportV1>;
/** Pin one current official context per mounted screen. A changed role, identity
 * binding, source or target revokes display admission; it never deletes pending
 * work or turns a failed read into permission to write. */
export function bindNativeMixedPaperTransportV1(base:Transport,onUnavailable:()=>void):Transport{
 let pinned:string|null=null,revoked=false;
 const unavailable=()=>{revoked=true;onUnavailable();return{data:null,error:'provider_unavailable' as const};};
 const metadata:Transport['paperBinding']=async(t:NativeMixedGameTargetV1)=>{
  if(revoked)return{data:null,error:'disabled'};
  const result=await base.paperBinding(t);if(!result.data)return unavailable();
  // Retained requests use canonical key order. Object insertion order is not a
  // changed identity/role/source and must not invalidate an equivalent context.
  const key=JSON.stringify(result.data,(_k,v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,(v as Record<string,unknown>)[k]])):v);
  if(pinned!==null&&key!==pinned)return unavailable();pinned=key;return result;
 };
 return{...base,paperBinding:metadata,
  state:async t=>{if(!(await metadata(t)).data)return{data:null,error:'provider_unavailable'};const r=await base.state(t);return r.data?r:unavailable();},
  write:async(t,r)=>!(await metadata(t)).data?{data:null,error:'provider_unavailable'}:base.write(t,r),
  resolve:async(t,r)=>!(await metadata(t)).data?{data:null,error:'provider_unavailable'}:base.resolve(t,r),
 };
}
