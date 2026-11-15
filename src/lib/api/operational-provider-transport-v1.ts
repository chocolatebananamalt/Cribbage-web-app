import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import {assembleNativeOperationalFinanceV1} from '../finance/operational-finance-native-assembler-v1.ts';
import {isRestorableEventFinanceEditorV1} from '../finance/event-finance-draft-codec-v1.ts';
import {isEventSettingsWorkspaceV3} from './event-settings-handlers-v3.ts';
import {isEventSettingsSetupV3,type EventSettingsSetupEnvelopeV3} from './event-settings-setup-v3.ts';
import {readEventSettingsCustomPoolProviderWriteV4} from './event-settings-custom-pool-v4.ts';
import {validateNativeFinalAwardRequestV1,validateNativeFundReviewRequestV1,validateNativeRecordedIncomeRequestV1} from '../finance/native-final-award-requests-v1.ts';
import {projectNativeFinalRecipientEstimateV1} from '../finance/native-playoff-recipient-v1.ts';
import {reconcileNativeFinalAwardSourceV1} from '../finance/native-final-award-reconciliation-v1.ts';
import {decodeNativeFinalAwardRecordV1} from '../finance/native-final-award-record-v1.ts';
import type{EventFinanceWorkspaceV1}from'../finance/event-finance-workspace-v1.ts';
import {readNativeRecordedFundReviewSourceServerV1} from './native-recorded-fund-review-source-v1.ts';

type RpcResult={data:unknown;error:unknown};
type UserResult={data:{user:{id:string}|null};error:unknown};
export type AuthenticatedProviderClientV1={auth:{getUser:()=>Promise<UserResult>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<RpcResult>};
export type ProviderAccessV1={actorId:string;roles:Array<'director'|'co_director'>};
type AccessResult={access:ProviderAccessV1;error:null}|{access:null;error:'permission_required'|'identity_changed'};
type Scope={tournamentId:string;eventId:string};
type Result={data:unknown;error:null|string;actorId?:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const version=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=2147483646&&!Object.is(v,-0);
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const iso=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v));
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const noAuthority=(v:unknown)=>object(v)&&['moneyMoved','payoutAuthorized','disbursementAuthorized','finalizationAuthorized'].every(k=>v[k]!==true);
export const operationalProviderTransportEnabledV1=()=>integratedTestFeatureEnabled();

export type OperationalFinanceProviderWorkspaceV1={
 kind:'operational-finance-provider-workspace-v1';actorId:string;tournamentId:string;eventId:string;
 currentSource:unknown;head:null|{revisionId:string;version:number;sourceDigest:string;basisDigest:string;editor:unknown;reason:string;createdAt:string};
 compatibility:{status:'empty'|'same_basis'|'source_revision_changed_requires_review';editable:boolean};
 proposalOnly:true;moneyMoved:false;payoutAuthorized:false;finalizationAuthorized:false;
};
export type OperationalFinanceProviderRouteWorkspaceV1=OperationalFinanceProviderWorkspaceV1&{preparedCurrent:EventFinanceWorkspaceV1;currentBasisDigest:string};
export function readOperationalFinanceProviderWorkspaceV1(v:unknown,scope:Scope&{actorId:string}):OperationalFinanceProviderWorkspaceV1|null{
 if(!exact(v,['kind','actorId','tournamentId','eventId','currentSource','head','compatibility','proposalOnly','moneyMoved','payoutAuthorized','finalizationAuthorized'])||v.kind!=='operational-finance-provider-workspace-v1'||v.actorId!==scope.actorId||v.tournamentId!==scope.tournamentId||v.eventId!==scope.eventId||v.proposalOnly!==true||v.moneyMoved!==false||v.payoutAuthorized!==false||v.finalizationAuthorized!==false)return null;
 if(!assembleNativeOperationalFinanceV1(v.currentSource,scope))return null;
 if(!exact(v.compatibility,['status','editable'])||!['empty','same_basis','source_revision_changed_requires_review'].includes(v.compatibility.status as string)||v.compatibility.editable!==(v.compatibility.status==='empty'||v.compatibility.status==='same_basis'))return null;
 if(v.head===null)return v.compatibility.status==='empty'?structuredClone(v)as OperationalFinanceProviderWorkspaceV1:null;
 const head=v.head;
 if(!exact(head,['revisionId','version','sourceDigest','basisDigest','editor','reason','createdAt'])||!uuid(head.revisionId)||!version(head.version)||(head.version as number)<1||!hash(head.sourceDigest)||!hash(head.basisDigest)||!isRestorableEventFinanceEditorV1(head.editor)||head.editor.basis.source.tournamentId!==scope.tournamentId||head.editor.basis.source.eventId!==scope.eventId||head.editor.basis.payoutSource.tournamentId!==scope.tournamentId||head.editor.basis.payoutSource.eventId!==scope.eventId||!text(head.reason,2000)||!iso(head.createdAt)||v.compatibility.status==='empty')return null;
 const current=v.currentSource as {sourceDigest:string;basisDigest:string};
 if((v.compatibility.status==='same_basis')!==(head.sourceDigest===current.sourceDigest&&head.basisDigest===current.basisDigest))return null;
 return structuredClone(v)as OperationalFinanceProviderWorkspaceV1;
}

