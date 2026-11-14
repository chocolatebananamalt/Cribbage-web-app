import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import type {NextRequest} from 'next/server';
import {readPlayoffPrizeProposalSaveV2,serializePlayoffPrizeProposalSaveV2,readPlayoffPrizeProposalWorkspaceV2,readPlayoffPrizeProposalReplyV2,playoffPrizeProposalRequestBytesV2} from '../finance/playoff-prize-proposal-store-v2.ts';
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,string>)=>PromiseLike<{data:unknown;error:unknown}>};
type Context={params:Promise<{id:string;eventId:string}>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export const playoffPrizeProposalProviderEnabledV2=()=>integratedTestFeatureEnabled();
/** Same cookie-authenticated client for role, native capture and journal.
 * Default composition is OFF. No service/admin client or posted actor is used. */
export function createPlayoffPrizeProposalHandlersV2<Reply extends Response>(d:{enabled:()=>boolean;readEnabled:()=>boolean;writeEnabled:()=>boolean;recoveryEnabled:()=>boolean;client:()=>Promise<Client>;sameOrigin:(r:NextRequest)=>boolean;readJson:(r:Request,maxBytes:number)=>Promise<unknown>;json:(body:unknown,init?:ResponseInit)=>Reply;boundary:(f:()=>Promise<Reply>)=>Promise<Reply>;projectWorkspace?:(raw:unknown,scope:{actorId:string;tournamentId:string;eventId:string})=>unknown;projectReply?:(raw:unknown,scope:{actorId:string;tournamentId:string;eventId:string},request:NonNullable<ReturnType<typeof readPlayoffPrizeProposalSaveV2>>)=>unknown}){
 type Mode='read'|'save'|'operation';const allowed=(mode:Mode)=>d.enabled()===true&&(mode==='read'?d.readEnabled():mode==='save'?d.writeEnabled():d.recoveryEnabled())===true;
 const fail=(code:string,status:number)=>d.json({error:code},{status});
 const authorized=async(client:Client,actorId:string,tid:string)=>{const auth=await client.auth.getUser();if(auth.error||auth.data?.user?.id!==actorId)return false;const role=await client.rpc('get_tournament_role',{p_tournament_id:tid});return !role.error&&(role.data==='director'||role.data==='co_director');};
 const run=(r:NextRequest,c:Context,mode:Mode)=>d.boundary(async()=>{
  if(!allowed(mode))return fail('not_found',404);const method=mode==='read'?'GET':'POST';if(r.method!==method)return fail('method_not_allowed',405);if(method==='POST'&&!d.sameOrigin(r))return fail('invalid_origin',403);
  const {id:tid,eventId:eid}=await c.params,actorId=r.headers.get('x-expected-actor-id');if(!uuid(tid)||!uuid(eid)||!uuid(actorId))return fail('invalid_request',400);
  const client=await d.client();if(!await authorized(client,actorId,tid)||!allowed(mode))return fail('permission_required',403);const scope={actorId,tournamentId:tid,eventId:eid};
  if(mode==='read'){const result=await client.rpc('get_playoff_prize_proposal_workspace_provider_v2',{p_tid:tid,p_eid:eid});if(result.error||!allowed(mode)||!await authorized(client,actorId,tid))return fail('workspace_unavailable',503);const workspace=readPlayoffPrizeProposalWorkspaceV2(result.data,scope);const projected=workspace&&(d.projectWorkspace?d.projectWorkspace(workspace,scope):workspace);return projected?d.json(projected):fail('workspace_unavailable',503);}
  const request=readPlayoffPrizeProposalSaveV2(await d.readJson(r,playoffPrizeProposalRequestBytesV2)),raw=request&&serializePlayoffPrizeProposalSaveV2(request);if(!request||!raw)return fail('invalid_request',400);
  const input=request.input as {binding:{tournamentId:string;eventId:string}};if(input.binding.tournamentId!==tid||input.binding.eventId!==eid)return fail('invalid_scope',400);
  if(!allowed(mode)||!await authorized(client,actorId,tid))return fail('permission_required',403);
  const reply=await client.rpc(mode==='save'?'save_playoff_prize_proposal_provider_v2':'get_playoff_prize_proposal_operation_provider_v2',{p_tid:tid,p_eid:eid,p_request_text:raw});
  if(reply.error||!allowed(mode)||!await authorized(client,actorId,tid))return fail('operation_outcome_unknown',503);
  const result=readPlayoffPrizeProposalReplyV2(reply.data,scope,request);if(!result)return fail('operation_outcome_unknown',503);
  const status=result.kind==='playoff-prize-proposal-operation-v2'?result.result.status==='saved'?200:409:result.status==='rejected'?409:503;
  const projected=d.projectReply?d.projectReply(result,scope,request):result;return projected?d.json(projected,{status}):fail('operation_outcome_unknown',503);
 });
 return{GET:(r:NextRequest,c:Context)=>run(r,c,'read'),POST:(r:NextRequest,c:Context)=>run(r,c,'save'),operationPOST:(r:NextRequest,c:Context)=>run(r,c,'operation')};
}
