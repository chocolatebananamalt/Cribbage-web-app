'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createClient} from '../lib/supabase/client';
import {getPublicSupabaseEnv} from '../lib/env';
import {createConsyAddonDirectorTransportV1} from '../lib/api/consy-addon-director-transport-v1';
import {createConsyPendingStoreV1} from '../lib/finance/consy-addon-pending-store-v1';
import {pendingKey} from '../lib/finance/consy-addon-desk-contract-v1';
import {setAppRecoveryItem,trackAppRecoveryWrite} from '../lib/recovery-write-coordinator';
import {mrpReviewUuid} from '../lib/results/mrp-membership-review-contract-v1';
import {ConsyAddonDirectorV1} from './consy-addon-director-v1';
import styles from './mrp-membership-review-v1.module.css';
import type {EventRosterEnrollmentWorkspace} from '../lib/api/event-roster-enrollment';
type Props={enabled?:boolean;actorId:string;tournamentId:string;projectUrl:string;workspace:EventRosterEnrollmentWorkspace};
/** Page visibility never substitutes for SQL Director and Co-director checks. */
export function ConsyAddonDirectorProviderV1(p:Props){if(p.enabled!==true)return null;return <Provider key={JSON.stringify([p.actorId,p.tournamentId,p.projectUrl])} {...p}/>;}
function Provider({actorId,tournamentId,projectUrl,workspace}:Props){
 const [session,setSession]=useState<string|null>(null),[auth,setAuth]=useState({authorized:false,revision:0}),[selection,setSelection]=useState({eventId:'',rosterEntryId:'',playerLabel:''}),[pending,setPending]=useState(false);
 const authorized=auth.authorized;const setAuthorized=useCallback((value:boolean)=>setAuth(v=>({authorized:value,revision:v.revision+1})),[]);
 const region=useRef<HTMLElement>(null);
 const allowed=useRef(false),live=useRef(false),owner=useRef(0),locked=useRef(false),runtimeCurrent=useRef<string|null>(null),sourceCurrent=useRef(false),boundSession=useRef<string|null>(null);
 useLayoutEffect(()=>{if(region.current){const open=auth.authorized&&allowed.current;region.current.hidden=!open;region.current.inert=!open;}},[auth]);
 const selectedEvent=workspace.events.find(e=>e.eventId===selection.eventId&&e.eventType==='consolation'&&e.format==='standard_singles');
 const selectionValid=!!selectedEvent;
 const binding=JSON.stringify([actorId,tournamentId,projectUrl,session,selection.eventId,selection.rosterEntryId,selection.playerLabel]);
 useLayoutEffect(()=>{runtimeCurrent.current=binding;sourceCurrent.current=selectionValid;return()=>{if(runtimeCurrent.current===binding)runtimeCurrent.current=null;sourceCurrent.current=false;};},[binding,selectionValid]);
 useEffect(()=>{
  if(!mrpReviewUuid(actorId)||!mrpReviewUuid(tournamentId)||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(projectUrl))return;
  const conceal=()=>{if(region.current){region.current.hidden=true;region.current.inert=true;}};
  let active=true,epoch=0,expiry:ReturnType<typeof setTimeout>|undefined;live.current=true;allowed.current=false;const ownerRef=owner,version=++ownerRef.current;
  let client:ReturnType<typeof createClient>;try{if(getPublicSupabaseEnv({NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}).url!==projectUrl){live.current=false;return;}client=createClient();}catch{live.current=false;return;}
  async function check(n:number){try{const u=await client.auth.getUser(),claims=await client.auth.getClaims(),role=await client.rpc('get_tournament_role',{p_tournament_id:tournamentId}),c=claims.data?.claims;const valid=!u.error&&!claims.error&&!role.error&&u.data.user?.id===actorId&&c?.sub===actorId&&mrpReviewUuid(c?.session_id)&&typeof c?.exp==='number'&&c.exp*1000>Date.now()&&['director','co_director'].includes(role.data as string)&&(!boundSession.current||boundSession.current===c.session_id);
   if(active&&owner.current===version&&n===epoch){allowed.current=valid;setAuthorized(valid);if(!valid)conceal();if(valid){boundSession.current=c!.session_id as string;setSession(c!.session_id as string);clearTimeout(expiry);expiry=setTimeout(()=>{conceal();allowed.current=false;if(active)setAuthorized(false);},Math.min(2147483647,(c!.exp as number)*1000-Date.now()));}}
  }catch{if(active&&n===epoch){conceal();allowed.current=false;setAuthorized(false);}}}
  const invalidate=()=>{conceal();allowed.current=false;if(active)setAuthorized(false);};
  const refresh=()=>{invalidate();const n=++epoch;queueMicrotask(()=>{if(active)void check(n);});};
  const auth=client.auth.onAuthStateChange(refresh);window.addEventListener('focus',refresh);window.addEventListener('pagehide',invalidate);void check(++epoch);
  return()=>{conceal();active=false;live.current=false;allowed.current=false;ownerRef.current++;epoch++;clearTimeout(expiry);auth.data.subscription.unsubscribe();window.removeEventListener('focus',refresh);window.removeEventListener('pagehide',invalidate);};
 },[actorId,tournamentId,projectUrl,setAuthorized]);
 const resources=useMemo(()=>{const [actor,tid,,sid,eid]=JSON.parse(binding) as (string|null)[];if(![actor,tid,sid,eid].every(mrpReviewUuid))return null;const scope={actorId:actor!,tournamentId:tid!,eventId:eid!};const current=()=>live.current&&allowed.current&&sourceCurrent.current&&runtimeCurrent.current===binding,recoveryCurrent=()=>live.current&&allowed.current&&runtimeCurrent.current===binding;
 const runtime=createConsyAddonDirectorTransportV1({enabled:true,scope,sessionId:sid!,current,recoveryCurrent,onIdentityRejected:()=>{allowed.current=false;if(region.current){region.current.hidden=true;region.current.inert=true;}setAuthorized(false);},fetcher:(...args)=>fetch(...args)});if(!runtime)return null;
 const store=createConsyPendingStoreV1({key:pendingKey(scope),get:k=>sessionStorage.getItem(k),set:(k,v)=>setAppRecoveryItem(sessionStorage,k,v),remove:k=>sessionStorage.removeItem(k),exclusive:async(name,work)=>{if(!navigator.locks)throw Error('exclusive_recovery_unavailable');return navigator.locks.request(name,{mode:'exclusive'},work);},track:trackAppRecoveryWrite,current,recoveryCurrent});return{scope,runtime,store};},[binding,setAuthorized]);
 const pendingChanged=useCallback((value:boolean)=>{locked.current=value;setPending(value);},[]);
 const selectorIntent={binding,authorized,pending};const latestSelector=useRef<typeof selectorIntent|null>(null);useLayoutEffect(()=>{latestSelector.current=selectorIntent;return()=>{if(latestSelector.current===selectorIntent)latestSelector.current=null;};});
 function choose(eventId:string){if(!live.current||!allowed.current||locked.current||latestSelector.current!==selectorIntent)return;latestSelector.current=null;runtimeCurrent.current=null;setSelection({eventId,rosterEntryId:'',playerLabel:''});}
 return <><p role="status" hidden={authorized}>Checking the current Director account. Saved payment operations remain held.</p><section ref={region} hidden={!authorized} inert={!authorized} className={styles.review} aria-labelledby="consy-payment-selection"><h2 id="consy-payment-selection">Additional Consolation Entry Payments</h2><p>Director and Co-director only. Record receipt evidence without collecting money through the app.</p>
 <fieldset disabled={pending||!authorized}><legend>Select a Consolation Event</legend><label>Event<select value={selection.eventId} onChange={e=>choose(e.target.value)}><option value="">Choose an Event</option>{workspace.events.filter(e=>e.eventType==='consolation'&&e.format==='standard_singles').map(e=><option key={e.eventId} value={e.eventId}>{e.name}</option>)}</select></label></fieldset>
 {resources&&session&&<ConsyAddonDirectorV1 key={binding} enabled admitted={authorized&&selectionValid} recoveryAdmitted={authorized} scope={resources.scope} sessionId={session} projectUrl={projectUrl} runtime={resources.runtime} store={resources.store} onPendingChange={pendingChanged}/>}
 </section></>;
}
