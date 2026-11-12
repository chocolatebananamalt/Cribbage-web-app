import type {NativeMixedReviewContextV1} from '../finance/native-mixed-review-read-v1.ts';
import {isNativeMixedReviewContextV1,nativeMixedReviewBytesV1,readNativeMixedReviewEnvelopeV1} from '../finance/native-mixed-review-read-v1.ts';
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>;getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown;exp?:unknown;iss?:unknown}}|null;error:unknown}>}};
/** Own-session GET only. No service client, Start selection, retries or writes. */
export function createNativeMixedReviewHttpV1(d:{context:NativeMixedReviewContextV1;client:Client;enabled?:()=>boolean;revoked?:()=>void;fetcher?:typeof fetch;now?:()=>number}){
 if(!isNativeMixedReviewContextV1(d.context))throw Error('invalid_review_context');const c=structuredClone(d.context),url='https://nnhcnvksxgxnpvdqjgpg.supabase.co',path=`/api/v1/tournaments/${c.scope.tournamentId}/rehearsal/${c.scope.eventId}/review`;
 const own=async()=>{if(d.enabled?.()!==true)return false;const u=await d.client.auth.getUser(),j=await d.client.auth.getClaims(),v=j.data?.claims;return !u.error&&!j.error&&u.data?.user?.id===c.scope.actorId&&v?.sub===c.scope.actorId&&v.session_id===c.sessionId&&v.iss===url+'/auth/v1'&&typeof v.exp==='number'&&Number.isFinite(v.exp*1000)&&v.exp*1000>(d.now??Date.now)()&&d.enabled?.()===true;};
 return async()=>{
  if(d.enabled?.()!==true)return null;
  if(!await own()){d.revoked?.();return null;}
  const response=await(d.fetcher??fetch)(path,{method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error',headers:{accept:'application/json','x-expected-actor-id':c.scope.actorId}});
  if(!await own()){d.revoked?.();return null;}if(response.status===403){d.revoked?.();return null;}
  if(response.status!==200||response.redirected||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!response.body)return null;
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';
  try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>nativeMixedReviewBytesV1){await reader.cancel();return null;}text+=decoder.decode(next.value,{stream:true});}text+=decoder.decode();}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  if(!await own()){d.revoked?.();return null;}return readNativeMixedReviewEnvelopeV1(JSON.parse(text),c);
 };
}
