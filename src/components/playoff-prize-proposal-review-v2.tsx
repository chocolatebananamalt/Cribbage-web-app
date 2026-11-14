'use client';
import {useId,useLayoutEffect,useRef,useState} from 'react';
import {calculatePlayoffPrizeProposalsV2,isPlayoffPrizeProposalExtensionV2,type PlayoffPrizeProposalV2,type PlayoffPrizeCurrentV2,type PlayoffPrizeWholeBandOverrideV2} from '../lib/results/playoff-prize-proposals-v2';
import {formatFinanceMoneyV1 as money} from '../lib/finance/format-finance-money-v1';
import {isEventPrizeResponseValueV1} from '../lib/api/event-prize-settings-v1';
import './playoff-prize-proposal-review-v2.css';

type Props={retained:PlayoffPrizeProposalV2;expectedCurrent:PlayoffPrizeCurrentV2|null;onChange:(next:PlayoffPrizeProposalV2,previous:PlayoffPrizeProposalV2)=>void};
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const places=(a:number,b:number)=>a===b?`Place ${a}`:`Places ${a}-${b}`;
function parseAmount(text:string):number|null{
 if(text.length>32||!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text))return null;
 const [whole,fraction='']=text.split('.'),minor=BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,'0'));
 return minor<=BigInt(Number.MAX_SAFE_INTEGER)?Number(minor):null;
}
type Edit={amount:string;reason:string;baseline:string|null;pending:{record:PlayoffPrizeWholeBandOverrideV2;basis:string}|null};
const empty=():Edit=>({amount:'',reason:'',baseline:null,pending:null});
type Band={firstPlace:number;lastPlace:number;people:number;sourcePerPersonMinor:number;perPersonMinor:number;bandTotalMinor:number;overrideState:'absent'|'active'|'voided'};
function BandEditor({band,retained,locked,append}:{band:Band;retained:PlayoffPrizeProposalV2;locked:boolean;append:(baseline:string,record:PlayoffPrizeWholeBandOverrideV2)=>boolean}){
 const id=useId(),[raw,setRaw]=useState<Edit>(empty),[message,setMessage]=useState(''),latestEdit=useRef(raw),fingerprint=canonical(retained),basis=canonical({source:retained.source,input:retained.input});
 const replace=(next:Edit)=>{latestEdit.current=next;setRaw(next);};
 const acknowledged=raw.pending!==null&&raw.pending.basis===basis&&retained.overrideHistory.some(r=>canonical(r)===canonical(raw.pending!.record));
 const form=acknowledged?empty():raw,waiting=form.pending!==null,stale=form.baseline!==null&&form.baseline!==fingerprint;
 const last=retained.overrideHistory.filter(r=>r.firstPlace===band.firstPlace&&r.lastPlace===band.lastPlace).at(-1),amount=parseAmount(form.amount),step=Number(retained.input.plan.rounding.regular)*100;
 const amountValid=amount!==null&&amount%step===0,reasonValid=!!form.reason.trim()&&form.reason.length<=2000,disabled=locked||stale||waiting;
 const edit=(key:'amount'|'reason',value:string)=>{replace({...form,[key]:value,baseline:form.baseline??fingerprint,pending:null});setMessage('');};
 const submit=(voided:boolean)=>{
  if(canonical(latestEdit.current)!==canonical(raw)||disabled||!reasonValid||(!voided&&!amountValid))return;
  let record:PlayoffPrizeWholeBandOverrideV2;
  try{record={recordId:crypto.randomUUID(),firstPlace:band.firstPlace,lastPlace:band.lastPlace,priorRecordId:last?.recordId??null,perPersonMinor:voided?last!.perPersonMinor:amount!,voided,reason:form.reason};}catch{setMessage('A local record ID could not be created. Your text is retained.');return;}
  replace({...form,baseline:form.baseline??fingerprint,pending:{record,basis}});
  if(!append(form.baseline??fingerprint,record)){replace({...form,baseline:form.baseline??fingerprint,pending:null});setMessage('The source or local proposal changed. Your text is retained; no record was appended.');}
 };
 return <li className="prize-proposal-band"><h4>{places(band.firstPlace,band.lastPlace)}</h4>
  <dl><div><dt>People</dt><dd>{band.people}</dd></div><div><dt>Calculated per person</dt><dd>{money(band.sourcePerPersonMinor)}</dd></div><div><dt>Local proposed per person</dt><dd>{money(band.perPersonMinor)}</dd></div><div><dt>Local group total</dt><dd>{money(band.bandTotalMinor)}</dd></div><div><dt>Override state</dt><dd>{band.overrideState==='absent'?'No override':band.overrideState==='voided'?'Voided; calculated amount restored':'Active local proposal'}</dd></div></dl>
  <div className="prize-proposal-fields"><label htmlFor={`${id}-amount`}>Per Person Amount ($)<input id={`${id}-amount`} inputMode="decimal" type="text" maxLength={32} value={form.amount} onChange={e=>edit('amount',e.target.value)} aria-invalid={form.amount!==''&&!amountValid} aria-describedby={`${id}-help`} disabled={waiting}/></label>
   <div><label htmlFor={`${id}-reason`}>Reason</label><textarea id={`${id}-reason`} value={form.reason} onChange={e=>edit('reason',e.target.value)} aria-invalid={form.reason!==''&&!reasonValid} disabled={waiting}/></div></div>
  <p id={`${id}-help`}>Whole finishing group only. Use {money(step)} increments. Blank means no entered amount; 0 is an explicit zero. A reason is required.</p>
  {form.amount!==''&&!amountValid&&<p role="status">Enter a nonnegative dollar amount in {money(step)} increments, with at most two decimal places. Your raw text is retained.</p>}
  {stale&&<p role="status">The source or local proposal changed while you were editing. Your text is retained and cannot be appended to the changed proposal.</p>}
  {waiting&&<p role="status">Waiting for the controlled local proposal to include this exact record. Nothing has been saved.</p>}
  {message&&<p role="status">{message}</p>}
  <div className="prize-proposal-actions"><button type="button" disabled={disabled||!amountValid||!reasonValid} onClick={()=>submit(false)}>{last?.voided?'Reopen Local Override':last?'Append Local Correction':'Append Local Override'}</button>
   {last&&!last.voided&&<button type="button" disabled={disabled||!reasonValid} onClick={()=>submit(true)}>Void Local Override</button>}
   <button type="button" disabled={waiting||(!form.amount&&!form.reason&&!stale)} onClick={()=>{if(canonical(latestEdit.current)!==canonical(raw))return;replace(empty());setMessage('');}}>Discard Unappended Text</button></div>
 </li>;
}

