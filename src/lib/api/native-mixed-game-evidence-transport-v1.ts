import{readNativeMixedOwnBindingsV1,type NativeMixedDigitalEntryBindingV1}from'../seating/native-mixed-digital-entry-view-v1.ts';
import{readNativeMixedPaperBindingV1,type NativeMixedPaperEntryBindingV1}from'../seating/native-mixed-paper-entry-view-v1.ts';
import {isNativeMixedGameTargetV1,isNativeMixedGameWriteRequestV1,readNativeMixedGameWriteReceiptV1,readNativeMixedGameClosedV1,readNativeMixedGameOutcomeV1,readNativeMixedGameStateV1,
 type NativeMixedGameTargetV1,type NativeMixedGameWriteRequestV1,type NativeMixedGameOutcomeV1,type NativeMixedGameWriteReceiptV1,type NativeMixedGameClosedV1,type NativeMixedGameStateV1}from'../seating/native-mixed-game-evidence-v1.ts';

type Rpc={data:unknown;error:unknown};
export type NativeMixedOwnClientV1={auth:{
 getUser:()=>Promise<{data:{user:{id:string}|null};error:unknown}>;
 getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown;exp?:unknown}}|null;error:unknown}>;
};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<Rpc>};
type Error='disabled'|'invalid_target'|'invalid_request'|'identity_changed'|'provider_unavailable'|'operation_outcome_unknown'|'invalid_response';
type Result<T>={data:T;error:null}|{data:null;error:Error};
const clone=<T>(v:T):T=>structuredClone(v);
const snapshot=(v:unknown):{ok:true;value:unknown}|{ok:false;value:null}=>{try{return{ok:true,value:clone(v)};}catch{return{ok:false,value:null};}};

/** No client creation, service key, actor RPC argument, op generation or retry.
 * The own-subject database boundary is authoritative; injected client tests
 * alone cannot establish JWT signatures, RLS, live sessions or a committed write.
 * Every post-dispatch error may follow a commit: retain pending bytes and recover.
 */
