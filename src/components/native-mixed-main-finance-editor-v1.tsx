"use client";
import{useId}from'react';
import{nativeMixedMainRecipientsIdentifiedV1}from'../lib/finance/native-mixed-main-workspace-view-v1';
import type{NativeMixedMainViewV1}from'../lib/finance/native-mixed-main-workspace-view-v1';
import{buildNativeMixedMainEditorActionV1,nativeMixedMainEditorBasisV1,nativeMixedMainManualTotalV1,newNativeMixedMainEditorDraftV1,type NativeMixedMainEditorDraftV1,type NativeMixedMainEditorActionV1}from'../lib/finance/native-mixed-main-editor-v1';
import{NativeMixedMainFinanceViewSummaryV1}from'./native-mixed-main-finance-summary-v1';
import common from'./event-finance-section-v1.module.css';import styles from'./native-mixed-main-finance-editor-v1.module.css';
export type NativeMixedMainEditorLeaseV1={view:NativeMixedMainViewV1;draft:NativeMixedMainEditorDraftV1};
const categories=[['player_benefit','Player Benefits'],['operating_expense','Expenses'],['unrestricted_income','Additional Income']]as const;
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
/** Controlled, disabled-by-default presentation. A trusted current-owner host
 * supplies decoded view/draft and MUST reject stale leases before changing a
 * draft, allocating a line/operation ID, or staging. No ID, storage, transport,
 * calculator approval or asynchronous authority is created by this panel. */
