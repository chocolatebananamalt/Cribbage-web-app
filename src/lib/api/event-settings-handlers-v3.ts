import type {NextRequest} from 'next/server';
import {isUuid} from './validation.ts';
import {isEventSettingsSetupV3,isEventSettingsDraftSavedV3,serializeEventSettingsSetupV3,type EventSettingsSetupEnvelopeV3} from './event-settings-setup-v3.ts';
import {isEventSettingsSnapshotV3,type EventSettingsSnapshotV3} from './event-settings-snapshot-v3.ts';
import {isCustomQDraftRetryV2} from './custom-q-draft-result-v2.ts';
import type {SetupCustomPayoutsBaseV2} from './custom-payout-setup-v2.ts';

type Context={params:Promise<{id:string;operationId?:string}>};
type Access={actorId:string;roles:string[]};
type BackendResult={data:unknown;error:unknown};
const uuid=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>obj(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const baseValid=(v:unknown):v is SetupCustomPayoutsBaseV2=>exact(v,['tournamentId','setupRevisionId','setupVersion','sourceDigest'])&&uuid(v.tournamentId)&&Number.isInteger(v.setupVersion)&&(v.setupVersion as number)>=0&&(v.setupVersion as number)<=2147483647&&(v.setupVersion===0?v.setupRevisionId===null:uuid(v.setupRevisionId))&&typeof v.sourceDigest==='string'&&/^[a-f0-9]{64}$/.test(v.sourceDigest);
export type EventSettingsWorkspaceV3={actorId:string;tid:string;base:SetupCustomPayoutsBaseV2;currentSnapshot:EventSettingsSnapshotV3|null};
/** Conservative candidate reader: existing sources without a validated settings
 * snapshot stay unavailable. A future explicit legacy-absence reader is separate.
 */
export function isEventSettingsWorkspaceV3(v:unknown,actorId:string,tid:string):v is EventSettingsWorkspaceV3{
 return exact(v,['actorId','tid','base','currentSnapshot'])&&v.actorId===actorId&&v.tid===tid&&baseValid(v.base)&&v.base.tournamentId===tid
 &&(v.currentSnapshot===null?v.base.setupVersion===0:isEventSettingsSnapshotV3(v.currentSnapshot)&&v.currentSnapshot.tournamentId===tid&&v.currentSnapshot.setupRevisionId===v.base.setupRevisionId&&v.currentSnapshot.setupVersion===v.base.setupVersion);
}
const rejected=new Set(['authentication_required','not_director','tournament_unavailable','idempotency_conflict','invalid_request','invalid_settings','invalid_settings_coverage','invalid_event','invalid_intent','duplicate_intent','missing_intent','stale_version','source_changed','side_custom_unsupported','satellite_custom_unsupported','non_q_intent_unsupported','setup_lifecycle_closed','invalid_setup_payload','invalid_officials','invalid_q_pool','invalid_side_pool','invalid_links','invalid_event_sequence','dependent_event_removal']);
export function isEventSettingsRejectedV3(v:unknown):v is{status:'rejected';code:string}{return exact(v,['status','code'])&&v.status==='rejected'&&typeof v.code==='string'&&rejected.has(v.code);}
const knownRejected=isEventSettingsRejectedV3;
function ownBase(v:unknown):SetupCustomPayoutsBaseV2|null{return obj(v)&&obj(v.setup)&&baseValid(v.setup.base)?v.setup.base:null;}
export type EventSettingsOperationRecordV3=Readonly<{actorId:string;tid:string;operationId:string;envelope:EventSettingsSetupEnvelopeV3;outcome:unknown}>;
function frozen<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(frozen);Object.freeze(v);}return v;}
/** Operation lookup preserves the full immutable binding even for rejection or
 * retry. A client must compare its own retained request before any cleanup.
 */
export function readEventSettingsOperationRecordV3(v:unknown,actorId:string,tid:string,operationId:string,envelope:unknown):EventSettingsOperationRecordV3|null{
 const base=ownBase(envelope);
 if(!base||!uuid(actorId)||!uuid(tid)||!uuid(operationId)||base.tournamentId!==tid||!isEventSettingsSetupV3(envelope,base)||envelope.setup.request.idempotencyKey!==operationId
  ||!exact(v,['actorId','tid','operationId','envelope','outcome'])||v.actorId!==actorId||v.tid!==tid||v.operationId!==operationId
  ||serializeEventSettingsSetupV3(v.envelope,base)!==serializeEventSettingsSetupV3(envelope,base)
  ||!(isEventSettingsDraftSavedV3(v.outcome,envelope,base)||knownRejected(v.outcome)||isCustomQDraftRetryV2(v.outcome)))return null;
 return frozen(JSON.parse(JSON.stringify(v)) as EventSettingsOperationRecordV3);
}
/** Dependency-injected, disabled unless a caller explicitly supplies true.
 * No route, provider client, service grant or production capability is created.
 * access() must verify identity against its provider; it is not a client claim.
 */