export function createNativeMixedGameEvidenceTransportV1(o:{authenticated:NativeMixedOwnClientV1;projectUrl:string;projectRef:string;
 enabled?:()=>boolean;recoveryEnabled?:()=>boolean;now?:()=>number}){
 const enabled=o.enabled??(()=>false),recovery=o.recoveryEnabled??(()=>false),now=o.now??Date.now;
 const target=(v:unknown):v is NativeMixedGameTargetV1=>isNativeMixedGameTargetV1(v)&&v.projectUrl===o.projectUrl&&v.projectRef===o.projectRef;
 async function identity(t:NativeMixedGameTargetV1):Promise<boolean>{
  try{const user=await o.authenticated.auth.getUser(),claims=await o.authenticated.auth.getClaims(),c=claims.data?.claims;
   return !user.error&&!claims.error&&user.data.user?.id===t.actorId&&c?.sub===t.actorId&&c?.session_id===t.sessionId
    &&typeof c.exp==='number'&&Number.isSafeInteger(c.exp)&&c.exp*1000>now();
  }catch{return false;}
 }
 async function call(name:string,args:Record<string,unknown>):Promise<{captured:ReturnType<typeof snapshot>;failed:boolean}>{
  try{const response=await o.authenticated.rpc(name,args);return{captured:snapshot(response.data),failed:response.error!=null};}
  catch{return{captured:{ok:false,value:null},failed:true};}
 }
 return{
  write:async(targetInput:NativeMixedGameTargetV1,requestInput:NativeMixedGameWriteRequestV1):Promise<Result<NativeMixedGameOutcomeV1>>=>{
   if(enabled()!==true)return{data:null,error:'disabled'};
   const ts=snapshot(targetInput),rs=snapshot(requestInput);if(!ts.ok||!target(ts.value))return{data:null,error:'invalid_target'};const t=ts.value;
   if(!rs.ok||!isNativeMixedGameWriteRequestV1(rs.value))return{data:null,error:'invalid_request'};const r=rs.value;
   if(r.startId!==t.startId||r.gameId!==t.gameId||r.expectedStartSourceDigest!==t.startSourceDigest)return{data:null,error:'invalid_target'};
   if(!await identity(t))return{data:null,error:'identity_changed'};if(enabled()!==true)return{data:null,error:'disabled'};
   const response=await call('record_native_mixed_simulation_game_evidence_v1',{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_request:r});
   if(!await identity(t))return{data:null,error:'identity_changed'};if(enabled()!==true)return{data:null,error:'disabled'};
   if(response.failed||!response.captured.ok)return{data:null,error:'operation_outcome_unknown'};
   const v=readNativeMixedGameOutcomeV1(response.captured.value,t,r);return v?{data:v,error:null}:{data:null,error:'operation_outcome_unknown'};
  },
  recover:async(targetInput:NativeMixedGameTargetV1,requestInput:NativeMixedGameWriteRequestV1):Promise<Result<NativeMixedGameWriteReceiptV1|NativeMixedGameClosedV1>>=>{
   if(recovery()!==true)return{data:null,error:'disabled'};
   const ts=snapshot(targetInput),rs=snapshot(requestInput);if(!ts.ok||!target(ts.value))return{data:null,error:'invalid_target'};const t=ts.value;
   if(!rs.ok||!isNativeMixedGameWriteRequestV1(rs.value))return{data:null,error:'invalid_request'};const r=rs.value;
   if(r.startId!==t.startId||r.gameId!==t.gameId||r.expectedStartSourceDigest!==t.startSourceDigest)return{data:null,error:'invalid_target'};
   if(!await identity(t))return{data:null,error:'identity_changed'};if(recovery()!==true)return{data:null,error:'disabled'};
   const response=await call('get_native_mixed_simulation_game_operation_v1',{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_request:r});
   if(!await identity(t))return{data:null,error:'identity_changed'};if(recovery()!==true)return{data:null,error:'disabled'};
   if(response.failed||!response.captured.ok)return{data:null,error:'operation_outcome_unknown'};
   const v=readNativeMixedGameWriteReceiptV1(response.captured.value,t,r,true)??readNativeMixedGameClosedV1(response.captured.value,t,r);return v?{data:v,error:null}:{data:null,error:'operation_outcome_unknown'};
  },
  resolve:async(targetInput:NativeMixedGameTargetV1,requestInput:NativeMixedGameWriteRequestV1):Promise<Result<NativeMixedGameOutcomeV1>>=>{
   if(enabled()!==true||recovery()!==true)return{data:null,error:'disabled'};
   const ts=snapshot(targetInput),rs=snapshot(requestInput);if(!ts.ok||!target(ts.value))return{data:null,error:'invalid_target'};const t=ts.value;
   if(!rs.ok||!isNativeMixedGameWriteRequestV1(rs.value))return{data:null,error:'invalid_request'};const r=rs.value;
   if(r.startId!==t.startId||r.gameId!==t.gameId||r.expectedStartSourceDigest!==t.startSourceDigest)return{data:null,error:'invalid_target'};
   if(!await identity(t))return{data:null,error:'identity_changed'};if(enabled()!==true||recovery()!==true)return{data:null,error:'disabled'};
   const response=await call('resolve_native_mixed_game_operation_v1',{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_request:r});
   if(!await identity(t))return{data:null,error:'identity_changed'};if(enabled()!==true||recovery()!==true)return{data:null,error:'disabled'};
   if(response.failed||!response.captured.ok)return{data:null,error:'operation_outcome_unknown'};
   const v=readNativeMixedGameOutcomeV1(response.captured.value,t,r);return v?{data:v,error:null}:{data:null,error:'operation_outcome_unknown'};
  },
  bindings:async(targetInput:NativeMixedGameTargetV1):Promise<Result<NativeMixedDigitalEntryBindingV1[]>>=>{
   if(enabled()!==true)return{data:null,error:'disabled'};
   const ts=snapshot(targetInput);if(!ts.ok||!target(ts.value))return{data:null,error:'invalid_target'};const t=ts.value;
   if(!await identity(t))return{data:null,error:'identity_changed'};if(enabled()!==true)return{data:null,error:'disabled'};
   const response=await call('get_native_mixed_own_player_bindings_v1',{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_start_id:t.startId});
   if(!await identity(t))return{data:null,error:'identity_changed'};if(enabled()!==true)return{data:null,error:'disabled'};
   if(response.failed||!response.captured.ok)return{data:null,error:'provider_unavailable'};
   const value=readNativeMixedOwnBindingsV1(response.captured.value,t);return value?{data:value,error:null}:{data:null,error:'invalid_response'};
  },
  paperBinding:async(targetInput:NativeMixedGameTargetV1):Promise<Result<NativeMixedPaperEntryBindingV1>>=>{
   if(enabled()!==true)return{data:null,error:'disabled'};
   const ts=snapshot(targetInput);if(!ts.ok||!target(ts.value))return{data:null,error:'invalid_target'};const t=ts.value;
   if(!await identity(t))return{data:null,error:'identity_changed'};if(enabled()!==true)return{data:null,error:'disabled'};
   const response=await call('get_native_mixed_paper_binding_v1',{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_start_id:t.startId,p_game_id:t.gameId});
   if(!await identity(t))return{data:null,error:'identity_changed'};if(enabled()!==true)return{data:null,error:'disabled'};
   if(response.failed||!response.captured.ok)return{data:null,error:'provider_unavailable'};
   const value=readNativeMixedPaperBindingV1(response.captured.value,t);return value?{data:value,error:null}:{data:null,error:'invalid_response'};
  },
  state:async(targetInput:NativeMixedGameTargetV1):Promise<Result<NativeMixedGameStateV1>>=>{
   if(enabled()!==true)return{data:null,error:'disabled'};
   const ts=snapshot(targetInput);if(!ts.ok||!target(ts.value))return{data:null,error:'invalid_target'};const t=ts.value;
   if(!await identity(t))return{data:null,error:'identity_changed'};if(enabled()!==true)return{data:null,error:'disabled'};
   const response=await call('get_native_mixed_simulation_game_state_v1',{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_start_id:t.startId,p_game_id:t.gameId});
   if(!await identity(t))return{data:null,error:'identity_changed'};if(enabled()!==true)return{data:null,error:'disabled'};
   if(response.failed)return{data:null,error:'provider_unavailable'};if(!response.captured.ok)return{data:null,error:'invalid_response'};
   const v=readNativeMixedGameStateV1(response.captured.value,t);return v?{data:v,error:null}:{data:null,error:'invalid_response'};
  },
 };
}
