'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {createClient} from '../lib/supabase/client';
import {getPublicSupabaseEnv} from '../lib/env';
import {createNativeMixedReviewHttpV1} from '../lib/api/native-mixed-review-http-v1';
import {isNativeMixedReviewContextV1,type NativeMixedReviewContextV1} from '../lib/finance/native-mixed-review-read-v1';
import {NativeMixedReviewSectionV1} from './native-mixed-review-section-v1';
type Ready={owner:object;context:NativeMixedReviewContextV1;read:()=>Promise<unknown>};
/** Read-only provider; no Director executor, privileged client or play runtime. */
export function NativeMixedReviewProviderV1({enabled=false,tournamentId,eventId}:{enabled?:boolean;tournamentId:string;eventId:string}){
 const owner=useMemo(()=>({enabled,tournamentId,eventId}),[enabled,tournamentId,eventId]),[ready,setReady]=useState<Ready|null>(null),[online,setOnline]=useState(false),allowed=useRef(false);
 useEffect(()=>{if(!enabled||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(tournamentId)||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(eventId))return;
  const ref='nnhcnvksxgxnpvdqjgpg',url=`https://${ref}.supabase.co`;try{if(getPublicSupabaseEnv({NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}).url!==url)return;}catch{return;}
  let alive=true,epoch=0;allowed.current=false;const client=createClient();
  async function load(n:number){try{const u=await client.auth.getUser(),j=await client.auth.getClaims(),c=j.data?.claims;if(!alive||epoch!==n)return;
   const context={projectRef:ref,scope:{actorId:u.data.user?.id??'',tournamentId,eventId},sessionId:typeof c?.session_id==='string'?c.session_id:''};
   if(u.error||j.error||c?.sub!==context.scope.actorId||c.iss!==url+'/auth/v1'||typeof c.exp!=='number'||!Number.isFinite(c.exp*1000)||c.exp*1000<=Date.now()||!isNativeMixedReviewContextV1(context)){allowed.current=false;setReady(null);return;}
   const role=await client.rpc('get_tournament_role',{p_tournament_id:tournamentId});if(!alive||epoch!==n)return;if(role.error||!['director','co_director'].includes(String(role.data))){allowed.current=false;setReady(null);return;}
   allowed.current=true;const revoked=()=>{if(alive&&epoch===n){allowed.current=false;setReady(null);}};
   const read=createNativeMixedReviewHttpV1({context,client,enabled:()=>alive&&epoch===n&&allowed.current,revoked});setReady({owner,context,read});
  }catch{if(alive&&epoch===n){allowed.current=false;setReady(null);}}}
  const sub=client.auth.onAuthStateChange(()=>{allowed.current=false;const n=++epoch;if(alive)setReady(null);queueMicrotask(()=>{if(alive)void load(n);});});
  const connectivity=()=>{if(alive)setOnline(navigator.onLine);};connectivity();window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);void load(++epoch);
  return()=>{alive=false;epoch++;allowed.current=false;sub.data.subscription.unsubscribe();window.removeEventListener('online',connectivity);window.removeEventListener('offline',connectivity);};
 },[enabled,tournamentId,eventId,owner]);
 if(!enabled)return null;if(!ready||ready.owner!==owner)return <p role="status">Practice review access is not verified. Existing evidence is unchanged.</p>;
 return <NativeMixedReviewSectionV1 enabled context={ready.context} online={online} read={ready.read}/>;
}
