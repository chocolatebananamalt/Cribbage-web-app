import type{NativeMixedOwnClientV1}from'./native-mixed-game-evidence-transport-v1.ts';
import{isPlayoffReopenTargetV1,isPlayoffReopenRequestV1,readPlayoffReopenWorkspaceV1,readPlayoffReopenReceiptV1,playoffCorrectionUuidV1 as uuid,type PlayoffReopenTargetV1,type PlayoffReopenRequestV1}from'../playoffs/native-mixed-playoff-reopen-v1.ts';
/** Normal authenticated client, no service credentials or actor RPC parameter.
 * All three dedicated RPCs remain revoked/default-off in the SQL proposal. */
export function createPlayoffReopenTransportV1(o:{client:NativeMixedOwnClientV1;target:PlayoffReopenTargetV1;enabled:()=>boolean;now?:()=>number;revoked?:()=>void}){
 const t=isPlayoffReopenTargetV1(o.target)?structuredClone(o.target):null,client=o.client,enabled=o.enabled,now=o.now??Date.now;
 const on=()=>{try{return enabled()===true;}catch{return false;}};
 async function identity(){if(!t||!on())return false;try{const u=await client.auth.getUser(),c=await client.auth.getClaims(),j=c.data?.claims as Record<string,unknown>|undefined;return!u.error&&!c.error&&u.data.user?.id===t.actorId&&j?.sub===t.actorId&&j.session_id===t.sessionId&&j.iss===t.projectUrl+'/auth/v1'&&typeof j.exp==='number'&&Number.isSafeInteger(j.exp)&&j.exp*1000>now()&&on();}catch{return false;}}
 async function call(mode:'read'|'write'|'recover',op?:string,input?:PlayoffReopenRequestV1){
  if(!t||!on())return null;let q:PlayoffReopenRequestV1|undefined;
  if(mode!=='read'){if(!uuid(op)||!isPlayoffReopenRequestV1(input)||input.contextId!==t.contextId||input.slot!==t.slot||input.gameNumber!==t.gameNumber)return null;q=structuredClone(input);}
  if(!await identity()){o.revoked?.();return null;}
  const name=mode==='read'?'get_native_mixed_playoff_reopen_workspace_v1':mode==='write'?'record_native_mixed_playoff_reopen_v1':'reconcile_native_mixed_playoff_reopen_v1';
  const args=mode==='read'?{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_context_id:t.contextId,p_slot:t.slot,p_game_number:t.gameNumber}:{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_operation_id:op!,p_request:q!};
  try{const r=await client.rpc(name,args);const value=r.error?null:mode==='read'?readPlayoffReopenWorkspaceV1(r.data,t):readPlayoffReopenReceiptV1(r.data,t,op!,q!);if(!await identity()){o.revoked?.();return null;}return value;}catch{return null;}
 }
 return{read:()=>call('read'),write:(op:string,q:PlayoffReopenRequestV1)=>call('write',op,q),recover:(op:string,q:PlayoffReopenRequestV1)=>call('recover',op,q)};
}

