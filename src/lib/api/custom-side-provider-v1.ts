import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import {isUuid} from './validation.ts';
import {
 customSideProviderWriteKindV4,
 isCustomSideOperatingOperationV4,
 readCustomSideOperatingWorkspaceV4,
 readCustomSideProviderWriteV4,
 customSidePolicyResultMatchesV4,
 type CustomSideOperatingOperationV4,
 type CustomSideProviderWriteV4,
 type CustomSideOperatingWorkspaceV4,
} from './custom-side-operating-v4.ts';

type RpcResult={data:unknown;error:unknown};
type UserResult={data:{user:{id:string}|null};error:unknown};
export type CustomSideAuthenticatedClientV1={auth:{getUser:()=>Promise<UserResult>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<RpcResult>};
/** Injected trusted server port. Implementations may use the existing service
 * RPC client after the ordinary authenticated actor has been resolved. This
 * module never creates, accepts, or forwards a service credential. */
export type CustomSideServiceRpcV1=(name:string,args:Record<string,unknown>)=>PromiseLike<RpcResult>;
export type CustomSideProviderScopeV1={actorId:string;tournamentId:string;eventId:string;poolId:string};
type Result<T>={data:T;error:null}|{data:null;error:'disabled'|'invalid_scope'|'permission_required'|'identity_changed'|'provider_unavailable'|'invalid_response'};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>object(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const uuid=(value:unknown):value is string=>isUuid(value)&&value===value.toLowerCase();
const clone=<T>(value:T):T=>structuredClone(value);
export const customSideProviderEnabledV1=()=>integratedTestFeatureEnabled();

async function official(client:CustomSideAuthenticatedClientV1,tournamentId:string,expectedActorId:string){
 const before=await client.auth.getUser();if(before.error||!before.data.user||!uuid(before.data.user.id))return'permission_required' as const;
 if(before.data.user.id!==expectedActorId)return'identity_changed' as const;
 const role=await client.rpc('get_tournament_role',{p_tournament_id:tournamentId});if(role.error||!['director','co_director'].includes(role.data as string))return'permission_required' as const;
 const after=await client.auth.getUser();if(after.error||after.data.user?.id!==expectedActorId)return'identity_changed' as const;
 return null;
}

export function createCustomSideProviderV1(options:{authenticated:CustomSideAuthenticatedClientV1;serviceRpc:CustomSideServiceRpcV1;enabled?:()=>boolean}){
 const enabled=options.enabled??customSideProviderEnabledV1;
 const validScope=(scope:CustomSideProviderScopeV1)=>[scope.actorId,scope.tournamentId,scope.eventId,scope.poolId].every(uuid);
 async function call(scope:CustomSideProviderScopeV1,name:string,args:Record<string,unknown>):Promise<Result<unknown>>{
  const fixedScope=clone(scope),fixedArgs=clone(args);
  if(enabled()!==true)return{data:null,error:'disabled'};if(!validScope(fixedScope))return{data:null,error:'invalid_scope'};
  const before=await official(options.authenticated,fixedScope.tournamentId,fixedScope.actorId);if(before)return{data:null,error:before};
  const result=await options.serviceRpc(name,fixedArgs);if(result.error)return{data:null,error:'provider_unavailable'};
  const after=await official(options.authenticated,fixedScope.tournamentId,fixedScope.actorId);if(after)return{data:null,error:after};
  return{data:clone(result.data),error:null};
 }
 return{
  workspace:async(scope:CustomSideProviderScopeV1):Promise<Result<CustomSideOperatingWorkspaceV4>>=>{
   const fixedScope=clone(scope);if(!validScope(fixedScope))return{data:null,error:'invalid_scope'};
   const result=await call(fixedScope,'get_custom_side_operating_workspace_provider_v4',{p_actor_id:fixedScope.actorId,p_tournament_id:fixedScope.tournamentId,p_event_id:fixedScope.eventId,p_pool_id:fixedScope.poolId});
   if(result.error)return result;const workspace=readCustomSideOperatingWorkspaceV4(result.data,fixedScope);return workspace?{data:workspace,error:null}:{data:null,error:'invalid_response'};
  },
  save:async(scope:CustomSideProviderScopeV1,operation:CustomSideOperatingOperationV4):Promise<Result<CustomSideProviderWriteV4>>=>{
   const fixedScope=clone(scope),fixedOperation=clone(operation);if(!validScope(fixedScope)||!isCustomSideOperatingOperationV4(fixedOperation))return{data:null,error:'invalid_scope'};
   const result=await call(fixedScope,'save_side_custom_operating_policy_provider_v4',{p_actor_id:fixedScope.actorId,p_tournament_id:fixedScope.tournamentId,p_event_id:fixedScope.eventId,p_pool_id:fixedScope.poolId,p_request:fixedOperation.request,p_operation_id:fixedOperation.operationId});
   if(result.error)return result;if(!customSidePolicyResultMatchesV4(result.data,fixedOperation,fixedScope.poolId))return{data:null,error:'invalid_response'};
   const record={kind:customSideProviderWriteKindV4,actorId:fixedScope.actorId,tournamentId:fixedScope.tournamentId,eventId:fixedScope.eventId,poolId:fixedScope.poolId,operationId:fixedOperation.operationId,operation:fixedOperation,outcome:clone(result.data)};
   const decoded=readCustomSideProviderWriteV4(record,{...fixedScope,operation:fixedOperation});return decoded?{data:decoded,error:null}:{data:null,error:'invalid_response'};
  },
  reconcile:async(scope:CustomSideProviderScopeV1,operation:CustomSideOperatingOperationV4):Promise<Result<CustomSideProviderWriteV4>>=>{
   const fixedScope=clone(scope),fixedOperation=clone(operation);if(!validScope(fixedScope)||!isCustomSideOperatingOperationV4(fixedOperation))return{data:null,error:'invalid_scope'};
   const result=await call(fixedScope,'get_side_custom_operating_reconciliation_provider_v4',{p_actor_id:fixedScope.actorId,p_tournament_id:fixedScope.tournamentId,p_event_id:fixedScope.eventId,p_pool_id:fixedScope.poolId,p_operation_id:fixedOperation.operationId,p_request:fixedOperation.request});
   if(result.error)return result;if(!exact(result.data,['authorized','result'])||result.data.authorized!==true||(result.data.result!==null&&!customSidePolicyResultMatchesV4(result.data.result,fixedOperation,fixedScope.poolId)))return{data:null,error:'invalid_response'};
   const record={kind:customSideProviderWriteKindV4,actorId:fixedScope.actorId,tournamentId:fixedScope.tournamentId,eventId:fixedScope.eventId,poolId:fixedScope.poolId,operationId:fixedOperation.operationId,operation:fixedOperation,outcome:clone(result.data.result)};
   const decoded=readCustomSideProviderWriteV4(record,{...fixedScope,operation:fixedOperation});return decoded?{data:decoded,error:null}:{data:null,error:'invalid_response'};
  },
 };
}
