import'server-only';
import type{NativeMixedOwnClientV1}from'../api/native-mixed-game-evidence-transport-v1.ts';
import{createNativeMixedPoolTransportV1}from'../api/native-mixed-pool-transport-v1.ts';
import{isNativeMixedReviewContextV1}from'../finance/native-mixed-review-read-v1.ts';
import{readNativeMixedMainWorkspaceViewV1}from'../finance/native-mixed-main-workspace-view-v1.ts';
import{playoffCorrectionSameV1 as same,playoffCorrectionPlainV1 as plain}from'../playoffs/native-mixed-playoff-reopen-v1.ts';
import{projectNativeMixedEventResultsV1,type NativeMixedResultsScopeV1}from'./native-mixed-event-results-v1.ts';
export type NativeMixedResultsReadV1=Awaited<ReturnType<typeof readNativeMixedEventResultsV1>>;
/** Normal-auth read APIs only. No grant, administrative client,
 * writer or cached snapshot. Matching captures are NOT an atomic transaction. */
export async function readNativeMixedEventResultsV1(o:{client:NativeMixedOwnClientV1;scope:NativeMixedResultsScopeV1;enabled?:()=>boolean;now?:()=>number}){
 const on=()=>{try{return o.enabled?.()===true;}catch{return false;}};
 if(!on())return null;
 const s=o.scope,context={projectRef:s.projectRef,scope:s.scope,sessionId:s.sessionId};if(!isNativeMixedReviewContextV1(context))return null;
 if(s.eventKind!=='main'||s.format!=='singles')return{status:'unsupported' as const,reason:'This mixed rehearsal results bridge supports Main singles only. Consolation, Satellite and team rules remain separate.'};
 const url=`https://${s.projectRef}.supabase.co`,target={...s.scope,sessionId:s.sessionId,projectRef:s.projectRef,projectUrl:url},client=o.client,now=o.now??Date.now;
 async function authorized(){try{if(!on())return false;const u=await client.auth.getUser(),j=await client.auth.getClaims(),v=j.data?.claims as Record<string,unknown>|undefined;
  if(u.error||j.error||u.data.user?.id!==target.actorId||v?.sub!==target.actorId||v.session_id!==target.sessionId||v.iss!==url+'/auth/v1'||typeof v.exp!=='number'||!Number.isSafeInteger(v.exp)||v.exp*1000<=now()||!on())return false;
  const r=await client.rpc('get_tournament_roles_v1',{p_tournament_id:target.tournamentId});return!r.error&&Array.isArray(r.data)&&r.data.some(r=>r==='director'||r==='co_director')&&on();
 }catch{return false;}}
 const pools=createNativeMixedPoolTransportV1({authenticated:client,target,projectUrl:url,projectRef:s.projectRef,enabled:on,now});
 async function capture(){
  if(!on())return null;const args={p_tournament_id:target.tournamentId,p_event_id:target.eventId};
  // Preparation and workspace both take the same try-advisory event lock.
  // Parallel independent HTTP transactions can reject one another as busy.
  // Finish each read transaction before opening the next; never weaken locks.
  const m=await client.rpc('get_native_mixed_main_finance_v1',args),p=await pools.readPreparation();
  if(!on()||p.error==='identity_changed')return null;
  const w=await pools.read();if(!on()||w.error==='identity_changed')return null;
  let poolFinal:unknown=null;
  if(p.error===null&&w.error===null)try{const final=await client.rpc('get_native_mixed_pool_results_v1',args);if(!final.error&&plain(final.data))poolFinal=structuredClone(final.data);}catch{/* A missing/closed final reader leaves awards unknown, never zero. */}
  if(!on())return null;
  let main:unknown=null,qualification:unknown=null;
  if(!m.error&&readNativeMixedMainWorkspaceViewV1(m.data,{tournamentId:target.tournamentId,eventId:target.eventId})&&plain(m.data)){
   main=structuredClone(m.data);const raw=main as {source:{capture:{playoffSource:{capture:{review:unknown}}}}};
   qualification={kind:'native-mixed-review-provider-v1',...s.scope,sessionId:s.sessionId,review:raw.source.capture.playoffSource.capture.review};
  }else{
   // Before playoff completion the established qualification resolver remains
   // the only source. No winner/award is manufactured from its ranking.
   if(!on())return null;const q=await client.rpc('get_native_mixed_qualification_review_provider_v1',args);if(!q.error&&plain(q.data))qualification=structuredClone(q.data);
  }
  return{qualification,main,preparation:p.error===null?p.data:null,poolWorkspace:w.error===null?w.data:null,poolFinal};
 }
 try{if(!await authorized())return null;const a=await capture();if(!a||!await authorized())return null;const b=await capture();if(!b||!same(a,b)||!await authorized())return null;
  const view=projectNativeMixedEventResultsV1(b,s);return view?{status:'available' as const,view}:null;
 }catch{return null;}
}
