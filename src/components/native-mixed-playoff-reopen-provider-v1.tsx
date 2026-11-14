'use client';
import { integratedTestBackendRef, integratedTestBackendOrigin } from '../lib/integrated-test-target.ts';
import{useEffect,useLayoutEffect,useRef,useState}from'react';
import{createClient}from'../lib/supabase/client';import{getPublicSupabaseEnv}from'../lib/env';
import{createIndexedSeriesGameRetainedV1}from'../lib/playoffs/series-game-retained-v1';
import{createPlayoffReopenTransportV1}from'../lib/api/native-mixed-playoff-reopen-transport-v1';
import{isPlayoffReopenTargetV1}from'../lib/playoffs/native-mixed-playoff-reopen-v1';
import type{PlayoffReopenRuntimeV1}from'../lib/playoffs/native-mixed-playoff-reopen-pending-v1';
import{NativeMixedPlayoffReopenV1}from'./native-mixed-playoff-reopen-v1';
/** Default-off normal-auth host. Client role check is only an admission aid;
 * dedicated SQL independently verifies live nonself Director and saved policy. */
export function NativeMixedPlayoffReopenProviderV1({enabled=false,tournamentId,eventId,contextId,slot,gameNumber}:{enabled?:boolean;tournamentId:string;eventId:string;contextId:string;slot:number;gameNumber:number}){
 const key=JSON.stringify([enabled,tournamentId,eventId,contextId,slot,gameNumber]),[loaded,setLoaded]=useState<{key:string;runtime:PlayoffReopenRuntimeV1}|null>(null),[online,setOnline]=useState(false),allowed=useRef(false);
 const region=useRef<HTMLDivElement|null>(null);
 useLayoutEffect(()=>{if(region.current)region.current.hidden=!loaded||loaded.key!==key||!allowed.current;},[loaded,key]);
 useEffect(()=>{if(!enabled)return;const projectRef=integratedTestBackendRef(),projectUrl=integratedTestBackendOrigin();try{if(getPublicSupabaseEnv({NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}).url!==projectUrl)return;}catch{return;}const client=createClient();let active=true,epoch=0;allowed.current=false;
  const conceal=()=>{const node=region.current;if(node)node.hidden=true;};
  async function load(n:number){try{const u=await client.auth.getUser(),j=await client.auth.getClaims(),v=j.data?.claims;if(!active||epoch!==n)return;const target={projectRef,projectUrl,actorId:u.data.user?.id??'',sessionId:typeof v?.session_id==='string'?v.session_id:'',tournamentId,eventId,contextId,slot,gameNumber};if(u.error||j.error||!isPlayoffReopenTargetV1(target)||v?.sub!==target.actorId||v.iss!==projectUrl+'/auth/v1'||typeof v.exp!=='number'||!Number.isSafeInteger(v.exp)||v.exp*1000<=Date.now())return;
   const role=await client.rpc('get_tournament_role',{p_tournament_id:tournamentId});if(!active||epoch!==n||role.error||role.data!=='director')return;
   allowed.current=true;const enabledNow=()=>active&&epoch===n&&allowed.current,revoked=()=>{if(active&&epoch===n){allowed.current=false;conceal();setLoaded(null);}},transport=createPlayoffReopenTransportV1({client,target,enabled:enabledNow,revoked});setLoaded({key,runtime:{target,retained:createIndexedSeriesGameRetainedV1(),...transport,enabled:enabledNow,online:()=>navigator.onLine}});
  }catch{if(active&&epoch===n){allowed.current=false;setLoaded(null);}}}
  const sub=client.auth.onAuthStateChange(()=>{allowed.current=false;conceal();const n=++epoch;if(active)setLoaded(null);queueMicrotask(()=>{if(active)void load(n);});}),connection=()=>{if(active)setOnline(navigator.onLine);};window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();void load(++epoch);return()=>{active=false;epoch++;allowed.current=false;conceal();sub.data.subscription.unsubscribe();window.removeEventListener('online',connection);window.removeEventListener('offline',connection);};
 },[enabled,tournamentId,eventId,contextId,slot,gameNumber,key]);
 if(!enabled)return null;if(!loaded||loaded.key!==key)return <p role="status">Director Playoff correction access has not been verified. Existing evidence is unchanged.</p>;
 return <div ref={region} data-online={online}><NativeMixedPlayoffReopenV1 enabled runtime={loaded.runtime}/></div>;
}

