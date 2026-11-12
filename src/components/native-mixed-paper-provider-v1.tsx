'use client';
import {useEffect,useMemo,useRef,useState,type ComponentProps}from'react';
import {getPublicSupabaseEnv}from'../lib/env';
import {createClient}from'../lib/supabase/client';
import {createNativeMixedGameEvidenceTransportV1}from'../lib/api/native-mixed-game-evidence-transport-v1';
import {createIndexedSeriesGameRetainedV1}from'../lib/playoffs/series-game-retained-v1';
import {isNativeMixedGameTargetV1,type NativeMixedGameTargetV1}from'../lib/seating/native-mixed-game-evidence-v1';
import {bindNativeMixedPaperTransportV1}from'../lib/seating/native-mixed-paper-bound-transport-v1';
import {NativeMixedBoundPaperScreenV1}from'./native-mixed-bound-paper-screen-v1';
type Runtime=NonNullable<ComponentProps<typeof NativeMixedBoundPaperScreenV1>['runtime']>;
/** Private browser provider. Off by default; no service key. Auth event closes
 * transport admission immediately; pending storage is never deleted on logout. */
export function NativeMixedPaperProviderV1({enabled=false,target}:{enabled?:boolean;target:NativeMixedGameTargetV1}){
 const key=isNativeMixedGameTargetV1(target)?JSON.stringify(target):'',allowed=useRef(false);
 const activation=useMemo(()=>({enabled,key}),[enabled,key]);
 const [loaded,setLoaded]=useState<{key:string;activation:object;runtime:Runtime|null;authorized:boolean}|null>(null),[online,setOnline]=useState(false);
 useEffect(()=>{
  if(!enabled||!key)return;let active=true,epoch=0;allowed.current=false;const captured=JSON.parse(key)as NativeMixedGameTargetV1;
  let configured=false;try{const env=getPublicSupabaseEnv({NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY});configured=env.url===captured.projectUrl&&new URL(env.url).hostname.split('.')[0]===captured.projectRef;}catch{/* Fail closed before creating a client. */}
  if(!configured){queueMicrotask(()=>{if(active)setLoaded({key,activation,runtime:null,authorized:false});});return()=>{active=false;allowed.current=false;};}
  const client=createClient();
  const baseTransport=createNativeMixedGameEvidenceTransportV1({authenticated:client,projectUrl:captured.projectUrl,projectRef:captured.projectRef,enabled:()=>active&&allowed.current,recoveryEnabled:()=>active&&allowed.current});
  const transport=bindNativeMixedPaperTransportV1(baseTransport,()=>{if(active){allowed.current=false;setLoaded({key,activation,runtime:null,authorized:false});}});
  const runtime={transport,retained:createIndexedSeriesGameRetainedV1(),makeOperationId:()=>crypto.randomUUID(),makeArtifactId:()=>crypto.randomUUID()};
  async function check(n:number){try{const u=await client.auth.getUser(),c=await client.auth.getClaims(),v=c.data?.claims;const valid=!u.error&&!c.error&&u.data.user?.id===captured.actorId&&v?.sub===captured.actorId&&v?.session_id===captured.sessionId&&typeof v.exp==='number'&&v.exp*1000>Date.now();if(active&&epoch===n){allowed.current=valid;setLoaded({key,activation,runtime,authorized:valid});}}catch{if(active&&epoch===n){allowed.current=false;setLoaded({key,activation,runtime,authorized:false});}}}
  const auth=client.auth.onAuthStateChange(()=>{allowed.current=false;const n=++epoch;if(active)setLoaded({key,activation,runtime,authorized:false});queueMicrotask(()=>{if(active)void check(n);});});
  const connectivity=()=>{if(active)setOnline(navigator.onLine);};connectivity();window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);void check(++epoch);
  return()=>{active=false;allowed.current=false;epoch++;auth.data.subscription.unsubscribe();window.removeEventListener('online',connectivity);window.removeEventListener('offline',connectivity);};
 },[activation,enabled,key]);
 if(!enabled||!key)return <p role="status">Paper rehearsal is not enabled.</p>;
 if(!loaded||loaded.key!==key||loaded.activation!==activation)return <p role="status">Checking your signed-in rehearsal session.</p>;
 if(!loaded.authorized||!loaded.runtime)return <p role="status">The rehearsal session changed or could not be verified. Saved entries are preserved. Sign in again before continuing.</p>;
 return <NativeMixedBoundPaperScreenV1 enabled target={target} online={online} runtime={loaded.runtime}/>;
}
