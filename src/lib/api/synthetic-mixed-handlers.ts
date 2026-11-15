import {isUuid}from'./validation.ts';
import {isSyntheticMixedLocalDeployment,isMixedCapability,isMixedOwnHybrid,isMixedOwnAckRequest,isMixedOfficialPhase,isMixedOfficialEnvelope,
 isMixedOwnAckResult,isMixedOfficialResult,isMixedNativeRejection,projectMixedOfficialWorkspace,readMixedArtifacts,sameMixedUuid,
 type MixedCapability,type MixedOfficialPhase,type MixedOfficialEnvelope,type MixedOwnAckRequest,type MixedScopedReceipt}from'./synthetic-mixed-evidence.ts';

export type MixedRpc = (name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
export type MixedHandlerIdentity = {actorId:string;rpc:MixedRpc};
export type MixedHandlerDependencies<Reply,Req extends Request=Request> = {env:Record<string,string|undefined>;getIdentity:()=>Promise<MixedHandlerIdentity|null>;adminRpc:MixedRpc;
 readJson:(request:Req)=>Promise<unknown>;sameOrigin:(request:Req)=>boolean;json:(body:unknown,init?:ResponseInit)=>Reply;boundary:(run:()=>Promise<Reply>)=>Promise<Reply>};
export type MixedRouteParams = {id:string;eventId:string;gameId?:string;kind?:string;phase?:string};
type RouteContext={params:Promise<MixedRouteParams>};

/** Same handlers are used by Next routes and the isolated fixture test app.
 * Injection is code-only: there is no runtime adapter endpoint or auth bypass. */
export function createMixedHandlers<Reply,Req extends Request=Request>(d:MixedHandlerDependencies<Reply,Req>){
 const fail=(status:number,error:string)=>d.json({error},{status});
 type Entered={ok:true;id:string;eventId:string;identity:MixedHandlerIdentity;cap:MixedCapability;params:MixedRouteParams}|{ok:false;reply:Reply};
 async function enter(request:Req,context:RouteContext,write=false):Promise<Entered>{
  // Never construct any existing hosted environment client before this gate.
  if(!isSyntheticMixedLocalDeployment(d.env))return{ok:false,reply:fail(404,'not_found')};
  if(write&&!d.sameOrigin(request))return{ok:false,reply:fail(403,'invalid_origin')};
  const params=await context.params;
  if(!isUuid(params.id)||!isUuid(params.eventId))return{ok:false,reply:fail(400,'invalid_request')};
  const identity=await d.getIdentity();if(!identity||!isUuid(identity.actorId))return{ok:false,reply:fail(401,'unauthorized')};
  const id=params.id.toLowerCase(),eventId=params.eventId.toLowerCase();
  const{data,error}=await d.adminRpc('get_synthetic_mixed_capability_v2',{p_actor_id:identity.actorId,p_tournament_id:id,p_event_id:eventId});
  if(error)return{ok:false,reply:fail(503,'operation_unavailable')};
  if(data===null)return{ok:false,reply:fail(404,'not_found')};
  if(!isMixedCapability(data,identity.actorId,id,eventId))return{ok:false,reply:fail(503,'operation_unavailable')};
  return{ok:true,id,eventId,identity,cap:data,params};
 }
 function envelope(ctx:Extract<Entered,{ok:true}>,gameId:string,phase:'own-ack'|MixedOfficialPhase,body:MixedOwnAckRequest|MixedOfficialEnvelope,result:Record<string,unknown>):MixedScopedReceipt{
  return{kind:'synthetic-mixed-receipt-v1',actorId:ctx.identity.actorId,tournamentId:ctx.id,eventId:ctx.eventId,gameId,phase,idempotencyKey:body.idempotencyKey,request:body,result};
 }
 return{
  capabilityGET:(request:Req,context:RouteContext)=>d.boundary(async()=>{const c=await enter(request,context);return c.ok?d.json(c.cap):c.reply;}),
  ownGET:(request:Req,context:RouteContext)=>d.boundary(async()=>{
   const c=await enter(request,context);if(!c.ok)return c.reply;
   if(!isUuid(c.params.gameId))return fail(400,'invalid_request');if(!c.cap.isDigitalParticipant)return fail(404,'not_found');
   const gid=c.params.gameId.toLowerCase();const{data,error}=await c.identity.rpc('get_own_synthetic_mixed_hybrid_v1',{tid:c.id,eid:c.eventId,gid});
   if(error)return fail(503,'operation_unavailable');if(data===null)return fail(404,'not_found');
   return isMixedOwnHybrid(data,c.id,c.eventId,gid)?d.json(data):fail(503,'operation_unavailable');
  }),
  ownPOST:(request:Req,context:RouteContext)=>d.boundary(async()=>{
   const c=await enter(request,context,true);if(!c.ok)return c.reply;
   if(!isUuid(c.params.gameId))return fail(400,'invalid_request');const body=await d.readJson(request);if(!isMixedOwnAckRequest(body))return fail(400,'invalid_request');
   if(!c.cap.isDigitalParticipant)return fail(404,'not_found');
   const gid=c.params.gameId.toLowerCase(),{idempotencyKey,...rest}=body;
   const{data,error}=await c.identity.rpc('attest_synthetic_mixed_hybrid_v1',{p_tournament_id:c.id,p_event_id:c.eventId,p_request:{gameId:gid,...rest},p_operation_id:idempotencyKey});
   if(error)return fail(503,'operation_unavailable');
   if(isMixedOwnAckResult(data,gid,body))return d.json(envelope(c,gid,'own-ack',body,data as Record<string,unknown>));
   if(isMixedNativeRejection(data,body,'own-ack'))return d.json(envelope(c,gid,'own-ack',body,data as Record<string,unknown>),{status:409});
   return fail(503,'operation_unavailable');
  }),
  officialGET:(request:Req,context:RouteContext)=>d.boundary(async()=>{
   const c=await enter(request,context);if(!c.ok)return c.reply;if(!c.cap.isOfficial)return fail(404,'not_found');
   const results=await Promise.all([
    d.adminRpc('get_synthetic_mixed_workspace_v1',{actor:c.identity.actorId,tid:c.id}),
    d.adminRpc('get_paper_game_completion_workspace_v1',{p_actor_id:c.identity.actorId,p_tournament_id:c.id}),
    d.adminRpc('get_hybrid_game_workspace_v1',{p_actor_id:c.identity.actorId,p_tournament_id:c.id})]);
   if(results.some(r=>r.error))return fail(503,'operation_unavailable');
   const workspace=projectMixedOfficialWorkspace(c.cap,results[0].data,results[1].data,results[2].data);
   return workspace?d.json(workspace):fail(503,'operation_unavailable');
  }),
  officialPOST:(request:Req,context:RouteContext)=>d.boundary(async()=>{
   const c=await enter(request,context,true);if(!c.ok)return c.reply;
   const phase=`${c.params.kind}-${c.params.phase}`;if(!isMixedOfficialPhase(phase))return fail(400,'invalid_request');
   const body=await d.readJson(request);if(!isMixedOfficialEnvelope(body,phase))return fail(400,'invalid_request');if(!c.cap.isOfficial)return fail(404,'not_found');
   const evidence=await d.adminRpc('get_synthetic_mixed_workspace_v1',{actor:c.identity.actorId,tid:c.id});
   if(evidence.error)return fail(503,'operation_unavailable');const artifacts=readMixedArtifacts(evidence.data,c.id,c.eventId);
   if(!artifacts)return fail(503,'operation_unavailable');const artifact=artifacts.find(a=>sameMixedUuid(a.artifactId,body.request.artifactId));
   if(!artifact||!sameMixedUuid(body.gameId,artifact.gameId)||artifact.pairing!==(phase.startsWith('paper')?'PP':'PD'))return fail(400,'invalid_request');
   if('gameId'in body.request&&!sameMixedUuid(body.request.gameId,artifact.gameId))return fail(400,'invalid_request');
   const rpcName={ 'paper-capture':'capture_synthetic_mixed_paper_v1','paper-review':'review_synthetic_mixed_paper_v1','hybrid-capture':'capture_synthetic_mixed_hybrid_v1','hybrid-review':'review_synthetic_mixed_hybrid_v1'}[phase];
   // Readiness flags deliberately do not block exact retained retries. The
   // frozen writer distinguishes receipt replay from a forbidden new write.
   const{data,error}=await d.adminRpc(rpcName,{actor:c.identity.actorId,tid:c.id,eid:c.eventId,request:body.request,operation:body.idempotencyKey});
   if(error)return fail(503,'operation_unavailable');
   if(isMixedOfficialResult(data,c.id,c.eventId,artifact.gameId,phase,body.request))return d.json(envelope(c,artifact.gameId,phase,body,data as Record<string,unknown>));
   if(isMixedNativeRejection(data,body.request,phase))return d.json(envelope(c,artifact.gameId,phase,body,data as Record<string,unknown>),{status:409});
   return fail(503,'operation_unavailable');
  }),
 };
}
