"use client";
import {useLayoutEffect,useRef,useState,useSyncExternalStore}from'react';
import {EventPlayoffParametersEditor}from'./event-playoff-parameters-editor';
import {isEventSettingsSetupV3,isEventSettingsDraftSavedV3,parseEventSettingsRecoveryV3,serializeEventSettingsRecoveryV3,serializeEventSettingsSetupV3,type EventSettingsSetupEnvelopeV3,type EventSettingsDraftSavedV3}from'../lib/api/event-settings-setup-v3';
import type{SeriesRuleContextV1}from'../lib/playoffs/series-settings-v1';
import{readEventSettingsOperationRecordV3,isEventSettingsRejectedV3}from'../lib/api/event-settings-handlers-v3';
import{isCustomQDraftRetryV2}from'../lib/api/custom-q-draft-result-v2';
import styles from'./event-settings-recovery-panel-v3.module.css';
type Port={read:()=>string|null;write:(raw:string)=>void;clearIfMatches:(raw:string)=>boolean};
type Transport={save:(envelope:EventSettingsSetupEnvelopeV3)=>Promise<unknown>;operationGET:(operationId:string)=>Promise<unknown>;readback:(ack:EventSettingsDraftSavedV3)=>Promise<unknown>};
type Props={capability:boolean;actorId:string;envelope:EventSettingsSetupEnvelopeV3;onEnvelopeChange:(v:EventSettingsSetupEnvelopeV3)=>void;onConfirmed?:(ack:EventSettingsDraftSavedV3)=>void;contextForEvent:(id:string)=>SeriesRuleContextV1;retained:Port;transport:Transport};
function pending(raw:string|null,actorId:string,tid:string){try{if(raw===null)return null;const v=JSON.parse(raw);if(v?.envelope?.setup?.base?.tournamentId!==tid)return null;return parseEventSettingsRecoveryV3(raw,actorId,v.operationId,v.envelope.setup.base);}catch{return null;}}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const canonical=(v:unknown)=>JSON.stringify(v,(_key,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const subscribe=()=>()=>{};
/** Unwired local prototype. The injected host owns storage coordination and
 * authenticated transport; this component never fetches or selects an account.
 */
export function EventSettingsRecoveryPanelV3(props:Props){
 const hydrated=useSyncExternalStore(subscribe,()=>true,()=>false);
 if(!props.capability)return<section className={styles.panel}><h2>Local Settings Prototype</h2><p role="status">Settings transport is unavailable. Saving is disabled.</p></section>;
 if(!hydrated)return<section className={styles.panel}><p role="status">Loading retained local settings…</p></section>;
 return<EnabledPanel key={`${props.actorId}:${props.envelope.setup.base.tournamentId}`} {...props}/>;
}
function EnabledPanel({actorId,envelope,onEnvelopeChange,onConfirmed,contextForEvent,retained,transport}:Props){
 const tid=envelope.setup.base.tournamentId,[raw,setRaw]=useState(()=>{try{return retained.read();}catch{return'UNREADABLE';}}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const flight=useRef(false),mounted=useRef(true);useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const locked=pending(raw,actorId,tid),blocked=raw!==null&&!locked;
 const displayed=locked?.envelope??envelope;
 const [confirmed,setConfirmed]=useState<EventSettingsDraftSavedV3|null>(null);
 const refreshed=confirmed!==null&&isEventSettingsSetupV3(envelope,envelope.setup.base)&&envelope.setup.base.setupVersion>=confirmed.linked.result.version
  &&envelope.setup.request.idempotencyKey!==confirmed.envelope.setup.request.idempotencyKey&&envelope.setup.base.sourceDigest!==confirmed.envelope.setup.base.sourceDigest
  &&(envelope.setup.base.setupVersion>confirmed.linked.result.version||envelope.setup.base.setupRevisionId===confirmed.linked.result.revisionId);
 const awaitingSource=confirmed!==null&&!refreshed;
 async function confirm(result:unknown,savedRaw:string,request:EventSettingsSetupEnvelopeV3){
  const base=request.setup.base;
  if(!isEventSettingsDraftSavedV3(result,request,base)){if(mounted.current)setMessage(isEventSettingsRejectedV3(result)?'Request was rejected; the exact draft is retained for review.':isCustomQDraftRetryV2(result)?'Temporarily unavailable; retry the exact retained request.':'Outcome is unconfirmed. The exact request remains retained.');return;}
  const read=await transport.readback(result);
  if(!mounted.current)return;
  if(!object(read)||Reflect.ownKeys(read).length!==5||!['actorId','tid','operationId','envelope','ack'].every(k=>Object.hasOwn(read,k))||read.actorId!==actorId||read.tid!==tid||read.operationId!==request.setup.request.idempotencyKey
   ||serializeEventSettingsSetupV3(read.envelope,base)!==serializeEventSettingsSetupV3(request,base)||!isEventSettingsDraftSavedV3(read.ack,request,base)
   ||canonical(read.ack)!==canonical(result)){setMessage('Readback did not confirm the same request. Recovery remains retained.');return;}
  if(retained.read()!==savedRaw||!retained.clearIfMatches(savedRaw)){setMessage('Recovery changed during confirmation. Nothing was cleared.');return;}
  setRaw(null);setConfirmed(result);setMessage('Confirmed by the local transport and matching readback. No production persistence or payment is claimed.');
  try{onConfirmed?.(result);}catch{setMessage('Confirmed locally. Host refresh failed; new edits remain locked until a fresh source and operation arrive.');}
 }
 async function run(mode:'save'|'retry'|'reconcile'){
  if(flight.current||blocked||(mode==='save'&&awaitingSource))return;flight.current=true;setBusy(true);setMessage('');
  try{
   let savedRaw=raw,request:EventSettingsSetupEnvelopeV3;
   if(mode==='save'){
    savedRaw=serializeEventSettingsRecoveryV3({kind:'event-settings-recovery-v3',actorId,operationId:envelope.setup.request.idempotencyKey,envelope},envelope.setup.base);
    if(savedRaw===null){setMessage('The complete settings request is invalid.');return;}
    // Never overwrite recovery introduced by another actor/tab between render
    // and action. Host must additionally coordinate cross-document writers.
    if(retained.read()!==null){setMessage('Existing recovery must be reviewed first.');return;}
    retained.write(savedRaw);if(retained.read()!==savedRaw){setMessage('Recovery could not be verified. No request was sent.');return;}setRaw(savedRaw);request=pending(savedRaw,actorId,tid)!.envelope;
   }else{
    if(savedRaw===null||retained.read()!==savedRaw){setMessage('Recovery changed. Reload before continuing.');return;}
    const current=pending(savedRaw,actorId,tid);if(!current){setMessage('Recovery cannot be verified for this actor.');return;}request=current.envelope;
   }
   let result:unknown;
   if(mode==='reconcile'){
    const lookup=await transport.operationGET(request.setup.request.idempotencyKey),record=readEventSettingsOperationRecordV3(lookup,actorId,tid,request.setup.request.idempotencyKey,request);
    result=record?.outcome;
   }else result=await transport.save(request);
   if(mounted.current)await confirm(result,savedRaw,request);
  }catch{if(mounted.current){try{const existing=retained.read();if(existing!==null)setRaw(existing);}catch{setRaw('UNREADABLE');}setMessage('Connection or storage outcome is unknown. Keep the exact retained request.');}}
  finally{flight.current=false;if(mounted.current)setBusy(false);}
 }
 return<section className={styles.panel} aria-label="Local Settings Recovery Prototype">
  <h2>Local Settings Prototype</h2><p>LOCAL SIMULATED TRANSPORT — not a production API or proof of durable server storage. Root setup and historical declarations are unchanged.</p>
  {blocked?<p role="alert">Retained recovery is unavailable or belongs to a different actor/source. Nothing will be overwritten or cleared.</p>:displayed.eventSettings.map((choice,index)=>choice.mode==='configured'?<div key={choice.eventClientRowId}><EventPlayoffParametersEditor draft={choice.draft} disabled={busy||raw!==null||awaitingSource} context={contextForEvent(choice.eventClientRowId)} onDraftChange={draft=>onEnvelopeChange({...envelope,eventSettings:envelope.eventSettings.map((old,i)=>i===index?{...choice,draft}:old)})}/></div>:<p key={choice.eventClientRowId}>Historical settings are preserved.</p>)}
  {awaitingSource&&<p>Awaiting a fresh host source and a new operation ID before another edit or save.</p>}
  {raw===null&&!blocked?<button type="button" disabled={busy||awaitingSource} onClick={()=>void run('save')}>Save Local Settings</button>:locked?<div className={styles.actions}><p>The complete request is retained under its original actor and operation. Editing is locked.</p><button type="button" disabled={busy} onClick={()=>void run('retry')}>Retry Exact Request</button><button type="button" disabled={busy} onClick={()=>void run('reconcile')}>Check Operation</button></div>:null}
  <p role="status" aria-live="polite">{busy?'Checking local transport…':message}</p>
 </section>;
}
