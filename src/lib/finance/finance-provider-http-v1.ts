import{createFinanceJsonHttpV1}from'./finance-provider-json-http-v1.ts';
import{readFinanceProviderUiWorkspaceV1,type FinanceProviderScopeV1}from'./operational-finance-provider-ui-v1.ts';
import type{FinanceProviderOperationPortV1}from'./finance-provider-operation-v1.ts';
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
/** Default-off browser transport. No actor is posted and no retry is automatic.
 * All write replies still pass the operation host's full-request receipt check. */
export function createFinanceProviderHttpV1(scope:FinanceProviderScopeV1,options:{enabled?:()=>boolean;fetch?:typeof globalThis.fetch}={}){
 if(Object.keys(scope).length!==3||!['actorId','tournamentId','eventId'].every(k=>Object.hasOwn(scope,k)&&uuid(scope[k as keyof FinanceProviderScopeV1])))throw Error('invalid_provider_scope');
 const fixed=Object.freeze(structuredClone(scope)),base=`/api/v1/tournaments/${fixed.tournamentId}/events/${fixed.eventId}/operational-finance`;
 const send=createFinanceJsonHttpV1({...options,expectedActorId:fixed.actorId});
 const operation:FinanceProviderOperationPortV1={
  save:request=>send(base,request),
  reconcile:operationId=>{if(!uuid(operationId))return Promise.reject(Error('invalid_operation'));return send(`${base}/operations/${operationId}`);},
 };
 return{operation,workspace:async()=>{const value=await send(base),workspace=readFinanceProviderUiWorkspaceV1(value,fixed);if(!workspace)throw Error('provider_workspace_unavailable');return workspace;}};
}
