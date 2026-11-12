import 'server-only';
import type {NextRequest} from 'next/server';
import {serializeEventPrizeActivationV1,eventPrizeActivationRequestHashV1,readEventPrizeActivationSourceV1,readEventPrizeActivationRecordV1} from './event-prize-activation-v1.ts';
import {readEventPrizeRuleContextWorkspaceV1,isEventPrizeRuleContextRequestV1,readEventPrizeRuleContextOperationV1} from './event-prize-rule-context-v1.ts';
type RpcClient={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
export type PrizeActivationUserClientV1=RpcClient&{auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>}};
type Context={params:Promise<{id:string}>};
type Mode='source'|'prepare'|'finalize'|'reconcile'|'context'|'contextSave'|'contextOperation';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
export const eventPrizeActivationRoutesEnabledV1=()=>false;
/** Admin construction is deferred until an exact owned preparation receipt and
 * a current verified cookie identity/official role have both been established. */
export function createEventPrizeActivationHandlersV1<Reply extends Response>(d:{enabled:()=>boolean;readEnabled:()=>boolean;writeEnabled:()=>boolean;recoveryEnabled:()=>boolean;client:()=>Promise<PrizeActivationUserClientV1>;admin:()=>RpcClient;json:(body:unknown,init?:ResponseInit)=>Reply;boundary:(f:()=>Promise<Reply>)=>Promise<Reply>;sameOrigin:(r:NextRequest)=>boolean;readJson:(r:Request,maxBytes:number)=>Promise<unknown>}){
 const allowed=(mode:Mode)=>d.enabled()===true&&(mode==='source'||mode==='context'?d.readEnabled():mode==='reconcile'||mode==='contextOperation'?d.recoveryEnabled():d.writeEnabled())===true;
 const fail=(status:number,error:string)=>d.json({error},{status});
 async function authorized(client:PrizeActivationUserClientV1,actorId:string,tid:string){const a=await client.auth.getUser();if(a.error||a.data?.user?.id!==actorId)return false;const role=await client.rpc('get_tournament_role',{p_tournament_id:tid});return !role.error&&(role.data==='director'||role.data==='co_director');}
 const run=(request:NextRequest,context:Context,mode:Mode)=>d.boundary(async()=>{
  if(!allowed(mode))return fail(404,'not_found');const method=mode==='source'||mode==='context'?'GET':'POST';if(request.method!==method)return fail(405,'method_not_allowed');if(method==='POST'&&!d.sameOrigin(request))return fail(403,'invalid_origin');
  const{id:tid}=await context.params,actorId=request.headers.get('x-expected-actor-id');if(!uuid(tid)||!uuid(actorId))return fail(400,'invalid_request');
  const client=await d.client();if(!await authorized(client,actorId,tid))return fail(403,'permission_required');if(!allowed(mode))return fail(404,'not_found');
  if(mode==='context'){const reply=await client.rpc('get_event_prize_rule_context_source_provider_v1',{tid});if(reply.error||!await authorized(client,actorId,tid)||!allowed(mode))return fail(503,'context_source_unavailable');const workspace=readEventPrizeRuleContextWorkspaceV1(reply.data,actorId,tid);return workspace?d.json(workspace):fail(503,'context_source_unavailable');}
  if(mode==='contextSave'||mode==='contextOperation'){
   const body=await d.readJson(request,1_000_000);if(!isEventPrizeRuleContextRequestV1(body))return fail(400,'invalid_request');
   const reply=await client.rpc(mode==='contextSave'?'save_event_prize_rule_context_provider_v1':'get_event_prize_rule_context_operation_provider_v1',{tid,request_value:body});
   if(reply.error||!await authorized(client,actorId,tid)||!allowed(mode))return fail(503,'operation_outcome_unknown');
   const operation=readEventPrizeRuleContextOperationV1(reply.data,actorId,tid,body);return operation?d.json(operation,{status:operation.result.status==='context_recorded'?200:409}):fail(503,'operation_outcome_unknown');
  }
  if(mode==='source'){const reply=await client.rpc('get_event_prize_activation_source_provider_v1',{tid});if(reply.error||!await authorized(client,actorId,tid)||!allowed(mode))return fail(503,'source_unavailable');const source=readEventPrizeActivationSourceV1(reply.data,actorId,tid);return source?d.json(source):fail(409,'playoff_policy_or_rule_review_required');}
  const body=await d.readJson(request,1_000_000),raw=serializeEventPrizeActivationV1(body),hash=await eventPrizeActivationRequestHashV1(body);if(!raw||!hash)return fail(400,'invalid_request');
  const own=async()=>{const r=await client.rpc('get_event_prize_activation_operation_provider_v1',{tid,request_text:raw});return r.error?null:readEventPrizeActivationRecordV1(r.data,actorId,tid,raw,hash);};
  let result;
  if(mode==='finalize'){
   const prepared=await own();if(!prepared||prepared.preparation.status!=='activation_intent_prepared')return fail(409,'owned_preparation_required');
   if(!await authorized(client,actorId,tid)||!allowed(mode))return fail(403,'permission_required');
   if(prepared.activation?.status==='event_settings_operationally_activated')result=prepared;
   else{const reply=await d.admin().rpc('finalize_event_prize_activation_provider_v1',{actor:actorId,tid,request_text:raw});if(reply.error)return fail(503,'operation_outcome_unknown');result=readEventPrizeActivationRecordV1(reply.data,actorId,tid,raw,hash);}
  }else if(mode==='prepare'){const reply=await client.rpc('prepare_event_prize_activation_provider_v1',{tid,request_text:raw});if(reply.error)return fail(503,'operation_outcome_unknown');result=readEventPrizeActivationRecordV1(reply.data,actorId,tid,raw,hash);}
  else result=await own();
  if(!allowed(mode)||!await authorized(client,actorId,tid))return fail(503,'operation_outcome_unknown');
  if(!result)return fail(503,'operation_outcome_unknown');
  return d.json(result,{status:result.preparation.status==='activation_intent_prepared'&&(result.activation===null||result.activation.status==='event_settings_operationally_activated')?200:409});
 });
 return{sourceGET:(r:NextRequest,c:Context)=>run(r,c,'source'),preparePOST:(r:NextRequest,c:Context)=>run(r,c,'prepare'),finalizePOST:(r:NextRequest,c:Context)=>run(r,c,'finalize'),operationPOST:(r:NextRequest,c:Context)=>run(r,c,'reconcile'),contextGET:(r:NextRequest,c:Context)=>run(r,c,'context'),contextPOST:(r:NextRequest,c:Context)=>run(r,c,'contextSave'),contextOperationPOST:(r:NextRequest,c:Context)=>run(r,c,'contextOperation')};
}
