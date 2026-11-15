import 'server-only';
import type{NextRequest}from'next/server';
import{isUuid}from'./validation.ts';
import{isOperationalFinanceSourceAdoptionRequestV1}from'./operational-finance-source-adoption-v1.ts';
import{isNativeLedgerAllocationWireRequestV1,type createOperationalFinanceSourceAdoptionTransportV1}from'./operational-finance-source-adoption-transport-v1.ts';
type Port=ReturnType<typeof createOperationalFinanceSourceAdoptionTransportV1>;
type EventContext={params:Promise<{id:string;eventId:string;operationId?:string}>};
type TournamentContext={params:Promise<{id:string;operationId?:string}>};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export const operationalFinanceExpectedActorHeaderV1='x-expected-actor-id';

export function createOperationalFinanceSourceAdoptionHandlersV1<Reply>(dependencies:{
 enabled?:()=>boolean;port:()=>Promise<Port>;readJson:(request:NextRequest,limit:{maxBytes:number})=>Promise<unknown>;
 sameOrigin:(request:NextRequest)=>boolean;json:(body:unknown,init?:ResponseInit)=>Reply;boundary:(run:()=>Promise<Reply>)=>Promise<Reply>;
}){
 const response=(body:unknown,init?:ResponseInit)=>{const headers=new Headers(init?.headers);headers.set('cache-control','private, no-store');headers.set('vary','Cookie, Authorization');headers.set('x-content-type-options','nosniff');return dependencies.json(body,{...init,headers});};
 const fail=(status:number,error:string)=>response({error},{status});
 const guarded=(run:()=>Promise<Reply>)=>dependencies.boundary(async()=>dependencies.enabled?.()===true?run():fail(404,'not_found'));
 const providerError=(error:string|null)=>error==='disabled'?fail(404,'not_found'):error==='identity_changed'?fail(403,'identity_changed'):error==='permission_required'?fail(403,'forbidden'):error==='invalid_request'||error==='invalid_scope'?fail(400,'invalid_request'):fail(503,'operation_unavailable');
 const expectedActor=(request:NextRequest)=>{const value=request.headers.get(operationalFinanceExpectedActorHeaderV1);return value&&isUuid(value)?value:null;};
 const eventIds=async(context:EventContext)=>{const params=await context.params;return isUuid(params.id)&&isUuid(params.eventId)?{tournamentId:params.id,eventId:params.eventId,operationId:params.operationId}:null;};
 const tournamentId=async(context:TournamentContext)=>{const params=await context.params;return isUuid(params.id)?{tournamentId:params.id,operationId:params.operationId}:null;};
 const post=async(request:NextRequest,run:(body:unknown)=>Promise<Reply>)=>{if(!dependencies.sameOrigin(request))return fail(403,'invalid_origin');return run(await dependencies.readJson(request,{maxBytes:4200000}));};
 const write=(result:{data:unknown;error:null|string})=>{if(result.error)return providerError(result.error);if(!object(result.data)||!object(result.data.outcome)||!['accepted','rejected','retry_exact'].includes(result.data.outcome.status as string))return fail(503,'operation_unavailable');return response(result.data,{status:result.data.outcome.status==='rejected'?409:result.data.outcome.status==='retry_exact'?503:200});};
 return{
  adoptionGET:(request:NextRequest,context:EventContext)=>guarded(async()=>{if(request.method!=='GET')return fail(405,'method_not_allowed');const actor=expectedActor(request);if(!actor)return fail(403,'identity_changed');const scope=await eventIds(context);if(!scope)return fail(400,'invalid_request');const result=await(await dependencies.port()).workspace(scope,actor);return result.error?providerError(result.error):response(result.data);}),
  adoptionPOST:(request:NextRequest,context:EventContext)=>guarded(async()=>{if(request.method!=='POST')return fail(405,'method_not_allowed');const actor=expectedActor(request);if(!actor)return fail(403,'identity_changed');const scope=await eventIds(context);if(!scope)return fail(400,'invalid_request');return post(request,async body=>isOperationalFinanceSourceAdoptionRequestV1(body)?write(await(await dependencies.port()).save(scope,body,actor)):fail(400,'invalid_request'));}),
  adoptionOperationGET:(request:NextRequest,context:EventContext)=>guarded(async()=>{if(request.method!=='GET')return fail(405,'method_not_allowed');const actor=expectedActor(request);if(!actor)return fail(403,'identity_changed');const scope=await eventIds(context);if(!scope||!isUuid(scope.operationId))return fail(400,'invalid_request');const result=await(await dependencies.port()).operation(scope,scope.operationId,actor);return result.error?providerError(result.error):response(result.data);}),
  allocationGET:(request:NextRequest,context:TournamentContext)=>guarded(async()=>{if(request.method!=='GET')return fail(405,'method_not_allowed');const actor=expectedActor(request);if(!actor)return fail(403,'identity_changed');const scope=await tournamentId(context);if(!scope)return fail(400,'invalid_request');const result=await(await dependencies.port()).allocationWorkspace(scope.tournamentId,actor);return result.error?providerError(result.error):response(result.data);}),
  allocationPOST:(request:NextRequest,context:TournamentContext)=>guarded(async()=>{if(request.method!=='POST')return fail(405,'method_not_allowed');const actor=expectedActor(request);if(!actor)return fail(403,'identity_changed');const scope=await tournamentId(context);if(!scope)return fail(400,'invalid_request');return post(request,async body=>isNativeLedgerAllocationWireRequestV1(body)?write(await(await dependencies.port()).saveAllocation(scope.tournamentId,body,actor)):fail(400,'invalid_request'));}),
  allocationOperationGET:(request:NextRequest,context:TournamentContext)=>guarded(async()=>{if(request.method!=='GET')return fail(405,'method_not_allowed');const actor=expectedActor(request);if(!actor)return fail(403,'identity_changed');const scope=await tournamentId(context);if(!scope||!isUuid(scope.operationId))return fail(400,'invalid_request');const result=await(await dependencies.port()).allocationOperation(scope.tournamentId,scope.operationId,actor);return result.error?providerError(result.error):response(result.data);}),
 };
}