export function isOperationalFinanceProposalWireRequestV1(v:unknown){
 return exact(v,['kind','operationId','expectedVersion','expectedSourceDigest','expectedBasisDigest','editor','reason'])&&v.kind==='operational-event-finance-proposal-v1'&&uuid(v.operationId)&&version(v.expectedVersion)&&hash(v.expectedSourceDigest)&&hash(v.expectedBasisDigest)&&isRestorableEventFinanceEditorV1(v.editor)&&text(v.reason,2000);
}

async function currentOfficial(client:AuthenticatedProviderClientV1,tid:string,expectedActorId:string):Promise<AccessResult>{
 const before=await client.auth.getUser();if(before.error||!before.data.user||!uuid(before.data.user.id))return{access:null,error:'permission_required'};
 if(before.data.user.id!==expectedActorId)return{access:null,error:'identity_changed'};
 const role=await client.rpc('get_tournament_role',{p_tournament_id:tid});if(role.error||!['director','co_director'].includes(role.data as string))return{access:null,error:'permission_required'};
 const after=await client.auth.getUser();if(after.error||after.data.user?.id!==expectedActorId)return{access:null,error:'identity_changed'};
 return{access:{actorId:expectedActorId,roles:[role.data as'director'|'co_director']},error:null};
}

function eventSettingsWrite(v:unknown,actorId:string,tid:string,envelope:EventSettingsSetupEnvelopeV3){
 const op=envelope.setup.request.idempotencyKey;
 if(!exact(v,['actorId','tid','operationId','envelope','outcome'])||v.actorId!==actorId||v.tid!==tid||v.operationId!==op||!same(v.envelope,envelope)||!object(v.outcome)||!noAuthority(v.outcome))return null;
 return structuredClone(v);
}
export function readBoundOperationalProviderWriteV1(v:unknown,kind:'operational-finance-provider-write-v1'|'native-finance-provider-write-v1',actorId:string,scope:Scope,request?:unknown){
 if(!exact(v,['kind','actorId','tournamentId','eventId','operationId','request','outcome'])||v.kind!==kind||v.actorId!==actorId||v.tournamentId!==scope.tournamentId||v.eventId!==scope.eventId||!object(v.request)||!uuid(v.operationId)||v.operationId!==v.request.operationId||(request!==undefined&&!same(v.request,request))||!object(v.outcome)||!noAuthority(v.outcome))return null;
 return{request:structuredClone(v.request),outcome:structuredClone(v.outcome),record:structuredClone(v)};
}

/** Cookie/session-bound RPC port. The client must be the ordinary authenticated
 * Supabase client. No service key, actor argument, or identity claim is accepted.
 * The default capability is literal false until provider acceptance is complete. */
