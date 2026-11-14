import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import type{NextRequest}from'next/server';
import{requireVerifiedIdentity}from'./verified-subject.ts';
import{readBoundedJson}from'./bounded-json.ts';
import{isSameOriginRequest}from'./same-origin.ts';
import{uuid,isConsyRequest,readConsyDesk,readConsyReply,object,type ConsyScope}from'../finance/consy-addon-desk-contract-v1.ts';
export const consyAddonDirectorRoutesEnabledV1=()=>integratedTestFeatureEnabled();
export const consyAddonPoolAwareRoutesEnabledV3=()=>integratedTestFeatureEnabled();
type Client={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(n:string,a:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Context={params:Promise<{id:string;eventId:string}>};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'cache-control':'private, no-store'}});
export function createConsyAddonDirectorHandlersV1(o:{client:()=>Promise<Client>;enabled?:()=>boolean;poolAwareEnabled?:()=>boolean;serviceRpc?:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>}){
 const pooled=o.poolAwareEnabled??consyAddonPoolAwareRoutesEnabledV3;
 const enabled=o.enabled??consyAddonDirectorRoutesEnabledV1;const on=()=>{try{return enabled()===true;}catch{return false;}};
 async function admitted(c:Client,s:ConsyScope,sid:string){try{const claims=await requireVerifiedIdentity(c),user=await c.auth.getUser(),role=await c.rpc('get_tournament_role',{p_tournament_id:s.tournamentId});return!!claims&&claims.subject===s.actorId&&claims.sessionId===sid&&!user.error&&user.data?.user?.id===s.actorId&&!role.error&&['director','co_director'].includes(role.data as string);}catch{return false;}}
 async function poolAwareAdmitted(c:Client,s:ConsyScope){if(!pooled())return false;const r=await c.rpc('get_tournament_role',{p_tournament_id:s.tournamentId});return!r.error&&r.data==='director';}
 async function binding(r:NextRequest,ctx:Context){const p=await ctx.params,s={actorId:r.headers.get('x-expected-actor-id'),tournamentId:p.id,eventId:p.eventId},sid=r.headers.get('x-expected-session-id');return Object.values(s).every(uuid)&&uuid(sid)?{scope:s as ConsyScope,sid}:null;}
 async function GET(r:NextRequest,ctx:Context){if(!on())return json({error:'not_found'},404);if(r.method!=='GET')return json({error:'method_not_allowed'},405);try{
  const b=await binding(r,ctx);if(!b)return json({error:'invalid_request'},400);const keys=[...r.nextUrl.searchParams.keys()],roster=r.nextUrl.searchParams.get('rosterEntryId');if(keys.length>1||keys.length===1&&(keys[0]!=='rosterEntryId'||!uuid(roster)))return json({error:'invalid_request'},400);
  const c=await o.client();if(!await admitted(c,b.scope,b.sid))return json({error:'identity_changed'},403);if(!on())return json({error:'not_found'},404);
  const pool=roster&&await poolAwareAdmitted(c,b.scope);if(pool&&!o.serviceRpc)throw Error('pool_aware_provider_missing');const reply=pool?await o.serviceRpc!('get_pool_aware_consy_source_v3',{actor:b.scope.actorId,sid:b.sid,tid:b.scope.tournamentId,eid:b.scope.eventId,roster}):await c.rpc(roster?'get_consy_addon_payment_source_v1':'get_consy_addon_payment_desk_v1',{p_tournament_id:b.scope.tournamentId,p_event_id:b.scope.eventId,...(roster?{p_roster_entry_id:roster}:{})});
  if(!await admitted(c,b.scope,b.sid)||pool&&!await poolAwareAdmitted(c,b.scope))return json({error:'identity_changed',pendingCleared:false},403);if(!on()||reply.error)return json({error:'source_unavailable'},503);
  if(roster){if(!object(reply.data)||!['source_available','recorded','prepaid_recorded','blocked','retry_exact'].includes(reply.data.status as string))return json({error:'source_unavailable'},503);return json(reply.data);}
  const desk=readConsyDesk(reply.data,b.scope);return desk?json(desk):json({error:'source_unavailable'},503);
 }catch{return json({error:'source_unavailable'},503);}}
 async function run(r:NextRequest,ctx:Context,recovery:boolean){if(!on())return json({error:'not_found'},404);if(r.method!=='POST')return json({error:'method_not_allowed'},405);if(!isSameOriginRequest(r))return json({error:'invalid_origin'},403);try{
  const b=await binding(r,ctx),op=r.headers.get('x-idempotency-key');if(!b||!uuid(op))return json({error:'invalid_request'},400);const value=await readBoundedJson(r,8192);if(!isConsyRequest(value)||value.operationId!==op)return json({error:'invalid_request'},400);const req=structuredClone(value),c=await o.client();
  if(!await admitted(c,b.scope,b.sid))return json({error:'identity_changed'},403);if(!on())return json({error:'not_found'},404);
  const pool=await poolAwareAdmitted(c,b.scope);if(pool&&!o.serviceRpc)throw Error('pool_aware_provider_missing');const reply=pool?await o.serviceRpc!('pool_aware_consy_command_v3',{actor:b.scope.actorId,sid:b.sid,tid:b.scope.tournamentId,eid:b.scope.eventId,op,request:req,recovery}):await c.rpc(recovery?'get_consy_addon_payment_command_v1':'record_consy_addon_payment_command_v1',{p_tournament_id:b.scope.tournamentId,p_event_id:b.scope.eventId,p_operation_id:op,p_request:req});
  if(!await admitted(c,b.scope,b.sid))return json({error:'identity_changed',pendingCleared:false},403);if(!on()||reply.error)return json({error:'operation_outcome_unknown',pendingCleared:false},503);const result=readConsyReply(reply.data,b.scope,req);if(!result)return json({error:'operation_outcome_unknown',pendingCleared:false},503);
  return json(result,result.status==='accepted'||result.status==='not_found'?200:result.status==='rejected'?409:503);
 }catch{return json({error:'operation_outcome_unknown',pendingCleared:false},503);}}
 return{GET,POST:(r:NextRequest,c:Context)=>run(r,c,false),reconcilePOST:(r:NextRequest,c:Context)=>run(r,c,true)};
}
