'use client';
import{useEffect,useMemo,useState,useSyncExternalStore}from'react';
import{createClient}from'../lib/supabase/client';
import{getPublicSupabaseEnv}from'../lib/env';
import type{NativeMixedOwnClientV1}from'../lib/api/native-mixed-game-evidence-transport-v1';
import{createPlayoffPaperTransportV1}from'../lib/api/native-mixed-playoff-paper-transport-v1';
import{PlayoffPaperPendingV1}from'../lib/playoffs/native-mixed-playoff-paper-pending-v1';
import{isPlayoffReopenTargetV1,playoffCorrectionSameV1 as same}from'../lib/playoffs/native-mixed-playoff-reopen-v1';
import{buildPlayoffPaperRequestV1,type PlayoffPaperTargetV1,type PlayoffPaperRequestV1}from'../lib/playoffs/native-mixed-playoff-paper-v1';
import{createIndexedSeriesGameRetainedV1,type SeriesGameRetainedPortV1}from'../lib/playoffs/series-game-retained-v1';
import{NativeMixedPlayoffPaperV1}from'./native-mixed-playoff-paper-v1';

export type PlayoffPaperHostPortV1={client:NativeMixedOwnClientV1;retained:SeriesGameRetainedPortV1;subscribeAuth:(listener:()=>void)=>()=>void;online:()=>boolean;subscribeOnline:(listener:()=>void)=>()=>void;makeOperationId:()=>string;makeArtifactId:()=>string;now?:()=>number};
type Snapshot=ReturnType<PlayoffPaperPendingV1['getSnapshot']>;
type View={epoch:number;online:boolean;busy:boolean;snapshot:Snapshot|null;message:string};
/** A synchronous external admission store hides private data on auth events,
 * before an asynchronous session recheck. No SSR or administrative fallback. */
