import 'server-only';
import type {NextRequest} from 'next/server';
import {requireVerifiedIdentity} from './verified-subject.ts';
import {readBoundedJson} from './bounded-json.ts';
import {isSameOriginRequest} from './same-origin.ts';

/** Default closed. No environment enables these source-only routes. */
export const mrpMembershipManualReviewRoutesEnabledV1=()=>false;
import {isMrpMembershipManualReviewRequestV1,readMrpMembershipReviewWorkspaceV1,isMrpMembershipReviewCommandReplyV1} from '../results/mrp-membership-review-contract-v1.ts';
export {isMrpMembershipManualReviewRequestV1} from '../results/mrp-membership-review-contract-v1.ts';
type Row=Record<string,unknown>;
type Identity={subject:string;sessionId:string};
type Client={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Row)=>PromiseLike<{data:unknown;error:unknown}>};
type Context={params:Promise<{id:string;eventId:string}>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
/** Thin tested boundary only: normal cookie client, no client creation, UUIDs,
 * storage, source fetch, UI, role-string authorization or eligibility projection. */
export function createMrpMembershipManualReviewHandlersV1(o:{client:()=>Promise<Client>;enabled?:()=>boolean}){
 const enabled=o.enabled??mrpMembershipManualReviewRoutesEnabledV1,makeClient=o.client;
 const on=()=>{try{return enabled()===true;}catch{return false;}};
 async function identity(client:Client,expected:Identity){try{const claims=await requireVerifiedIdentity(client),user=await client.auth.getUser();return!!claims&&!user.error&&user.data?.user?.id===expected.subject&&claims.subject===expected.subject&&claims.sessionId===expected.sessionId;}catch{return false;}}
 async function run(request:NextRequest,context:Context,recovery:boolean):Promise<Response>{
  if(!on())return json({error:'not_found'},404);
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  if(!isSameOriginRequest(request))return json({error:'invalid_origin'},403);
  try{
   const params=await context.params,scope=Object.freeze({id:params.id,eventId:params.eventId}),expected={subject:request.headers.get('x-expected-actor-id'),sessionId:request.headers.get('x-expected-session-id')},operation=request.headers.get('x-idempotency-key');
   if(!uuid(scope.id)||!uuid(scope.eventId)||!uuid(expected.subject)||!uuid(expected.sessionId)||!uuid(operation))return json({error:'invalid_request'},400);
   const body=await readBoundedJson(request,8192);if(!isMrpMembershipManualReviewRequestV1(body))return json({error:'invalid_request'},400);
   const captured=structuredClone(body),client=await makeClient(),binding=expected as Identity;
   if(!await identity(client,binding))return json({error:'identity_changed'},403);
   if(!on())return json({error:'not_found'},404);
   const args={p_tournament_id:scope.id,p_event_id:scope.eventId,p_operation_id:operation,p_request:captured};
   const reply=recovery?await client.rpc('get_mrp_membership_manual_review_operation_v1',args):await client.rpc('record_mrp_membership_manual_review_v1',args);
   if(!await identity(client,binding)||!on()||reply.error||!isMrpMembershipReviewCommandReplyV1(reply.data,scope,captured,recovery))return json({error:'operation_outcome_unknown',pendingCleared:false},503);
   const result=structuredClone(reply.data)as Row;return json(result,result.status==='rejected'?409:result.status==='manual_review_recorded'||result.status==='not_found'?200:503);
  }catch{return json({error:'operation_outcome_unknown',pendingCleared:false},503);}
 }
 async function GET(request:NextRequest,context:Context):Promise<Response>{
  if(!on())return json({error:'not_found'},404);if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  try{const params=await context.params,scope=Object.freeze({tournamentId:params.id,eventId:params.eventId,rosterEntryId:request.nextUrl.searchParams.get('rosterEntryId')??''}),expected={subject:request.headers.get('x-expected-actor-id'),sessionId:request.headers.get('x-expected-session-id')};
   if([...Object.values(scope),expected.subject,expected.sessionId].some(x=>!uuid(x))||[...request.nextUrl.searchParams.keys()].length!==1)return json({error:'invalid_request'},400);
   const binding=expected as Identity,client=await makeClient();if(!await identity(client,binding))return json({error:'identity_changed'},403);if(!on())return json({error:'not_found'},404);
   const reply=await client.rpc('get_mrp_membership_manual_review_v1',{p_tournament_id:scope.tournamentId,p_event_id:scope.eventId,p_roster_entry_id:scope.rosterEntryId});
   if(!await identity(client,binding)||!on()||reply.error)return json({error:'review_unavailable'},503);
   const workspace=readMrpMembershipReviewWorkspaceV1(reply.data,scope);return workspace?json(workspace):json({error:'review_unavailable'},503);
  }catch{return json({error:'review_unavailable'},503);}
 }
 return{GET,POST:(r:NextRequest,c:Context)=>run(r,c,false),reconcilePOST:(r:NextRequest,c:Context)=>run(r,c,true)};
}
