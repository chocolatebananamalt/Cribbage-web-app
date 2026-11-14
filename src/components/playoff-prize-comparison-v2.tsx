import {useId} from 'react';
import {calculatePlayoffPrizeComparisonV2} from '../lib/results/playoff-prize-comparison-v2';
import {formatFinanceMoneyV1 as money} from '../lib/finance/format-finance-money-v1';
import type {PlayoffPrizePlanDraftV2,PlayoffPrizeFieldV2} from '../lib/playoffs/playoff-prize-plan-v2';
import './playoff-prize-comparison-v2.css';

type Props={plan:PlayoffPrizePlanDraftV2;field:PlayoffPrizeFieldV2;fundMinor:number};
const methods={graduated:'Graduated',equal:'Equal','winner-multiplier':'Equal with Winner Multiplier','winner-takes-all':'Winner Takes All'};
const intention={unset:'No Intention Selected',less:'Less than Entry Fee',equal:'Equal to Entry Fee',more:'More than Entry Fee'};
const place=(first:number,last:number)=>first===last?`Place ${first}`:`Places ${first}–${last}`;
function blockedMessage(code:string){
 if(code==='known_playoff_field_required')return 'A known playoff field is required before prize amounts can be compared.';
 if(code==='payments_beyond_qualifiers_policy_unresolved')return 'The requested paid-place count exceeds the supplied playoff field. Review the plan before comparing amounts.';
 if(code==='invalid_factor'||code==='invalid_winner_multiplier')return 'Complete the active factor or winner multiplier before comparing amounts.';
 if(code==='technical_resource_bound')return 'The supplied values exceed the calculation limits for this comparison.';
 return 'The supplied fund, field or prize settings need review before amounts can be compared.';
}
/** Finance proposal display only. Supplied field/fund facts are not ledger or
 * sporting authority. This component has no controls, storage or write port. */
export function PlayoffPrizeComparisonV2({plan,field,fundMinor}:Props){
 const id=useId(),view=calculatePlayoffPrizeComparisonV2({plan,field,fundMinor});
 const heading=<header><h3 id={`${id}-title`}>Playoff Prize Comparison</h3><p>Proposed amounts based on the supplied fund and playoff field.</p></header>;
 if(view.status==='blocked')return <section className="playoff-prize-comparison-v2" aria-labelledby={`${id}-title`}>{heading}<p role="status">{blockedMessage(view.code)}</p><p className="prize-comparison-authority">Proposal only. Recipient assignment, final awards and payments remain unapproved.</p></section>;
 const comparisonText={
  not_applicable:'The first-round entry-fee intention does not apply to this method or the included finishing groups.',
  pending_field_evidence:'Reviewed first-round finishing evidence is required before checking this intention.',
  pending_entry_fee:'A known positive entry fee is required before checking this intention.',
  choice_required:'A first-round entry-fee intention has not been selected.',
  incompatible_increment:`An amount exactly equal to the entry fee cannot use the selected ${money(view.roundingStepMinor)} increment.`,
  satisfied:'The rounded proposals meet the selected intention for the included first-round finishing groups.',
  not_satisfied:'The rounded proposals do not meet the selected intention. Review is required.'
 }[view.comparison];
 return <section className="playoff-prize-comparison-v2" aria-labelledby={`${id}-title`}>
  {heading}
  <dl className="prize-comparison-summary">
   <div><dt>Payout Method</dt><dd>{methods[view.method]}{view.method==='graduated'?` — Factor ${plan.incrementFactorText}`:view.method==='winner-multiplier'?` — Multiplier ${plan.winnerMultiplierText}`:''}</dd></div>
   <div><dt>Playoff Qualifiers</dt><dd>{view.qualifierCount}</dd></div>
   <div><dt>Requested Paid Places</dt><dd>{view.requestedPaidPlaces}</dd></div>
   <div><dt>Paid Places in This Comparison</dt><dd>{view.actualPaidPlaces}</dd></div>
   <div><dt>Supplied Prize Fund</dt><dd>{money(view.fundMinor)}</dd></div>
   <div><dt>Proposed Prize Total</dt><dd>{money(view.roundedAwardsTotalMinor)}</dd></div>
  </dl>
  {view.cutoffWarning&&<section className="prize-comparison-notice" aria-label="Paid-Place Expansion"><h4>Paid-Place Expansion</h4><p role="status">{view.cutoffWarning}</p></section>}
  <section className={`prize-comparison-notice ${view.balanced?'prize-comparison-balanced':'prize-comparison-balance-review'}`} aria-label="Fund Balance">
   <h4>Fund Balance</h4>
   <p role="status">{view.balanced?`The proposed total matches the supplied ${money(view.fundMinor)} fund.`:view.discrepancyMinor>0?`Proposed prizes total ${money(view.roundedAwardsTotalMinor)}, which is ${money(view.discrepancyMinor)} over the ${money(view.fundMinor)} fund.`:`Proposed prizes total ${money(view.roundedAwardsTotalMinor)}, leaving ${money(-view.discrepancyMinor)} of the ${money(view.fundMinor)} fund unallocated.`}</p>
   {!view.balanced&&<p>Review the fund and proposal. Rounding differences have not been redistributed.</p>}
  </section>
  <section aria-labelledby={`${id}-bands`}><h4 id={`${id}-bands`}>Proposed Finishing-Group Prizes</h4><p>Each person in an included equal finishing group receives the same proposed amount.</p>
   <ol className="prize-comparison-bands" aria-label="Proposed Prize Bands">{view.bands.map(b=><li key={`${b.firstPlace}:${b.lastPlace}`}><h5>{place(b.firstPlace,b.lastPlace)}</h5><dl><div><dt>People</dt><dd>{b.people}</dd></div><div><dt>Per Person</dt><dd>{money(b.perPersonMinor)}</dd></div><div><dt>Group Total</dt><dd>{money(b.bandTotalMinor)}</dd></div></dl></li>)}</ol>
   {view.zeroAwardBand&&<p className="prize-comparison-notice" role="status">One or more included finishing groups receive $0.00 in this comparison. Review is required.</p>}
  </section>
  <section aria-labelledby={`${id}-rounding`}><h4 id={`${id}-rounding`}>Regular-Prize Rounding</h4><p>Source-model rounding uses the nearest {money(view.roundingStepMinor)} increment, with positive half increments rounded up. Per-person amounts are rounded before group totals are added.</p></section>
  <section className="prize-comparison-notice" aria-labelledby={`${id}-intention`}><h4 id={`${id}-intention`}>First-Round Entry-Fee Intention</h4><p>{intention[plan.firstRoundComparison]}{field.entryFeeMinor!==null?`; supplied entry fee ${money(field.entryFeeMinor)}.`:'.'}</p><p role="status">{comparisonText}</p><p>This checks the supplied intention against the proposals. It does not change the fund or solve for different amounts.</p></section>
  <p className="prize-comparison-authority">Proposal only. Recipient assignment, final awards and payments remain unapproved.</p>
 </section>;
}