function createHost(port:PlayoffPaperHostPortV1,target:PlayoffPaperTargetV1){
 let alive=true,epoch=0,allowed=false,expires=0,flight=false,controller:PlayoffPaperPendingV1|null=null,timer:ReturnType<typeof setTimeout>|null=null;
 let view:View={epoch:0,online:false,busy:false,snapshot:null,message:'Checking your signed-in practice session.'};
 const listeners=new Set<()=>void>(),now=port.now??Date.now;
 const connected=()=>{try{return port.online()===true;}catch{return false;}};
 const permitted=()=>alive&&allowed&&expires>now();
 const publish=(message?:string)=>{view={epoch,online:connected(),busy:flight,snapshot:permitted()?controller?.getSnapshot()??null:null,message:message??view.message};listeners.forEach(f=>f());};
 const hide=(message:string)=>{allowed=false;expires=0;if(timer!==null)clearTimeout(timer);timer=null;controller?.dispose();controller=null;publish(message);};
 const expire=()=>{if(timer!==null)clearTimeout(timer);timer=setTimeout(()=>{if(!alive)return;if(expires<=now()){epoch++;flight=false;hide('Your session expired. Saved readings are preserved.');}else expire();},Math.min(2147483647,Math.max(1,expires-now())));};
 async function identity(n:number){
  try{const u=await port.client.auth.getUser(),r=await port.client.auth.getClaims(),c=r.data?.claims as Record<string,unknown>|undefined;
   if(!alive||epoch!==n)return false;
   if(u.error||r.error||u.data.user?.id!==target.actorId||c?.sub!==target.actorId||c.session_id!==target.sessionId||c.iss!==target.projectUrl+'/auth/v1'||typeof c.exp!=='number'||!Number.isSafeInteger(c.exp)||c.exp*1000<=now()){hide('Your session could not be verified. Saved readings are preserved.');return false;}
   expires=c.exp*1000;expire();return true;
  }catch{if(alive&&epoch===n)hide('Your session could not be verified. Saved readings are preserved.');return false;}
 }
 const transport=createPlayoffPaperTransportV1({client:port.client,target,enabled:permitted,now,revoked:()=>{if(alive){epoch++;flight=false;hide('Your session changed. Saved readings are preserved.');}}});
 async function checkSession(){
  const n=++epoch;flight=false;hide('Checking your signed-in practice session.');
  if(!connected()||!await identity(n)||!alive||epoch!==n)return;
  allowed=true;const current=()=>permitted()&&epoch===n;
  const c=new PlayoffPaperPendingV1({target,retained:port.retained,transport,enabled:current,online:connected});controller=c;
  await c.initialize();if(!current())return;await c.refresh();if(!current())return;publish('');
 }
 async function work(action:'record'|'refresh'|'retry'|'check'|'close',request?:PlayoffPaperRequestV1,expected?:Snapshot):Promise<boolean>{
  const c=controller,n=epoch;
  if(!permitted()||!c||flight||expected&&!same(expected,c.getSnapshot())){if(alive&&!permitted())hide('Your session must be checked before continuing. Saved readings are preserved.');return false;}
  const offline= !connected();if(offline&&action!=='record')return false;
  if(action==='record'){
   const s=c.getSnapshot(),w=s.workspace;if(!w||s.pending||s.blocked||!request)return false;
   const e=request.data.entry,claims=e.type==='paper-capture'?e.claims:e.reenteredClaims;
   const built=buildPlayoffPaperRequestV1(w,Object.fromEntries(claims.map(x=>[x.participantId,x.winnerParticipantId])),e.type==='paper-capture'?e.artifactId:undefined);
   if(!built||!same(built,request))return false;
  }
  flight=true;publish();let staged=false;
  try{
   if(!offline&&!await identity(n)||!alive||epoch!==n||!permitted())return false;
   if(action==='record'&&request){const w=c.getSnapshot().workspace;if(!w)return false;staged=await c.stage(port.makeOperationId(),request,w);if(!staged||!permitted()||epoch!==n)return staged;if(connected())await c.submitExact();}
   else if(action==='retry')await c.submitExact();else if(action==='check')await c.checkOutcome();else if(action==='close')await c.closeObsolete();
   else{await c.initialize();if(permitted()&&epoch===n)await c.refresh();}
   if(!permitted()||epoch!==n)return staged;
   if(connected()&&!await identity(n))return staged;
   if(!c.getSnapshot().pending&&!c.getSnapshot().workspace&&connected())await c.refresh();
   if(permitted()&&epoch===n)publish('');return action==='record'?staged:true;
  }catch{if(alive&&epoch===n)publish('This step could not be confirmed. Saved readings are preserved.');return staged;}
  finally{if(alive&&epoch===n){flight=false;publish();}}
 }
 let auth=()=>{},online=()=>{};
 return{subscribe:(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f);};},get:()=>view,server:()=>null,
  start:()=>{alive=true;try{auth=port.subscribeAuth(()=>{epoch++;flight=false;hide('Your session changed. Check it before continuing.');});online=port.subscribeOnline(()=>publish());void checkSession();}catch{hide('The practice connection is unavailable. Saved readings are preserved.');}},
  stop:()=>{alive=false;epoch++;allowed=false;if(timer!==null)clearTimeout(timer);timer=null;controller?.dispose();controller=null;auth();online();},work,checkSession};
}

