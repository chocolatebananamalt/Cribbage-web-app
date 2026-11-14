import { integratedTestBackendRef, integratedTestBackendOrigin } from '../integrated-test-target.ts';
import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import'server-only';
import type{NextRequest}from'next/server';
import{requireVerifiedIdentity}from'./verified-subject.ts';import{readBoundedJson}from'./bounded-json.ts';import{isSameOriginRequest}from'./same-origin.ts';
import{isReopenContextV1,isReopenRequestV1,readReopenWorkspaceV1,readReopenReceiptV1,isReopenNonterminalV1,type ReopenContextV1}from'../seating/native-mixed-game-reopen-v1.ts';
export const nativeMixedGameReopenRoutesEnabledV1=()=>integratedTestFeatureEnabled();
type Client={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Context={params:Promise<{id:string;eventId:string;startId:string;gameId:string}>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
/** Normal cookie client only. No privileged client, actor argument, implicit
 * retry, policy override, source fetch or write capability is created here. */
export function createNativeMixedGameReopenHandlersV1(o:{client:()=>Promise<Client>;enabled?:()=>boolean;projectRef?:string;projectUrl?:string}){
 const on=()=>{try{return(o.enabled??nativeMixedGameReopenRoutesEnabledV1)()===true;}catch{return false;}};
 async function identity(client:Client,c:ReopenContextV1){try{const a=await requireVerifiedIdentity(client),u=await client.auth.getUser();return!!a&&!u.error&&u.data?.user?.id===c.actorId&&a.subject===c.actorId&&a.sessionId===c.sessionId;}catch{return false;}}
 async function run(request:NextRequest,context:Context,mode:'read'|'write'|'recover'){
  if(!on())return json({error:'not_found'},404);
  if(request.method!==(mode==='read'?'GET':'POST'))return json({error:'method_not_allowed'},405);
  if(mode!=='read'&&!isSameOriginRequest(request))return json({error:'invalid_origin'},403);
  try{const p=await context.params,c={actorId:request.headers.get('x-expected-actor-id'),sessionId:request.headers.get('x-expected-session-id'),projectRef:o.projectRef??integratedTestBackendRef(),projectUrl:o.projectUrl??integratedTestBackendOrigin(),tournamentId:p.id,eventId:p.eventId,startId:p.startId,gameId:p.gameId};if(!isReopenContextV1(c))return json({error:'invalid_request'},400);
   const captured=structuredClone(c),op=request.headers.get('x-idempotency-key'),body=mode==='read'?null:await readBoundedJson(request,8192);
   if(mode!=='read'&&(!uuid(op)||!isReopenRequestV1(body)||body.startId!==c.startId||body.gameId!==c.gameId))return json({error:'invalid_request'},400);
   const saved=mode==='read'?null:structuredClone(body),client=await o.client();if(!await identity(client,captured))return json({error:'identity_changed'},403);if(!on())return json({error:'not_found'},404);
   const scope={p_tournament_id:captured.tournamentId,p_event_id:captured.eventId};let response;
   if(mode==='read')response=await client.rpc('get_native_mixed_game_reopen_workspace_v1',{...scope,p_start_id:captured.startId,p_game_id:captured.gameId});
   else if(mode==='recover')response=await client.rpc('get_native_mixed_game_reopen_operation_v1',{...scope,p_operation_id:op,p_request:saved});
   else response=await client.rpc('record_native_mixed_game_reopen_v1',{...scope,p_operation_id:op,p_request:saved});
   const capturedReply=structuredClone(response.data);
   if(!on()||!await identity(client,captured)||response.error)return json({error:mode==='read'?'review_unavailable':'operation_outcome_unknown',pendingCleared:false},503);
   if(mode==='read'){const value=readReopenWorkspaceV1(capturedReply,captured);return value?json(value):json({error:'review_unavailable'},404);}
   const value=uuid(op)&&isReopenRequestV1(saved)?readReopenReceiptV1(capturedReply,captured,op,saved):null;if(value)return json(value,value.status==='rejected'?409:200);
   return isReopenNonterminalV1(capturedReply)?json(capturedReply,503):json({error:'operation_outcome_unknown',pendingCleared:false},503);
  }catch{return json({error:mode==='read'?'review_unavailable':'operation_outcome_unknown',pendingCleared:false},503);}
 }
 return{GET:(r:NextRequest,c:Context)=>run(r,c,'read'),POST:(r:NextRequest,c:Context)=>run(r,c,'write'),reconcilePOST:(r:NextRequest,c:Context)=>run(r,c,'recover')};
}
