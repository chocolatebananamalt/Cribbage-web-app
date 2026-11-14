import {
 isNativeMixedSimulationOperationV1,
 type NativeMixedSimulationOperationReadV1,
 type NativeMixedSimulationOperationV1,
 type NativeMixedSimulationProviderWriteV1,
} from '../seating/native-mixed-simulation-operation-v1.ts';
import {
 isNativeMixedSimulationCancellationRequestV1,
 type NativeMixedSimulationCancellationReceiptV1,
 type NativeMixedSimulationCancellationRequestV1,
} from '../seating/native-mixed-cancellation-v1.ts';
import type {NativeMixedDirectorTransitionV1} from '../seating/native-mixed-director-transition-v1.ts';
import {
 readNativeMixedDirectorSessionV1,
 type NativeMixedDirectorSessionV1,
 type NativeMixedSimulationCancelOutcomeV1,
 type NativeMixedSimulationProviderCapabilityV1,
} from './native-mixed-simulation-provider-v1.ts';

import {isNativeMixedSimulationStartRequestV1, type NativeMixedSimulationStartRequestV1,
 type NativeMixedSimulationStartOutcomeV1, type NativeMixedSimulationStartReceiptV1,
 type NativeMixedSimulationStartedSourceV1} from '../seating/native-mixed-simulation-start-v1.ts';

export const nativeMixedSimulationRequestBodyLimitV1=131072;
type Identity={subjectId:string;sessionId:string};
type Context={params:Promise<{id:string;eventId:string;operationId?:string}>};
type PortResult<T>={data:T;error:null}|{data:null;error:string};
export type NativeMixedSimulationHandlerPortV1={
 execute:(session:NativeMixedDirectorSessionV1,operation:NativeMixedSimulationOperationV1)=>Promise<PortResult<NativeMixedSimulationProviderWriteV1>>;
 cancel:(session:NativeMixedDirectorSessionV1,request:NativeMixedSimulationCancellationRequestV1)=>Promise<PortResult<NativeMixedSimulationCancelOutcomeV1>>;
 operation:(session:NativeMixedDirectorSessionV1,operationId:string)=>Promise<PortResult<NativeMixedSimulationOperationReadV1>>;
 cancellation:(session:NativeMixedDirectorSessionV1,operation:NativeMixedSimulationOperationV1)=>Promise<PortResult<NativeMixedSimulationCancellationReceiptV1>>;
 transition:(session:NativeMixedDirectorSessionV1,operation:NativeMixedSimulationOperationV1)=>Promise<PortResult<NativeMixedDirectorTransitionV1>>;
 source:(session:NativeMixedDirectorSessionV1)=>Promise<PortResult<unknown>>;
 startSimulation?:(session:NativeMixedDirectorSessionV1,request:NativeMixedSimulationStartRequestV1)=>Promise<PortResult<NativeMixedSimulationStartOutcomeV1>>;
 startOperation?:(session:NativeMixedDirectorSessionV1,request:NativeMixedSimulationStartRequestV1)=>Promise<PortResult<NativeMixedSimulationStartReceiptV1>>;
 startedSource?:(session:NativeMixedDirectorSessionV1,request:NativeMixedSimulationStartRequestV1,startId:string)=>Promise<PortResult<NativeMixedSimulationStartedSourceV1>>;
};
type AuthorizeInput=Identity&{actorId:string;tournamentId:string;eventId:string;projectUrl:string;projectRef:string;action:NativeMixedSimulationProviderCapabilityV1};
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);

/** Pure server boundary. A production route must inject a provider-validated
 * identity, a current-Director target authorization and bounded JSON reader.
 * This module creates no client, route, credential or executor. */
