'use client';
import{createNativeMixedReviewHttpV1}from'../lib/api/native-mixed-review-http-v1';
import{NativeMixedStartSessionV1}from'../lib/seating/native-mixed-start-session-v1';
import{useEffect,useMemo,useRef,useState}from'react';
import{createClient}from'../lib/supabase/client';
import{getPublicSupabaseEnv}from'../lib/env';
import{createNativeMixedDirectorHttpV1}from'../lib/api/native-mixed-director-http-v1';
import{NativeMixedDirectorSessionV1,type NativeMixedDirectorContextV1}from'../lib/seating/native-mixed-director-session-v1';
import{createIndexedFinanceDraftRetainedV1}from'../lib/finance/event-finance-draft-retained-v1';
import{NativeMixedPreparationScreenV1,type NativeMixedPreparationRuntimeV1}from'./native-mixed-preparation-screen-v1';
const ref='nnhcnvksxgxnpvdqjgpg',url=`https://${ref}.supabase.co`,uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export function NativeMixedPreparationProviderV1({enabled=false,tournamentId,eventId}:{enabled?:boolean;tournamentId:string;eventId:string}){
 const activation=useMemo(()=>({enabled,tournamentId,eventId}),[enabled,tournamentId,eventId]),allowed=useRef(false),[loaded,setLoaded]=useState<{activation:object;authorized:boolean;context:NativeMixedDirectorContextV1|null;runtime:NativeMixedPreparationRuntimeV1|null}|null>(null),[online,setOnline]=useState(false);
 useEffect(()=>{
  if(!enabled||!uuid(tournamentId)||!uuid(eventId))return;let alive=true,epoch=0;allowed.current=false;
  try{if(getPublicSupabaseEnv({NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}).url!==url)return;}catch{return;}
  const client=createClient(),retained=createIndexedFinanceDraftRetainedV1();
  async function check(n:number){try{const u=await client.auth.getUser(),j=await client.auth.getClaims(),v=j.data?.claims;if(!alive||n!==epoch)return;
   if(u.error||j.error||!uuid(u.data.user?.id)||v?.sub!==u.data.user.id||!uuid(v.session_id)||typeof v.exp!=='number'||v.exp*1000<=Date.now()){allowed.current=false;setLoaded({activation,authorized:false,context:null,runtime:null});return;}
   const context:NativeMixedDirectorContextV1={projectRef:ref,scope:{actorId:u.data.user.id,tournamentId,eventId},sessionId:v.session_id};allowed.current=true;
   const revoked=()=>{if(alive&&epoch===n){allowed.current=false;setLoaded({activation,authorized:false,context:null,runtime:null});}};
   const port=createNativeMixedDirectorHttpV1({context,client,enabled:()=>alive&&epoch===n&&allowed.current,revoked});
   const controller=new NativeMixedDirectorSessionV1({retained,currentContext:()=>alive&&epoch===n&&allowed.current?context:null,canRead:()=>alive&&epoch===n&&allowed.current,canWrite:()=>alive&&epoch===n&&allowed.current&&navigator.onLine,execute:port.execute,readOperation:port.operation,readTransition:port.transition,cancel:port.cancel,readCancellation:port.cancellation});
   const start=new NativeMixedStartSessionV1({retained,currentContext:()=>alive&&epoch===n&&allowed.current?context:null,canRead:()=>alive&&epoch===n&&allowed.current,canWrite:()=>alive&&epoch===n&&allowed.current&&navigator.onLine,readiness:port.bootstrap,source:port.source,execute:port.start,operation:port.startOperation,started:port.started,makeId:()=>crypto.randomUUID()});
   const review=createNativeMixedReviewHttpV1({context,client,enabled:()=>alive&&epoch===n&&allowed.current,revoked});
   setLoaded({activation,authorized:true,context,runtime:{controller,start,bootstrap:port.bootstrap,preparation:port.preparation,review,makeId:()=>crypto.randomUUID()}});
  }catch{if(alive&&n===epoch){allowed.current=false;setLoaded({activation,authorized:false,context:null,runtime:null});}}}
  const subscription=client.auth.onAuthStateChange(()=>{allowed.current=false;const n=++epoch;if(alive)setLoaded({activation,authorized:false,context:null,runtime:null});queueMicrotask(()=>{if(alive)void check(n);});});
  const connectivity=()=>{if(alive)setOnline(navigator.onLine);};connectivity();window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);void check(++epoch);
  return()=>{alive=false;allowed.current=false;epoch++;subscription.data.subscription.unsubscribe();window.removeEventListener('online',connectivity);window.removeEventListener('offline',connectivity);};
 },[activation,enabled,tournamentId,eventId]);
 if(!enabled)return <p role="status">Rehearsal preparation is not enabled.</p>;
 if(!loaded||loaded.activation!==activation)return <p role="status">Checking your rehearsal access.</p>;
 if(!loaded.authorized||!loaded.context||!loaded.runtime)return <p role="status">Test access could not be verified. Saved requests are preserved. Reload after your access is restored.</p>;
 return <NativeMixedPreparationScreenV1 enabled context={loaded.context} runtime={loaded.runtime} online={online}/>;
}