export function NativeMixedMainFinanceEditorV1({enabled=false,disabled=true,view,draft,onDraft,onAddCost,onRequest}:{enabled?:boolean;disabled?:boolean;view:NativeMixedMainViewV1|null;draft:NativeMixedMainEditorDraftV1;onDraft:(next:NativeMixedMainEditorDraftV1,expected:NativeMixedMainEditorLeaseV1)=>void;onAddCost:(category:NativeMixedMainEditorDraftV1['category'],expected:NativeMixedMainEditorLeaseV1)=>void;onRequest:(action:NativeMixedMainEditorActionV1,expected:NativeMixedMainEditorLeaseV1)=>void}){
 const id=useId();if(!enabled||!view)return <NativeMixedMainFinanceViewSummaryV1 enabled={enabled} view={null}/>;
 const lease={view,draft},editable=!disabled&&view.awards===null,fresh=draft.basis===nativeMixedMainEditorBasisV1(view),action=buildNativeMixedMainEditorActionV1(view,draft),manualTotal=nativeMixedMainManualTotalV1(view,draft),knownUnit=view.savedRounding.status==='saved_latest';
 const change=(patch:Partial<NativeMixedMainEditorDraftV1>)=>{if(editable)onDraft({...draft,...patch,confirmed:false},lease);};
 const begin=(mode:NativeMixedMainEditorDraftV1['mode'])=>{if(editable)onDraft(newNativeMixedMainEditorDraftV1(view,mode),lease);};
 return <><NativeMixedMainFinanceViewSummaryV1 enabled view={view}/><section className={`${common.section} ${styles.form}`} aria-labelledby={`${id}-heading`}>
  <h2 id={`${id}-heading`}>Review Main Event Finance</h2>
  <p className={common.notice}>Fictional rehearsal bookkeeping only. No actual payment, refund or disbursement is authorized.</p>
  {view.awards?<p role="status">Unpaid simulated awards are recorded. This Main journal is read-only.</p>:<>
   {categories.map(([category,label])=><section key={category} aria-labelledby={`${id}-${category}`}><h3 id={`${id}-${category}`}>{label}</h3>
    <button type="button" disabled={!editable} onClick={()=>{if(editable)onAddCost(category,lease);}}>Add {label} row</button>
    {view.lines.filter(l=>l.category===category).map(l=><div className={common.row} key={l.lineId}><span>{l.label}: {money(l.amountMinor)}{l.voided?' - Voided':''}</span>{' '}<button type="button" disabled={!editable} onClick={()=>{if(editable)onDraft({...newNativeMixedMainEditorDraftV1(view,'cost-line'),lineId:l.lineId,priorRecordId:l.recordId,category:l.category,label:l.label,amountText:(l.amountMinor/100).toFixed(2)},lease);}}>Correct {l.label}</button></div>)}
   </section>)}
   <div className={common.actions}><button type="button" disabled={!editable||!knownUnit} onClick={()=>begin('review-costs')}>Review costs</button><button type="button" disabled={!editable||!knownUnit||!view.costsReviewed||!view.review} onClick={()=>begin('propose-awards')}>Enter whole-group awards</button><button type="button" disabled={!editable||!knownUnit||!view.costsReviewed||!view.review||!view.proposal} onClick={()=>begin('finalize-unpaid')}>Review final unpaid awards</button></div>
   {!knownUnit&&<p role="status">The saved regular rounding unit is unknown. Cost rows may be entered; cost review and awards remain unavailable.</p>}
   {draft.mode!=='idle'&&<form onSubmit={e=>{e.preventDefault();if(editable&&fresh&&action)onRequest(action,lease);}}>
    <p>This form has not been saved. Save or cancel before leaving or reloading this page.</p>
    <h3>{draft.mode==='cost-line'?'Cost or income row':draft.mode==='review-costs'?'Explicit cost review':draft.mode==='propose-awards'?'Manual whole-group awards':'Finalize unpaid simulated awards'}</h3>
    {!fresh&&<p role="alert" className={common.alert}>Current information changed. These draft values are retained, but cannot be submitted. Cancel and review the fresh view.</p>}
    <fieldset disabled={!editable||!fresh}>
     {draft.mode==='cost-line'&&<><label>Description<input value={draft.label} maxLength={200} onChange={e=>change({label:e.target.value})}/></label><label>Amount (USD)<input inputMode="decimal" value={draft.amountText} disabled={draft.voided} onChange={e=>change({amountText:e.target.value})}/></label>{draft.priorRecordId&&<label className={styles.check}><input type="checkbox" checked={draft.voided} onChange={e=>change({voided:e.target.checked})}/>Void this row and retain its history</label>}{draft.voided&&<p>The void correction records $0.00. Earlier records remain unchanged.</p>}</>}
     {draft.mode==='review-costs'&&<><p>Saved regular increment: {view.savedRounding.unitMinor===null?'Unknown':money(view.savedRounding.unitMinor)}.</p><p>Benefits {money(view.benefitsMinor)}; expenses {money(view.expensesMinor)}; additional income {money(view.additionalIncomeMinor)}; regular fund {money(view.netMinor)}.</p><label htmlFor={`${id}-coverage`}>Informal Rehearsal Coverage Reason</label><textarea id={`${id}-coverage`} value={draft.coverageReason} maxLength={500} onChange={e=>change({coverageReason:e.target.value})}/></>}
     {draft.mode==='propose-awards'&&<><p>Enter every amount explicitly. Third and fourth place share one equal per-person amount. Saved increment: {view.savedRounding.unitMinor===null?'Unknown':money(view.savedRounding.unitMinor)}.</p>{view.finishingBands.map((b,i)=><label key={b.firstPlace}>{b.firstPlace===b.lastPlace?`Place ${b.firstPlace}`:`Places ${b.firstPlace}-${b.lastPlace}`} per person (USD)<input inputMode="decimal" value={draft.amounts[i]} onChange={e=>{const amounts=[...draft.amounts]as NativeMixedMainEditorDraftV1['amounts'];amounts[i]=e.target.value;change({amounts});}}/></label>)}<p role="status" className={manualTotal===null||manualTotal!==view.netMinor?common.alert:common.notice}>{manualTotal===null?'Enter a valid amount for every group.':`Entered total ${money(manualTotal)}; regular fund ${money(view.netMinor)}; difference ${money(manualTotal-view.netMinor)}.`}</p><label htmlFor={`${id}-disclosure`}>Manual Award Policy Disclosure</label><textarea id={`${id}-disclosure`} value={draft.disclosure} maxLength={1000} onChange={e=>change({disclosure:e.target.value})}/></>}
     {draft.mode==='finalize-unpaid'&&<>{!nativeMixedMainRecipientsIdentifiedV1(view)&&<p role="alert">Recipient names or Tournament IDs are unknown or stale. Refresh and identify all five recipients before final review.</p>}<p>Current reviewed proposal: {view.proposal?money(view.proposal.totalMinor):'Unavailable'}. No amount is marked paid by this action.</p>{view.proposal?.groups.map(g=><p key={g.firstPlace}>{g.firstPlace===g.lastPlace?`Place ${g.firstPlace}`:`Places ${g.firstPlace}-${g.lastPlace}`}: {money(g.perPersonMinor)} each. {g.participantIds.map(pid=>{const person=view.recipients.find(r=>r.participantId===pid);return <span key={pid}> {person?.displayName??'Unknown'} — Tournament ID {person?.fixedTournamentId??'Unknown'}.</span>;})}</p>)}</>}
     <label htmlFor={`${id}-reason`}>Reason for This Request</label><textarea id={`${id}-reason`} value={draft.reason} maxLength={500} onChange={e=>change({reason:e.target.value})}/>
     <label className={styles.check}><input type="checkbox" checked={draft.confirmed} onChange={e=>{if(editable)onDraft({...draft,confirmed:e.target.checked},lease);}}/>I reviewed these exact amounts and this simulated-only request.</label>
     <button type="submit" disabled={!action}>{draft.mode==='cost-line'?(draft.priorRecordId?'Save row correction':'Save row'):draft.mode==='review-costs'?'Save explicit cost review':draft.mode==='propose-awards'?'Save reviewed award proposal':'Record unpaid simulated awards'}</button>
    </fieldset>
    <button type="button" disabled={disabled} onClick={()=>onDraft(newNativeMixedMainEditorDraftV1(view),lease)}>Cancel draft</button>
   </form>}
  </>}
 </section></>;
}


