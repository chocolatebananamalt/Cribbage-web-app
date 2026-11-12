'use client';
import{useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore}from'react';
import{getPublicSupabaseEnv}from'../lib/env';
import{createClient}from'../lib/supabase/client';
import type{NativeMixedOwnClientV1}from'../lib/api/native-mixed-game-evidence-transport-v1';
import{createNativeMixedPlayoffOwnTransportV1,type NativeMixedPlayoffOwnTargetV1}from'../lib/api/native-mixed-playoff-own-transport-v1';
import{createIndexedSeriesGameRetainedV1,type SeriesGameRetainedPortV1}from'../lib/playoffs/series-game-retained-v1';
import{NativeMixedPlayoffOwnPendingV1}from'../lib/playoffs/native-mixed-playoff-own-pending-v1';
import{isNativeMixedPlayoffOwnScopeV1,buildNativeMixedPlayoffOwnCommandV1,type NativeMixedPlayoffOwnCommandV1,type NativeMixedPlayoffOwnStateV1}from'../lib/playoffs/native-mixed-playoff-own-view-v1';
import{NativeMixedPlayoffPlayerV1}from'./native-mixed-playoff-player-v1';
export type NativeMixedPlayoffPlayerHostPortV1={client:NativeMixedOwnClientV1;retained:SeriesGameRetainedPortV1;subscribeAuth:(listener:()=>void)=>()=>void;online:()=>boolean;subscribeOnline:(listener:()=>void)=>()=>void;makeOperationId:()=>string;now?:()=>number};
type Props={enabled?:boolean;target:NativeMixedPlayoffOwnTargetV1;initialState?:unknown};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
/** Validate descriptors before reading identity. No SSR state is displayed. */
export function nativeMixedPlayoffPlayerTargetKeyV1(value:unknown):string|null{
 try{if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==5)return null;
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=['actorId','sessionId','projectUrl','projectRef','ownScope'];if(!keys.every(k=>descriptors[k]?.enumerable&&'value'in descriptors[k]))return null;
  const t=value as NativeMixedPlayoffOwnTargetV1;if(!uuid(t.actorId)||!uuid(t.sessionId)||!isNativeMixedPlayoffOwnScopeV1(t.ownScope)||typeof t.projectRef!=='string'||!/^[a-z0-9-]{1,128}$/.test(t.projectRef)||typeof t.projectUrl!=='string')return null;
  const u=new URL(t.projectUrl);if(u.protocol!=='https:'||u.username||u.password||u.origin!==t.projectUrl)return null;return canonical(t);
 }catch{return null;}
}
export function nativeMixedPlayoffPlayerEnvMatchesV1(target:unknown,env:{url:string}){
 const key=nativeMixedPlayoffPlayerTargetKeyV1(target);if(!key)return false;const t=JSON.parse(key)as NativeMixedPlayoffOwnTargetV1;
 try{return env.url===t.projectUrl&&new URL(env.url).hostname.split('.')[0]===t.projectRef;}catch{return false;}
}
async function matchesIdentity(port:NativeMixedPlayoffPlayerHostPortV1,target:NativeMixedPlayoffOwnTargetV1){
 try{const u=await port.client.auth.getUser(),c=await port.client.auth.getClaims(),v=c.data?.claims;return!u.error&&!c.error&&u.data.user?.id===target.actorId&&v?.sub===target.actorId&&v.session_id===target.sessionId&&typeof v.exp==='number'&&Number.isSafeInteger(v.exp)&&v.exp*1000>(port.now??Date.now)();}catch{return false;}
}
/** Real normal-browser wrapper. No service key, route, grant or auth-system
 * changes. Exact public environment pin is checked BEFORE constructing SDK or
 * retained adapter. Initial SSR data is intentionally never used as a fallback. */
