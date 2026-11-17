import 'server-only';
import type{NextRequest}from'next/server';
import{isSameOriginRequest}from'./same-origin.ts';
import{readSmallJson}from'./bounded-json.ts';
import{requireVerifiedIdentity}from'./verified-subject.ts';
import{isUuid}from'./validation.ts';
import{isAcceptedManualRosterEntry,isRejectedManualRosterEntry}from'./roster.ts';
type Normal={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null};error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'cache-control':'private, no-store'}});
export function createManualRosterRecoveryHandlerV22(normal:()=>Promise<Normal>){return async(request:Request,id:string,bounded?:{value:unknown})=>{
 if(!isSameOriginRequest(request as NextRequest))return json({error:'invalid_origin'},403);
 try{const body=bounded?bounded.value:await readSmallJson(request);if(!isUuid(id)||!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='idempotencyKey'||!isUuid((body as Record<string,unknown>).idempotencyKey))return json({error:'invalid_request'},400);
  const operationId=(body as{ idempotencyKey:string }).idempotencyKey,client=await normal(),identity=await requireVerifiedIdentity(client);if(!identity||!isUuid(identity.subject)||!isUuid(identity.sessionId))return json({error:'unauthorized'},401);
  const access=async()=>{const current=await requireVerifiedIdentity(client),user=await client.auth.getUser();if(!current||current.subject!==identity.subject||current.sessionId!==identity.sessionId||user.error||user.data.user?.id!==identity.subject)return false;const role=await client.rpc('get_tournament_role',{p_tournament_id:id});const final=await requireVerifiedIdentity(client);return !role.error&&typeof role.data==='string'&&['director','co_director'].includes(role.data)&&final?.subject===identity.subject&&final.sessionId===identity.sessionId;};
  if(!await access())return json({error:'unauthorized'},403);
  const r=await client.rpc('get_manual_roster_entry_reconciliation_v1',{p_tournament_id:id,p_idempotency_key:operationId});
  if(!await access())return json({error:'unauthorized'},403);if(r.error)return json({error:'operation_unavailable'},503);
  if(r.data!==null&&!isAcceptedManualRosterEntry(r.data)&&!isRejectedManualRosterEntry(r.data))return json({error:'invalid_outcome'},503);
  return json({kind:'manual-roster-recovery-v22',actorId:identity.subject,tournamentId:id,sessionId:identity.sessionId,operationId,result:r.data});
 }catch{return json({error:'temporarily_unavailable'},503);}
};}
