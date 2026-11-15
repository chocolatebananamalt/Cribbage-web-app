import{createFinanceJsonHttpV1}from'./finance-provider-json-http-v1.ts';
import type{FinanceProviderScopeV1}from'./operational-finance-provider-ui-v1.ts';
import{isPreparedNativeCostAdoptionV1}from'./native-cost-adoption-plan-v1.ts';
import type{NativeCostAdoptionOperationPortV1}from'./native-cost-adoption-operation-v1.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const same=(a:unknown,b:unknown)=>JSON.stringify(a,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)===JSON.stringify(b,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
/** The authenticated route assembles raw sources. Browser projection checks
 * scope and pins only; it cannot grant source or payment authority. */
export function createNativeCostAdoptionHttpV1(scope:FinanceProviderScopeV1,options:{enabled?:()=>boolean;fetch?:typeof globalThis.fetch}={}){
 if(Object.keys(scope).length!==3||!['actorId','tournamentId','eventId'].every(k=>Object.hasOwn(scope,k)&&uuid(scope[k as keyof FinanceProviderScopeV1])))throw Error('invalid_provider_scope');
 const fixed=Object.freeze(structuredClone(scope)),send=createFinanceJsonHttpV1({...options,expectedActorId:fixed.actorId}),base=`/api/v1/tournaments/${fixed.tournamentId}/events/${fixed.eventId}/operational-finance/source-adoption`;
 const operation:NativeCostAdoptionOperationPortV1={save:request=>send(base,request),reconcile:operationId=>{if(!uuid(operationId))return Promise.reject(Error('invalid_operation'));return send(`${base}/operations/${operationId}`);}};
 return{operation,workspace:async()=>{
  const value=await send(base);if(!object(value)||Object.keys(value).length!==2||!object(value.raw)||!Object.hasOwn(value,'prepared'))throw Error('adoption_workspace_unavailable');
  const raw=value.raw;
  if(raw.kind!=='operational-finance-source-adoption-workspace-v1'||raw.actorId!==fixed.actorId||raw.tournamentId!==fixed.tournamentId||raw.eventId!==fixed.eventId||raw.proposalOnly!==true||raw.moneyMoved!==false||raw.payoutAuthorized!==false||raw.finalizationAuthorized!==false)throw Error('adoption_workspace_unavailable');
  if(raw.status==='blocked')return{raw:structuredClone(raw),prepared:null,blocked:true as const};
  if(raw.status!=='available'||!isPreparedNativeCostAdoptionV1(value.prepared))throw Error('adoption_workspace_unavailable');
  const p=value.prepared;
  if(p.actorId!==fixed.actorId||p.tournamentId!==fixed.tournamentId||p.eventId!==fixed.eventId||!object(raw.head)||!object(raw.currentSource)||!object(raw.currentSource.raw)||!object(raw.currentSource.raw.allocation)||p.head.revisionId!==raw.head.revisionId||p.head.version!==raw.head.version||p.head.sourceDigest!==raw.head.sourceDigest||p.head.basisDigest!==raw.head.basisDigest||!same(p.head.editor,raw.head.editor)||p.current.source.sourceDigest!==raw.currentSource.sourceDigest||p.currentBasisDigest!==raw.currentSource.basisDigest||p.currentAllocationRevisionId!==raw.currentSource.raw.allocation.revisionId||p.unchangedFrameDigest!==raw.unchangedFrameDigest)throw Error('adoption_workspace_unavailable');
  return{raw:structuredClone(raw),prepared:structuredClone(p),blocked:false as const};
 }};
}
