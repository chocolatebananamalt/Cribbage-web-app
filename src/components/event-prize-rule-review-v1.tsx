"use client";
import {useCallback,useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {setAppRecoveryItem,assertRecoveryWriteAllowed} from '../lib/recovery-write-coordinator';
import {assertRecoveryStorageOwner} from '../lib/auth/recovery-owner';
import {readEventPrizeRuleContextWorkspaceV1,isEventPrizeRuleContextRequestV1,readEventPrizeRuleContextOperationV1,eventPrizeRuleContextPendingKeyV1,serializeEventPrizeRuleContextPendingV1,parseEventPrizeRuleContextPendingV1,inspectEventPrizeRuleContextReadbackV1,eventPrizeRuleContextReadyReviewsV1,type EventPrizeRuleContextReadyReviewsV1,type EventPrizeRuleContextPinsV1,type EventPrizeRuleContextWorkspaceV1,type EventPrizeRuleContextRowV1,type EventPrizeRuleContextRequestV1,type EventPrizeRuleContextPendingV1,type EventPrizeRuleContextOperationV1} from '../lib/api/event-prize-rule-context-v1';

type Props=EventPrizeRuleContextPinsV1&{actorId:string;tournamentId:string;onReady?:()=>void;onReadyChange?:(ready:boolean)=>void;onReadyReviews?:(reviews:EventPrizeRuleContextReadyReviewsV1|null)=>void};
type Form={sanctioned:''|'yes'|'no';duration:string;reason:string;reference:string};
const errorMessage='The current rule context could not be verified. Retained requests are unchanged.';
const samePins=(a:EventPrizeRuleContextPinsV1,b:EventPrizeRuleContextPinsV1)=>a.setupRevisionId===b.setupRevisionId&&a.setupVersion===b.setupVersion&&a.settingsSnapshotId===b.settingsSnapshotId&&a.settingsDigest===b.settingsDigest;
const fieldLabelStyle={display:'grid',gridTemplateColumns:'minmax(0,1fr)',alignItems:'initial',gap:'.4rem',minWidth:0,overflowWrap:'anywhere' as const};
const fieldControlStyle={width:'100%',maxWidth:'100%',minWidth:0};
/** Source-bound authoring only. Server validation still owns registration and
 * rules. No sanction status is inferred from tournament names or test labels. */
export function EventPrizeRuleReviewV1(props:Props){
 return <Connected key={`${props.actorId}:${props.tournamentId}:${props.setupRevisionId}:${props.setupVersion}:${props.settingsSnapshotId}:${props.settingsDigest}`} {...props}/>;
}
function Connected(props:Props){
 const {actorId,tournamentId,setupRevisionId,setupVersion,settingsSnapshotId,settingsDigest}=props,base=`/api/v1/tournaments/${tournamentId}/event-prize-settings/activation/context`;
 const owner=useMemo(()=>({actorId,tournamentId,setupRevisionId,setupVersion,settingsSnapshotId,settingsDigest}),[actorId,tournamentId,setupRevisionId,setupVersion,settingsSnapshotId,settingsDigest]);
 const active=useRef<typeof owner|null>(null),sequence=useRef(0),callbacks=useRef({onReady:props.onReady,onReadyChange:props.onReadyChange,onReadyReviews:props.onReadyReviews});
 const [workspace,setWorkspace]=useState<EventPrizeRuleContextWorkspaceV1|null>(null),[loading,setLoading]=useState(true),[message,setMessage]=useState('Loading saved rule-context sources.'),[blockedRows,setBlockedRows]=useState<Record<string,boolean>>({});
 useLayoutEffect(()=>{callbacks.current={onReady:props.onReady,onReadyChange:props.onReadyChange,onReadyReviews:props.onReadyReviews};},[props.onReady,props.onReadyChange,props.onReadyReviews]);
 useLayoutEffect(()=>{active.current=owner;callbacks.current.onReadyChange?.(false);callbacks.current.onReadyReviews?.(null);return()=>{if(active.current===owner)active.current=null;callbacks.current.onReadyChange?.(false);callbacks.current.onReadyReviews?.(null);};},[owner]);
 const refresh=useCallback(async()=>{
  const ticket=++sequence.current;setLoading(true);callbacks.current.onReadyChange?.(false);callbacks.current.onReadyReviews?.(null);
  try{
   assertRecoveryStorageOwner(actorId);
   const response=await fetch(base,{credentials:'same-origin',cache:'no-store',headers:{'x-expected-actor-id':actorId}}),value:unknown=await response.json();
   if(active.current!==owner||ticket!==sequence.current)return null;
   const w=response.ok?readEventPrizeRuleContextWorkspaceV1(value,actorId,tournamentId,owner):null;
   if(!w){setWorkspace(null);setMessage(errorMessage);return null;}
   assertRecoveryStorageOwner(actorId);setWorkspace(w);setMessage(w.allCurrentEligible?'Current saved reviews satisfy the supported registration rule checks.':'Complete and save an explicit rule-context review for each event.');return w;
  }catch{if(active.current===owner&&ticket===sequence.current){setWorkspace(null);setMessage(errorMessage);}return null;}
  finally{if(active.current===owner&&ticket===sequence.current)setLoading(false);}
 },[actorId,tournamentId,base,owner]);
 useEffect(()=>{void Promise.resolve().then(()=>{if(active.current===owner)return refresh();});},[refresh,owner]);
 const rowStatus=useCallback((rowId:string,blocked:boolean)=>{if(active.current!==owner)return;if(blocked){callbacks.current.onReadyChange?.(false);callbacks.current.onReadyReviews?.(null);}setBlockedRows(old=>old[rowId]===blocked?old:{...old,[rowId]:blocked});},[owner]);
 const ready=!!workspace&&!loading&&workspace.allCurrentEligible&&workspace.rows.every(r=>blockedRows[r.eventClientRowId]===false);
 const priorReady=useRef(false);
 useEffect(()=>{callbacks.current.onReadyChange?.(ready);callbacks.current.onReadyReviews?.(ready&&workspace?eventPrizeRuleContextReadyReviewsV1(workspace,actorId,tournamentId):null);if(ready&&!priorReady.current)callbacks.current.onReady?.();priorReady.current=ready;},[ready,workspace,actorId,tournamentId]);
 return <section aria-label="Playoff Rule Context" aria-busy={loading} style={{minWidth:0}}>
  <h3>Review Playoff Rule Context</h3>
  <p>Choose the event’s actual sanctioning status and duration. A reference records supporting evidence; it does not establish external approval or waive a rule. These reviews do not calculate prizes or make payments.</p>
  <p role="status" aria-live="polite">{message}</p>
  <button type="button" disabled={loading} onClick={()=>void refresh()}>Refresh Rule Reviews</button>
  {workspace?.rows.map(row=><RuleRow key={row.eventClientRowId} actorId={actorId} tournamentId={tournamentId} pins={props} row={row} base={base} disabled={loading} refresh={refresh} onStatus={rowStatus}/>)}
 </section>;
}
function initialForm(row:EventPrizeRuleContextRowV1):Form{
 const r=row.review;return r.state==='present'?{sanctioned:r.context.sanctioned?'yes':'no',duration:String(r.context.durationDays),reason:r.reason,reference:r.approvalReference}:{sanctioned:'',duration:'',reason:'',reference:''};
}
function RuleRow({actorId,tournamentId,pins,row,base,disabled,refresh,onStatus}:{actorId:string;tournamentId:string;pins:EventPrizeRuleContextPinsV1;row:EventPrizeRuleContextRowV1;base:string;disabled:boolean;refresh:()=>Promise<EventPrizeRuleContextWorkspaceV1|null>;onStatus:(rowId:string,blocked:boolean)=>void}){
 const labelId=useId(),storageKey=eventPrizeRuleContextPendingKeyV1(actorId,tournamentId,row.eventClientRowId);
 const owner=useMemo(()=>({actorId,tournamentId,rowId:row.eventClientRowId,setupRevisionId:pins.setupRevisionId,setupVersion:pins.setupVersion,settingsSnapshotId:pins.settingsSnapshotId,settingsDigest:pins.settingsDigest}),[actorId,tournamentId,row.eventClientRowId,pins.setupRevisionId,pins.setupVersion,pins.settingsSnapshotId,pins.settingsDigest]);
 const active=useRef<typeof owner|null>(null),inFlight=useRef(false),pendingRaw=useRef<string|null>(null);
 const [form,setForm]=useState<Form>(()=>initialForm(row)),[formReviewId,setFormReviewId]=useState<string|null>(()=>row.review.state==='present'?row.review.reviewId:null),[dirty,setDirty]=useState(false),[loaded,setLoaded]=useState(false),[corrupt,setCorrupt]=useState(false),[pending,setPending]=useState<EventPrizeRuleContextPendingV1|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmed,setConfirmed]=useState<{operation:EventPrizeRuleContextOperationV1;fresh:EventPrizeRuleContextWorkspaceV1}|null>(null);
 useLayoutEffect(()=>{active.current=owner;return()=>{if(active.current===owner)active.current=null;};},[owner]);
 useEffect(()=>{queueMicrotask(()=>{
  if(active.current!==owner)return;
  try{assertRecoveryStorageOwner(actorId);const raw=sessionStorage.getItem(storageKey);pendingRaw.current=raw;if(raw!==null){const retained=parseEventPrizeRuleContextPendingV1(raw,actorId,tournamentId,row.eventClientRowId);if(retained){setPending(retained);setForm({sanctioned:retained.request.context.sanctioned?'yes':'no',duration:String(retained.request.context.durationDays),reason:retained.request.reason,reference:retained.request.approvalReference});setMessage('A retained review request needs its exact server outcome checked.');}else{setCorrupt(true);setMessage('Retained review data is unrecognized. Keep it intact for recovery.');}}}
  catch{setCorrupt(true);setMessage('Recovery storage or account ownership is unavailable. No request was sent.');}
  setLoaded(true);
 });},[actorId,tournamentId,row.eventClientRowId,storageKey,owner]);
 const blocked=!loaded||corrupt||dirty||!!pending||busy||disabled;
 useLayoutEffect(()=>{onStatus(row.eventClientRowId,blocked);},[onStatus,row.eventClientRowId,blocked]);
 const latestReviewId=row.review.state==='present'?row.review.reviewId:null;
 // A clean display is derived synchronously from the actual refreshed row.
 // Dirty or retained request values keep their own original review baseline.
 const shownForm=!dirty&&!pending&&!busy?initialForm(row):form;
 const dirtySourceChanged=dirty&&formReviewId!==latestReviewId;
 function edit(change:Partial<Form>){if(disabled||pending||busy||corrupt)return;onStatus(row.eventClientRowId,true);if(!dirty)setFormReviewId(latestReviewId);setDirty(true);setConfirmed(null);setForm({...shownForm,...change});}
 const validDuration=/^[1-9][0-9]*$/.test(shownForm.duration)&&Number(shownForm.duration)<=2147483647;
 const makeRequest=():EventPrizeRuleContextRequestV1|null=>{
  if(shownForm.sanctioned===''||!validDuration||dirtySourceChanged)return null;
  const v={kind:'event-rule-context-v1',operationId:globalThis.crypto.randomUUID(),expectedReviewId:dirty?formReviewId:latestReviewId,setupRevisionId:pins.setupRevisionId,settingsSnapshotId:pins.settingsSnapshotId,eventClientRowId:row.eventClientRowId,context:{sanctioned:shownForm.sanctioned==='yes',eventKind:row.eventKind,durationDays:Number(shownForm.duration),originalEntrants:null},reason:shownForm.reason,approvalReference:shownForm.reference,confirmed:true};return isEventPrizeRuleContextRequestV1(v)?v:null;
 };
 const canSubmit=loaded&&!corrupt&&!disabled&&!busy&&!pending&&!dirtySourceChanged&&shownForm.sanctioned!==''&&validDuration&&shownForm.reason.trim().length>0&&shownForm.reason===shownForm.reason.trim()&&!/[\u0000-\u001f\u007f]/.test(shownForm.reason);
 const current=(raw:string)=>{try{return active.current===owner&&pendingRaw.current===raw&&sessionStorage.getItem(storageKey)===raw;}catch{return false;}};
 function clearVerified(retained:EventPrizeRuleContextPendingV1,raw:string,operation:EventPrizeRuleContextOperationV1,fresh:EventPrizeRuleContextWorkspaceV1,explicit:boolean){
  if(!current(raw)||!samePins(fresh,pins))return false;assertRecoveryStorageOwner(actorId);assertRecoveryWriteAllowed();
  const view=inspectEventPrizeRuleContextReadbackV1(retained,operation,fresh);if(!view.canClear||(view.requiresExplicitResolution&&!explicit))return false;
  // Exact compare immediately before synchronous cleanup; no await separates
  // account/source/operation checks from removal of this one app-owned key.
  if(!current(raw))return false;sessionStorage.removeItem(storageKey);if(sessionStorage.getItem(storageKey)!==null)return false;
  pendingRaw.current=null;setPending(null);setConfirmed(null);setDirty(false);const next=fresh.rows.find(r=>r.eventClientRowId===row.eventClientRowId);if(next)setForm(initialForm(next));setMessage(view.status==='verified_current'?'Saved review verified against current source.':'The confirmed historical request is resolved. Review the current event context before finalization.');return true;
 }
 async function run(retained:EventPrizeRuleContextPendingV1,raw:string,check:boolean){
  if(inFlight.current||!current(raw))return;inFlight.current=true;setBusy(true);onStatus(row.eventClientRowId,true);setConfirmed(null);
  try{
   assertRecoveryStorageOwner(actorId);assertRecoveryWriteAllowed();
   const response=await fetch(check?base+'/reconcile':base,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','x-expected-actor-id':actorId},body:JSON.stringify(retained.request)}),body:unknown=await response.json();
   if(!current(raw))return;assertRecoveryStorageOwner(actorId);
   const operation=readEventPrizeRuleContextOperationV1(body,actorId,tournamentId,retained.request);
   if(!operation){setMessage('The exact outcome remains unknown. Keep this request; check it or retry the same request.');return;}
   const fresh=await refresh();if(!current(raw)||!fresh)return;
   const view=inspectEventPrizeRuleContextReadbackV1(retained,operation,fresh);if(!view.canClear){setMessage('The journal and current readback could not be matched. Retained work is unchanged.');return;}
   if(view.requiresExplicitResolution){setConfirmed({operation,fresh});setMessage(operation.result.status==='rejected'?'The server journal confirms rejection. Resolve this confirmed request before preparing another review.':'The server confirms this historical review. Resolve it explicitly, then review current context.');}
   else clearVerified(retained,raw,operation,fresh,false);
  }catch{if(active.current===owner)setMessage('Outcome or readback is unavailable. The exact pending request is retained.');}
  finally{inFlight.current=false;if(active.current===owner)setBusy(false);}
 }
 function save(){
  if(!canSubmit||inFlight.current)return;const request=makeRequest();if(!request)return;
  const retained:EventPrizeRuleContextPendingV1={kind:'event-prize-rule-context-pending-v1',actorId,tournamentId,eventClientRowId:row.eventClientRowId,setupRevisionId:pins.setupRevisionId,setupVersion:pins.setupVersion,settingsSnapshotId:pins.settingsSnapshotId,settingsDigest:pins.settingsDigest,request},raw=serializeEventPrizeRuleContextPendingV1(retained);if(raw===null)return;
  try{assertRecoveryStorageOwner(actorId);if(sessionStorage.getItem(storageKey)!==null){setMessage('A retained request already exists. Reload and recover it before saving.');setCorrupt(true);return;}setAppRecoveryItem(sessionStorage,storageKey,raw);assertRecoveryStorageOwner(actorId);if(sessionStorage.getItem(storageKey)!==raw)throw Error('storage');pendingRaw.current=raw;setForm({sanctioned:request.context.sanctioned?'yes':'no',duration:String(request.context.durationDays),reason:request.reason,reference:request.approvalReference});setFormReviewId(request.expectedReviewId);setPending(retained);setDirty(false);onStatus(row.eventClientRowId,true);void run(retained,raw,false);}
  catch{setCorrupt(true);setMessage('The request could not be retained safely. No new request was sent.');}
 }
 async function resolveConfirmed(){
  const raw=pendingRaw.current;if(!pending||!raw||!confirmed||inFlight.current)return;inFlight.current=true;setBusy(true);
  try{const fresh=await refresh();if(fresh&&current(raw))clearVerified(pending,raw,confirmed.operation,fresh,true);}
  catch{if(active.current===owner)setMessage(errorMessage);}finally{inFlight.current=false;if(active.current===owner)setBusy(false);}
 }
 const review=row.review;
 return <fieldset disabled={disabled||busy||corrupt||!loaded} style={{minWidth:0,marginTop:'1rem',gridTemplateColumns:'minmax(0,1fr)'}}>
  <legend>{row.displayName} — Rule Context</legend>
  <p>{review.state==='present'?(review.current?(review.eligible?'Saved Current Review':'Current Review Needs Rule Resolution'):'Earlier Review Requires Renewal'):'No saved review exists for this event.'}</p>
  {review.state==='present'&&review.deferredOriginalField&&<p>Original entrant count still needs verification before playoffs. Registration review does not waive that check.</p>}
  <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:'.75rem',minWidth:0}}>
   <label style={fieldLabelStyle} htmlFor={`${labelId}-sanctioned`}>ACC-Sanctioned Event (Required)<select style={fieldControlStyle} id={`${labelId}-sanctioned`} required disabled={!!pending} value={shownForm.sanctioned} onChange={e=>edit({sanctioned:e.target.value as Form['sanctioned']})}><option value="">Choose Yes or No</option><option value="yes">Yes</option><option value="no">No</option></select></label>
   <label style={fieldLabelStyle} htmlFor={`${labelId}-duration`}>Event Duration in Days (Required)<input style={fieldControlStyle} id={`${labelId}-duration`} required inputMode="numeric" pattern="[1-9][0-9]*" maxLength={10} disabled={!!pending} value={shownForm.duration} onChange={e=>edit({duration:e.target.value})}/></label>
   <label style={fieldLabelStyle} htmlFor={`${labelId}-reason`}>Reason for This Review (Required)<textarea style={fieldControlStyle} id={`${labelId}-reason`} required maxLength={500} disabled={!!pending} value={shownForm.reason} onChange={e=>edit({reason:e.target.value})}/></label>
   <label style={fieldLabelStyle} htmlFor={`${labelId}-reference`}>Supporting Reference (Optional)<textarea style={fieldControlStyle} id={`${labelId}-reference`} maxLength={1000} disabled={!!pending} value={shownForm.reference} onChange={e=>edit({reference:e.target.value})}/><span>A reference is evidence to review; it is not proof of external ACC approval.</span></label>
  </div>
  <p role="status" aria-live="polite">{message}</p>
  {dirtySourceChanged&&!pending&&<div><p role="status">The saved review changed after these edits began. Your typed values are retained. Load the latest saved review before preparing another request.</p><button type="button" onClick={()=>{setForm(initialForm(row));setFormReviewId(latestReviewId);setDirty(false);setConfirmed(null);}}>Use Latest Saved Review</button></div>}
  {!pending&&<button type="button" disabled={!canSubmit} onClick={save}>Save Rule Context</button>}
  {pending&&<div><button type="button" onClick={()=>{const raw=pendingRaw.current;if(raw)void run(pending,raw,true);}}>Check This Review</button><button type="button" onClick={()=>{const raw=pendingRaw.current;if(raw)void run(pending,raw,false);}}>Retry the Same Review</button>{confirmed&&<button type="button" onClick={()=>void resolveConfirmed()}>Resolve Confirmed Request</button>}</div>}
 </fieldset>;
}
