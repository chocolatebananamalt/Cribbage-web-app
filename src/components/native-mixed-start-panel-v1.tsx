'use client';
import{useEffect,useLayoutEffect,useRef,useState}from'react';
import type{NativeMixedDirectorContextV1}from'../lib/seating/native-mixed-director-session-v1';
import{nativeMixedStartPendingKeyV1,type NativeMixedStartSessionV1,type NativeMixedStartSnapshotV1}from'../lib/seating/native-mixed-start-session-v1';
import styles from'./native-mixed-director-panel-v1.module.css';

type Props={enabled?:boolean;context:NativeMixedDirectorContextV1;controller:NativeMixedStartSessionV1;online:boolean;allowPrepare:boolean};
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function NativeMixedStartPanelV1(props:Props){
 if(props.enabled!==true)return null;let key:string;try{key=`${nativeMixedStartPendingKeyV1(props.context)}:${props.context.sessionId}`;}catch{return <p role="status">Start context could not be verified. Saved requests are preserved.</p>;}
 return <ActiveStart key={key} {...props}/>;
}
function ActiveStart({context,controller,online,allowPrepare}:Props){
 const[fixedContext]=useState(()=>structuredClone(context)),[,render]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const[activation,setActivation]=useState<{controller:NativeMixedStartSessionV1;generation:number}|null>(null),[ack,setAck]=useState<{controller:NativeMixedStartSessionV1;generation:number;request:string}|null>(null);
 const alive=useRef(false),epoch=useRef(0),flight=useRef<{controller:NativeMixedStartSessionV1;generation:number}|null>(null),activeController=useRef<NativeMixedStartSessionV1|null>(controller);
 useLayoutEffect(()=>{activeController.current=controller;return()=>{if(activeController.current===controller)activeController.current=null;};},[controller]);
 useEffect(()=>{const generation=++epoch.current;alive.current=true;flight.current=null;
  void controller.activate(fixedContext).then(()=>{if(alive.current&&epoch.current===generation){setBusy(false);setNotice('');setActivation({controller,generation});}}).catch(()=>{if(alive.current&&epoch.current===generation){setBusy(false);setNotice('Start access could not be verified. Saved requests are preserved.');}});
  const timer=setInterval(()=>{if(alive.current&&epoch.current===generation)render(v=>v+1);},1000);
  return()=>{alive.current=false;epoch.current=generation+1;flight.current=null;clearInterval(timer);void controller.activate(null);};
 },[controller,fixedContext]);
 const activated=activation?.controller===controller;
 const snapshot:NativeMixedStartSnapshotV1=activated?controller.getSnapshot():{status:'loading',request:null,phase:null,receipt:null,currentStarted:false,message:'Checking saved Start.'};
 const requestSignature=canonical(snapshot.request),confirmed=!!snapshot.request&&ack?.controller===controller&&ack.generation===activation?.generation&&ack.request===requestSignature;
 const intent={controller,online,allowPrepare,snapshot:canonical(snapshot),requestSignature,ack,generation:activation?.generation},latest=useRef<typeof intent|null>(null);
 useLayoutEffect(()=>{latest.current=intent;return()=>{if(latest.current===intent)latest.current=null;};});
 const current=()=>{try{return latest.current===intent&&alive.current&&activated&&epoch.current===intent.generation&&activeController.current===controller&&canonical(controller.getSnapshot())===intent.snapshot;}catch{return false;}};
 const ready=snapshot.status==='ready',canPrepare=ready&&online&&allowPrepare&&!busy,canSubmit=canPrepare&&!!snapshot.request&&confirmed;
 const canRetry=online&&!busy&&snapshot.status==='pending'&&!!snapshot.request&&['not_sent','retryable'].includes(snapshot.phase??'');
 const canCheck=online&&!busy&&['pending','blocked','resolved'].includes(snapshot.status)&&!!snapshot.request;
 const confirm=(value:boolean)=>{if(!current()||!canPrepare||!snapshot.request)return;latest.current=null;setAck(value?{controller,generation:activation!.generation,request:requestSignature}:null);};
 async function run(work:()=>Promise<unknown>){
  if(flight.current||!current()||!online)return;const token={controller,generation:epoch.current};flight.current=token;setBusy(true);setNotice('');
  const owned=()=>alive.current&&flight.current===token&&epoch.current===token.generation&&activeController.current===controller;
  try{const ok=await work();if(owned()&&latest.current?.requestSignature===requestSignature&&ok!==true)setNotice('The action is not confirmed. Saved requests are preserved; check their outcome.');}
  catch{if(owned()&&latest.current?.requestSignature===requestSignature)setNotice('The action could not be confirmed. Saved requests are preserved.');}
  finally{if(owned()){flight.current=null;setBusy(false);render(v=>v+1);}}
 }
 return <NativeMixedStartViewV1 enabled snapshot={snapshot} busy={busy} online={online} allowPrepare={allowPrepare} confirmed={confirmed} confirm={confirm} notice={notice}
  prepare={()=>{if(canPrepare)void run(()=>controller.prepare());}}
  submit={()=>{if(canSubmit)void run(()=>controller.submit(true));}}
  retry={()=>{if(canRetry)void run(()=>controller.retryExact());}}
  check={()=>{if(canCheck)void run(()=>controller.check());}}/>;
}
export function NativeMixedStartViewV1({enabled,snapshot,busy,online,allowPrepare,confirmed,confirm,prepare,submit,retry,check,notice}:{enabled:boolean;snapshot:NativeMixedStartSnapshotV1;busy:boolean;online:boolean;allowPrepare:boolean;confirmed:boolean;confirm:(v:boolean)=>void;prepare:()=>void;submit:()=>void;retry:()=>void;check:()=>void;notice?:string}){
 if(!enabled)return null;const ready=snapshot.status==='ready';
 return <section className={styles.panel} aria-label="Start Rehearsal" aria-busy={busy}><h2>Start Rehearsal</h2><p>This starts simulated play only. It does not check anyone in, confirm physical attendance, collect fees, or approve payouts.</p><p role="status" aria-live="polite">{snapshot.message}</p>{notice&&<p role="alert">{notice}</p>}
  {ready&&<><button type="button" disabled={busy||!online||!allowPrepare} onClick={prepare}>Check Start Readiness</button>{snapshot.request&&<><p>18 Players · 12 Games Each · 108 Games</p><label className={styles.check}><input type="checkbox" checked={confirmed} disabled={busy||!online||!allowPrepare} onChange={e=>confirm(e.target.checked)}/>I am starting this test rehearsal with fictional paper players and simulated fees.</label><button type="button" disabled={busy||!online||!allowPrepare||!confirmed} onClick={submit}>Start Simulated Play</button></>}</>}
  {['pending','blocked','resolved'].includes(snapshot.status)&&snapshot.request&&<button type="button" disabled={busy||!online} onClick={check}>{snapshot.receipt?'Check Current Start Readiness':'Check Saved Start'}</button>}
  {snapshot.status==='pending'&&snapshot.request&&['not_sent','retryable'].includes(snapshot.phase??'')&&<button type="button" disabled={busy||!online} onClick={retry}>Send Same Saved Start Request</button>}
  {snapshot.currentStarted&&<p>Simulated play has started. Player consent and independent score review are still required.</p>}
  {!online&&<p>Offline. Saved Start requests are kept. Reconnect to check them.</p>}
 </section>;
}
