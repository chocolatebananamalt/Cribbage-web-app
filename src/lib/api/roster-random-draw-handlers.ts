import {isUuid}from"./validation.ts";
import{isLoopbackPlannerUrl}from"./local-seating-planner.ts";
import{isRosterDrawBody,isRosterDrawWorkspace,isPlanReceipt,isDrawReceipt,isRejectedDrawReceipt,sameDrawRequest,readRosterOperation,type PlanReceipt}from"./roster-random-draw.ts";
export type RosterDrawRpc=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
type Context={params:Promise<{id:string;operationId?:string}>};
export function rosterDrawEnabled(env:Record<string,string|undefined>){if(env.CRIBBAGE_LOCAL_ROSTER_DRAW!=="1"||!["development","test"].includes(env.NODE_ENV??"")||(env.VERCEL_ENV!==undefined&&env.VERCEL_ENV!=="development"))return false;
 const port=env.CRIBBAGE_LOCAL_ROSTER_BACKEND_PORT;
 return !!port&&/^[1-9][0-9]{0,4}$/.test(port)&&Number(port)<=65535&&["127.0.0.1","localhost"].some(host=>env.NEXT_PUBLIC_SUPABASE_URL===`http://${host}:${port}`);}
export function createRosterDrawHandlers<Reply,Req extends Request=Request>(d:{env:Record<string,string|undefined>;fictionalScope?:boolean;identity:()=>Promise<string|null>;rpc:RosterDrawRpc;readJson:(r:Req)=>Promise<unknown>;sameOrigin:(r:Req)=>boolean;json:(v:unknown,i?:ResponseInit)=>Reply;boundary:(f:()=>Promise<Reply>)=>Promise<Reply>}){
 const fail=(status:number,error:string)=>d.json({error},{status});
 async function enter(r:Req,c:Context,write=false):Promise<{reply:Reply}|{actor:string;tid:string;operationId:string|undefined}>{
  const host=r.headers.get("host");
  if(!d.fictionalScope&&(!rosterDrawEnabled(d.env)||!isLoopbackPlannerUrl(r.url)||(host!==null&&!/^(?:localhost|127\.0\.0\.1)(?::[0-9]{1,5})?$/.test(host))))return{reply:fail(404,"not_found")} as const;
  if(write&&!d.sameOrigin(r))return{reply:fail(403,"invalid_origin")} as const;
  const p=await c.params;if(!isUuid(p.id))return{reply:fail(400,"invalid_request")} as const;
  const actor=await d.identity();if(!actor||!isUuid(actor))return{reply:fail(401,"unauthorized")} as const;
  return{actor:actor.toLowerCase(),tid:p.id.toLowerCase(),operationId:p.operationId} as const;
 }
 async function plan(actor:string,tid:string,planId:string):Promise<PlanReceipt|null>{const r=await d.rpc("get_random_seating_plan_v1",{p_actor_id:actor,p_tournament_id:tid,p_plan_id:planId});return!r.error&&r.data&&typeof r.data==="object"&&"actorId"in r.data&&typeof r.data.actorId==="string"&&isUuid(r.data.actorId)&&isPlanReceipt(r.data,r.data.actorId,tid)?r.data:null;}
 function rejectOrUnknown(data:unknown,actor:string,tid:string,op:string,phase:"plan"|"draw"){return isRejectedDrawReceipt(data,actor,tid,op)&&data.kind===(phase==="plan"?"random-seating-plan-receipt-v1":"random-seating-draw-receipt-v1")?d.json(data,{status:409}):fail(503,"operation_unavailable");}
 return{
  workspaceGET:(r:Req,c:Context)=>d.boundary(async()=>{const e=await enter(r,c);if("reply"in e)return e.reply;const out=await d.rpc("get_random_seating_workspace_v1",{p_actor_id:e.actor,p_tournament_id:e.tid});if(out.error)return fail(503,"operation_unavailable");return isRosterDrawWorkspace(out.data,e.actor,e.tid)?d.json(out.data):fail(404,"not_found");}),
  operationGET:(r:Req,c:Context)=>d.boundary(async()=>{const e=await enter(r,c);if("reply"in e)return e.reply;if(!isUuid(e.operationId)||e.operationId!==e.operationId.toLowerCase())return fail(400,"invalid_request");const out=await d.rpc("get_random_seating_operation_v1",{p_actor_id:e.actor,p_tournament_id:e.tid,p_operation_id:e.operationId});
   const stored=out.data;if(out.error||!stored||typeof stored!=="object"||Array.isArray(stored))return fail(503,"operation_outcome_unknown");
   const record=stored as Record<string,unknown>;if(Object.keys(record).sort().join()!=="actorId,kind,operationId,phase,request,response,tournamentId"||record.kind!=="random-seating-operation-record-v1"||record.actorId!==e.actor||record.tournamentId!==e.tid||record.operationId!==e.operationId)return fail(503,"operation_unavailable");
   const body={phase:record.phase,operationId:record.operationId,request:record.request};if(!isRosterDrawBody(body))return fail(503,"operation_unavailable");
   const response=record.response;let p:PlanReceipt|null=null;if(body.phase==="draw"&&response&&typeof response==="object"&&"status"in response&&response.status==="accepted")p=await plan(e.actor,e.tid,body.request.planId);
   const wrapper={kind:"random-seating-operation-v1",request:body,receipt:response,...(p?{plan:p}:{})};return readRosterOperation(wrapper,e.actor,e.tid,e.operationId)?d.json(wrapper):fail(503,"operation_unavailable");
  }),
  POST:(r:Req,c:Context)=>d.boundary(async()=>{const e=await enter(r,c,true);if("reply"in e)return e.reply;const body=await d.readJson(r);if(!isRosterDrawBody(body))return fail(400,"invalid_request");const name=body.phase==="plan"?"save_random_seating_plan_v1":"draw_random_seating_candidate_v1";
   const out=await d.rpc(name,{p_actor_id:e.actor,p_tournament_id:e.tid,p_request:body.request,p_operation_id:body.operationId});if(out.error)return fail(503,"operation_outcome_unknown");
   if(body.phase==="plan"&&isPlanReceipt(out.data,e.actor,e.tid,body.operationId)&&out.data.sourceHash===body.request.expectedSourceHash&&out.data.revision===body.request.expectedRevision+1&&sameDrawRequest(out.data.config,body.request.config))return d.json(out.data);
   if(body.phase==="draw"){const p=await plan(e.actor,e.tid,body.request.planId);if(p&&p.sourceHash===body.request.expectedSourceHash&&isDrawReceipt(out.data,e.actor,e.tid,p,body.operationId))return d.json(out.data);}
   return rejectOrUnknown(out.data,e.actor,e.tid,body.operationId,body.phase);
  }),
 };
}

