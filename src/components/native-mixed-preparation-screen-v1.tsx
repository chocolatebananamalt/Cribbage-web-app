'use client';
import {NativeMixedPlayLinksV1}from'./native-mixed-play-links-v1';
import {NativeMixedReviewSectionV1} from './native-mixed-review-section-v1';
import {nativeMixedReviewUiEnabledV1} from '../lib/finance/native-mixed-review-read-v1';

import{NativeMixedBootstrapProviderV1}from'./native-mixed-bootstrap-provider-v1';
import{bootstrapWorkflowEnabled}from'../lib/seating/native-mixed-bootstrap-workflow-v1';
import{NativeMixedStartPanelV1}from'./native-mixed-start-panel-v1';
import type{NativeMixedStartSessionV1}from'../lib/seating/native-mixed-start-session-v1';
import{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{NativeMixedDirectorPanelV1}from'./native-mixed-director-panel-v1';
import{readNativeMixedPreparationV1,authorNativeMixedPreparationOperationV1,type NativeMixedPreparationV1}from'../lib/seating/native-mixed-pilot-preparation-v1';
import type{NativeMixedSimulationOperationV1}from'../lib/seating/native-mixed-simulation-operation-v1';
import type{NativeMixedDirectorContextV1,NativeMixedDirectorSessionV1}from'../lib/seating/native-mixed-director-session-v1';
import styles from'./native-mixed-director-panel-v1.module.css';
export type NativeMixedPreparationRuntimeV1={controller:NativeMixedDirectorSessionV1;start:NativeMixedStartSessionV1;bootstrap:()=>Promise<unknown>;preparation:()=>Promise<unknown>;schedule?:()=>Promise<unknown>;review?:()=>Promise<unknown>;makeId:()=>string};
export function NativeMixedPreparationScreenV1({enabled=false,context,runtime,online}:{enabled?:boolean;context:NativeMixedDirectorContextV1;runtime:NativeMixedPreparationRuntimeV1;online:boolean}){
 const alive=useRef(false),epoch=useRef(0),[source,setSource]=useState<NativeMixedPreparationV1|null>(null),[ids,setIds]=useState<{operationId:string;seatingOperationId:string;scheduleOperationId:string}|null>(null),[approved,setApproved]=useState({layoutReviewed:false,noSpecialRequests:false}),[busy,setBusy]=useState(false),[message,setMessage]=useState('Checking current preparation.'),[now,setNow]=useState(0);
 const load=useCallback(async()=>{if(!enabled||!online)return;const n=++epoch.current;setBusy(true);setSource(null);setIds(null);setApproved({layoutReviewed:false,noSpecialRequests:false});try{const raw=await runtime.preparation();if(!alive.current||n!==epoch.current)return;const value=readNativeMixedPreparationV1(raw,context.scope);setSource(value);setNow(Date.now());if(value)setIds({operationId:runtime.makeId(),seatingOperationId:runtime.makeId(),scheduleOperationId:runtime.makeId()});setMessage(value?'Current test preparation loaded.':'Preparation could not be verified. Existing work is kept.');}catch{if(alive.current&&n===epoch.current)setMessage('Preparation is unavailable. Existing work is kept.');}finally{if(alive.current&&n===epoch.current)setBusy(false);}},[enabled,online,runtime,context]);
 const invalidate=useCallback(()=>{epoch.current++;},[]);
 useEffect(()=>{alive.current=true;queueMicrotask(()=>{if(alive.current)void load();});const timer=setInterval(()=>{if(alive.current)setNow(Date.now());},1000);return()=>{alive.current=false;invalidate();clearInterval(timer);};},[load,invalidate]);
 const prepared=useMemo(()=>source&&ids?authorNativeMixedPreparationOperationV1(source,context.scope,ids,approved,now):null,[source,ids,approved,context,now]);
 return <><NativeMixedBootstrapProviderV1 enabled={enabled&&bootstrapWorkflowEnabled()} tournamentId={context.scope.tournamentId} eventId={context.scope.eventId} mode="director"/><NativeMixedPreparationViewV1 enabled={enabled} source={source} context={context} controller={runtime.controller} online={online} prepared={prepared} approved={approved} busy={busy} message={message} now={now} refresh={()=>void load()} approve={(field,value)=>setApproved(v=>({...v,[field]:value}))}/><NativeMixedStartPanelV1 enabled={enabled} context={context} controller={runtime.start} online={online} allowPrepare={source?.phase==='published'&&source.writesEnabled}/>{enabled&&runtime.schedule&&<NativeMixedPlayLinksV1 context={context} controller={runtime.start} online={online} readSchedule={runtime.schedule}/>} {runtime.review&&<NativeMixedReviewSectionV1 enabled={enabled&&nativeMixedReviewUiEnabledV1()} context={context} online={online} read={runtime.review}/>}</>;
}
/** Presentation only. Authorization and durable request state remain in the host/controller. */
export function NativeMixedPreparationViewV1({enabled,source,context,controller,online,prepared,approved,busy,message,now,refresh,approve}:{enabled:boolean;source:NativeMixedPreparationV1|null;context:NativeMixedDirectorContextV1;controller:NativeMixedDirectorSessionV1;online:boolean;prepared:NativeMixedSimulationOperationV1|null;approved:{layoutReviewed:boolean;noSpecialRequests:boolean};busy:boolean;message:string;now:number;refresh:()=>void;approve:(field:'layoutReviewed'|'noSpecialRequests',value:boolean)=>void}){
 if(!enabled)return <p role="status">Rehearsal preparation is not enabled.</p>;
 return <main className={styles.panel}><h1>Prepare Rehearsal</h1><p className={styles.notice}><strong>Test Only</strong> Â| Fictional Paper Players Â| Simulated Fees</p>{source&&<><h2>{source.tournamentName}</h2><p>{source.eventName} Â| 18 Players Â| 12 Qualifying Games</p></>}
  <p role="status" aria-live="polite">{message}</p>{!online&&<p>Offline. Saved requests are kept. Reconnect before continuing.</p>}
  <button type="button" disabled={busy||!online} onClick={refresh}>Refresh Preparation</button>
  {source?.phase==='plan'&&<fieldset disabled={!online||busy||!source.writesEnabled}><legend>Review This Test Layout</legend><p>One table: A-1 through A-18. A-1 is the fixed seat, assigned by the draw. This test screen does not support additional seating requests.</p>
   <label className={styles.check}><input type="checkbox" checked={approved.layoutReviewed} onChange={e=>approve('layoutReviewed',e.target.checked)}/>I reviewed this layout and the available space.</label>
   <label className={styles.check}><input type="checkbox" checked={approved.noSpecialRequests} onChange={e=>approve('noSpecialRequests',e.target.checked)}/>No reserved stationary seat or family restriction needs to be applied in this test.</label>
  </fieldset>}
  {source?.phase==='published'&&<p>Rehearsal seating and 108 games are saved. Use Start Rehearsal below to check readiness.</p>}
  {source&&!prepared&&source.phase!=='published'&&now-Date.parse(source.observedAt)>30000&&<p>Refresh Preparation before continuing.</p>}
  {source&&!source.writesEnabled&&<p>This test is read-only. Saved requests are kept.</p>}
  <NativeMixedDirectorPanelV1 enabled canRead={enabled} canWrite={online&&(source?.writesEnabled??true)} controller={controller} context={context} preparedOperation={prepared??undefined} reviewMaterials={source?.history}/>
 </main>;
}