export function NativeMixedPlayoffPlayerProviderV1({enabled=false,target}:Props){
 const key=nativeMixedPlayoffPlayerTargetKeyV1(target),activation=useMemo(()=>({enabled,key}),[enabled,key]),[loaded,setLoaded]=useState<{key:string;activation:object;port:NativeMixedPlayoffPlayerHostPortV1}|null>(null);
 useEffect(()=>{
  if(!enabled||!key)return;let active=true;
  try{const captured=JSON.parse(key)as NativeMixedPlayoffOwnTargetV1,env=getPublicSupabaseEnv({NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY});
   if(!nativeMixedPlayoffPlayerEnvMatchesV1(captured,env))return;
   const client=createClient(),port:NativeMixedPlayoffPlayerHostPortV1={client,retained:createIndexedSeriesGameRetainedV1(),makeOperationId:()=>crypto.randomUUID(),online:()=>navigator.onLine,
    subscribeAuth:listener=>{const sub=client.auth.onAuthStateChange(()=>listener());return()=>sub.data.subscription.unsubscribe();},
    subscribeOnline:listener=>{window.addEventListener('online',listener);window.addEventListener('offline',listener);return()=>{window.removeEventListener('online',listener);window.removeEventListener('offline',listener);};}};
   queueMicrotask(()=>{if(active)setLoaded({key,activation,port});});
  }catch{/* Missing/mismatched environment never creates an admitted host. */}
  return()=>{active=false;};
 },[enabled,key,activation]);
 if(!enabled||!key)return <p role="status">Practice playoffs are not enabled.</p>;
 if(!loaded||loaded.key!==key||loaded.activation!==activation)return <p role="status">The practice connection is unavailable or still being checked. Saved operations are preserved.</p>;
 return <NativeMixedPlayoffPlayerHostV1 key={key} enabled target={target} port={loaded.port}/>;
}
type Owner={active:boolean;allowed:boolean;epoch:number;port:NativeMixedPlayoffPlayerHostPortV1;controller:NativeMixedPlayoffOwnPendingV1|null;transport:ReturnType<typeof createNativeMixedPlayoffOwnTransportV1>|null;check:(n:number)=>Promise<void>};
type Snapshot=ReturnType<NativeMixedPlayoffOwnPendingV1['getSnapshot']>;
type Loaded={owner:Owner;epoch:number;port:NativeMixedPlayoffPlayerHostPortV1;state:NativeMixedPlayoffOwnStateV1;snapshot:Snapshot};
/** React external admission snapshot prevents a queued/stale Loaded render from
 * reopening private content after synchronous auth revocation. Not auth state:
 * only a view of the already verified owner's current lifecycle. */
function createAdmission(){
 type Value={owner:Owner;epoch:number;controller:NativeMixedPlayoffOwnPendingV1;port:NativeMixedPlayoffPlayerHostPortV1};
 let current:Owner|null=null,value:Value|null=null;const listeners=new Set<()=>void>(),notify=()=>listeners.forEach(fn=>fn());
 return{subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},server:()=>null,
  get:()=>value&&value.owner===current&&value.owner.active&&value.owner.allowed&&value.owner.epoch===value.epoch&&value.owner.controller===value.controller&&value.owner.port===value.port?value:null,
  owner:(o:Owner|null)=>{current=o;value=null;notify();},clear:(o:Owner)=>{if(current===o){value=null;notify();}},
  publish:(o:Owner,n:number,c:NativeMixedPlayoffOwnPendingV1)=>{if(current===o&&o.active&&o.allowed&&o.epoch===n&&o.controller===c){value={owner:o,epoch:n,controller:c,port:o.port};notify();}},
 };
}
/** DI seam for isolated React tests. Mock acceptance is neither a signed-in
 * provider test nor real-origin IndexedDB proof. No initialState is consumed. */
