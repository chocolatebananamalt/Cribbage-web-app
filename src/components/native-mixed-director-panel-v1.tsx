'use client';

import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {nativeMixedDirectorPendingKeyV1,type NativeMixedDirectorContextV1,type NativeMixedDirectorSessionV1,type NativeMixedDirectorSnapshotV1} from '../lib/seating/native-mixed-director-session-v1';
import type {NativeMixedSimulationOperationV1} from '../lib/seating/native-mixed-simulation-operation-v1';
import {readNativeMixedDirectorPreparedOperationV1,readNativeMixedDirectorReviewMaterialsV1} from '../lib/seating/native-mixed-director-review-materials-v1';
import OneTableMovementPreview from './one-table-movement-preview';
import styles from './native-mixed-director-panel-v1.module.css';

type Props={enabled?:boolean;canRead?:boolean;canWrite?:boolean;controller?:NativeMixedDirectorSessionV1;context?:NativeMixedDirectorContextV1|null;preparedOperation?:NativeMixedSimulationOperationV1;reviewMaterials?:unknown};
const label={plan:'Save Seating Plan',draw:'Draw Seats',review:'Approve This Test Layout',publish:'Publish Rehearsal Seating and Games'};
/** Client-host seam only: controller/functions are never Server Component props.
 * No route imports this panel; flags default off and there is no network client. */