export function NativeMixedPlayoffPaperHostV1({enabled=false,target,port}:{enabled?:boolean;target:PlayoffPaperTargetV1;port:PlayoffPaperHostPortV1}){
 if(!enabled||!isPlayoffReopenTargetV1(target))return <p role="status">Practice paper playoffs are not enabled.</p>;
 return <ActiveHost key={JSON.stringify(target)} target={target} port={port}/>;
}
function ActiveHost({target,port}:{target:PlayoffPaperTargetV1;port:PlayoffPaperHostPortV1}){
 const targetKey=JSON.stringify(target),host=useMemo(()=>createHost(port,JSON.parse(targetKey)as PlayoffPaperTargetV1),[port,targetKey]);
 const v=useSyncExternalStore(host.subscribe,host.get,host.server);
 useEffect(()=>{host.start();return()=>host.stop();},[host]);
 const s=v?.snapshot,p=s?.pending,blocked=!!v?.busy||!s?.initialized||s.blocked||!!p;
 return <>{!s&&<section aria-label="Practice Session"><p role="status">{v?.message??'Checking your signed-in practice session.'}</p><button type="button" disabled={!v?.online||v.busy} onClick={()=>void host.checkSession()}>Check Session</button></section>}
  {s&&<><NativeMixedPlayoffPaperV1 enabled connected workspace={s.workspace} online={!!v?.online} blocked={blocked} busy={v?.busy} message={s.message||v?.message} resolutionKey={s.resolutionKey} makeArtifactId={port.makeArtifactId} onRecord={q=>host.work('record',q,s)} onRefresh={async()=>{await host.work('refresh',undefined,s);}}/>
   {!s.workspace&&<button type="button" disabled={!v?.online||v.busy} onClick={()=>void host.work('refresh',undefined,s)}>Refresh Current Evidence</button>}
   {p&&<section aria-label="Saved Paper Reading"><h2>Saved Paper Reading</h2><p>Match {p.target.slot}, Game {p.target.gameNumber}. This is your exact saved {p.request.data.entry.type==='paper-capture'?'paper entry':'independent reading'}, not a verified result.</p>
    <p>Checking does not resend. Retrying sends only this original operation. No result is silently replaced.</p>
    <button type="button" disabled={!v?.online||v.busy} onClick={()=>void host.work('check',undefined,s)}>Check Saved Reading</button>
    <button type="button" disabled={!v?.online||v.busy||s.blocked&&!s.canRetryOriginal} onClick={()=>void host.work('retry',undefined,s)}>Retry Exact Saved Reading</button>
    {s.rejection&&<button type="button" disabled={!v?.online||v.busy} onClick={()=>void host.work('close',undefined,s)}>Close Proven Obsolete Reading</button>}
   </section>}
   {s.message&&<p role="status">{s.message}</p>}
  </>}
 </>;
}

/** Normal authenticated SDK; no administrative reader or service credential.
 * Explicit opt-in and exact environment match precede any client construction. */
export function NativeMixedPlayoffPaperProviderV1({enabled=false,target}:{enabled?:boolean;target:PlayoffPaperTargetV1}){
 const key=isPlayoffReopenTargetV1(target)?JSON.stringify(target):null,activation=useMemo(()=>({enabled,key}),[enabled,key]);
 const[loaded,setLoaded]=useState<{activation:object;port:PlayoffPaperHostPortV1}|null>(null);
 useEffect(()=>{if(!enabled||!key)return;let active=true;try{
  const t=JSON.parse(key)as PlayoffPaperTargetV1,env=getPublicSupabaseEnv({NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY});
  if(env.url!==t.projectUrl||new URL(env.url).hostname.split('.')[0]!==t.projectRef)return;
  const client=createClient(),port:PlayoffPaperHostPortV1={client,retained:createIndexedSeriesGameRetainedV1(),makeOperationId:()=>crypto.randomUUID(),makeArtifactId:()=>crypto.randomUUID(),online:()=>navigator.onLine,
   subscribeAuth:f=>{const s=client.auth.onAuthStateChange(()=>f());return()=>s.data.subscription.unsubscribe();},subscribeOnline:f=>{window.addEventListener('online',f);window.addEventListener('offline',f);return()=>{window.removeEventListener('online',f);window.removeEventListener('offline',f);};}};
  queueMicrotask(()=>{if(active)setLoaded({activation,port});});
 }catch{/* Disabled or mismatched environment remains closed. */}return()=>{active=false;};},[enabled,key,activation]);
 if(!enabled||!key)return <p role="status">Practice paper playoffs are not enabled.</p>;
 if(!loaded||loaded.activation!==activation)return <p role="status">The practice paper connection is unavailable or still being checked.</p>;
 return <NativeMixedPlayoffPaperHostV1 enabled target={target} port={loaded.port}/>;
}
