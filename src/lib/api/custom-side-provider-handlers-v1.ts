import 'server-only';
import type {NextRequest} from 'next/server';
import {isUuid} from './validation.ts';
import {isCustomSideOperatingOperationV4} from './custom-side-operating-v4.ts';
import type {createCustomSideProviderV1} from './custom-side-provider-v1.ts';

type Port=ReturnType<typeof createCustomSideProviderV1>;
type Context={params:Promise<{id:string;eventId:string;poolId:string;operationId?:string}>};
const uuid=(value:unknown):value is string=>isUuid(value)&&value===value.toLowerCase();
export const customSideExpectedActorHeaderV1='x-expected-actor-id';

/** Pure route boundary for a future dedicated Custom Side route. No route is
 * registered by this module and both handler and provider capabilities remain
 * default-off. Reconciliation posts the complete immutable operation again. */
export function createCustomSideProviderHandlersV1<Reply>(dependencies:{
 enabled?:()=>boolean;port:()=>Promise<Port>;readJson:(request:NextRequest,limit:{maxBytes:number})=>Promise<unknown>;
 sameOrigin:(request:NextRequest)=>boolean;json:(body:unknown,init?:ResponseInit)=>Reply;boundary:(run:()=>Promise<Reply>)=>Promise<Reply>;
}){
 const response=(body:unknown,init?:ResponseInit)=>{const headers=new Headers(init?.headers);headers.set('cache-control','private, no-store');headers.set('vary','Cookie, Authorization');headers.set('x-content-type-options','nosniff');return dependencies.json(body,{...init,headers});};
 const fail=(status:number,error:string)=>response({error},{status});
 const error=(value:string)=>value==='disabled'?fail(404,'not_found'):value==='identity_changed'?fail(403,'identity_changed'):value==='permission_required'?fail(403,'forbidden'):value==='invalid_scope'?fail(400,'invalid_request'):fail(503,'operation_unavailable');
 const guarded=(run:()=>Promise<Reply>)=>dependencies.boundary(async()=>dependencies.enabled?.()===true?run():fail(404,'not_found'));
 const scope=async(request:NextRequest,context:Context)=>{const params=await context.params,actor=request.headers.get(customSideExpectedActorHeaderV1);return actor&&uuid(actor)&&uuid(params.id)&&uuid(params.eventId)&&uuid(params.poolId)?{actorId:actor,tournamentId:params.id,eventId:params.eventId,poolId:params.poolId,operationId:params.operationId}:null;};
 const post=async(request:NextRequest,run:(body:unknown)=>Promise<Reply>)=>{if(!dependencies.sameOrigin(request))return fail(403,'invalid_origin');return run(await dependencies.readJson(request,{maxBytes:4200000}));};
 const write=(result:Awaited<ReturnType<Port['save']>>)=>{if(result.error)return error(result.error);const status=result.data.outcome?.status==='rejected'?409:200;return response(result.data,{status});};
 return{
  workspaceGET:(request:NextRequest,context:Context)=>guarded(async()=>{if(request.method!=='GET')return fail(405,'method_not_allowed');const value=await scope(request,context);if(!value)return fail(403,'identity_changed');const result=await(await dependencies.port()).workspace(value);return result.error?error(result.error):response(result.data);}),
  policyPOST:(request:NextRequest,context:Context)=>guarded(async()=>{if(request.method!=='POST')return fail(405,'method_not_allowed');const value=await scope(request,context);if(!value)return fail(403,'identity_changed');return post(request,async body=>{if(!isCustomSideOperatingOperationV4(body))return fail(400,'invalid_request');return write(await(await dependencies.port()).save(value,body));});}),
  operationPOST:(request:NextRequest,context:Context)=>guarded(async()=>{if(request.method!=='POST')return fail(405,'method_not_allowed');const value=await scope(request,context);if(!value||!uuid(value.operationId))return fail(403,'identity_changed');return post(request,async body=>{if(!isCustomSideOperatingOperationV4(body)||body.operationId!==value.operationId)return fail(400,'invalid_request');const result=await(await dependencies.port()).reconcile(value,body);if(result.error)return error(result.error);return response(result.data);});}),
 };
}
