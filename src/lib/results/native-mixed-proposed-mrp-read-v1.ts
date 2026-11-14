import'server-only';
import type{NativeMixedOwnClientV1}from'../api/native-mixed-game-evidence-transport-v1.ts';
import{isNativeMixedReviewContextV1,readNativeMixedReviewEnvelopeV1,type NativeMixedReviewContextV1}from'../finance/native-mixed-review-read-v1.ts';
import{playoffCorrectionSameV1 as same}from'../playoffs/native-mixed-playoff-reopen-v1.ts';
import{nativeMixedProposedMrpEnabledV1,projectNativeMixedProposedMrpV1}from'./native-mixed-proposed-mrp-v1.ts';
/** Independent of prize/pool Finance. Normal read APIs only; SQL owns consent,
 * pilot admission and source/receipt verification. Matching reads are not atomic. */
export async function readNativeMixedProposedMrpV1(o:{client:NativeMixedOwnClientV1;context:NativeMixedReviewContextV1;enabled?:()=>boolean;now?:()=>number}){
 const on=()=>{try{return(o.enabled??nativeMixedProposedMrpEnabledV1)()===true;}catch{return false;}};if(!on()||!isNativeMixedReviewContextV1(o.context))return null;
 const context=structuredClone(o.context),client=o.client,now=o.now??Date.now,url='https://'+context.projectRef+'.supabase.co';
 async function authorized(){try{if(!on())return false;const u=await client.auth.getUser(),j=await client.auth.getClaims(),c=j.data?.claims as Record<string,unknown>|undefined;if(u.error||j.error||u.data.user?.id!==context.scope.actorId||c?.sub!==context.scope.actorId||c.session_id!==context.sessionId||c.iss!==url+'/auth/v1'||typeof c.exp!=='number'||!Number.isSafeInteger(c.exp)||c.exp*1000<=now())return false;const roles=await client.rpc('get_tournament_roles_v1',{p_tournament_id:context.scope.tournamentId});return !roles.error&&Array.isArray(roles.data)&&roles.data.some(r=>r==='director'||r==='co_director')&&on();}catch{return false;}}
 async function capture(){const args={p_tournament_id:context.scope.tournamentId,p_event_id:context.scope.eventId};if(!on())return null;const q=await client.rpc('get_native_mixed_qualification_review_provider_v1',args),qualification=structuredClone(q.data);if(q.error||!readNativeMixedReviewEnvelopeV1(qualification,context)||!await authorized())return null;// The simulated playoff envelope exists only in app schema, with no public RPC.
  // Qualifying proposals remain available; playoff points stay pending.
  return on()?{qualification,playoff:null}:null;}
 try{if(!await authorized())return null;const first=await capture();if(!first||!await authorized())return null;const second=await capture();if(!second||!await authorized()||!same(first,second))return null;const result=projectNativeMixedProposedMrpV1(second,context,new Date(now()).toISOString());return result.status==='available'?{...result,sourceObservation:'matching-double-read-not-atomic' as const}:result;}catch{return null;}
}
