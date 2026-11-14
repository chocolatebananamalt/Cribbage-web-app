import 'server-only';
import {isEventPrizeWireValueV1,isEventPrizeResponseValueV1,serializeEventPrizeSettingsV1,parseEventPrizeSettingsV1,eventPrizeSettingsRequestHashV1,planEventPrizeSnapshotV1,isEventPrizeSettingsSavedV1,readEventPrizeRecordedRejectionV1,type EventPrizeSettingsEnvelopeV1} from './event-prize-settings-v1.ts';
import {readEventPrizeWorkspaceV1} from './event-prize-workspace-v1.ts';

type Scope={actorId:string;tournamentId:string};
/** Same signed-in user client for auth and RPC. No service-role client or actor argument. */
export type EventPrizeRpcClientV1={
 auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};
 rpc:(name:string,args:Record<string,string>)=>PromiseLike<{data:unknown;error:unknown}>;
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const unknown=()=>({status:'outcome_unknown' as const,code:'operation_outcome_unknown',pendingCleared:false as const});
const rejected=(code:string)=>({status:'rejected' as const,code,pendingCleared:false as const});
const rejectionCodes=new Set(['feature_disabled','authentication_required','not_director','tournament_unavailable','invalid_request','idempotency_conflict','setup_lifecycle_closed','source_changed','settings_source_changed','prize_source_unavailable','nested_write_rejected','invalid_snapshot','head_conflict','write_failed']);
const retryCodes=new Set(['isolation_not_supported','operation_busy','source_busy']);
function frozen<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(frozen);Object.freeze(v);}return v;}

/** Single-call transport only. The named RPCs do not yet exist in an approved
 * database migration. Defaults are OFF; this factory creates no route/client,
 * grants no capability and never emulates a transaction with multiple RPCs.
 * A database implementation must enforce current roles, locks, source pins,
 * reciprocal legacy-writer guards, atomic journals and commit before return.
 */
export function createEventPrizeRpcV1(client:EventPrizeRpcClientV1,scope:Scope,flags:{write?:()=>boolean;recovery?:()=>boolean;read?:()=>boolean}={}){
 const fixed=isEventPrizeWireValueV1(scope)&&exact(scope,['actorId','tournamentId'])&&Object.values(scope).every(uuid)?Object.freeze({...scope}):null;
 const authenticated=async()=>{const r=await client.auth.getUser();return !r.error&&r.data?.user?.id===fixed?.actorId;};
 async function run(input:unknown,recovery:boolean){
  const enabled=()=>{try{return (recovery?flags.recovery:flags.write)?.()===true;}catch{return false;}};
  if(!enabled())return rejected(recovery?'recovery_unavailable':'feature_disabled');
  if(!fixed||!isEventPrizeWireValueV1(input)||!object(input)||!object(input.setup)||!object(input.setup.setup))return rejected('invalid_request');
  const raw=serializeEventPrizeSettingsV1(input,input.setup.setup.base);
  if(raw===null)return rejected('invalid_request');
  const envelope=parseEventPrizeSettingsV1(raw,input.setup.setup.base) as EventPrizeSettingsEnvelopeV1;
  const base=envelope.setup.setup.base;
  if(base.tournamentId!==fixed.tournamentId)return rejected('invalid_request');
  try{
   const requestHash=await eventPrizeSettingsRequestHashV1(envelope,base);
   if(!requestHash)return rejected('hash_unavailable');
   if(!await authenticated())return rejected('authentication_required');
   if(!enabled())return rejected(recovery?'recovery_unavailable':'feature_disabled');
   const reply=await client.rpc(recovery?'get_event_prize_operation_provider_v1':'save_event_prize_settings_provider_v1',{p_tid:fixed.tournamentId,p_request_text:raw});
   // An HTTP error, session switch or malformed reply never proves rollback.
   if(reply.error||!enabled()||!await authenticated()||!isEventPrizeResponseValueV1(reply.data))return unknown();
   const v=structuredClone(reply.data);
   if(!object(v)||!exact(v.scope,['actorId','tournamentId'])||v.scope.actorId!==fixed.actorId||v.scope.tournamentId!==fixed.tournamentId||v.operationId!==envelope.operationId||v.requestHash!==requestHash)return unknown();
   const binding=frozen({...fixed,operationId:envelope.operationId,requestHash});
   if(recovery&&exact(v,['kind','scope','operationId','requestHash'])&&v.kind==='event-prize-no-record-v1')return frozen({status:'not_found' as const,binding,pendingCleared:false as const,writeAuthorized:false as const});
   if(exact(v,['kind','scope','operationId','requestHash','result'])&&v.kind==='event-prize-attempt-v1'&&exact(v.result,['status','code'])&&typeof v.result.code==='string'){
    if(v.result.status==='rejected'&&rejectionCodes.has(v.result.code))return rejected(v.result.code);
    if(!recovery&&v.result.status==='retry_exact'&&retryCodes.has(v.result.code))return{status:'retry_exact' as const,code:v.result.code,pendingCleared:false as const};
    return unknown();
   }
   if(!exact(v,['kind','scope','operationId','requestText','requestHash','priorSnapshot','result'])||v.kind!=='event-prize-operation-record-v1'||v.requestText!==raw||planEventPrizeSnapshotV1(envelope,base,v.priorSnapshot).status!=='planned')return unknown();
   if(exact(v.result,['status','ack'])&&v.result.status==='accepted'&&isEventPrizeSettingsSavedV1(v.result.ack,envelope,base,v.priorSnapshot,requestHash)&&(recovery||v.result.ack.nested.status==='event_settings_custom_pool_draft_saved_v4'))return frozen({status:'accepted' as const,binding,ack:v.result.ack,priorSnapshot:structuredClone(v.priorSnapshot),pendingCleared:false as const});
   if(exact(v.result,['status','code'])&&v.result.status==='rejected')return readEventPrizeRecordedRejectionV1({kind:'event-prize-recorded-rejection-v1',status:'rejected',code:v.result.code,binding,requestText:raw,envelope,priorSnapshot:v.priorSnapshot,pendingCleared:false,writeAuthorized:false},envelope,requestHash,fixed.actorId)??unknown();
   return unknown();
  }catch{return unknown();}
 }
 return{save:(input:unknown)=>run(input,false),reconcile:(input:unknown)=>run(input,true),async workspace(){
  const enabled=()=>{try{return flags.read?.()===true;}catch{return false;}};
  if(!enabled()||!fixed)return{status:'unavailable' as const};
  try{
   if(!await authenticated()||!enabled())return{status:'unavailable' as const};
   const reply=await client.rpc('get_event_prize_workspace_provider_v1',{p_tid:fixed.tournamentId});
   if(reply.error||!enabled()||!await authenticated())return{status:'unavailable' as const};
   const workspace=readEventPrizeWorkspaceV1(reply.data,fixed.actorId,fixed.tournamentId);
   return workspace?{status:'available' as const,workspace}:{status:'unavailable' as const};
  }catch{return{status:'unavailable' as const};}
 }};
}
