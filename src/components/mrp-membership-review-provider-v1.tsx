'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createClient} from '../lib/supabase/client';
import {getPublicSupabaseEnv} from '../lib/env';
import {createMrpMembershipReviewTransportV1} from '../lib/api/mrp-membership-review-transport-v1';
import {mrpReviewUuid} from '../lib/results/mrp-membership-review-contract-v1';
import {MrpMembershipReviewV1,type MrpMembershipReviewRuntimeV1} from './mrp-membership-review-v1';
import styles from './mrp-membership-review-v1.module.css';
import type {EventRosterEnrollmentWorkspace} from '../lib/api/event-roster-enrollment';
type Props={enabled?:boolean;actorId:string;tournamentId:string;projectUrl:string;workspace:EventRosterEnrollmentWorkspace};
const personLabel=(r:EventRosterEnrollmentWorkspace['roster'][number])=>`${r.verificationId?`Tournament ID# ${r.verificationId}`:`Roster Entry ${r.rosterEntryId}`} — ${r.displayName}`;
/** Page visibility never substitutes for the SQL primary-director check. */
export function MrpMembershipReviewProviderV1(p:Props){if(p.enabled!==true)return null;return <Provider key={JSON.stringify([p.actorId,p.tournamentId,p.projectUrl])} {...p}/>;}
function Provider({actorId,tournamentId,projectUrl,workspace}:Props){
 const [session,setSession]=useState<string|null>(null),[auth,setAuth]=useState({authorized:false,revision:0}),[selection,setSelection]=useState({eventId:'',rosterEntryId:'',playerLabel:''}),[pending,setPending]=useState(false);
 const authorized=auth.authorized;const setAuthorized=useCallback((value:boolean)=>setAuth(v=>({authorized:value,revision:v.revision+1})),[]);
 const region=useRef<HTMLElement>(null);
 const allowed=useRef(false),live=useRef(false),owner=useRef(0),locked=useRef(false),runtimeCurrent=useRef<string|null>(null),sourceCurrent=useRef(false),boundSession=useRef<string|null>(null);
 useLayoutEffect(()=>{if(region.current){const open=auth.authorized&&allowed.current;region.current.hidden=!open;region.current.inert=!open;}},[auth]);
 const selectedEvent=workspace.events.find(e=>e.eventId===selection.eventId&&['main','consolation'].includes(e.eventType)&&e.format==='standard_singles'),selectedPerson=workspace.roster.find(r=>r.rosterEntryId===selection.rosterEntryId&&r.enrolledEventIds.includes(selection.eventId));
 const selectionValid=!!selectedEvent&&!!selectedPerson&&personLabel(selectedPerson)===selection.playerLabel;
 const binding=JSON.stringify([actorId,tournamentId,projectUrl,session,selection.eventId,selection.rosterEntryId,selection.playerLabel]);
 useLayoutEffect(()=>{runtimeCurrent.current=binding;sourceCurrent.current=selectionValid;return()=>{if(runtimeCurrent.current===binding)runtimeCurrent.current=null;sourceCurrent.current=false;};},[binding,selectionValid]);
 useEffect(()=>{
  if(!mrpReviewUuid(actorId)||!mrpReviewUuid(tournamentId)||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(projectUrl))return;
  const conceal=()=>{if(region.current){region.current.hidden=true;region.current.inert=true;}};
  let active=true,epoch=0,expiry:ReturnType<typeof setTimeout>|undefined;live.current=true;allowed.current=false;const ownerRef=owner,version=++ownerRef.current;
  let client:ReturnType<typeof createClient>;try{if(getPublicSupabaseEnv({NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}).url!==projectUrl){live.current=false;return;}client=createClient();}catch{live.current=false;return;}
  async function check(n:number){try{const u=await client.auth.getUser(),claims=await client.auth.getClaims(),role=await client.rpc('get_tournament_role',{p_tournament_id:tournamentId}),c=claims.data?.claims;const valid=!u.error&&!claims.error&&!role.error&&u.data.user?.id===actorId&&c?.sub===actorId&&mrpReviewUuid(c?.session_id)&&typeof c?.exp==='number'&&c.exp*1000>Date.now()&&role.data==='director'&&(!boundSession.current||boundSession.current===c.session_id);
   if(active&&owner.current===version&&n===epoch){allowed.current=valid;setAuthorized(valid);if(!valid)conceal();if(valid){boundSession.current=c!.session_id as string;setSession(c!.session_id as string);clearTimeout(expiry);expiry=setTimeout(()=>{conceal();allowed.current=false;if(active)setAuthorized(false);},Math.min(2147483647,(c!.exp as number)*1000-Date.now()));}}
  }catch{if(active&&n===epoch){conceal();allowed.current=false;setAuthorized(false);}}}
  const invalidate=()=>{conceal();allowed.current=false;if(active)setAuthorized(false);};
  const refresh=()=>{invalidate();const n=++epoch;queueMicrotask(()=>{if(active)void check(n);});};
  const auth=client.auth.onAuthStateChange(refresh);window.addEventListener('focus',refresh);window.addEventListener('pagehide',invalidate);void check(++epoch);
  return()=>{conceal();active=false;live.current=false;allowed.current=false;ownerRef.current++;epoch++;clearTimeout(expiry);auth.data.subscription.unsubscribe();window.removeEventListener('focus',refresh);window.removeEventListener('pagehide',invalidate);};
 },[actorId,tournamentId,projectUrl,setAuthorized]);
 const runtime=useMemo<MrpMembershipReviewRuntimeV1|null>(()=>{const [actor,tid,,sid,eid,rid]=JSON.parse(binding) as (string|null)[];if(![actor,tid,sid,eid,rid].every(mrpReviewUuid))return null;return createMrpMembershipReviewTransportV1({enabled:true,scope:{tournamentId:tid!,eventId:eid!,rosterEntryId:rid!},actorId:actor!,sessionId:sid!,current:()=>live.current&&allowed.current&&sourceCurrent.current&&runtimeCurrent.current===binding,recoveryCurrent:()=>live.current&&allowed.current&&runtimeCurrent.current===binding,fetcher:(...args)=>fetch(...args),makeId:()=>crypto.randomUUID(),now:()=>new Date().toISOString()});},[binding]);
 const pendingChanged=useCallback((value:boolean)=>{locked.current=value;setPending(value);},[]);
 const selectorIntent={binding,authorized,pending};const latestSelector=useRef<typeof selectorIntent|null>(null);useLayoutEffect(()=>{latestSelector.current=selectorIntent;return()=>{if(latestSelector.current===selectorIntent)latestSelector.current=null;};});
 function choose(eventId:string,rosterEntryId:string){if(!live.current||!allowed.current||locked.current||latestSelector.current!==selectorIntent)return;latestSelector.current=null;runtimeCurrent.current=null;const person=workspace.roster.find(r=>r.rosterEntryId===rosterEntryId&&r.enrolledEventIds.includes(eventId));setSelection({eventId,rosterEntryId,playerLabel:person?personLabel(person):''});}
 return <><p role="status" hidden={authorized}>Checking the current Director account. Pending work is held in this page.</p><section ref={region} hidden={!authorized} inert={!authorized} className={styles.review} aria-labelledby="mrp-review-selection"><h2 id="mrp-review-selection">Manual Membership Evidence</h2><p>Primary Director review only. This records evidence; it does not award MRPs or determine eligibility.</p>
 {!authorized?<p role="status">The signed-in Director session could not yet be verified. Existing pending work is held.</p>:<fieldset disabled={pending}><legend>Select an Enrolled Player</legend><label>Event<select value={selection.eventId} onChange={e=>choose(e.target.value,'')}><option value="">Choose an Event</option>{workspace.events.filter(e=>['main','consolation'].includes(e.eventType)&&e.format==='standard_singles').map(e=><option key={e.eventId} value={e.eventId}>{e.name}</option>)}</select></label><label>Player<select value={selection.rosterEntryId} disabled={!selectedEvent} onChange={e=>choose(selection.eventId,e.target.value)}><option value="">Choose a Player</option>{workspace.roster.filter(r=>r.enrolledEventIds.includes(selection.eventId)).map(r=><option key={r.rosterEntryId} value={r.rosterEntryId}>{personLabel(r)}</option>)}</select></label></fieldset>}
 {runtime&&session&&selection.eventId&&selection.rosterEntryId&&<MrpMembershipReviewV1 key={binding} enabled admitted={authorized&&selectionValid} recoveryAdmitted={authorized} scope={{tournamentId,eventId:selection.eventId,rosterEntryId:selection.rosterEntryId}} actorId={actorId} sessionId={session} runtime={runtime} playerLabel={selection.playerLabel} onPendingChange={pendingChanged}/>}
 </section></>;
}