export function createNativeMixedSimulationHandlersV1<Reply,Req extends Request=Request>(d:{
 enabled:()=>boolean;projectUrl:string;projectRef:string;now?:()=>number;
 simulatedStartEnabled?:()=>boolean;simulatedStartRecoveryEnabled?:()=>boolean;
 verifiedIdentity:()=>Promise<Identity|null>;
 authorizeTarget:(input:AuthorizeInput)=>Promise<unknown>;
 port:()=>Promise<NativeMixedSimulationHandlerPortV1>;
 readJson:(request:Req,maxBytes:number)=>Promise<unknown>;
 sameOrigin:(request:Req)=>boolean;
 json:(body:unknown,init?:ResponseInit)=>Reply;
 boundary:(run:()=>Promise<Reply>)=>Promise<Reply>;
}){
 const now=d.now??Date.now,fail=(status:number,error:string)=>d.json({error},{status});
 async function enter(request:Req,context:Context,action:NativeMixedSimulationProviderCapabilityV1,write=false):Promise<{reply:Reply}|{session:NativeMixedDirectorSessionV1;operationId:string|undefined}>{
  if(d.enabled()!==true)return{reply:fail(404,'not_found')};
  const params=await context.params;if(!uuid(params.id)||!uuid(params.eventId)||(params.operationId!==undefined&&!uuid(params.operationId)))return{reply:fail(400,'invalid_request')};
  if(write&&!d.sameOrigin(request))return{reply:fail(403,'invalid_origin')};
  const expectedActor=request.headers.get('x-expected-actor-id');if(!uuid(expectedActor))return{reply:fail(403,'identity_required')};
  const identity=await d.verifiedIdentity();if(!identity||!uuid(identity.subjectId)||identity.subjectId!==expectedActor||typeof identity.sessionId!=='string'||identity.sessionId.length<1)return{reply:fail(403,'identity_changed')};
  const input={...identity,actorId:identity.subjectId,tournamentId:params.id,eventId:params.eventId,projectUrl:d.projectUrl,projectRef:d.projectRef,action};
  const authorized=await d.authorizeTarget(input);const session=readNativeMixedDirectorSessionV1(authorized,{subjectId:identity.subjectId,sessionId:identity.sessionId,tournamentId:params.id,eventId:params.eventId,projectUrl:d.projectUrl,projectRef:d.projectRef,action,now:now()});
  return session?{session,operationId:params.operationId}:{reply:fail(403,'target_not_authorized')};
 }
 function error(error:string){
  if(error==='disabled')return fail(404,'not_found');
  if(['invalid_session','action_not_allowed','permission_required','identity_changed'].includes(error))return fail(403,'forbidden');
  return fail(503,error==='operation_outcome_unknown'?'operation_outcome_unknown':'operation_unavailable');
 }
 return{
  simulatedStartPOST:(request:Req,context:Context)=>d.boundary(async()=>{
   if(d.enabled()!==true||d.simulatedStartEnabled?.()!==true)return fail(404,'not_found');
   if(!d.sameOrigin(request))return fail(403,'invalid_origin');
   const body=await d.readJson(request,16384);if(!isNativeMixedSimulationStartRequestV1(body))return fail(400,'invalid_request');
   const fixed=structuredClone(body);
   const entered=await enter(request,context,'simulation-start',true);if('reply'in entered)return entered.reply;
   if(entered.operationId!==fixed.operationId)return fail(400,'invalid_request');
   if(d.simulatedStartEnabled?.()!==true)return fail(404,'not_found');
   const port=await d.port();if(d.simulatedStartEnabled?.()!==true)return fail(404,'not_found');if(!port.startSimulation)return fail(503,'operation_unavailable');
   const result=await port.startSimulation(entered.session,fixed);if(d.enabled()!==true||d.simulatedStartEnabled?.()!==true)return fail(404,'not_found');if(result.data===null)return error(result.error);
   return d.json(result.data,{status:result.data.status==='accepted'?200:result.data.status==='rejected'?409:503});
  }),
  simulatedStartOperationPOST:(request:Req,context:Context)=>d.boundary(async()=>{
   if(d.enabled()!==true||d.simulatedStartRecoveryEnabled?.()!==true)return fail(404,'not_found');
   if(!d.sameOrigin(request))return fail(403,'invalid_origin');
   const body=await d.readJson(request,16384);if(!isNativeMixedSimulationStartRequestV1(body))return fail(400,'invalid_request');
   const fixed=structuredClone(body);
   const entered=await enter(request,context,'simulation-start-operation',true);if('reply'in entered)return entered.reply;
   if(entered.operationId!==fixed.operationId)return fail(400,'invalid_request');
   if(d.simulatedStartRecoveryEnabled?.()!==true)return fail(404,'not_found');
   const port=await d.port();if(d.simulatedStartRecoveryEnabled?.()!==true)return fail(404,'not_found');if(!port.startOperation)return fail(503,'operation_unavailable');
   const result=await port.startOperation(entered.session,fixed);if(d.enabled()!==true||d.simulatedStartRecoveryEnabled?.()!==true)return fail(404,'not_found');return result.error?error(result.error):d.json(result.data);
  }),
  simulatedStartedSourcePOST:(request:Req,context:Context)=>d.boundary(async()=>{
   if(d.enabled()!==true||d.simulatedStartEnabled?.()!==true)return fail(404,'not_found');
   if(!d.sameOrigin(request))return fail(403,'invalid_origin');
   const body=await d.readJson(request,16384);
   if(!body||typeof body!=='object'||Array.isArray(body)||Reflect.ownKeys(body).length!==2||!Object.hasOwn(body,'request')||!Object.hasOwn(body,'startId'))return fail(400,'invalid_request');
   const value=body as {request:unknown;startId:unknown};if(!isNativeMixedSimulationStartRequestV1(value.request)||!uuid(value.startId))return fail(400,'invalid_request');
   const fixed=structuredClone({request:value.request,startId:value.startId});
   const entered=await enter(request,context,'simulation-start-source',true);if('reply'in entered)return entered.reply;
   if(entered.operationId!==fixed.request.operationId)return fail(400,'invalid_request');
   if(d.simulatedStartEnabled?.()!==true)return fail(404,'not_found');
   const port=await d.port();if(d.simulatedStartEnabled?.()!==true)return fail(404,'not_found');if(!port.startedSource)return fail(503,'operation_unavailable');
   const result=await port.startedSource(entered.session,fixed.request,fixed.startId);if(d.enabled()!==true||d.simulatedStartEnabled?.()!==true)return fail(404,'not_found');return result.error?error(result.error):d.json(result.data);
  }),
  sourceGET:(request:Req,context:Context)=>d.boundary(async()=>{
   const entered=await enter(request,context,'source');if('reply'in entered)return entered.reply;
   const result=await(await d.port()).source(entered.session);return result.error?error(result.error):d.json(result.data);
  }),
  operationGET:(request:Req,context:Context)=>d.boundary(async()=>{
   const entered=await enter(request,context,'operation');if('reply'in entered)return entered.reply;
   if(!entered.operationId)return fail(400,'invalid_request');
   const result=await(await d.port()).operation(entered.session,entered.operationId);return result.error?error(result.error):d.json(result.data);
  }),
  operationPOST:(request:Req,context:Context)=>d.boundary(async()=>{
   if(d.enabled()!==true)return fail(404,'not_found');
   if(!d.sameOrigin(request))return fail(403,'invalid_origin');
   const body=await d.readJson(request,nativeMixedSimulationRequestBodyLimitV1);if(!isNativeMixedSimulationOperationV1(body))return fail(400,'invalid_request');
   const entered=await enter(request,context,body.action);if('reply'in entered)return entered.reply;
   if(entered.operationId!==undefined&&entered.operationId!==body.operationId)return fail(400,'invalid_request');
   const result=await(await d.port()).execute(entered.session,structuredClone(body));if(result.data===null)return error(result.error);
   const status=result.data.outcome.status==='accepted'?200:result.data.outcome.status==='rejected'?409:503;
   return d.json(result.data,{status});
  }),
  cancelPOST:(request:Req,context:Context)=>d.boundary(async()=>{
   if(d.enabled()!==true)return fail(404,'not_found');
   if(!d.sameOrigin(request))return fail(403,'invalid_origin');
   const body=await d.readJson(request,nativeMixedSimulationRequestBodyLimitV1);if(!isNativeMixedSimulationCancellationRequestV1(body))return fail(400,'invalid_request');
   const entered=await enter(request,context,'cancel',true);if('reply'in entered)return entered.reply;
   if(entered.operationId!==undefined&&entered.operationId!==body.operationId)return fail(400,'invalid_request');
   const result=await(await d.port()).cancel(entered.session,structuredClone(body));if(result.data===null)return error(result.error);
   const status='status'in result.data&&['retry_exact','blocked'].includes(result.data.status)?503:'status'in result.data&&result.data.status==='rejected'?409:200;
   return d.json(result.data,{status});
  }),
  cancellationPOST:(request:Req,context:Context)=>d.boundary(async()=>{
   if(d.enabled()!==true)return fail(404,'not_found');
   if(!d.sameOrigin(request))return fail(403,'invalid_origin');
   const body=await d.readJson(request,nativeMixedSimulationRequestBodyLimitV1);if(!isNativeMixedSimulationOperationV1(body))return fail(400,'invalid_request');
   const entered=await enter(request,context,'cancellation',true);if('reply'in entered)return entered.reply;
   if(entered.operationId!==undefined&&entered.operationId!==body.operationId)return fail(400,'invalid_request');
   const result=await(await d.port()).cancellation(entered.session,structuredClone(body));return result.error?error(result.error):d.json(result.data);
  }),
  transitionPOST:(request:Req,context:Context)=>d.boundary(async()=>{
   if(d.enabled()!==true)return fail(404,'not_found');
   if(!d.sameOrigin(request))return fail(403,'invalid_origin');
   const body=await d.readJson(request,nativeMixedSimulationRequestBodyLimitV1);if(!isNativeMixedSimulationOperationV1(body))return fail(400,'invalid_request');
   const entered=await enter(request,context,'transition',true);if('reply'in entered)return entered.reply;
   if(entered.operationId!==undefined&&entered.operationId!==body.operationId)return fail(400,'invalid_request');
   const result=await(await d.port()).transition(entered.session,structuredClone(body));return result.error?error(result.error):d.json(result.data);
  }),
 };
}
