'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore,useId,useCallback} from 'react';
import {createClient} from '../lib/supabase/client';
import {createIndexedFinanceDraftRetainedV1,type FinanceDraftRetainedPortV1} from '../lib/finance/event-finance-draft-retained-v1';
import {SatelliteFinanceControllerV1,createSatelliteFinanceHttpV1,type SatelliteFinancePortV1} from '../lib/finance/satellite-finance-controller-v1';
import {isSatelliteFinanceScopeV1,prepareSatelliteFinanceAttemptV1,type SatelliteFinanceScopeV1} from '../lib/finance/satellite-finance-contract-v1';
import {formatUsd,formatUsdInput} from '../lib/money';
import {SatelliteFundReviewV1} from './satellite-fund-review-v1';
import styles from './satellite-finance-authoring-v1.module.css';
type Props={scope:SatelliteFinanceScopeV1;eventName:string;role:string;enabled?:boolean;writesVerified?:boolean;storage?:FinanceDraftRetainedPortV1;port?:SatelliteFinancePortV1;makeId?:()=>string;subscribeIdentity?:(f:()=>void)=>()=>void};
const empty={active:false,busy:false,blocked:false,workspace:null,pending:null,message:''};
function makeLifetime(){let live=false,writes=false;return{enabled:()=>live,writes:()=>writes,setEnabled:(value:boolean)=>{live=value;},setWrites:(value:boolean)=>{writes=value;}};}
export function SatelliteFinanceAuthoringV1(p:Props){
 if(p.enabled!==true||p.role!=='director'||!isSatelliteFinanceScopeV1(p.scope))return null;
 return <OwnedSatelliteFinanceV1 key={`${p.scope.actorId}:${p.scope.tournamentId}:${p.scope.eventId}`} {...p}/>;
}
function OwnedSatelliteFinanceV1(p:Props){
 const own=p.enabled===true&&p.role==='director'&&isSatelliteFinanceScopeV1(p.scope),runtime=useMemo(()=>makeLifetime(),[]);
 const actor=p.scope.actorId,tid=p.scope.tournamentId,eid=p.scope.eventId;
 const controller=useMemo(()=>own?new SatelliteFinanceControllerV1({actorId:actor,tournamentId:tid,eventId:eid},p.storage??createIndexedFinanceDraftRetainedV1(),p.port??createSatelliteFinanceHttpV1({actorId:actor,tournamentId:tid,eventId:eid},{enabled:runtime.enabled})):null,[own,actor,tid,eid,p.storage,p.port,runtime]);
 const state=useSyncExternalStore(controller?.subscribe??(()=>()=>{}),controller?.getSnapshot??(()=>empty),controller?.getSnapshot??(()=>empty));
 const [mode,setMode]=useState<'add'|'correct'|'void'|'review'>('add'),[incomeId,setIncomeId]=useState<string|null>(null),[label,setLabel]=useState(''),[amount,setAmount]=useState(''),[reference,setReference]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[retireConfirmed,setRetireConfirmed]=useState(false);const prefix=useId();
 const [confirmedFor,setConfirmedFor]=useState<typeof state.workspace>(null),[retireFor,setRetireFor]=useState<typeof state.pending>(null);
 const region=useRef<HTMLDivElement|null>(null),leaseRef=useRef<object|null>(null),mounted=useRef(false);const [intentVersion,bumpIntent]=useState(0),[formError,setFormError]=useState('');
 const lease=useMemo(()=>({controller,state,mode,incomeId,label,amount,reference,reason,confirmed,confirmedFor,retireConfirmed,retireFor,writesVerified:p.writesVerified,intentVersion}),[controller,state,mode,incomeId,label,amount,reference,reason,confirmed,confirmedFor,retireConfirmed,retireFor,p.writesVerified,intentVersion]);
 const mask=useCallback(()=>{const el=region.current;if(el){el.hidden=true;el.inert=true;el.setAttribute('aria-hidden','true');}},[]);
 useLayoutEffect(()=>{runtime.setWrites(p.writesVerified===true);return()=>{runtime.setWrites(false);};},[runtime,p.writesVerified]);
 useLayoutEffect(()=>{if(!controller)return;mounted.current=true;runtime.setEnabled(true);controller.setActive(true);void controller.initialize();return()=>{mounted.current=false;leaseRef.current=null;mask();runtime.setEnabled(false);controller.setActive(false);};},[controller,mask,runtime]);
 useLayoutEffect(()=>{if(!mounted.current||controller?.getSnapshot()!==state)return;leaseRef.current=lease;const el=region.current;if(el){const show=state.active&&runtime.enabled();el.hidden=!show;el.inert=!show;el.setAttribute('aria-hidden',show?'false':'true');}return()=>{if(leaseRef.current===lease)leaseRef.current=null;};},[controller,state,lease,runtime]);
 const subscribeIdentity=p.subscribeIdentity;
 useEffect(()=>{if(!controller)return;const hide=()=>{if(!mounted.current)return;leaseRef.current=null;mask();runtime.setEnabled(false);controller.setActive(false);};window.addEventListener('pagehide',hide);let stop:()=>void;
  if(subscribeIdentity)stop=subscribeIdentity(hide);else{const client=createClient(),subscription=client.auth.onAuthStateChange((event,session)=>{if(event!=='INITIAL_SESSION'||session?.user.id!==actor)hide();});stop=()=>subscription.data.subscription.unsubscribe();}
  return()=>{window.removeEventListener('pagehide',hide);stop();};
 },[controller,subscribeIdentity,mask,actor,runtime]);
 if(!own||!controller)return null;
 const owned=()=>mounted.current&&leaseRef.current===lease&&controller.getSnapshot()===state;
 const recheck=()=>{if(!owned()||state.busy)return;leaseRef.current=null;mask();setConfirmed(false);setRetireConfirmed(false);runtime.setEnabled(true);controller.setActive(true);void controller.initialize();};
 const w=state.workspace,canWrite=p.writesVerified===true&&state.active&&!state.busy&&!state.blocked;
 const confirmedReady=confirmed&&confirmedFor===w&&state.active,retireReady=retireConfirmed&&retireFor===state.pending&&state.active;
 const form={mode,incomeId,label,amount,evidenceReference:reference,reason,confirmed:confirmedReady};
 const validDraft=!!w&&!!prepareSatelliteFinanceAttemptV1(w,form,()=> 'a0000000-0000-4000-8000-000000000001');
 const edit=(f:()=>void)=>{if(!owned()||!canWrite)return;leaseRef.current=null;bumpIntent(n=>n+1);setFormError('');f();};
 const select=(id:string|null,next:'add'|'correct'|'void'|'review')=>edit(()=>{setMode(next);setIncomeId(id);setConfirmed(false);setReason('');const h=w?.incomeHeads.find(r=>r.incomeId===id);setLabel(h?.label??'');setAmount(h?formatUsdInput(h.amountMinor):'');setReference(h?.evidenceReference??'');});
 const retain=()=>{if(!owned()||!canWrite||!w||!confirmedReady)return;leaseRef.current=null;bumpIntent(n=>n+1);const attempt=prepareSatelliteFinanceAttemptV1(w,form,p.makeId??(()=>crypto.randomUUID()));if(attempt)void controller.retain(attempt,w);else setFormError('The request could not be prepared. Check the fields and recheck this account.');};
 const send=(command:'record'|'retire'|'recover')=>{if(!owned()||!state.active||state.busy||state.blocked||command!=='recover'&&(!canWrite||!runtime.writes())||!state.pending||command==='retire'&&!retireReady)return;leaseRef.current=null;bumpIntent(n=>n+1);void controller.send(command,command==='retire'&&retireReady,state.pending);};
 return <section className={`correction-item ${styles.authoring}`} aria-label="Satellite Finance Authoring"><h2>Satellite Income and Fund Review</h2>
  <button type="button" onClick={recheck} disabled={state.busy}>Recheck Account and Saved Work</button><p role="status">{state.message}</p>
  {p.writesVerified!==true&&<p>Recording remains unavailable until the database path is verified. Saved work is preserved.</p>}
  <div ref={region} hidden={!state.active} inert={!state.active} aria-hidden={!state.active}>
  {state.active&&w&&<SatelliteFundReviewV1 value={w} eventName={p.eventName}/>}
  {state.active&&state.pending?<><h3>Exact Saved Request</h3><p>{state.pending.request.action==='review'?'Fund coverage review':state.pending.request.voided?'Void recorded income':'Record or correct unrestricted income'} — {state.pending.request.reason}</p>
   {state.pending.request.action==='income'&&<p>{state.pending.request.label}: {formatUsd(state.pending.request.amountMinor)}. Reference: {state.pending.request.evidenceReference}</p>}
   <button type="button" disabled={!state.active||state.busy||state.blocked} onClick={()=>send('recover')}>Recover Saved Request (Read Only)</button>
   <button type="button" disabled={!canWrite} onClick={()=>send('record')}>Record Saved Request / Retry Exact Request</button>
   <label htmlFor={`${prefix}-retire`}><input id={`${prefix}-retire`} type="checkbox" checked={retireReady} disabled={!canWrite} onChange={e=>edit(()=>{setRetireConfirmed(e.target.checked);setRetireFor(e.target.checked?state.pending:null);})}/> Retire This Uncommitted Request and Keep Its History</label>
   <button type="button" disabled={!canWrite||!retireReady} onClick={()=>send('retire')}>Confirm Retirement / Check Original Outcome</button>
   <p>If it already recorded, recovery returns that saved record. Retirement never reverses an income record or moves money.</p>
  </>:state.active&&w&&<>
   <div><button type="button" disabled={!canWrite} onClick={()=>select(null,'add')}>Add Unrestricted Income</button> <button type="button" disabled={!canWrite||w.fundMinor<0||w.reviewCurrent} onClick={()=>select(null,'review')}>Review Recorded Fund Coverage</button></div>
   <ul>{w.incomeHeads.map(h=><li key={h.incomeId}>{h.label} — {h.voided?'Voided':formatUsd(h.amountMinor)} <button type="button" disabled={!canWrite} onClick={()=>select(h.incomeId,'correct')}>Correct {h.label}</button> <button type="button" disabled={!canWrite||h.voided} onClick={()=>select(h.incomeId,'void')}>Void {h.label}</button></li>)}</ul>
   <h3>{mode==='review'?'Review Recorded Coverage':mode==='void'?'Void Recorded Income':mode==='correct'?'Correct Recorded Income':'Add Unrestricted Income'}</h3>
   <fieldset disabled={!canWrite}><legend>{mode==='review'?'Declared Recorded Coverage':'Event-Specific Income Record'}</legend>
    {mode!=='review'&&<><label htmlFor={`${prefix}-label`}>Income Label</label><input id={`${prefix}-label`} maxLength={200} value={label} onChange={e=>edit(()=>{setLabel(e.target.value);setConfirmed(false);})}/>
     <label htmlFor={`${prefix}-amount`}>Amount (USD)</label><input id={`${prefix}-amount`} inputMode="decimal" value={mode==='void'?'0.00':amount} disabled={mode==='void'} onChange={e=>edit(()=>{setAmount(e.target.value);setConfirmed(false);})}/>
     <label htmlFor={`${prefix}-ref`}>Evidence Reference</label><input id={`${prefix}-ref`} maxLength={500} value={reference} readOnly={mode!=='add'} onChange={e=>edit(()=>{setReference(e.target.value);setConfirmed(false);})}/></>}
    <label htmlFor={`${prefix}-reason`}>Director Review Reason</label><textarea id={`${prefix}-reason`} maxLength={500} value={reason} onChange={e=>edit(()=>{setReason(e.target.value);setConfirmed(false);})}/>
    <label htmlFor={`${prefix}-confirm`}><input id={`${prefix}-confirm`} type="checkbox" checked={confirmedReady} onChange={e=>edit(()=>{setConfirmed(e.target.checked);setConfirmedFor(e.target.checked?w:null);})}/>{mode==='review'?' I reviewed these current event receipts, allocated costs and all recorded unrestricted income; this is declared recorded coverage, not bank verification.':' I reviewed this event-owned unrestricted income evidence and amount; it is separate from entry receipts and Q-Pool or Side Pool funds.'}</label>
    {formError&&<p role="alert">{formError}</p>}
    {confirmedReady&&!validDraft&&<p role="alert">Check the required amount, reference, label and reason. This request is not ready to save.</p>}
    <button type="button" disabled={!validDraft} onClick={retain}>Save Exact Request on This Device</button>
   </fieldset><p>Saving a request here does not record it on the server. Use the separate Record Saved Request action afterward. No money is moved.</p>
  </>}
  </div>
  {!state.active&&<p>Account, event and saved request must be rechecked before authoring or recovery.</p>}
 </section>;
}
