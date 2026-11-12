'use client';
import{useEffect,useMemo,useRef,useState}from'react';
import{createClient}from'../lib/supabase/client';
import{getPublicSupabaseEnv}from'../lib/env';
import{createIndexedFinanceDraftRetainedV1}from'../lib/finance/event-finance-draft-retained-v1';
import{bootstrapWorkflowEnabled,type BootstrapMode,type BootstrapContext}from'../lib/seating/native-mixed-bootstrap-workflow-v1';
import{NativeMixedBootstrapSessionV1}from'../lib/seating/native-mixed-bootstrap-session-v1';
import{createNativeMixedBootstrapHttpV1}from'../lib/api/native-mixed-bootstrap-http-v1';
import{NativeMixedBootstrapScreenV1}from'./native-mixed-bootstrap-workflow-v1';
const ref='nnhcnvksxgxnpvdqjgpg',url=`https://${ref}.supabase.co`,uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export function NativeMixedBootstrapProviderV1({enabled=bootstrapWorkflowEnabled(),tournamentId,eventId,mode}:{enabled?:boolean;tournamentId:string;eventId:string;mode:BootstrapMode}){
 const activation=useMemo(()=>({enabled,tournamentId,eventId,mode}),[enabled,tournamentId,eventId,mode]),allowed=useRef(false),[online,setOnline]=useState(false),[loaded,setLoaded]=useState<{activation:object;context:BootstrapContext;controller:NativeMixedBootstrapSessionV1}|null>(null);
 useEffect(()=>{if(!enabled||!uuid(tournamentId)||!uuid(eventId)||!['director','paper-review','consent'].includes(mode))return;let alive=true,epoch=0;allowed.current=false;
  try{if(getPublicSupabaseEnv({NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}).url!==url)return;}catch{return;}
  const client=createClient(),retained=createIndexedFinanceDraftRetainedV1();async function check(n:number){try{const u=await client.auth.getUser(),j=await client.auth.getClaims(),v=j.data?.claims;if(!alive||n!==epoch)return;if(u.error||j.error||!uuid(u.data.user?.id)||v?.sub!==u.data.user.id||!uuid(v.session_id)||typeof v.exp!=='number'||v.exp*1000<=Date.now()){allowed.current=false;setLoaded(null);return;}
   const context:BootstrapContext={projectRef:ref,scope:{actorId:u.data.user.id,tournamentId,eventId},sessionId:v.session_id,mode};allowed.current=true;const revoked=()=>{if(alive&&n===epoch){allowed.current=false;setLoaded(null);}};const port=createNativeMixedBootstrapHttpV1({context,client,enabled:()=>alive&&n===epoch&&allowed.current,revoked});
   const controller=new NativeMixedBootstrapSessionV1({retained,currentContext:()=>alive&&n===epoch&&allowed.current?context:null,canRead:()=>alive&&n===epoch&&allowed.current,canWrite:()=>alive&&n===epoch&&allowed.current&&navigator.onLine,source:port.source,execute:port.execute,operation:port.operation,makeId:()=>crypto.randomUUID()});setLoaded({activation,context,controller});
  }catch{if(alive&&n===epoch){allowed.current=false;setLoaded(null);}}}
  const subscription=client.auth.onAuthStateChange(()=>{allowed.current=false;const n=++epoch;if(alive)setLoaded(null);queueMicrotask(()=>{if(alive)void check(n);});}),connectivity=()=>{if(alive)setOnline(navigator.onLine);};connectivity();window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);void check(++epoch);
  return()=>{alive=false;allowed.current=false;epoch++;subscription.data.subscription.unsubscribe();window.removeEventListener('online',connectivity);window.removeEventListener('offline',connectivity);};
 },[activation,enabled,tournamentId,eventId,mode]);
 if(!enabled)return null;if(!loaded||loaded.activation!==activation)return <p role="status">Test access is not verified. Saved work is preserved.</p>;return <NativeMixedBootstrapScreenV1 enabled context={loaded.context} controller={loaded.controller} online={online}/>;
}