export function NativeMixedDirectorPanelV1(props:Props){
 const unavailable=<section className={styles.panel} aria-label="Rehearsal Seating"><h2>Rehearsal Seating</h2><p>These test controls are not enabled. Existing saved work is preserved.</p></section>;
 if(props.enabled!==true||props.canRead!==true||!props.controller||!props.context)return unavailable;
 const c=props.context;let key:string;try{key=`${nativeMixedDirectorPendingKeyV1(c)}:${c.sessionId}`;}catch{return unavailable;}
 return <ActivePanel key={key} controller={props.controller} context={c} canWrite={props.canWrite===true} preparedOperation={props.preparedOperation} reviewMaterials={props.reviewMaterials}/>;
}
function ActivePanel({controller,context,canWrite,preparedOperation,reviewMaterials}:{controller:NativeMixedDirectorSessionV1;context:NativeMixedDirectorContextV1;canWrite:boolean;preparedOperation?:NativeMixedSimulationOperationV1;reviewMaterials?:unknown}){
 const [fixedContext]=useState(()=>structuredClone(context)),[,render]=useState(0),[busy,setBusy]=useState(false),[cancelInput,setCancelInput]=useState({signature:'',reason:'',confirmed:false}),[reviewInput,setReviewInput]=useState({signature:'',checks:[false,false,false],publish:false}),[notice,setNotice]=useState('');
 const [activation,setActivation]=useState<{controller:NativeMixedDirectorSessionV1;generation:number}|null>(null);
 const alive=useRef(false),flight=useRef<{controller:NativeMixedDirectorSessionV1;generation:number}|null>(null),activationEpoch=useRef(0),statusRef=useRef<HTMLParagraphElement>(null),baseId=useId();
 useEffect(()=>{const generation=++activationEpoch.current;alive.current=true;flight.current=null;void controller.activate(fixedContext).then(()=>{if(alive.current&&activationEpoch.current===generation){setBusy(false);setNotice('');setActivation({controller,generation});}});return()=>{alive.current=false;activationEpoch.current=generation+1;flight.current=null;void controller.activate(null);};},[controller,fixedContext]);
 const activeController=useRef<NativeMixedDirectorSessionV1|null>(controller);
 useLayoutEffect(()=>{activeController.current=controller;return()=>{if(activeController.current===controller)activeController.current=null;};},[controller]);
 const activated=activation?.controller===controller;
 const view:NativeMixedDirectorSnapshotV1=activated?controller.getSnapshot():{status:'loading',operation:null,receipt:null,message:'Checking saved work.'},prepared=readNativeMixedDirectorPreparedOperationV1(preparedOperation);
 const materials=prepared?readNativeMixedDirectorReviewMaterialsV1(reviewMaterials,fixedContext.scope,prepared):null;
 const signature=JSON.stringify({prepared,materials}),pendingSignature=JSON.stringify(view.operation);
 const checks=reviewInput.signature===signature?reviewInput.checks:[false,false,false],publishConfirmed=reviewInput.signature===signature&&reviewInput.publish;
 const reason=cancelInput.signature===pendingSignature?cancelInput.reason:'',cancelConfirmed=cancelInput.signature===pendingSignature&&cancelInput.confirmed;
 const offered=prepared&&(view.status==='ready'?prepared.action==='plan':view.status==='blocked'&&prepared.action===view.nextActionHint)?prepared:null;
 const canSubmit=!!offered&&canWrite&&!busy&&(offered.action!=='review'||!!materials&&checks.every(Boolean))&&(offered.action!=='publish'||!!materials&&publishConfirmed);
 // An old enabled React callback is not current consent. State edits invalidate
 // dispatch synchronously, before React commits the next rendered checkbox.
 const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 const intent={controller,canWrite,viewSignature:canonical(view),signature,pendingSignature,reviewInput,cancelInput,generation:activation?.generation};
 const latestIntent=useRef<typeof intent|null>(null);
 useLayoutEffect(()=>{latestIntent.current=intent;return()=>{if(latestIntent.current===intent)latestIntent.current=null;};});
 const currentIntent=()=>{try{return latestIntent.current===intent&&alive.current&&activated&&activationEpoch.current===intent.generation&&canonical(controller.getSnapshot())===intent.viewSignature;}catch{return false;}};
 const changeReview=(next:typeof reviewInput)=>{if(!currentIntent()||!canWrite||busy)return;latestIntent.current=null;setReviewInput(next);};
 const changeCancel=(next:typeof cancelInput)=>{if(!currentIntent()||!canWrite||busy)return;latestIntent.current=null;setCancelInput(next);};
 async function run(work:()=>Promise<unknown>,write=false){
  if(flight.current||!currentIntent()||(write&&!canWrite))return;
  const token={controller,generation:activationEpoch.current};flight.current=token;setBusy(true);setNotice('');
  const ownerCurrent=()=>alive.current&&flight.current===token&&activationEpoch.current===token.generation&&activeController.current===controller;
  const sameSource=()=>ownerCurrent()&&latestIntent.current?.signature===signature;
  try{const ok=await work();if(sameSource()&&ok!==true)setNotice('The step is not confirmed. Saved work has been kept; check its result before continuing.');}
  catch{if(sameSource())setNotice('The step could not be confirmed. Saved work has been kept.');}
  finally{if(ownerCurrent()){flight.current=null;setBusy(false);render(n=>n+1);requestAnimationFrame(()=>{if(alive.current&&!flight.current&&activationEpoch.current===token.generation&&activeController.current===controller&&latestIntent.current?.signature===signature)statusRef.current?.focus();});}}
 }
 const cancelReady=canWrite&&!busy&&cancelConfirmed&&reason.trim().length>0&&reason.trim().length<=500&&!/[\u0000-\u001f\u007f]/u.test(reason);
 return <section className={styles.panel} aria-labelledby={`${baseId}-heading`} aria-busy={busy}>
  <h2 id={`${baseId}-heading`}>Rehearsal Seating</h2>
  <p className={styles.notice}><strong>Test Only — Simulated Participants and Fees</strong><br/>These controls do not start play or move money.</p>
  <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite">{view.message}</p>{notice&&<p role="alert">{notice}</p>}
  {view.status==='pending'&&<>
   <button type="button" disabled={busy} onClick={()=>{if(view.status==='pending'&&!busy)void run(()=>controller.check());}}>Check Saved Result</button>
   {canWrite&&<details><summary>Close an Uncertain Request</summary><p>Closing does not erase a committed result. An uncertain draw cannot be replaced with another draw in this event.</p>
    <label htmlFor={`${baseId}-reason`}>Reason for Closing (Required)</label><textarea id={`${baseId}-reason`} maxLength={500} value={reason} onChange={e=>changeCancel({signature:pendingSignature,reason:e.target.value,confirmed:cancelConfirmed})} disabled={busy}/>
    <label className={styles.check}><input type="checkbox" checked={cancelConfirmed} disabled={busy} onChange={e=>changeCancel({signature:pendingSignature,reason,confirmed:e.target.checked})}/><span>I understand this closes the attempt and does not authorize another draw.</span></label>
    <button type="button" disabled={!cancelReady} onClick={()=>{if(view.status==='pending'&&cancelReady)void run(()=>controller.cancelPending(reason.trim()),true);}}>Close Uncertain Request</button>
   </details>}
  </>}
  {view.status==='resolved'&&<button type="button" disabled={busy} onClick={()=>{if(view.status==='resolved'&&!busy)void run(()=>controller.archiveResolved());}}>Close This Step</button>}
  {offered&&<>
   {['review','publish'].includes(offered.action)&&!materials&&<p>Saved layout details must be verified before this step is available.</p>}
   {materials&&<OneTableMovementPreview config={materials.config} candidate={materials.candidate}/>}
   {offered.action==='review'&&materials&&<fieldset disabled={!canWrite||busy}><legend>Review This Test Layout</legend>{['I reviewed the displayed test layout.','I understand physical presence has not been verified.','I understand the paper players are fictional for this rehearsal.'].map((text,i)=><label className={styles.check} key={text}><input type="checkbox" checked={checks[i]} onChange={e=>changeReview({signature,checks:checks.map((v,j)=>j===i?e.target.checked:v),publish:publishConfirmed})}/><span>{text}</span></label>)}</fieldset>}
   {offered.action==='publish'&&materials&&<label className={styles.check}><input type="checkbox" disabled={!canWrite||busy} checked={publishConfirmed} onChange={e=>changeReview({signature,checks,publish:e.target.checked})}/><span>Publish the fixed Tournament IDs and 108 qualifying games for this test. This does not start play.</span></label>}
   <button type="button" disabled={!canSubmit} onClick={()=>{if(canSubmit)void run(()=>view.status==='ready'?controller.submit(offered):controller.advance(offered),true);}}>{label[offered.action]}</button>
  </>}
 </section>;
}
