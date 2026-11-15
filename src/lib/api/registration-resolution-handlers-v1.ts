import 'server-only';
import type{NextRequest}from'next/server';
import{requireVerifiedIdentity}from'./verified-subject.ts';
import{readBoundedJson}from'./bounded-json.ts';
import{isSameOriginRequest}from'./same-origin.ts';
import{isUuid}from'./validation.ts';
import{registrationResolutionEnabledV1,isRegistrationResolutionAttemptV1,readRegistrationResolutionProofV1,readRegistrationResolutionWorkspaceV1,resolutionExact}from'./registration-resolution-v1.ts';
type Client={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Context={params:Promise<{id:string}>};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
export function createRegistrationResolutionHandlersV1(o:{client:()=>Promise<Client>;enabled?:()=>boolean}){
 const on=()=>{try{return(o.enabled??registrationResolutionEnabledV1)()===true;}catch{return false;}};
 async function admitted(c:Client,actor:string,session:string,tid:string){const identity=await requireVerifiedIdentity(c),user=await c.auth.getUser();if(identity?.subject!==actor||identity?.sessionId!==session||user.error||user.data?.user?.id!==actor)return false;const role=await c.rpc('get_tournament_role',{p_tournament_id:tid});return !role.error&&['director','co_director'].includes(String(role.data));}
 async function run(r:NextRequest,context:Context,write:boolean){
  if(!on())return json({error:'not_found'},404);
  if(write&&!isSameOriginRequest(r))return json({error:'invalid_origin'},403);
  try{const {id}=await context.params,actor=r.headers.get('x-expected-actor-id'),session=r.headers.get('x-expected-session-id');if(!isUuid(id)||!isUuid(actor)||!isUuid(session))return json({error:'invalid_request'},400);
   const body=write?await readBoundedJson(r,16384):null;
   if(write&&(!resolutionExact(body,['command','attempt'])||!['record','recover'].includes(String(body.command))||!isRegistrationResolutionAttemptV1(body.attempt)||body.attempt.scope.actorId!==actor||body.attempt.scope.tournamentId!==id))return json({error:'invalid_request'},400);
   const captured=write?structuredClone(body) as Record<string,unknown>:null,c=await o.client();if(!await admitted(c,actor,session,id)||!on())return json({error:'identity_changed'},403);
   let name='get_registration_resolution_workspace_v1',args:Record<string,unknown>={p_tournament_id:id};
   if(captured&&isRegistrationResolutionAttemptV1(captured.attempt)){name=captured.command==='record'?'record_registration_resolution_v1':'get_registration_resolution_operation_v1';args={...args,p_operation_id:captured.attempt.operationId,p_request:captured.attempt.request};}
   const reply=await c.rpc(name,args);const value=structuredClone(reply.data);if(!await admitted(c,actor,session,id)||!on()||reply.error)return json({error:'outcome_unknown',pendingCleared:false},503);
   if(!captured){const workspace=readRegistrationResolutionWorkspaceV1(value,{actorId:actor,tournamentId:id});return workspace?json(workspace):json({error:'workspace_unavailable'},503);}
   if(!isRegistrationResolutionAttemptV1(captured.attempt))return json({error:'outcome_unknown',pendingCleared:false},503);
   const proof=readRegistrationResolutionProofV1(value,captured.attempt);if(proof)return json(proof,proof.status==='registration_resolution_rejected'?409:200);
   // Not-found, busy, bare rejection and unbound receipts never clear pending work.
   return json({error:'outcome_unknown',pendingCleared:false},503);
  }catch{return json({error:'outcome_unknown',pendingCleared:false},503);}
 }
 return{GET:(r:NextRequest,c:Context)=>run(r,c,false),POST:(r:NextRequest,c:Context)=>run(r,c,true)};
}
