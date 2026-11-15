import type{NativeMixedOwnClientV1}from'./native-mixed-game-evidence-transport-v1.ts';
import{preparePlayoffPaperV1,readPlayoffPaperPreparedV1,readPlayoffPaperWorkspaceV1,readPlayoffPaperReceiptV1,type PlayoffPaperTargetV1,type PlayoffPaperRequestV1,type PlayoffPaperPreparedV1,type PlayoffPaperReceiptV1,type PlayoffPaperWorkspaceV1}from'../playoffs/native-mixed-playoff-paper-v1.ts';
import{readPlayoffPaperRecoveryV1,readPlayoffPaperClosureV1,type PlayoffPaperRecoveryV1,type PlayoffPaperClosureV1}from'../playoffs/native-mixed-playoff-paper-recovery-v1.ts';
import{isPlayoffReopenTargetV1,playoffCorrectionPlainV1 as plain,playoffCorrectionExactV1 as exact}from'../playoffs/native-mixed-playoff-reopen-v1.ts';
type Negative={status:'retry_exact'|'blocked'|'rejected';code:string};
type ErrorCode='disabled'|'invalid_target'|'invalid_request'|'identity_changed'|'provider_unavailable'|'invalid_response'|'operation_outcome_unknown';
type Result<T>={data:T|null;error:ErrorCode|null;dispatched:boolean};
export type PlayoffPaperWriteResultV1=Result<PlayoffPaperReceiptV1|Negative>&{prepared:PlayoffPaperPreparedV1|null;serverStateVerified:false};
function negative(v:unknown):v is Negative{try{if(!plain(v)||!exact(v,['status','code']))return false;const codes={retry_exact:['source_busy','playoff_paper_unavailable'],blocked:['feature_unavailable','source_busy','operation_history_unavailable','legacy_capture_unsupported'],rejected:['invalid_request','parent_or_context_unavailable','idempotency_conflict','source_changed','source_unavailable','match_or_game_changed','history_changed','playoffs_complete','evidence_mismatch']};return typeof v.status==='string'&&Object.hasOwn(codes,v.status)&&codes[v.status as keyof typeof codes].includes(v.code as string);}catch{return false;}}
/** Normal-auth client only. No raw Director getter, service credentials, client
 * construction, retry, operation generation or storage. Exact earlier-game
 * packets may be recovered in the same actor/session/project/event scope. */
export function createPlayoffPaperTransportV1(o:{client:NativeMixedOwnClientV1;target:PlayoffPaperTargetV1;enabled?:()=>boolean;now?:()=>number;revoked?:()=>void}){
 const t=isPlayoffReopenTargetV1(o.target)?structuredClone(o.target):null,client=o.client,enabled=o.enabled??(()=>false),now=o.now??Date.now,revoked=o.revoked??(()=>{});
 const on=()=>{try{return enabled()===true;}catch{return false;}};
 async function identity(){if(!t||!on())return false;try{const u=await client.auth.getUser(),c=await client.auth.getClaims(),v=c.data?.claims as Record<string,unknown>|undefined;return!u.error&&!c.error&&u.data.user?.id===t.actorId&&v?.sub===t.actorId&&v.session_id===t.sessionId&&v.iss===t.projectUrl+'/auth/v1'&&typeof v.exp==='number'&&Number.isSafeInteger(v.exp)&&v.exp*1000>now()&&on();}catch{return false;}}
 async function admitted(){if(await identity())return true;revoked();return false;}
 function prepare(op:string,q:PlayoffPaperRequestV1){return on()&&t?preparePlayoffPaperV1(t,op,q):null;}
 async function read():Promise<Result<PlayoffPaperWorkspaceV1>>{
  if(!on())return{data:null,error:'disabled',dispatched:false};if(!t)return{data:null,error:'invalid_target',dispatched:false};if(!await admitted())return{data:null,error:'identity_changed',dispatched:false};
  if(!on())return{data:null,error:'disabled',dispatched:false};
  let data:PlayoffPaperWorkspaceV1|null=null,failed=false;try{const r=await client.rpc('get_native_mixed_playoff_paper_workspace_v1',{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_context_id:t.contextId,p_slot:t.slot,p_game_number:t.gameNumber});failed=r.error!=null;if(!failed)data=readPlayoffPaperWorkspaceV1(r.data,t);}catch{failed=true;}
  if(!await admitted())return{data:null,error:'identity_changed',dispatched:false};return{data,error:failed?'provider_unavailable':data?null:'invalid_response',dispatched:false};
 }
 async function write(input:PlayoffPaperPreparedV1):Promise<PlayoffPaperWriteResultV1>{
  const fail=(error:ErrorCode,prepared:PlayoffPaperPreparedV1|null,dispatched=false):PlayoffPaperWriteResultV1=>({data:null,error,prepared,dispatched,serverStateVerified:false});
  if(!on())return fail('disabled',null);if(!t)return fail('invalid_target',null);const p=readPlayoffPaperPreparedV1(input,t);if(!p)return fail('invalid_request',null);if(!await admitted())return fail('identity_changed',p);
  if(!on())return fail('disabled',p);
  let data:PlayoffPaperReceiptV1|Negative|null=null,failed=false;try{const r=await client.rpc('execute_native_mixed_playoff_v1',{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_operation_id:p.operationId,p_request:structuredClone(p.request)});failed=r.error!=null;if(!failed)data=readPlayoffPaperReceiptV1(r.data,p.request)??(negative(r.data)?structuredClone(r.data):null);}catch{failed=true;}
  if(!await admitted()||failed)return fail('operation_outcome_unknown',p,true);return data?{data,error:null,prepared:p,dispatched:true,serverStateVerified:false}:fail('operation_outcome_unknown',p,true);
 }
 async function operation(input:PlayoffPaperPreparedV1,close:boolean):Promise<Result<PlayoffPaperRecoveryV1|PlayoffPaperClosureV1>>{
  if(!on())return{data:null,error:'disabled',dispatched:false};if(!t)return{data:null,error:'invalid_target',dispatched:false};const p=readPlayoffPaperPreparedV1(input,t);if(!p)return{data:null,error:'invalid_request',dispatched:false};if(!await admitted())return{data:null,error:'identity_changed',dispatched:false};
  if(!on())return{data:null,error:'disabled',dispatched:false};
  let data:PlayoffPaperRecoveryV1|PlayoffPaperClosureV1|null=null,failed=false;try{const args={p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_operation_id:p.operationId,p_request:structuredClone(p.request)},r=close?await client.rpc('close_native_mixed_playoff_paper_operation_v1',args):await client.rpc('get_native_mixed_playoff_paper_operation_v1',args);failed=r.error!=null;if(!failed)data=close?readPlayoffPaperClosureV1(r.data,p):readPlayoffPaperRecoveryV1(r.data,p);}catch{failed=true;}
  if(!await admitted()||failed)return{data:null,error:close?'operation_outcome_unknown':'provider_unavailable',dispatched:close};return{data,error:data?null:close?'operation_outcome_unknown':'invalid_response',dispatched:close};
 }
 return{prepare,read,write,inspect:(p:PlayoffPaperPreparedV1)=>operation(p,false),close:(p:PlayoffPaperPreparedV1)=>operation(p,true)};
}
