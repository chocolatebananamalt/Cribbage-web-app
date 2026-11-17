import'server-only';
import type{NextRequest}from'next/server';
import{readLargeJson}from'../api/bounded-json.ts';
import{isSameOriginRequest}from'../api/same-origin.ts';
import{requireVerifiedIdentity}from'../api/verified-subject.ts';
import{closeUuid,readCloseAttempt,type CloseScope}from'./modern-event-close-contract-v1.ts';
import{readCloseoutTerminalV18,terminalReasonV18,type TerminalReplyV18}from'./closeout-terminal-contract-v18.ts';

// No existing integrated-test flag implies the new all-path retirement capability.
export const closeoutTerminalReadEnabledV18=()=>false;
export const closeoutTerminalWriteEnabledV18=()=>false;
type Normal={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null};error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Ports={readEnabled:()=>boolean;writeEnabled:()=>boolean;normal:()=>Promise<Normal>;service:()=>{rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};verifyCapability:(scope:CloseScope,sessionId:string)=>Promise<boolean>};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'private, no-store'}});
class AccessFailure extends Error{status:number;constructor(status:number){super('access_changed');this.status=status;}}
export function createCloseoutTerminalHandlerV18(ports:Ports){return async(request:Request,params:{id:string;eventId:string},boundedInput?:{value:unknown}):Promise<Response>=>{
 if(!ports.readEnabled())return json({error:'not_found'},404);
 if(!isSameOriginRequest(request as NextRequest))return json({error:'invalid_origin'},403);
 try{
  const normal=await ports.normal(),identity=await requireVerifiedIdentity(normal);if(!identity||!closeUuid(identity.subject)||!closeUuid(identity.sessionId))return json({error:'unauthorized'},401);
  const scope={actorId:identity.subject,tournamentId:params.id,eventId:params.eventId};if(!Object.values(scope).every(closeUuid))return json({error:'invalid_request'},400);
  const authorize=async()=>{const current=await requireVerifiedIdentity(normal),user=await normal.auth.getUser();if(!current||current.subject!==identity.subject||current.sessionId!==identity.sessionId||user.error||user.data.user?.id!==identity.subject)throw new AccessFailure(401);const role=await normal.rpc('get_tournament_role',{p_tournament_id:params.id});if(role.error||role.data!=='director')throw new AccessFailure(403);};
  await authorize();
  // The Next boundary may pass its already bounded parse; this is an internal
  // function argument, never an HTTP field or authority override.
  const body=boundedInput?boundedInput.value:await readLargeJson(request);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='action,attempt,reason')return json({error:'invalid_request'},400);
  const input=body as{action:unknown;attempt:unknown;reason:unknown},attempt=readCloseAttempt(input.attempt,scope);if(!attempt||input.action!=='recover'&&input.action!=='retire'||input.action==='recover'&&input.reason!==null||input.action==='retire'&&!terminalReasonV18(input.reason))return json({error:'invalid_request'},400);
  const writing=input.action==='retire';if(writing&&!ports.writeEnabled())return json({error:'retirement_unavailable'},403);
  if(!await ports.verifyCapability(scope,identity.sessionId))return json({error:'terminal_capability_unverified'},503);
  await authorize();if(!ports.readEnabled()||writing&&!ports.writeEnabled())return json({error:'retirement_unavailable'},503);
  const service=ports.service(),args:Record<string,unknown>={actor:scope.actorId,sid:identity.sessionId,tid:scope.tournamentId,eid:scope.eventId,op:attempt.operationId,stage:attempt.review.stage,request:attempt.request};if(writing)args.reason=input.reason;
  const response=await service.rpc(writing?'retire_closeout_operation_v18':'get_closeout_terminal_v18',args);
  await authorize();if(response.error||!ports.readEnabled()||writing&&!ports.writeEnabled())throw Error('outcome_unknown');
  const terminal=readCloseoutTerminalV18(response.data,attempt,writing?input.reason as string:null);
  let code='outcome_unknown';if(terminal)code='retired_no_effect';else{
   const raw=response.data;if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('invalid_outcome');const value=raw as Record<string,unknown>;
   if(value.status==='retired_no_effect')throw Error('unbound_terminal');
   if(value.status==='accepted')code='existing_operation_requires_recovery';
   else if(['unknown','rejected','retry_exact'].includes(String(value.status))&&typeof value.code==='string'&&/^[a-z0-9_]{1,100}$/.test(value.code))code=value.code;
   else throw Error('invalid_outcome');
  }
  const reply:TerminalReplyV18={kind:'closeout-terminal-reply-v18',scope,operationId:attempt.operationId,status:terminal?'terminal':'unresolved',code,terminal};return json(reply);
 }catch(error){return error instanceof AccessFailure?json({error:'unauthorized'},error.status):json({error:'temporarily_unavailable'},503);}
};}
