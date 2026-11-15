import{readNativeMixedPoolPreparationV1,readNativeMixedPoolWorkspaceV1,projectNativeMixedPoolPreparationV1,type NativeMixedPoolViewScopeV1}from'../finance/native-mixed-pool-preparation-view-v1.ts';

export type NativeMixedPoolResultsRowV1={poolId:string;kind:'q'|'side';slot:number;label:string;supported:boolean;configured:boolean;electedCount:number|null;simulatedPaidCount:number|null;fundMinor:number|null};
export type NativeMixedPoolResultsV1={status:'available'|'unavailable';rows:NativeMixedPoolResultsRowV1[];finalAwardsAvailable:false;finalAwards:null};

/** Pure projection of already-authorized Director reads. This cannot verify a
 * session, source currency or atomicity. Full elections must substantiate every
 * reported count; player-filtered workspaces must not stand in for that source.
 * No recipient selection, amount calculation, financial finality or zero-award
 * inference is performed. The existing getter does not expose final awards. */
export function projectNativeMixedPoolResultsV1(preparation:unknown,workspace:unknown,scope:NativeMixedPoolViewScopeV1):NativeMixedPoolResultsV1{
 const out:NativeMixedPoolResultsV1={status:'unavailable',rows:[],finalAwardsAvailable:false,finalAwards:null};
 const p=readNativeMixedPoolPreparationV1(preparation,scope),w=readNativeMixedPoolWorkspaceV1(workspace,scope);
 if(!p||!w)return out;
 const joined=projectNativeMixedPoolPreparationV1(p,w,scope,true);
 if(!joined.available||new Set(p.availablePools.map(x=>`${x.kind}:${x.slot}`)).size!==p.availablePools.length)return out;
 for(const policy of w.policies){
  const elections=w.elections.filter(e=>e.policyId===policy.policyId),elected=elections.filter(e=>e.elected).length,contributors=elections.filter(e=>e.simulatedFunded).length;
  if(elected!==policy.electedCount||contributors!==policy.simulatedPaidCount)return out;
 }
 const rows:NativeMixedPoolResultsRowV1[]=p.availablePools.map(pool=>{
  const policy=w.policies.find(x=>x.poolId===pool.poolId);
  return{poolId:pool.poolId,kind:pool.kind,slot:pool.slot,label:pool.label,supported:pool.supported,configured:policy!==undefined,electedCount:policy?.electedCount??null,simulatedPaidCount:policy?.simulatedPaidCount??null,fundMinor:policy?.simulatedFundMinor??null};
 });
 return{...out,status:'available',rows};
}