export function createOperationalProviderTransportV1(client:AuthenticatedProviderClientV1,enabled:()=>boolean=operationalProviderTransportEnabledV1){
 const access=async(tid:string,expectedActorId:string)=>{if(enabled()!==true)return null;if(!uuid(tid)||!uuid(expectedActorId))return null;return(await currentOfficial(client,tid,expectedActorId)).access;};
 async function call(tid:string,expectedActorId:string,name:string,args:Record<string,unknown>):Promise<Result>{
  if(enabled()!==true)return{data:null,error:'disabled'};if(!uuid(tid)||!uuid(expectedActorId))return{data:null,error:'invalid_scope'};
  const before=await currentOfficial(client,tid,expectedActorId);if(before.error)return{data:null,error:before.error};
  const result=await client.rpc(name,args);if(result.error)return{data:null,error:'provider_unavailable'};
  const after=await currentOfficial(client,tid,expectedActorId);if(after.error||after.access.actorId!==before.access.actorId)return{data:null,error:'identity_changed'};
  return{data:structuredClone(result.data),error:null,actorId:before.access.actorId};
 }
 return{
  access,
  eventSettingsWorkspace:async(tid:string,expectedActorId:string)=>{const r=await call(tid,expectedActorId,'get_event_settings_workspace_provider_v3',{tid});return!r.error&&r.actorId&&isEventSettingsWorkspaceV3(r.data,r.actorId,tid)?r:{data:null,error:r.error??'invalid_response'};},
  saveEventSettings:async(tid:string,envelope:EventSettingsSetupEnvelopeV3,expectedActorId:string)=>{const r=await call(tid,expectedActorId,'save_event_settings_draft_provider_v3',{tid,envelope}),data=!r.error&&r.actorId&&eventSettingsWrite(r.data,r.actorId,tid,envelope);return data?{data,error:null}:{data:null,error:r.error??'invalid_response'};},
  eventSettingsOperation:async(tid:string,operationId:string,expectedActorId:string)=>{const r=await call(tid,expectedActorId,'get_event_settings_operation_provider_v3',{tid,op:operationId});if(r.error||!r.actorId||!exact(r.data,['actorId','tid','operationId','envelope','outcome'])||r.data.actorId!==r.actorId||r.data.tid!==tid||r.data.operationId!==operationId||!isEventSettingsProviderRequestV3(r.data.envelope,tid)||r.data.envelope.setup.request.idempotencyKey!==operationId||!object(r.data.outcome)||!noAuthority(r.data.outcome))return{data:null,error:r.error??'invalid_response'};return{data:r.data,error:null};},
  saveEventSettingsCustomPool:async(tid:string,envelope:EventSettingsSetupEnvelopeV3,expectedActorId:string)=>{const fixedEnvelope=structuredClone(envelope),base=structuredClone(fixedEnvelope.setup.base);if(!isEventSettingsSetupV3(fixedEnvelope,base)||base.tournamentId!==tid)return{data:null,error:'invalid_request'};const r=await call(tid,expectedActorId,'save_event_settings_custom_pool_draft_provider_v4',{tid,envelope:fixedEnvelope}),data=!r.error&&r.actorId&&readEventSettingsCustomPoolProviderWriteV4(r.data,{actorId:r.actorId,tournamentId:tid,envelope:fixedEnvelope,base});return data?{data,error:null}:{data:null,error:r.error??'invalid_response'};},
  eventSettingsCustomPoolOperation:async(tid:string,operationId:string,envelope:EventSettingsSetupEnvelopeV3,expectedActorId:string)=>{const fixedEnvelope=structuredClone(envelope),base=structuredClone(fixedEnvelope.setup.base);if(!uuid(operationId)||!isEventSettingsSetupV3(fixedEnvelope,base)||base.tournamentId!==tid||fixedEnvelope.setup.request.idempotencyKey!==operationId)return{data:null,error:'invalid_request'};const r=await call(tid,expectedActorId,'get_event_settings_custom_pool_operation_provider_v4',{tid,op:operationId}),data=!r.error&&r.actorId&&readEventSettingsCustomPoolProviderWriteV4(r.data,{actorId:r.actorId,tournamentId:tid,envelope:fixedEnvelope,base});return data?{data,error:null}:{data:null,error:r.error??'invalid_response'};},
  financeWorkspace:async(scope:Scope,expectedActorId:string)=>{const r=await call(scope.tournamentId,expectedActorId,'get_operational_finance_provider_workspace_v1',{tid:scope.tournamentId,eid:scope.eventId});const data=!r.error&&r.actorId&&readOperationalFinanceProviderWorkspaceV1(r.data,{...scope,actorId:r.actorId}),assembly=data&&assembleNativeOperationalFinanceV1(data.currentSource,{...scope,actorId:r.actorId!});return data&&assembly?{data:{...data,preparedCurrent:structuredClone(assembly.basis.workspace),currentBasisDigest:assembly.basisDigest},error:null}:{data:null,error:r.error??'invalid_response'};},
  saveFinanceProposal:async(scope:Scope,request:unknown,expectedActorId:string)=>{const r=await call(scope.tournamentId,expectedActorId,'save_operational_finance_proposal_provider_v1',{tid:scope.tournamentId,eid:scope.eventId,request_value:request}),v=!r.error&&r.actorId&&readBoundOperationalProviderWriteV1(r.data,'operational-finance-provider-write-v1',r.actorId,scope,request);return v?{data:v.record,error:null}:{data:null,error:r.error??'invalid_response'};},
  reconcileFinanceProposal:async(scope:Scope,operationId:string,expectedActorId:string)=>{const r=await call(scope.tournamentId,expectedActorId,'reconcile_operational_finance_proposal_provider_v1',{tid:scope.tournamentId,eid:scope.eventId,op:operationId}),v=!r.error&&r.actorId&&readBoundOperationalProviderWriteV1(r.data,'operational-finance-provider-write-v1',r.actorId,scope);return v&&v.record.operationId===operationId?{data:v.record,error:null}:{data:null,error:r.error??'invalid_response'};},
  recipientSource:async(scope:Scope,expectedActorId:string)=>{const r=await call(scope.tournamentId,expectedActorId,'get_native_playoff_finance_recipient_source_provider_v1',{tid:scope.tournamentId,eid:scope.eventId}),v=!r.error&&r.actorId&&projectNativeFinalRecipientEstimateV1(r.data,{actorId:r.actorId,...scope});return v&&v.status==='recipient_estimate'?{data:r.data,error:null}:{data:null,error:r.error??'invalid_response'};},
  recordIncome:async(scope:Scope,request:unknown,expectedActorId:string)=>{const r=await call(scope.tournamentId,expectedActorId,'record_native_unrestricted_income_provider_v1',{tid:scope.tournamentId,eid:scope.eventId,request_value:request}),v=!r.error&&r.actorId&&readBoundOperationalProviderWriteV1(r.data,'native-finance-provider-write-v1',r.actorId,scope,request);return v?{data:v.record,error:null}:{data:null,error:r.error??'invalid_response'};},
  reviewFund:async(scope:Scope,request:unknown,expectedActorId:string)=>{const r=await call(scope.tournamentId,expectedActorId,'review_native_recorded_fund_provider_v1',{tid:scope.tournamentId,eid:scope.eventId,request_value:request}),v=!r.error&&r.actorId&&readBoundOperationalProviderWriteV1(r.data,'native-finance-provider-write-v1',r.actorId,scope,request);return v?{data:v.record,error:null}:{data:null,error:r.error??'invalid_response'};},
  fundReviewSource:async(scope:Scope,expectedActorId:string)=>{const r=await call(scope.tournamentId,expectedActorId,'get_native_recorded_fund_review_source_provider_v1',{tid:scope.tournamentId,eid:scope.eventId}),v=!r.error&&r.actorId&&readNativeRecordedFundReviewSourceServerV1(r.data,{...scope,actorId:r.actorId});return v?{data:v,error:null}:{data:null,error:r.error??'review_source_unavailable'};},
  finalAwardSource:async(scope:Scope,expectedActorId:string)=>{const r=await call(scope.tournamentId,expectedActorId,'get_native_playoff_final_award_source_provider_v1',{tid:scope.tournamentId,eid:scope.eventId}),v=!r.error&&r.actorId&&reconcileNativeFinalAwardSourceV1(r.data,{actorId:r.actorId,...scope});return v&&v.status==='recordable_unpaid_awards'?{data:r.data,error:null}:{data:null,error:r.error??'invalid_response'};},
  recordFinalAwards:async(scope:Scope,request:unknown,expectedActorId:string)=>{const r=await call(scope.tournamentId,expectedActorId,'record_native_playoff_final_awards_provider_v1',{tid:scope.tournamentId,eid:scope.eventId,request_value:request}),v=!r.error&&r.actorId&&readBoundOperationalProviderWriteV1(r.data,'native-finance-provider-write-v1',r.actorId,scope,request);return v?{data:v.record,error:null}:{data:null,error:r.error??'invalid_response'};},
  finalAwardRecord:async(scope:Scope,expectedActorId:string)=>{const r=await call(scope.tournamentId,expectedActorId,'get_native_playoff_final_award_record_provider_v1',{tid:scope.tournamentId,eid:scope.eventId}),v=!r.error&&decodeNativeFinalAwardRecordV1(r.data,scope);return v&&v.status==='recorded_unpaid_awards'?{data:r.data,error:null}:{data:null,error:r.error??'invalid_response'};},
  reconcileNativeWrite:async(scope:Scope,operationId:string,expectedActorId:string)=>{const r=await call(scope.tournamentId,expectedActorId,'get_native_playoff_finance_write_reconciliation_provider_v1',{tid:scope.tournamentId,eid:scope.eventId,op:operationId}),v=!r.error&&r.actorId&&readBoundOperationalProviderWriteV1(r.data,'native-finance-provider-write-v1',r.actorId,scope);return v&&v.record.operationId===operationId?{data:v.record,error:null}:{data:null,error:r.error??'invalid_response'};},
 };
}

export const isEventSettingsProviderRequestV3=(v:unknown,tid:string):v is EventSettingsSetupEnvelopeV3=>object(v)&&object(v.setup)&&object(v.setup.base)&&v.setup.base.tournamentId===tid&&isEventSettingsSetupV3(v,v.setup.base as never);
export const isNativeRecordedIncomeProviderRequestV1=(v:unknown)=>validateNativeRecordedIncomeRequestV1(v)!==null;
export const isNativeFundReviewProviderRequestV1=(v:unknown)=>validateNativeFundReviewRequestV1(v)!==null;
export const isNativeFinalAwardProviderRequestV1=(v:unknown)=>validateNativeFinalAwardRequestV1(v)!==null;