/** Controlled, memory-only authoring. Callback is a proposed local replacement,
 * not a save receipt. The host must compare previous before accepting next. */
function ControlledReview({retained,expectedCurrent,onChange}:Props){
 const id=useId(),latest=useRef({retained,expectedCurrent,onChange});useLayoutEffect(()=>{latest.current={retained,expectedCurrent,onChange};});
 // Keep the original editing source if the host replaces source/input. This
 // also retains rows/text when a changed cutoff removes a finishing group.
 // Same-source controlled history acknowledgements remain visible immediately.
 const [pinned,setPinned]=useState(()=>structuredClone(retained)),sourceChanged=canonical({source:pinned.source,input:pinned.input})!==canonical({source:retained.source,input:retained.input});
 if(!sourceChanged&&canonical(pinned)!==canonical(retained))setPinned(structuredClone(retained));
 const displayed=sourceChanged?pinned:retained,checked=calculatePlayoffPrizeProposalsV2(displayed,expectedCurrent),local=checked.status==='proposal_review'?checked:calculatePlayoffPrizeProposalsV2(displayed,{source:displayed.source,input:displayed.input}),locked=sourceChanged||checked.status!=='proposal_review';
 const append=(baseline:string,record:PlayoffPrizeWholeBandOverrideV2)=>{
  const current=latest.current;if(canonical(current.retained)!==baseline||calculatePlayoffPrizeProposalsV2(current.retained,current.expectedCurrent).status!=='proposal_review')return false;
  const next=structuredClone({...current.retained,overrideHistory:[...current.retained.overrideHistory,record]});
  if(!isPlayoffPrizeProposalExtensionV2(current.retained,next,current.expectedCurrent))return false;
  current.onChange(next,structuredClone(current.retained));return true;
 };
 return <section className="playoff-prize-proposal-review-v2" aria-labelledby={`${id}-title`}><h3 id={`${id}-title`}>Local Proposed Adjustments — Not Saved</h3><p>These reasoned adjustments exist only in this controlled local proposal. No storage, server save, payment, refund or recipient assignment occurs. Record IDs link local corrections; they do not prove who authored a record or when.</p>
  {locked&&<p className="prize-proposal-warning" role="status">Current source unavailable or changed. Appending is blocked. Retained proposal and unfinished text are kept for review.{sourceChanged?' This editor remains pinned to its original source; a new review must be opened explicitly for the changed source.':''}</p>}
  {local.status==='proposal_review'?<>
   <dl className="prize-proposal-summary"><div><dt>Supplied fund</dt><dd>{money(local.input.fundMinor)}</dd></div><div><dt>Original calculated total</dt><dd>{money(local.sourceCalculation.roundedAwardsTotalMinor)}</dd></div><div><dt>Local proposed total</dt><dd>{money(local.proposedTotalMinor)}</dd></div><div><dt>Paid places / positive awards</dt><dd>{local.actualPaidPlaces} / {local.positiveAwardPlaces}</dd></div></dl>
   <section className="prize-proposal-warning" aria-label="Local Proposal Warnings"><h4>Proposal Review</h4><p>{local.balanced?'The local proposed total matches the supplied fund.':local.discrepancyMinor>0?`The local proposal is ${money(local.discrepancyMinor)} over the fund.`:`The local proposal leaves ${money(-local.discrepancyMinor)} unallocated.`} Amounts are never redistributed automatically.</p>
    {local.cutoffWarning&&<p>{local.cutoffWarning}</p>}
    {local.manualDistributionChanged&&<p>Manual distribution changed from the calculated rounded amounts. Fund balance does not establish consistency with the selected method.</p>}
    {local.equalTreatmentViolation&&<p>Equal treatment violation: adjusted finishing groups have unequal per-person amounts under Equal.</p>}
    {local.methodRelationReviewRequired&&<p>Selected-method relation requires review. These local amounts have not been approved.</p>}
    {local.winnerMultiplierRelationReviewRequired&&<p>Winner Multiplier relation requires review: adjusted nonwinner equality or the winner multiplier does not match.</p>}
    {local.rankOrderViolation&&<p>A lower finishing group has a larger per-person amount. Rank order requires review.</p>}{local.zeroAwardBand&&<p>An included finishing group has an explicit or calculated zero award.</p>}
    <p>First-round intention on adjusted amounts: <strong>{local.comparison.replaceAll('_',' ')}</strong>. This checks supplied evidence only and never solves for new amounts.</p></section>
   {local.excludedBands.length>0&&<section aria-label="Finishing Groups Without Prize Awards"><h4>Finishing Groups Without Prize Awards</h4><p>{local.excludedPlaces} playoff places are excluded by the saved paid-place selection. These explicit zero amounts are not unpaid obligations. Change the saved selection to include them; they cannot be added with an amount override.</p><ul>{local.excludedBands.map(b=><li key={b.firstPlace}>{places(b.firstPlace,b.lastPlace)}: No Prize Award — {b.people} {b.people===1?'player':'players'}; $0.00 per person.</li>)}</ul></section>}
   <ol className="prize-proposal-bands" aria-label="Local Finishing Group Editors">{local.proposedBands.map(b=><BandEditor key={`${b.firstPlace}:${b.lastPlace}`} band={b} retained={displayed} locked={locked} append={append}/>)}</ol>
  </>:<p role="status">The retained proposal is malformed or cannot be calculated. Raw controlled data is unchanged; no new record can be appended.</p>}
  <section aria-labelledby={`${id}-history`}><h4 id={`${id}-history`}>Local Reasoned History — Not Saved</h4>{displayed.overrideHistory.length===0?<p>No local adjustment records.</p>:<ol className="prize-proposal-history">{displayed.overrideHistory.map(r=><li key={r.recordId}><strong>{places(r.firstPlace,r.lastPlace)} · {r.voided?'Void':'Propose'} · {money(r.perPersonMinor)} per person</strong><p className="prize-proposal-reason">{r.reason}</p><p>Local record: {r.recordId}<br/>Prior local record: {r.priorRecordId??'None'}</p></li>)}</ol>}</section>
  <p role="status">{displayed.overrideHistory.length} local history records. None have been saved.</p>
  <p>Local proposals only. Final awards and payments remain unapproved.</p>
 </section>;
}

function validProposal(value:unknown):value is PlayoffPrizeProposalV2{
 if(!isEventPrizeResponseValueV1(value)||!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return calculatePlayoffPrizeProposalsV2(v,{source:v.source,input:v.input}).status==='proposal_review';
}
export function PlayoffPrizeProposalReviewV2(props:Props){
 // Validate descriptors before reading/serializing fields. A malformed new
 // controlled value must neither crash history rendering nor discard edits.
 const valid=validProposal(props.retained),[lastValid,setLastValid]=useState<PlayoffPrizeProposalV2|null>(()=>valid?structuredClone(props.retained):null);
 if(valid&&canonical(lastValid)!==canonical(props.retained))setLastValid(structuredClone(props.retained));
 const displayed=valid?props.retained:lastValid;
 return <>{!valid&&<p role="status">Malformed controlled proposal. Raw supplied data and existing unfinished text are unchanged; appending is blocked.</p>}{displayed?<ControlledReview retained={displayed} expectedCurrent={valid?props.expectedCurrent:null} onChange={props.onChange}/>:<section className="playoff-prize-proposal-review-v2"><h3>Local Proposed Adjustments — Not Saved</h3><p>No valid retained history is available for display. No records were appended or saved.</p></section>}</>;
}
