import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import {
 isNativeOptionalFinanceProposalRequestV2,
 isNativeOptionalOwnershipRequestV2,
 readNativeOptionalFinanceReconciliationV2,
 readNativeOptionalFinanceWorkspaceV2,
 type NativeOptionalFinanceProposalRequestV2,
 type NativeOptionalFinanceScopeV2,
 type NativeOptionalOwnershipRequestV2,
} from './native-optional-finance-v2.ts';

type RpcResult={data:unknown;error:unknown};
type UserResult={data:{user:{id:string}|null};error:unknown};
export type NativeOptionalFinanceAuthenticatedClientV2={auth:{getUser:()=>Promise<UserResult>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<RpcResult>};
/** A trusted injected server port. This module neither constructs nor accepts
 * a service credential and never sends the ordinary session to this port. */
export type NativeOptionalFinanceServiceRpcV2=(name:string,args:Record<string,unknown>)=>PromiseLike<RpcResult>;
export type NativeOptionalFinanceOperationV2<R=NativeOptionalFinanceProposalRequestV2|NativeOptionalOwnershipRequestV2>={operationId:string;request:R};
export type NativeOptionalFinanceProviderActionV2='proposal'|'ownership';
export type NativeOptionalFinanceProviderWriteV2<R=NativeOptionalFinanceProposalRequestV2|NativeOptionalOwnershipRequestV2>={
 kind:'native-optional-finance-provider-write-v2';action:NativeOptionalFinanceProviderActionV2;actorId:string;tournamentId:string;eventId:string;operationId:string;request:R;result:unknown;
};
export type NativeOptionalOwnershipPreparationV2=NativeOptionalFinanceScopeV2&{
 kind:'native-optional-pool-ownership-preparation-v2';sourceDigest:string;
 costs:Array<{expenseEventId:string;description:string;amountMinor:number}>;
 funds:{regularReceiptsMinor:number;qReceiptsMinor:number;sideReceiptsMinor:number;recordedReceiptsMinor:number};
 moneyMoved:false;bankReceiptVerified:false;finalizationAuthorized:false;
};
type ErrorCode='disabled'|'invalid_scope'|'permission_required'|'identity_changed'|'provider_unavailable'|'invalid_response';
type Result<T>={data:T;error:null}|{data:null;error:ErrorCode};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>object(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const whole=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&!Object.is(value,-0);
const clone=<T>(value:T):T=>structuredClone(value);
const same=(a:unknown,b:unknown)=>JSON.stringify(a,(_key,value)=>object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)===JSON.stringify(b,(_key,value)=>object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
const validScope=(scope:unknown):scope is NativeOptionalFinanceScopeV2=>exact(scope,['actorId','tournamentId','eventId'])&&[scope.actorId,scope.tournamentId,scope.eventId].every(uuid);
const retryCodes=new Set(['isolation_not_supported','operation_busy','operation_incomplete','source_busy']);
const proposalRejectCodes=new Set(['feature_unavailable','invalid_request','idempotency_conflict','source_blocked','source_changed','stale_version','explicit_source_adoption_required','invalid_editor']);
const ownershipRejectCodes=new Set(['feature_unavailable','invalid_request','idempotency_conflict','source_blocked','source_changed','cost_coverage_incomplete','invalid_cost_classification','negative_regular_fund','stale_version']);
export const nativeOptionalFinanceProviderEnabledV2=()=>integratedTestFeatureEnabled();

function operationValid<R>(operation:NativeOptionalFinanceOperationV2<R>,requestGuard:(value:unknown)=>boolean){
 return exact(operation,['operationId','request'])&&uuid(operation.operationId)&&requestGuard(operation.request);
}
function proposalScopeValid(scope:NativeOptionalFinanceScopeV2,request:NativeOptionalFinanceProposalRequestV2){
 return request.editor.basis.source.tournamentId===scope.tournamentId&&request.editor.basis.source.eventId===scope.eventId&&request.editor.basis.payoutSource.tournamentId===scope.tournamentId&&request.editor.basis.payoutSource.eventId===scope.eventId;
}
function statusCode(value:unknown,rejects:Set<string>){
 return exact(value,['status','code'])&&((value.status==='retry_exact'&&retryCodes.has(value.code as string))||(value.status==='rejected'&&rejects.has(value.code as string)));
}
function unknown(value:unknown,scope:NativeOptionalFinanceScopeV2,operationId:string){
 return exact(value,['status','actorId','tournamentId','eventId','operationId'])&&value.status==='unknown'&&value.actorId===scope.actorId&&value.tournamentId===scope.tournamentId&&value.eventId===scope.eventId&&value.operationId===operationId;
}
function ownershipAccepted(value:unknown,scope:NativeOptionalFinanceScopeV2,operation:NativeOptionalFinanceOperationV2<NativeOptionalOwnershipRequestV2>){
 return exact(value,['status','revisionId','version','actorId','tournamentId','eventId','operationId','sourceDigest','moneyMoved','finalizationAuthorized'])&&value.status==='optional_pool_ownership_reviewed_v2'&&uuid(value.revisionId)&&value.version===operation.request.expectedVersion+1&&value.actorId===scope.actorId&&value.tournamentId===scope.tournamentId&&value.eventId===scope.eventId&&value.operationId===operation.operationId&&value.sourceDigest===operation.request.sourceDigest&&value.moneyMoved===false&&value.finalizationAuthorized===false;
}
function ownershipOutcome(value:unknown,scope:NativeOptionalFinanceScopeV2,operation:NativeOptionalFinanceOperationV2<NativeOptionalOwnershipRequestV2>,reconciliation=false){
 if(statusCode(value,reconciliation?new Set(['idempotency_conflict']):ownershipRejectCodes)||unknown(value,scope,operation.operationId))return clone(value);
 if(reconciliation){
  if(!exact(value,['status','result','currentFundAuthority','moneyMoved'])||value.status!=='historical_operation'||value.currentFundAuthority!==false||value.moneyMoved!==false||!ownershipAccepted(value.result,scope,operation))return null;
  return clone(value);
 }
 return ownershipAccepted(value,scope,operation)?clone(value):null;
}
function proposalOutcome(value:unknown,scope:NativeOptionalFinanceScopeV2,operation:NativeOptionalFinanceOperationV2<NativeOptionalFinanceProposalRequestV2>,reconciliation=false){
 if(statusCode(value,reconciliation?new Set(['idempotency_conflict']):proposalRejectCodes))return clone(value);
 if(reconciliation){
  const decoded=readNativeOptionalFinanceReconciliationV2(value,{...scope,operationId:operation.operationId,request:operation.request});
  return decoded?clone(decoded):null;
 }
 const decoded=readNativeOptionalFinanceReconciliationV2({status:'historical_operation',result:value,currentFundAuthority:false,moneyMoved:false},{...scope,operationId:operation.operationId,request:operation.request});
 return decoded?clone(value):null;
}
function writeEnvelope<R>(value:unknown,action:NativeOptionalFinanceProviderActionV2,scope:NativeOptionalFinanceScopeV2,operation:NativeOptionalFinanceOperationV2<R>,outcome:(value:unknown)=>unknown|null){
 if(!exact(value,['kind','action','actorId','tournamentId','eventId','operationId','request','result'])||value.kind!=='native-optional-finance-provider-write-v2'||value.action!==action||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||value.operationId!==operation.operationId||!same(value.request,operation.request)||outcome(value.result)===null)return null;
 return clone(value) as NativeOptionalFinanceProviderWriteV2<R>;
}
function prepareOwnership(value:unknown,scope:NativeOptionalFinanceScopeV2):NativeOptionalOwnershipPreparationV2|null{
 try{
  if(!exact(value,['status','kind','actorId','tournamentId','eventId','sourceDigest','capture','funds','moneyMoved','bankReceiptVerified','finalizationAuthorized'])||value.status!=='ownership_source_available'||value.kind!=='native-optional-pool-ownership-source-v2'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||!hash(value.sourceDigest)||value.moneyMoved!==false||value.bankReceiptVerified!==false||value.finalizationAuthorized!==false||!object(value.capture)||value.capture.kind!==value.kind||value.capture.tournamentId!==scope.tournamentId||value.capture.eventId!==scope.eventId||value.capture.refundPolicy!=='no-pool-refunds-v1'||!object(value.capture.basis)||!Array.isArray(value.capture.basis.expenses)||!exact(value.funds,['regularReceiptsMinor','qReceiptsMinor','sideReceiptsMinor','recordedReceiptsMinor']))return null;
  const funds=value.funds;if(!Object.values(funds).every(whole)||BigInt(funds.regularReceiptsMinor as number)+BigInt(funds.qReceiptsMinor as number)+BigInt(funds.sideReceiptsMinor as number)!==BigInt(funds.recordedReceiptsMinor as number))return null;
  const costs:NativeOptionalOwnershipPreparationV2['costs']=[],seen=new Set<string>();
  for(const expense of value.capture.basis.expenses){if(!exact(expense,['expenseEventId','description','amountMinor'])||!uuid(expense.expenseEventId)||seen.has(expense.expenseEventId)||typeof expense.description!=='string'||expense.description.length>500||expense.description!==expense.description.trim()||!whole(expense.amountMinor))return null;seen.add(expense.expenseEventId);costs.push({expenseEventId:expense.expenseEventId,description:expense.description,amountMinor:expense.amountMinor});}
  return clone({...scope,kind:'native-optional-pool-ownership-preparation-v2' as const,sourceDigest:value.sourceDigest,costs,funds:{regularReceiptsMinor:funds.regularReceiptsMinor as number,qReceiptsMinor:funds.qReceiptsMinor as number,sideReceiptsMinor:funds.sideReceiptsMinor as number,recordedReceiptsMinor:funds.recordedReceiptsMinor as number},moneyMoved:false as const,bankReceiptVerified:false as const,finalizationAuthorized:false as const});
 }catch{return null;}
}

async function official(client:NativeOptionalFinanceAuthenticatedClientV2,scope:NativeOptionalFinanceScopeV2){
 const user=await client.auth.getUser();
 if(user.error||!user.data.user||!uuid(user.data.user.id))return'permission_required' as const;
 if(user.data.user.id!==scope.actorId)return'identity_changed' as const;
 const role=await client.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId});
 if(role.error||role.data!=='director')return'permission_required' as const;
 const after=await client.auth.getUser();
 if(after.error||after.data.user?.id!==scope.actorId)return'identity_changed' as const;
 return null;
}

export function createNativeOptionalFinanceProviderV2(options:{authenticated:NativeOptionalFinanceAuthenticatedClientV2;serviceRpc:NativeOptionalFinanceServiceRpcV2;enabled?:()=>boolean}){
 const enabled=options.enabled??nativeOptionalFinanceProviderEnabledV2;
 async function call(scope:NativeOptionalFinanceScopeV2,name:string,args:Record<string,unknown>):Promise<Result<unknown>>{
  const fixedScope=clone(scope),fixedArgs=clone(args);
  if(enabled()!==true)return{data:null,error:'disabled'};
  if(!validScope(fixedScope))return{data:null,error:'invalid_scope'};
  const before=await official(options.authenticated,fixedScope);if(before)return{data:null,error:before};
  const response=await options.serviceRpc(name,fixedArgs);if(response.error)return{data:null,error:'provider_unavailable'};
  const after=await official(options.authenticated,fixedScope);if(after)return{data:null,error:after};
  return{data:clone(response.data),error:null};
 }
 return{
  workspace:async(scope:NativeOptionalFinanceScopeV2)=>{
   const fixedScope=clone(scope);if(!validScope(fixedScope))return{data:null,error:'invalid_scope'} as const;
   const response=await call(fixedScope,'get_native_optional_finance_workspace_provider_v2',{actor:fixedScope.actorId,tid:fixedScope.tournamentId,eid:fixedScope.eventId});
   if(response.error)return response;const decoded=readNativeOptionalFinanceWorkspaceV2(response.data,fixedScope);return decoded?{data:decoded,error:null} as const:{data:null,error:'invalid_response'} as const;
  },
  ownershipPreparation:async(scope:NativeOptionalFinanceScopeV2):Promise<Result<NativeOptionalOwnershipPreparationV2>>=>{
   const fixedScope=clone(scope);if(!validScope(fixedScope))return{data:null,error:'invalid_scope'};
   const response=await call(fixedScope,'get_native_optional_pool_ownership_source_provider_v2',{actor:fixedScope.actorId,tid:fixedScope.tournamentId,eid:fixedScope.eventId});
   if(response.error)return response;const decoded=prepareOwnership(response.data,fixedScope);return decoded?{data:decoded,error:null}:{data:null,error:'invalid_response'};
  },
  saveProposal:async(scope:NativeOptionalFinanceScopeV2,operation:NativeOptionalFinanceOperationV2<NativeOptionalFinanceProposalRequestV2>):Promise<Result<NativeOptionalFinanceProviderWriteV2<NativeOptionalFinanceProposalRequestV2>>>=>{
   const fixedScope=clone(scope),fixedOperation=clone(operation);if(!validScope(fixedScope)||!operationValid(fixedOperation,isNativeOptionalFinanceProposalRequestV2)||!proposalScopeValid(fixedScope,fixedOperation.request))return{data:null,error:'invalid_scope'};
   const response=await call(fixedScope,'save_native_optional_finance_proposal_provider_v2',{actor:fixedScope.actorId,tid:fixedScope.tournamentId,eid:fixedScope.eventId,op:fixedOperation.operationId,request:fixedOperation.request});
   if(response.error)return response;const decoded=writeEnvelope(response.data,'proposal',fixedScope,fixedOperation,value=>proposalOutcome(value,fixedScope,fixedOperation));return decoded?{data:decoded,error:null}:{data:null,error:'invalid_response'};
  },
  reconcileProposal:async(scope:NativeOptionalFinanceScopeV2,operation:NativeOptionalFinanceOperationV2<NativeOptionalFinanceProposalRequestV2>):Promise<Result<NativeOptionalFinanceProviderWriteV2<NativeOptionalFinanceProposalRequestV2>>>=>{
   const fixedScope=clone(scope),fixedOperation=clone(operation);if(!validScope(fixedScope)||!operationValid(fixedOperation,isNativeOptionalFinanceProposalRequestV2)||!proposalScopeValid(fixedScope,fixedOperation.request))return{data:null,error:'invalid_scope'};
   const response=await call(fixedScope,'reconcile_native_optional_finance_proposal_provider_v2',{actor:fixedScope.actorId,tid:fixedScope.tournamentId,eid:fixedScope.eventId,op:fixedOperation.operationId,request:fixedOperation.request});
   if(response.error)return response;const result=proposalOutcome(response.data,fixedScope,fixedOperation,true);if(result===null)return{data:null,error:'invalid_response'};return{data:{kind:'native-optional-finance-provider-write-v2',action:'proposal',...fixedScope,operationId:fixedOperation.operationId,request:fixedOperation.request,result},error:null};
  },
  saveOwnership:async(scope:NativeOptionalFinanceScopeV2,operation:NativeOptionalFinanceOperationV2<NativeOptionalOwnershipRequestV2>):Promise<Result<NativeOptionalFinanceProviderWriteV2<NativeOptionalOwnershipRequestV2>>>=>{
   const fixedScope=clone(scope),fixedOperation=clone(operation);if(!validScope(fixedScope)||!operationValid(fixedOperation,isNativeOptionalOwnershipRequestV2))return{data:null,error:'invalid_scope'};
   const response=await call(fixedScope,'save_native_optional_pool_ownership_provider_v2',{actor:fixedScope.actorId,tid:fixedScope.tournamentId,eid:fixedScope.eventId,op:fixedOperation.operationId,request:fixedOperation.request});
   if(response.error)return response;const decoded=writeEnvelope(response.data,'ownership',fixedScope,fixedOperation,value=>ownershipOutcome(value,fixedScope,fixedOperation));return decoded?{data:decoded,error:null}:{data:null,error:'invalid_response'};
  },
  reconcileOwnership:async(scope:NativeOptionalFinanceScopeV2,operation:NativeOptionalFinanceOperationV2<NativeOptionalOwnershipRequestV2>):Promise<Result<NativeOptionalFinanceProviderWriteV2<NativeOptionalOwnershipRequestV2>>>=>{
   const fixedScope=clone(scope),fixedOperation=clone(operation);if(!validScope(fixedScope)||!operationValid(fixedOperation,isNativeOptionalOwnershipRequestV2))return{data:null,error:'invalid_scope'};
   const response=await call(fixedScope,'reconcile_native_optional_pool_ownership_provider_v2',{actor:fixedScope.actorId,tid:fixedScope.tournamentId,eid:fixedScope.eventId,op:fixedOperation.operationId,request:fixedOperation.request});
   if(response.error)return response;const result=ownershipOutcome(response.data,fixedScope,fixedOperation,true);if(result===null)return{data:null,error:'invalid_response'};return{data:{kind:'native-optional-finance-provider-write-v2',action:'ownership',...fixedScope,operationId:fixedOperation.operationId,request:fixedOperation.request,result},error:null};
  },
 };
}