export function NativeMixedPlayoffPlayerHostV1({enabled=false,target,port}:{enabled?:boolean;target:NativeMixedPlayoffOwnTargetV1;initialState?:unknown;port:NativeMixedPlayoffPlayerHostPortV1}){
 const key=nativeMixedPlayoffPlayerTargetKeyV1(target);if(!enabled||!key)return <p role="status">Practice playoffs are not enabled.</p>;
 return <ActiveHost key={key} enabled={enabled} targetKey={key} port={port}/>;
}
function ActiveHost({enabled,targetKey,port}:{enabled:boolean;targetKey:string;port:NativeMixedPlayoffPlayerHostPortV1}){
 const[target]=useState(()=>JSON.parse(targetKey)as NativeMixedPlayoffOwnTargetV1),[loaded,setLoaded]=useState<Loaded|null>(null),[online,setOnline]=useState(false),[,bumpConnectivity]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('Checking your signed-in practice session.');
 const[admission]=useState(createAdmission),permit=useSyncExternalStore(admission.subscribe,admission.get,admission.server);
 const owner=useRef<Owner|null>(null),region=useRef<HTMLDivElement|null>(null),onlineRef=useRef(false),flight=useRef<object|null>(null),latest=useRef<object|null>(null);
 const snapshotKey=JSON.stringify(loaded?.snapshot??null),lease={enabled,port,loaded,online,busy,snapshotKey};
 useLayoutEffect(()=>{latest.current=lease;return()=>{if(latest.current===lease)latest.current=null;};});
 useLayoutEffect(()=>{const node=region.current;return()=>{const o=owner.current;if(o){admission.clear(o);o.active=false;o.allowed=false;o.epoch++;o.controller?.dispose();}if(node)node.hidden=true;};},[port,admission]);
 useEffect(()=>{
  const o:Owner={active:true,allowed:false,epoch:0,port,controller:null,transport:null,check:async()=>{}};owner.current=o;admission.owner(o);let unsubAuth=()=>{},unsubOnline=()=>{};
  const current=(n:number)=>o.active&&owner.current===o&&o.epoch===n;
  const hide=(text:string)=>{admission.clear(o);o.allowed=false;o.controller?.dispose();o.controller=null;o.transport=null;flight.current=null;latest.current=null;if(region.current)region.current.hidden=true;setLoaded(null);setBusy(false);setMessage(text);};
  const identity=()=>matchesIdentity(port,target);
  o.check=async n=>{
   if(!current(n))return;
   if(!await identity()){if(current(n))hide('Your practice session changed or could not be verified. Saved operations are preserved.');return;}
   if(!current(n))return;o.allowed=true;
   const permitted=()=>current(n)&&o.allowed;
   const transport=createNativeMixedPlayoffOwnTransportV1({authenticated:port.client,projectUrl:target.projectUrl,projectRef:target.projectRef,target,enabled:permitted,now:port.now});
   const controller=new NativeMixedPlayoffOwnPendingV1({target,retained:port.retained,transport,enabled:permitted,online:()=>permitted()&&onlineRef.current});o.controller=controller;o.transport=transport;
   const settled=await Promise.allSettled([controller.initialize(),transport.read()]);if(!current(n)||!o.allowed)return;
   const read=settled[1];if(read.status!=='fulfilled'||read.value.error!==null||!read.value.data||!await identity()){if(current(n))hide('Current results are unavailable. Saved operations are preserved.');return;}
   if(!current(n)||!o.allowed)return;flight.current=null;setBusy(false);admission.publish(o,n,controller);setLoaded({owner:o,epoch:n,port,state:structuredClone(read.value.data),snapshot:controller.getSnapshot()});setMessage('');
  };
  const authChanged=()=>{if(!o.active)return;const n=++o.epoch;hide('Checking your signed-in practice session.');queueMicrotask(()=>{if(current(n))void o.check(n);});};
  const connectivity=()=>{if(!o.active)return;let value=false;try{value=port.online()===true;}catch{/* offline */}if(onlineRef.current!==value){onlineRef.current=value;latest.current=null;setOnline(value);bumpConnectivity(n=>n+1);}};
  try{unsubAuth=port.subscribeAuth(authChanged);unsubOnline=port.subscribeOnline(connectivity);connectivity();void o.check(++o.epoch);}catch{hide('The practice connection could not be checked. Saved operations are preserved.');}
  return()=>{admission.clear(o);o.active=false;o.allowed=false;o.epoch++;o.controller?.dispose();if(owner.current===o)owner.current=null;unsubAuth();unsubOnline();};
 },[enabled,port,target,admission]);
 const admitted=()=>{const o=owner.current;return latest.current===lease&&enabled&&loaded&&o===loaded.owner&&o.active&&o.allowed&&o.epoch===loaded.epoch&&o.port===port&&o.controller&&o.transport&&JSON.stringify(o.controller.getSnapshot())===snapshotKey?o:null;};
 const still=(o:Owner,n:number)=>owner.current===o&&o.active&&o.allowed&&o.epoch===n;
 const revoke=(o:Owner,text:string)=>{admission.clear(o);o.allowed=false;o.epoch++;o.controller?.dispose();o.controller=null;o.transport=null;latest.current=null;flight.current=null;if(region.current)region.current.hidden=true;setLoaded(null);setBusy(false);setMessage(text);};
 async function work(action:'command'|'retry'|'check'|'refresh',command?:NativeMixedPlayoffOwnCommandV1){
  const o=admitted();if(!o||!loaded||!onlineRef.current||flight.current||busy||!o.controller||!o.transport)return;const controller=o.controller,transport=o.transport,n=o.epoch;
  if(action==='command'){
   const snapshot=controller.getSnapshot();if(snapshot.blocked||snapshot.pending||snapshot.retainedRaw!==null||!snapshot.initialized||!command)return;
   const choice=command.data.entry.type==='digital-confirm'?'confirm':command.data.entry.winnerParticipantId===target.ownScope.participantId?'own':'opponent',expected=buildNativeMixedPlayoffOwnCommandV1(loaded.state,target.ownScope,choice);
   if(!expected||canonical(command)!==canonical(expected))return;
  }
  const token={};flight.current=token;latest.current=null;setBusy(true);
  try{
   if(!await matchesIdentity(port,target)){if(still(o,n))revoke(o,'Your practice session changed. Saved operations are preserved.');return;}if(!still(o,n)||!onlineRef.current)return;
   if(action==='command'&&command){const prepared=transport.prepare(port.makeOperationId(),command);if(!prepared)return;if(!await controller.stage(prepared,loaded.state)||!still(o,n)||!onlineRef.current)return;await controller.sendExact();}
   else if(action==='retry')await controller.retryExact();else if(action==='check')await controller.checkFresh();
   if(!still(o,n))return;if(!await matchesIdentity(port,target)){if(still(o,n))revoke(o,'Your practice session changed. Saved operations are preserved.');return;}if(!still(o,n))return;
   let snapshot=controller.getSnapshot(),state=snapshot.state??loaded.state;
   if(action==='refresh'){
    if(snapshot.blocked||!snapshot.initialized){await controller.initialize();if(!still(o,n))return;}
    const fresh=await transport.read();if(!still(o,n))return;if(fresh.error!==null||!fresh.data){revoke(o,'Current results are unavailable. Saved operations are preserved.');return;}state=fresh.data;snapshot=controller.getSnapshot();
   }
   if(still(o,n))setLoaded({owner:o,epoch:n,port,state:structuredClone(state),snapshot});
  }catch{if(still(o,n))setMessage('This step could not be confirmed. Saved operations are preserved.');}
  finally{if(flight.current===token){flight.current=null;if(still(o,n)){setBusy(false);setLoaded(old=>old&&old.owner===o?{...old,snapshot:controller.getSnapshot()}:old);}}}
 }
 function checkSession(){const o=owner.current;if(latest.current!==lease||!enabled||!onlineRef.current||!o||!o.active||o.port!==port||flight.current)return;const n=++o.epoch;admission.clear(o);o.allowed=false;o.controller?.dispose();o.controller=null;o.transport=null;if(region.current)region.current.hidden=true;latest.current=null;setLoaded(null);setMessage('Checking your signed-in practice session.');queueMicrotask(()=>{if(o.active&&owner.current===o)void o.check(n);});}
 const visible=!!loaded&&!!permit&&loaded.owner===permit.owner&&loaded.epoch===permit.epoch&&loaded.port===permit.port&&permit.port===port&&enabled,snapshot=visible?loaded.snapshot:null,blocked=busy||!snapshot?.initialized||snapshot.blocked||!!snapshot.pending||snapshot.retainedRaw!==null;
 return <>
  {!visible&&<section aria-label="Practice Session"><p role="status">{message||'Checking your signed-in practice session.'}</p><button type="button" disabled={!online||busy} onClick={checkSession}>Check Session</button></section>}
  <div ref={region} data-native-playoff-private hidden={!visible}>
   {visible&&<><NativeMixedPlayoffPlayerV1 enabled connected online={online} controlsBlocked={blocked} scope={target.ownScope} state={loaded.state} onCommand={c=>work('command',c)} onRefresh={()=>work('refresh')}/>
    {snapshot?.message&&<p role="status">{snapshot.message}</p>}{message&&<p role="status">{message}</p>}
    {snapshot?.retainedRaw!==null&&<section aria-label="Saved Playoff Operation"><h2>Saved Operation</h2><p>Only this exact saved operation can be checked or retried. It will not be replaced with a new one.</p><button type="button" disabled={busy||!online||!!snapshot?.blocked} onClick={()=>void work('retry')}>Retry Saved Operation</button><button type="button" disabled={busy||!online||!!snapshot?.blocked} onClick={()=>void work('check')}>Check Saved Operation</button></section>}
   </>}
  </div>
 </>;
}
