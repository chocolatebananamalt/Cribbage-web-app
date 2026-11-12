"use client";
import { useId } from 'react';
import { readNativeMixedMainWorkspaceViewV1, type NativeMixedMainViewV1 } from '../lib/finance/native-mixed-main-workspace-view-v1';
import styles from './event-finance-section-v1.module.css';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
const categories=[['player_benefit','Player Benefits'],['operating_expense','Expenses'],['unrestricted_income','Additional Income']]as const;
/** Read-only native evidence presentation. No ordinary allocation IDs, editing,
 * payment controls, transport or authoritative current-source assertion. */
export function NativeMixedMainFinanceSummaryV1({enabled=false,workspace,scope}:{enabled?:boolean;workspace:unknown;scope:{tournamentId:string;eventId:string}}){
 const view=enabled?readNativeMixedMainWorkspaceViewV1(workspace,scope):null;
 return <NativeMixedMainFinanceViewSummaryV1 enabled={enabled} view={view}/>;
}
/** Controlled internal presenter. Only a trusted current-owner host may supply
 * this transport-decoded view. It does not validate source/authentication. The
 * raw-workspace wrapper above retains its strict decoder boundary. */
export function NativeMixedMainFinanceViewSummaryV1({enabled=false,view:input}:{enabled?:boolean;view:NativeMixedMainViewV1|null}){
 const id=useId(),view=enabled?input:null;
 return <section className={styles.section} aria-labelledby={`${id}-heading`}>
  <h2 id={`${id}-heading`}>Main Event Finance</h2>
  <p className={styles.notice}>Simulation only. No actual entry payment, refund or payout is recorded here.</p>
  {!view?<p role="status">Finance information is unavailable. Amounts and awards are unknown. This test version supports Main bookkeeping after verified playoffs are complete. Pre-play cost entry and registration forecasts are not connected yet.</p>:<>
   <p role="status">{view.awards?'Unpaid simulated awards recorded. Nobody is marked paid.':view.costsReviewed?'Costs reviewed. Unpaid awards have not been finalized.':'Costs need Director review. Unpaid awards have not been finalized.'}</p>
   <h3>Tournament Details</h3><dl className={styles.figures}>
    <dt>Simulated Entry Income</dt><dd>{money(view.grossMinor)}</dd>
    <dt>Player Benefits</dt><dd>{money(view.benefitsMinor)}</dd>
    <dt>Expenses</dt><dd>{money(view.expensesMinor)}</dd>
    <dt>Additional Income</dt><dd>{money(view.additionalIncomeMinor)}</dd>
    <dt>Regular Prize Fund</dt><dd>{money(view.netMinor)}</dd>
    <dt>Playoff Qualifiers</dt><dd>{view.qualifierCount}</dd>
   </dl><p>Q-Pool and Side Pool funds remain separate. No ACC sanctioning fee is inferred by this informal rehearsal view.</p>
   {categories.map(([key,label])=><section key={key} aria-labelledby={`${id}-${key}`}><h3 id={`${id}-${key}`}>{label}</h3>
    {view.lines.some(l=>l.category===key)?<ul>{view.lines.filter(l=>l.category===key).map(l=><li key={l.lineId}>{l.label}: {money(l.amountMinor)}{l.voided?' — Voided; prior history retained':''}</li>)}</ul>:<p>No recorded rows. This does not imply that the Director reviewed zero costs.</p>}
   </section>)}
   <h3>Calculated Payout Estimate</h3>
   {view.comparison?.status==='calculated_comparison'?<>
    <p>Estimate from the saved Playoff settings and regular prize fund. It does not approve awards or mark anyone paid.</p>
    {view.comparison.cutoffWarning&&<p className={styles.alert}>{view.comparison.cutoffWarning}</p>}
    <ul>{view.comparison.bands.map(g=><li key={g.firstPlace}>{g.firstPlace===g.lastPlace?`Place ${g.firstPlace}`:`Places ${g.firstPlace}–${g.lastPlace}`}: {money(g.perPersonMinor)} each × {g.people} = {money(g.bandTotalMinor)}</li>)}</ul>
    <p>Calculated total: <strong>{money(view.comparison.roundedAwardsTotalMinor)}</strong>.</p>{view.comparison.balanced?<p>Balances with the regular prize fund.</p>:<p className={styles.alert} role="alert">{view.comparison.discrepancyMinor<0?`Unallocated: ${money(-view.comparison.discrepancyMinor)}. Director adjustment required.`:`Exceeds the regular prize fund by ${money(view.comparison.discrepancyMinor)}. Director adjustment required.`}</p>}
    {view.comparison.zeroAwardBand&&<p className={styles.alert}>At least one included finishing group has a zero calculated amount. Review before proposing awards.</p>}
    {view.comparison.comparison!=='not_applicable'&&<p className={view.comparison.comparison==='satisfied'?styles.notice:styles.alert}>{({
     satisfied:'The calculated estimate meets the selected first-round-losers comparison with the common simulated entry fee. This does not establish that Director-adjusted awards meet the condition or approve a payout.',
     not_satisfied:'The calculated estimate does not meet the selected first-round-losers comparison with entry fee. Director review is required; actual award adjustments are assessed separately.',
     incompatible_increment:'The selected equal-to-entry-fee comparison is incompatible with the payout increment. Review the settings; this estimate does not resolve the conflict.',
     pending_field_evidence:'The first-round-losers comparison still needs verified playoff field and fee-reference evidence. This estimate does not establish the condition.',
     pending_entry_fee:'The first-round-losers comparison still needs a verified common entry-fee reference. This estimate does not establish the condition.',
     choice_required:'Choose whether the first-round-losers estimate should be less than, equal to or more than entry fee before assessing this comparison.'
    }as const)[view.comparison.comparison]}</p>}
   </>:<p>A source-backed estimate is unavailable. No payout method or legacy rounding default is inferred.</p>}
   <h3>Unpaid Simulated Awards</h3>
   {!view.awards?<p>No final award amounts are available.</p>:<>
    <p>Director-reviewed whole-group amounts, in {money(view.awards.roundingUnitMinor)} increments. These records do not constitute an actual disbursement.</p>
    <ul>{view.awards.groups.map(g=><li key={g.firstPlace}><strong>{g.firstPlace===g.lastPlace?`Place ${g.firstPlace}`:`Places ${g.firstPlace}–${g.lastPlace}`}</strong>: {money(g.perPersonMinor)} each × {g.participantIds.length} = {money(g.perPersonMinor*g.participantIds.length)}. {g.participantIds.map(pid=>{const person=view.recipients.find(r=>r.participantId===pid);return <span key={pid}> {person?.displayName??'Unknown'} — Tournament ID {person?.fixedTournamentId??'Unknown'}.</span>;})}</li>)}</ul>
    <p>Total unpaid simulated awards: <strong>{money(view.awards.totalMinor)}</strong>. Difference from regular prize fund: <strong>{money(view.netMinor-view.awards.totalMinor)}</strong>.</p>
   </>}
  </>}
 </section>;
}
