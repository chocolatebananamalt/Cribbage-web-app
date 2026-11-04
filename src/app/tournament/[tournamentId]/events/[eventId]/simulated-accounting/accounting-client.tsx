"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {setAppRecoveryItem} from '../../../../../../lib/recovery-write-coordinator';
import {isAccountingAction,acceptedAccountingAction,type AccountingAction} from '../../../../../../lib/api/multi-event-accounting-action';
import {isAccountingWorkspace,type AccountingWorkspace} from '../../../../../../lib/api/multi-event-accounting-workspace';
type Pending={version:1;action:AccountingAction;conflict:boolean};
function retained(v:unknown,eid:string):v is Pending {if(!v||typeof v!=='object'||Array.isArray(v))return false;const p=v as Record<string,unknown>;return Object.keys(p).length===3&&p.version===1&&typeof p.conflict==='boolean'&&isAccountingAction(p.action)&&(p.action.action==='finalize'||p.action.eventId===eid);}
export default function AccountingClient({actorId,tournamentId,eventId,previewDigest}:{actorId:string;tournamentId:string;eventId:string;previewDigest:string}){
 const endpoint=`/api/v1/tournaments/${tournamentId}/simulation-accounting`,key=`payment-operation:${actorId}:${tournamentId}:${eventId}:multi-event-accounting`;
 const conflictKey=`${key}:blocked`;
 const [workspace,setWorkspace]=useState<AccountingWorkspace|null>(null),[pending,setPending]=useState<Pending|null>(null),[busy,setBusy]=useState(true),[blocked,setBlocked]=useState(false),[message,setMessage]=useState('Loading simulated accounting.'),[reason,setReason]=useState(''),[reviewed,setReviewed]=useState(false);
 const raw=useRef<string|null>(null),flight=useRef(false);
 const load=useCallback(async()=>{const response=await fetch(`${endpoint}?eventId=${eventId}`,{credentials:'same-origin',cache:'no-store'});const data:unknown=response.ok?await response.json():null;if(!isAccountingWorkspace(data,tournamentId,eventId))throw Error('workspace');return data;},[endpoint,eventId,tournamentId]);
 useEffect(()=>{let active=true;void Promise.resolve().then(async()=>{try{const saved=sessionStorage.getItem(key);raw.current=saved;let p:Pending|null=null;if(saved){let value:unknown;try{value=JSON.parse(saved);}catch{value=null;}if(!retained(value,eventId))throw Error('recovery');p=value;}const marker=sessionStorage.getItem(conflictKey);if(marker!==null&&(!p||marker!==p.action.operationId))throw Error('conflict marker');const conflicted=!!p&&(p.conflict||marker!==null);const w=await load();if(active){setWorkspace(w);setPending(p);setBlocked(conflicted);setMessage(p?(conflicted?'The retained action conflicted. Keep it intact for reconciliation; do not send another action.':'An exact accounting action is retained. Retry it to reconcile the outcome.'):'');}}catch{if(active){setBlocked(true);setMessage('Accounting or recovery could not be verified. Existing records and pending work are preserved.');}}finally{if(active)setBusy(false);}});return()=>{active=false;};},[conflictKey,eventId,key,load]);
 async function send(action:AccountingAction){
  if(flight.current||busy||blocked)return;flight.current=true;setBusy(true);
  try{
   if(sessionStorage.getItem(key)!==raw.current||sessionStorage.getItem(conflictKey)!==null){setBlocked(true);setMessage('Saved work changed. The newer record is preserved. Reload before continuing.');return;}
   if(!pending){const next:Pending={version:1,action,conflict:false},text=JSON.stringify(next);setAppRecoveryItem(sessionStorage,key,text);if(sessionStorage.getItem(key)!==text)throw Error('storage');raw.current=text;setPending(next);}
   const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(action)});const result:unknown=await response.json().catch(()=>null);
   if(sessionStorage.getItem(key)!==raw.current||sessionStorage.getItem(conflictKey)!==null){setBlocked(true);setMessage('Saved work changed while waiting. The newer record is preserved.');return;}
   if(acceptedAccountingAction(result,action,tournamentId)){
    sessionStorage.removeItem(key);if(sessionStorage.getItem(key)!==null){setBlocked(true);setMessage('The record is saved, but recovery cleanup could not be verified. Reload without clearing data.');return;}raw.current=null;setPending(null);setBlocked(true);
    const next=await load();const matches=action.action==='crosscheck'?next.closureDigest===action.request.sourceDigest:action.action==='draft'?next.draftVersion===Number(action.request.expectedVersion)+1&&next.draftSourceDigest===action.request.sourceDigest:next.final?.jointDigest===action.request.jointDigest;
    if(!matches){setMessage('The response was saved, but its current readback could not be verified. Reload before continuing.');return;}
    setWorkspace(next);setBlocked(false);setReviewed(false);setMessage(action.action==='finalize'?'Simulated accounting is saved as UNPAID. No money moved.':'Simulated accounting record saved. No money moved.');
   }else if(response.status===409&&result&&typeof result==='object'&&!Array.isArray(result)&&(result as Record<string,unknown>).status==='rejected'){
    setBlocked(true);setAppRecoveryItem(sessionStorage,conflictKey,action.operationId);if(sessionStorage.getItem(conflictKey)!==action.operationId)throw Error('conflict marker');setMessage('The retained action conflicted. Keep it intact for reconciliation; do not send another action.');
   }else setMessage('The outcome is uncertain. Keep and retry this exact accounting action when connected.');
  }catch{if(raw.current===null)setBlocked(true);setMessage('The outcome or recovery could not be confirmed. Keep pending work intact; reload before continuing if no retry is shown.');}
  finally{flight.current=false;setBusy(false);}
 }
 function start(action:AccountingAction['action']){
  if(!workspace||busy||blocked||pending||workspace.final||!reviewed||!reason.trim())return;
  const common={reason:`TEST ONLY SYNTHETIC: ${reason.trim()}`,reviewed:true as const};let value:unknown;
  if(action==='crosscheck'&&workspace.readiness.ready&&!workspace.closureDigest)value={action,eventId,operationId:crypto.randomUUID(),request:{...common,sourceDigest:workspace.readiness.sourceDigest}};
  if(action==='draft'&&workspace.closureDigest)value={action,eventId,operationId:crypto.randomUUID(),request:{...common,sourceDigest:previewDigest,expectedVersion:workspace.draftVersion}};
  if(action==='finalize'&&workspace.joint.ready&&workspace.draftSourceDigest===previewDigest)value={action,operationId:crypto.randomUUID(),request:{...common,jointDigest:workspace.joint.jointDigest}};
  if(isAccountingAction(value))void send(value);
 }
 const locked=busy||blocked||!!pending||!!workspace?.final||!reviewed||!reason.trim();
 const reviewEvents=workspace?.final?.events??workspace?.joint.events??[];
 const money=(n:number)=>`$${(n/100).toFixed(2)}`;
 return <section aria-labelledby="simulated-accounting-actions"><h2 id="simulated-accounting-actions">Record simulated unpaid accounting</h2><p>One operator reviews generated test evidence. No independent human review, physical play, cash received or payment is claimed.</p>
  {reviewEvents.length>0&&<section aria-label={workspace?.final?'Saved unpaid event totals':'Review all event totals'}><h3>{workspace?.final?'Saved unpaid event totals':'Review all event totals'}</h3>{reviewEvents.map(event=><section key={event.eventId}><h4>{event.name}</h4><p>Base entries {money(event.baseMinor)}; expenses {money(event.expenseMinor)}; regular awards {money(event.regularMinor)}; Q Pool awards {money(event.qMinor)}; Side Pool awards {money(event.sideMinor)}; restricted remainder {money(event.restrictedMinor)}.</p><a href={`/tournament/${tournamentId}/events/${event.eventId}/simulated-accounting`}>Review {event.name} awards</a></section>)}</section>}
  {workspace?.final?<p><strong>UNPAID simulation saved</strong> for {workspace.final.eventCount} events. Recorded {workspace.final.recordedAt}. No money moved.</p>:<><label>Reason for this simulated review<input maxLength={470} value={reason} disabled={busy||!!pending||blocked} onChange={e=>{setReason(e.target.value);setReviewed(false);}}/></label><label><input type="checkbox" checked={reviewed} disabled={busy||!!pending||blocked} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the fictional awards and sources. No independent human review or money movement is claimed.</label>
   <p>Complete the event cross-check and unpaid draft for each event before closing all event finances together.</p><button type="button" disabled={locked||!workspace?.readiness.ready||!!workspace.closureDigest} onClick={()=>start('crosscheck')}>Record simulated event cross-check</button><button type="button" disabled={locked||!workspace?.closureDigest||workspace.draftSourceDigest===previewDigest||workspace.draftVersion>=256} onClick={()=>start('draft')}>Save simulated unpaid event draft</button><button type="button" disabled={locked||!workspace?.joint.ready||workspace.draftSourceDigest!==previewDigest} onClick={()=>start('finalize')}>Finalize all simulated finances as unpaid</button>{workspace?.joint.ready&&workspace.draftSourceDigest!==previewDigest&&<p>These awards changed. Reload and review the current preview before finalizing.</p>}{workspace&&!workspace.joint.ready&&<p>All events need current results, reviewed sources, cross-check and unpaid drafts before joint closure.</p>}</>}
  <p role="status">{message}</p>{pending&&<button type="button" disabled={busy||blocked||pending.conflict} onClick={()=>void send(pending.action)}>Retry exact saved accounting action</button>}
 </section>;
}
