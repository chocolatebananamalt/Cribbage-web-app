"use client";
import {useEffect,useRef,useState} from 'react';
import {setAppRecoveryItem} from '../../../../lib/recovery-write-coordinator';
import {isUuid} from '../../../../lib/api/validation';
import {isEventPrizeDeclarationRequest,isEventPrizeDeclarationWorkspace,isEventPrizeDeclarationSaved,isEventPrizeDeclarationRejected,type EventPrizeDeclarationRequest,type EventPrizeDeclarationWorkspace} from '../../../../lib/api/event-prize-declaration';
import {buildSetupPrizeScheduleV3} from '../../../../lib/results/prize-schedule-setup';
import './event-prize-declaration.css';
type Pending={kind:'event-prize-declaration-v2';operationId:string;request:EventPrizeDeclarationRequest};
function retained(value:unknown):value is Pending {if(!value||typeof value!=='object'||Array.isArray(value))return false;const v=value as Record<string,unknown>;return Object.keys(v).length===3&&v.kind==='event-prize-declaration-v2'&&isUuid(v.operationId)&&isEventPrizeDeclarationRequest(v.request);}
export default function EventPrizeDeclarationClient({actorId,tournamentId,clientRowId,eventName,disabled=false,onDraftChange}:{actorId:string;tournamentId:string;clientRowId:string;eventName:string;disabled?:boolean;onDraftChange?:(dirty:boolean)=>void}){
 const endpoint=`/api/v1/tournaments/${tournamentId}/setup/event-prize-declarations/${clientRowId}`;
 const key=`prize-schedule:${actorId}:${tournamentId}:${clientRowId}:v2`;
 const conflictKey=`${key}:blocked`;
 const [workspace,setWorkspace]=useState<EventPrizeDeclarationWorkspace|null>(null),[pending,setPending]=useState<Pending|null>(null),[busy,setBusy]=useState(true),[blocked,setBlocked]=useState(false),[message,setMessage]=useState('Loading this event’s prize declaration.');
 const [count,setCount]=useState<4|5>(4),[weights,setWeights]=useState(['','','']),[source,setSource]=useState(''),[reason,setReason]=useState(''),[reviewed,setReviewed]=useState(false);
 const raw=useRef<string|null>(null),flight=useRef(false);
 useEffect(()=>{let active=true;async function load(){
  try{
   const saved=sessionStorage.getItem(key);raw.current=saved;
   const conflict=sessionStorage.getItem(conflictKey);let p:Pending|null=null;if(saved){let parsed:unknown;try{parsed=JSON.parse(saved);}catch{parsed=null;}if(!retained(parsed)){if(active){setBlocked(true);setMessage('An unrecognized retained declaration must be resolved before saving.');}return;}p=parsed;}
   if(conflict!==null){if(active){setPending(p);setBlocked(true);setMessage(p?'A declaration conflict remains unresolved. The original request is retained; do not retry it blindly.':'A declaration conflict marker has no matching request. Keep saved work intact and seek recovery.');}return;}
   const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store'}),data:unknown=response.ok?await response.json():null;
   if(!active)return;if(!isEventPrizeDeclarationWorkspace(data,tournamentId,clientRowId)){setBlocked(true);setMessage('This event’s declaration facts are unavailable. Nothing was saved.');return;}
   setWorkspace(data);setPending(p);const schedule=p?.request.schedule??data.schedule;
   if(schedule){setCount(schedule.expectedQualifierCount);setWeights(schedule.cohorts.map(c=>String(c.weight)));setSource(schedule.sourceReference);}
   if(p){setReason(p.request.reason);setReviewed(true);setMessage('An exact declaration request is retained. Retry it once connected; do not create another.');}
   else setMessage(data.settingsCurrent?'This event’s prize formula is saved.':'Choose and review this event’s prize formula.');
  }catch{if(active){setBlocked(true);setMessage('Recovery or declaration facts are unavailable. Keep pending work intact.');}}
  finally{if(active)setBusy(false);}
 }void load();return()=>{active=false;};},[endpoint,key,conflictKey,tournamentId,clientRowId]);
 async function save(){
  if(flight.current||busy||blocked||(!pending&&(disabled||!workspace?.supported)))return;
  onDraftChange?.(true);
  const schedule=buildSetupPrizeScheduleV3(count,weights,source.trim());
  const request:unknown=pending?.request??{expectedVersion:workspace?.currentVersion,expectedSettingsFingerprint:workspace?.settingsFingerprint,schedule,reason:reason.trim(),reviewed};
  if(!isEventPrizeDeclarationRequest(request)){setMessage('Enter positive whole weights, a source and reason, then confirm review.');return;}
  const operation=pending??{kind:'event-prize-declaration-v2' as const,operationId:crypto.randomUUID(),request};
  flight.current=true;setBusy(true);
  try{
   if(sessionStorage.getItem(key)!==raw.current){setBlocked(true);setMessage('Another request changed recovery storage. It was preserved.');return;}
   if(!pending){const text=JSON.stringify(operation);setAppRecoveryItem(sessionStorage,key,text);if(sessionStorage.getItem(key)!==text){setBlocked(true);setMessage('Recovery could not be verified. Nothing was sent; keep this tab open.');return;}raw.current=text;setPending(operation);}
   const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','x-idempotency-key':operation.operationId},body:JSON.stringify(operation.request)});
   const data:unknown=await response.json().catch(()=>null);
   if(sessionStorage.getItem(key)!==raw.current){setBlocked(true);setMessage('Recovery changed while saving. The newer record remains intact.');return;}
   if(isEventPrizeDeclarationSaved(data,tournamentId,clientRowId,operation.request)){
    // Accepted server response is exact operation evidence; local cleanup must succeed.
    sessionStorage.removeItem(key);if(sessionStorage.getItem(key)!==null){setBlocked(true);setMessage('The declaration is saved, but recovery cleanup could not be confirmed. The exact request remains retained. Reload before continuing.');return;}raw.current=null;setPending(null);setBlocked(true);onDraftChange?.(false);
    setMessage('This event’s prize declaration is saved. Reload to read its current version. Financial accounting is not finalized.');
   }else if(isEventPrizeDeclarationRejected(data)&&data.code==='idempotency_conflict'){
    setBlocked(true);try{const marker=JSON.stringify({actorId,tournamentId,clientRowId,operationId:operation.operationId});setAppRecoveryItem(sessionStorage,conflictKey,marker);if(sessionStorage.getItem(conflictKey)!==marker)throw new Error('conflict_write_unconfirmed');setMessage('A declaration conflict remains unresolved. The original request is retained; do not retry it blindly.');}catch{setMessage('A declaration conflict occurred. The original request is retained, but its warning could not be saved; keep this tab open.');}
   }else if(isEventPrizeDeclarationRejected(data)){
    sessionStorage.removeItem(key);if(sessionStorage.getItem(key)!==null){setBlocked(true);setMessage('The declaration was rejected, but recovery cleanup could not be confirmed. The exact request remains retained. Reload before continuing.');return;}raw.current=null;setPending(null);setBlocked(true);
    setMessage(data.code==='stale_settings'||data.code==='stale_version'?'This event changed before saving. Reload and review its current terms.':'The declaration was rejected. Reload to review current eligibility and terms.');
   }else setMessage('The save outcome is uncertain. Keep this exact request and retry when connected.');
  }catch{setMessage('The save could not be confirmed. Keep this exact request and retry when connected.');}
  finally{flight.current=false;setBusy(false);}
 }
 const locked=disabled||busy||blocked||!!pending||!workspace?.supported;
 return <section className="setup-subsection event-prize-declaration" aria-label={`${eventName} prize declaration`}><h3>{eventName}: regular prize declaration</h3>
  <p>Each event has its own formula. Q and Side Pool contributions remain separate. This declaration does not record receipts, assign results or finalize accounting.</p>
  <fieldset disabled={locked}><legend>Director-selected formula</legend>
   <label>Expected playoff qualifiers<select value={count} onChange={e=>{onDraftChange?.(true);const n=Number(e.target.value) as 4|5;setCount(n);setWeights(n===5?[...weights.slice(0,3),weights[3]??'']:weights.slice(0,3));setReviewed(false);}}><option value={4}>4 qualifiers</option><option value={5}>5 qualifiers</option></select></label>
   {(count===5?['1st place weight','2nd place weight','3rd-4th per-person weight','5th place weight']:['1st place weight','2nd place weight','3rd-4th per-person weight']).map((label,i)=><label key={label}>{label}<input type="number" min="1" step="1" value={weights[i]} onChange={e=>{onDraftChange?.(true);setWeights(weights.map((v,j)=>j===i?e.target.value:v));setReviewed(false);}}/></label>)}
   <label>Schedule source reference<input value={source} maxLength={500} onChange={e=>{onDraftChange?.(true);setSource(e.target.value);setReviewed(false);}}/></label>
   <label>Reason for schedule<input value={reason} maxLength={500} onChange={e=>{onDraftChange?.(true);setReason(e.target.value);}}/></label>
   <label className="event-prize-review"><input type="checkbox" checked={reviewed} onChange={e=>{onDraftChange?.(true);setReviewed(e.target.checked);}}/>I reviewed this event&apos;s formula and source</label>
  </fieldset>
  <p role="status">{message}</p><button type="button" className="primary" disabled={busy||blocked||(!pending&&(disabled||!workspace?.supported))} onClick={()=>void save()}>{pending?'Retry exact event declaration':'Save event prize declaration'}</button>
  <p>Multi-event financial accounting remains unavailable until event allocations, pool consent and supported playoff results are integrated. Registration finalization remains blocked for this incomplete path.</p>
 </section>;
}
