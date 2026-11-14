import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import {readConsyAddonBindingsV1} from '../finance/consy-addon-source-contract-v1.ts';
import type{NativeLedgerRequestV1}from'../finance/native-ledger-handlers-v1.ts';
import {readNativeLedgerReceiptV1} from '../finance/native-ledger-receipt-v1.ts';
import {
 isOperationalFinanceSourceAdoptionRequestV1,
 readOperationalFinanceSourceAdoptionReceiptV1,
 readOperationalFinanceSourceAdoptionWorkspaceV1,
 type OperationalFinanceSourceAdoptionRequestV1,
} from './operational-finance-source-adoption-v1.ts';
import type{AuthenticatedProviderClientV1}from'./operational-provider-transport-v1.ts';

type Scope={tournamentId:string;eventId:string};
type Result={data:unknown;error:null|string};
type OfficialResult={actorId:string}|{error:'permission_required'|'identity_changed'};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>object(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const whole=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&!Object.is(value,-0);
const text=(value:unknown,max:number)=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const clone=<T>(value:T):T=>structuredClone(value);
const canonical=(value:unknown)=>JSON.stringify(value,(_key,next)=>object(next)?Object.fromEntries(Object.keys(next).sort().map(key=>[key,next[key]])):next);
export const operationalFinanceSourceAdoptionProviderEnabledV1=()=>integratedTestFeatureEnabled();

async function official(client:AuthenticatedProviderClientV1,tournamentId:string,expectedActorId:string):Promise<OfficialResult>{
 const first=await client.auth.getUser();if(first.error||!first.data.user||!uuid(first.data.user.id))return{error:'permission_required' as const};
 if(first.data.user.id!==expectedActorId)return{error:'identity_changed' as const};
 const role=await client.rpc('get_tournament_role',{p_tournament_id:tournamentId});if(role.error||!['director','co_director'].includes(role.data as string))return{error:'permission_required' as const};
 const second=await client.auth.getUser();if(second.error||second.data.user?.id!==expectedActorId)return{error:'identity_changed' as const};
 return{actorId:expectedActorId};
}

export function isNativeLedgerAllocationWireRequestV1(value:unknown):value is NativeLedgerRequestV1{
 return exact(value,['kind','operationId','expectedRevisionId','sourceDigest','allocations','reason','reviewed'])&&value.kind==='native-ledger-allocation-v1'&&uuid(value.operationId)&&(value.expectedRevisionId===null||uuid(value.expectedRevisionId))&&hash(value.sourceDigest)&&Array.isArray(value.allocations)&&value.allocations.length<=10000&&text(value.reason,500)&&value.reviewed===true;
}

export function readNativeLedgerAllocationProviderWorkspaceV1(value:unknown,scope:{actorId:string;tournamentId:string}){
 if(!exact(value,['kind','actorId','tournamentId','sources','allocation','proposalOnly','moneyMoved','payoutAuthorized','finalizationAuthorized'])||value.kind!=='native-ledger-allocation-provider-workspace-v1'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.proposalOnly!==true||value.moneyMoved!==false||value.payoutAuthorized!==false||value.finalizationAuthorized!==false||!exact(value.sources,['status','kind','actorId','tournamentId','sourceDigest','facts','snapshotConsistency','allocationCapability','additionalIncomeSourceAvailable','bankReceiptVerified','moneyMoved'])||value.sources.status!=='sources_available'||readConsyAddonBindingsV1(value.sources)===null||value.sources.actorId!==scope.actorId||value.sources.tournamentId!==scope.tournamentId||!hash(value.sources.sourceDigest)||!object(value.sources.facts)||!['statement_snapshot','locked_source_snapshot'].includes(value.sources.snapshotConsistency as string)||value.sources.allocationCapability!==false||value.sources.additionalIncomeSourceAvailable!==false||value.sources.bankReceiptVerified!==false||value.sources.moneyMoved!==false||!object(value.allocation)||!['unallocated','current','stale','retry_exact','blocked'].includes(value.allocation.status as string))return null;
 if(value.allocation.status==='current'&&(!uuid(value.allocation.revisionId)||!whole(value.allocation.version)||Number(value.allocation.version)<1||value.allocation.fundAvailable!==true||value.allocation.moneyMoved!==false||value.allocation.payoutAuthorized!==false||!object(value.allocation.snapshot)||value.allocation.snapshot.tournamentId!==scope.tournamentId))return null;
 if(value.allocation.status==='unallocated'&&(value.allocation.revisionId!==null||!hash(value.allocation.sourceDigest)||value.allocation.fundAvailable!==false))return null;
 return clone(value);
}

function readAllocationWrite(value:unknown,scope:{actorId:string;tournamentId:string;operationId:string},request?:NativeLedgerRequestV1){
 if(!exact(value,['kind','actorId','tournamentId','operationId','request','outcome'])||value.kind!=='native-ledger-allocation-provider-write-v1'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.operationId!==scope.operationId)return null;
 if(value.request===null&&value.outcome===null&&request===undefined)return clone(value);
 if(!isNativeLedgerAllocationWireRequestV1(value.request)||value.request.operationId!==scope.operationId||(request!==undefined&&canonical(value.request)!==canonical(request))||!object(value.outcome))return null;
 const envelope={kind:'native-ledger-transport-v1' as const,actorId:scope.actorId,tournamentId:scope.tournamentId,request:value.request};
 if(value.outcome.status==='retry_exact')return typeof value.outcome.code==='string'?clone(value):null;
 return readNativeLedgerReceiptV1(value.outcome,envelope).status==='unverified'?null:clone(value);
}

/** Authenticated cookie/session transport only. No service key or posted actor is
 * accepted, and the literal-false capability cannot be enabled by environment. */
export function createOperationalFinanceSourceAdoptionTransportV1(client:AuthenticatedProviderClientV1,enabled:()=>boolean=operationalFinanceSourceAdoptionProviderEnabledV1){
 async function call(tournamentId:string,expectedActorId:string,name:string,args:Record<string,unknown>):Promise<Result&{actorId?:string}>{
  if(enabled()!==true)return{data:null,error:'disabled'};if(!uuid(tournamentId)||!uuid(expectedActorId))return{data:null,error:'invalid_scope'};
  const before=await official(client,tournamentId,expectedActorId);if('error'in before)return{data:null,error:before.error};
  const response=await client.rpc(name,args);if(response.error)return{data:null,error:'provider_unavailable'};
  const after=await official(client,tournamentId,expectedActorId);if('error'in after||after.actorId!==before.actorId)return{data:null,error:'identity_changed'};
  return{data:clone(response.data),error:null,actorId:before.actorId};
 }
 return{
  workspace:async(scope:Scope,expectedActorId:string)=>{const result=await call(scope.tournamentId,expectedActorId,'get_operational_finance_source_adoption_workspace_provider_v1',{tid:scope.tournamentId,eid:scope.eventId}),data=!result.error&&result.actorId&&readOperationalFinanceSourceAdoptionWorkspaceV1(result.data,{...scope,actorId:result.actorId});return data?{data,error:null}:{data:null,error:result.error??'invalid_response'};},
  save:async(scope:Scope,request:OperationalFinanceSourceAdoptionRequestV1,expectedActorId:string)=>{if(!isOperationalFinanceSourceAdoptionRequestV1(request))return{data:null,error:'invalid_request'};const result=await call(scope.tournamentId,expectedActorId,'save_operational_finance_source_adoption_provider_v1',{tid:scope.tournamentId,eid:scope.eventId,request_value:request}),data=!result.error&&result.actorId&&readOperationalFinanceSourceAdoptionReceiptV1(result.data,{...scope,actorId:result.actorId,operationId:request.operationId},request);return data?{data,error:null}:{data:null,error:result.error??'invalid_response'};},
  operation:async(scope:Scope,operationId:string,expectedActorId:string)=>{if(!uuid(operationId))return{data:null,error:'invalid_request'};const result=await call(scope.tournamentId,expectedActorId,'get_operational_finance_source_adoption_operation_provider_v1',{tid:scope.tournamentId,eid:scope.eventId,op:operationId}),data=!result.error&&result.actorId&&readOperationalFinanceSourceAdoptionReceiptV1(result.data,{...scope,actorId:result.actorId,operationId});return data?{data,error:null}:{data:null,error:result.error??'invalid_response'};},
  allocationWorkspace:async(tournamentId:string,expectedActorId:string)=>{const result=await call(tournamentId,expectedActorId,'get_native_ledger_allocation_provider_v1',{tid:tournamentId}),data=!result.error&&result.actorId&&readNativeLedgerAllocationProviderWorkspaceV1(result.data,{actorId:result.actorId,tournamentId});return data?{data,error:null}:{data:null,error:result.error??'invalid_response'};},
  saveAllocation:async(tournamentId:string,request:NativeLedgerRequestV1,expectedActorId:string)=>{if(!isNativeLedgerAllocationWireRequestV1(request))return{data:null,error:'invalid_request'};const result=await call(tournamentId,expectedActorId,'save_native_ledger_allocation_provider_v1',{tid:tournamentId,request_value:request}),data=!result.error&&result.actorId&&readAllocationWrite(result.data,{actorId:result.actorId,tournamentId,operationId:request.operationId},request);return data?{data,error:null}:{data:null,error:result.error??'invalid_response'};},
  allocationOperation:async(tournamentId:string,operationId:string,expectedActorId:string)=>{if(!uuid(operationId))return{data:null,error:'invalid_request'};const result=await call(tournamentId,expectedActorId,'get_native_ledger_allocation_operation_provider_v1',{tid:tournamentId,op:operationId}),data=!result.error&&result.actorId&&readAllocationWrite(result.data,{actorId:result.actorId,tournamentId,operationId});return data?{data,error:null}:{data:null,error:result.error??'invalid_response'};},
 };
}
