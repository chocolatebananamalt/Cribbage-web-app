import 'server-only';
import type {NextRequest} from 'next/server';
import {createEventPrizeRpcV1,type EventPrizeRpcClientV1} from './event-prize-rpc-v1.ts';
import {eventPrizeSettingsMaximumBytesV1} from './event-prize-settings-v1.ts';

type Context={params:Promise<{id:string}>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
/** Provider composition only. No environment flag can enable unverified SQL. */
export const eventPrizeProviderEnabledV1=()=>false;
export function createEventPrizeProviderV1<Reply extends Response>(d:{json:(body:unknown,init?:ResponseInit)=>Reply;boundary:(f:()=>Promise<Reply>)=>Promise<Reply>;enabled:()=>boolean;readEnabled:()=>boolean;writeEnabled:()=>boolean;recoveryEnabled:()=>boolean;client:()=>Promise<EventPrizeRpcClientV1>;sameOrigin:(r:NextRequest)=>boolean;readJson:(r:Request,maxBytes:number)=>Promise<unknown>}){
 const allowed=(mode:'read'|'save'|'reconcile')=>d.enabled()===true&&(mode==='read'?d.readEnabled():mode==='save'?d.writeEnabled():d.recoveryEnabled())===true;
 async function enter(r:NextRequest,c:Context,mode:'read'|'save'|'reconcile'):Promise<{response:Reply}|{port:ReturnType<typeof createEventPrizeRpcV1>}>{
  const method=mode==='read'?'GET':'POST';
  if(!allowed(mode))return{response:d.json({error:'not_found'},{status:404})};
  if(r.method!==method)return{response:d.json({error:'method_not_allowed'},{status:405})};
  if(method==='POST'&&!d.sameOrigin(r))return{response:d.json({error:'invalid_origin'},{status:403})};
  const{id}=await c.params,actor=r.headers.get('x-expected-actor-id');
  if(!uuid(id)||!uuid(actor))return{response:d.json({error:'invalid_request'},{status:400})};
  const client=await d.client(),auth=await client.auth.getUser();
  if(auth.error||!auth.data?.user)return{response:d.json({error:'unauthorized'},{status:401})};
  if(auth.data.user.id!==actor)return{response:d.json({error:'identity_changed'},{status:403})};
  if(!allowed(mode))return{response:d.json({error:'not_found'},{status:404})};
  return{port:createEventPrizeRpcV1(client,{actorId:actor,tournamentId:id},{read:()=>allowed('read'),write:()=>allowed('save'),recovery:()=>allowed('reconcile')})};
 }
 const execute=(r:NextRequest,c:Context,mode:'read'|'save'|'reconcile')=>d.boundary(async()=>{
  const gate=await enter(r,c,mode);if('response'in gate)return gate.response;
  if(mode==='read'){const v=await gate.port.workspace();return v.status==='available'?d.json(v.workspace):d.json({error:'workspace_unavailable'},{status:503});}
  const body=await d.readJson(r,eventPrizeSettingsMaximumBytesV1);if(body===null)return d.json({error:'invalid_request'},{status:400});
  const result=await gate.port[mode](body);
  // The full accepted receipt is required. No response authorizes activation,
  // clears pending browser work or represents a payment.
  return d.json(result,{status:result.status==='accepted'||result.status==='not_found'?200:result.status==='rejected'?409:503});
 });
 return{GET:(r:NextRequest,c:Context)=>execute(r,c,'read'),POST:(r:NextRequest,c:Context)=>execute(r,c,'save'),reconcilePOST:(r:NextRequest,c:Context)=>execute(r,c,'reconcile')};
}