export function createEventSettingsHandlersV3<Reply>(d:{
 enabled?:()=>boolean;access:(tid:string)=>Promise<Access|null>;
 workspace:(tid:string,actorId:string)=>Promise<unknown>;
 save:(tid:string,envelope:EventSettingsSetupEnvelopeV3)=>Promise<BackendResult>;
 operation:(tid:string,operationId:string,actorId:string)=>Promise<BackendResult>;
 readJson:(request:NextRequest,limits:{maxBytes:number})=>Promise<unknown>;sameOrigin:(request:NextRequest)=>boolean;
 json:(body:unknown,init?:ResponseInit)=>Reply;boundary:(f:()=>Promise<Reply>)=>Promise<Reply>;
}){
 const fail=(status:number,error:string)=>d.json({error},{status});
 const permitted=(a:Access|null):a is Access=>!!a&&uuid(a.actorId)&&Array.isArray(a.roles)&&a.roles.every(r=>typeof r==='string')&&a.roles.some(r=>r==='director'||r==='co_director');
 const stillPermitted=async(actorId:string,tid:string)=>{const a=await d.access(tid);return permitted(a)&&a.actorId===actorId;};
 async function enter(r:NextRequest,c:Context,method:'GET'|'POST'):Promise<{reply:Reply}|{actorId:string;tid:string;operationId:string|undefined}>{
  if(d.enabled?.()!==true)return{reply:fail(404,'not_found')};
  if(r.method!==method)return{reply:fail(405,'method_not_allowed')};
  if(method==='POST'&&!d.sameOrigin(r))return{reply:fail(403,'invalid_origin')};
  const p=await c.params;if(!uuid(p.id))return{reply:fail(400,'invalid_request')};
  const a=await d.access(p.id);if(!a)return{reply:fail(401,'unauthorized')};if(!permitted(a))return{reply:fail(403,'forbidden')};
  return{actorId:a.actorId,tid:p.id,operationId:p.operationId};
 }
 const outcome=(data:unknown,envelope:EventSettingsSetupEnvelopeV3,base:SetupCustomPayoutsBaseV2)=>isEventSettingsDraftSavedV3(data,envelope,base)?d.json(data):knownRejected(data)?d.json(data,{status:409}):isCustomQDraftRetryV2(data)?d.json(data,{status:503}):fail(503,'operation_outcome_unknown');
 return{
  GET:(r:NextRequest,c:Context)=>d.boundary(async()=>{
   const e=await enter(r,c,'GET');if('reply'in e)return e.reply;
   const data=await d.workspace(e.tid,e.actorId);if(!await stillPermitted(e.actorId,e.tid))return fail(403,'forbidden');
   return isEventSettingsWorkspaceV3(data,e.actorId,e.tid)?d.json(data):fail(503,'workspace_unavailable');
  }),
  POST:(r:NextRequest,c:Context)=>d.boundary(async()=>{
   const e=await enter(r,c,'POST');if('reply'in e)return e.reply;
   const length=r.headers.get('content-length');if(length!==null&&(!/^[0-9]+$/.test(length)||BigInt(length)>BigInt(1000000)))return fail(413,'request_too_large');
   const body=await d.readJson(r,{maxBytes:1000000});let encoded:string|undefined;try{encoded=JSON.stringify(body);}catch{return fail(400,'invalid_request');}
   if(encoded===undefined||new TextEncoder().encode(encoded).byteLength>1000000)return fail(413,'request_too_large');
   const base=ownBase(body);if(!base||base.tournamentId!==e.tid||!isEventSettingsSetupV3(body,base))return fail(400,'invalid_request');
   // Validate the retained request against its OWN posted base. A current-source
   // prefilter would incorrectly reject an exact historical accepted replay.
   if(!await stillPermitted(e.actorId,e.tid))return fail(403,'forbidden');
   const result=await d.save(e.tid,body);if(!await stillPermitted(e.actorId,e.tid))return fail(403,'forbidden');
   return result.error?fail(503,'operation_outcome_unknown'):outcome(result.data,body,base);
  }),
  operationGET:(r:NextRequest,c:Context)=>d.boundary(async()=>{
   const e=await enter(r,c,'GET');if('reply'in e)return e.reply;
   // Retained full requests are server lookup data, never query-string payloads.
   if(!uuid(e.operationId)||new URL(r.url).search!=='')return fail(400,'invalid_request');
   const result=await d.operation(e.tid,e.operationId,e.actorId);if(!await stillPermitted(e.actorId,e.tid))return fail(403,'forbidden');
   const row=result.data;
   if(result.error||!exact(row,['actorId','tid','operationId','envelope','outcome'])||row.actorId!==e.actorId||row.tid!==e.tid||row.operationId!==e.operationId)return fail(503,'operation_outcome_unknown');
   const base=ownBase(row.envelope);if(!base||base.tournamentId!==e.tid||!isEventSettingsSetupV3(row.envelope,base)||row.envelope.setup.request.idempotencyKey!==e.operationId)return fail(503,'operation_outcome_unknown');
   const record=readEventSettingsOperationRecordV3(row,e.actorId,e.tid,e.operationId,row.envelope);
   if(!record)return fail(503,'operation_outcome_unknown');
   return d.json(record,{status:isEventSettingsDraftSavedV3(record.outcome,row.envelope,base)?200:knownRejected(record.outcome)?409:503});
  }),
 };
}
