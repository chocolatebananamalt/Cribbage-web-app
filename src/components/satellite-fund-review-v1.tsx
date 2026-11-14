import type {SatelliteFundViewV1} from '../lib/finance/satellite-fund-review-v1';
import {formatUsd} from '../lib/money';
/** Saved bookkeeping only; no suggested awards or payment controls. */
type Display=Pick<SatelliteFundViewV1,'regularEntryMinor'|'benefitMinor'|'expenseMinor'|'additionalIncomeMinor'|'fundMinor'|'held'|'reviewCurrent'|'reviewStatus'|'incomeHeads'>;
export function SatelliteFundReviewV1({value,eventName}:{value:Display|null;eventName:string}){
 return <section className="correction-item" aria-label={`${eventName}: Recorded Fund Review`}>
  <h2>{eventName}: Recorded Fund Review</h2>
  {!value?<p>Current event-specific fund records are unavailable. Fund coverage remains on hold.</p>:<>
   <dl><dt>Recorded Regular Entry Income</dt><dd>{formatUsd(value.regularEntryMinor)}</dd>
    <dt>Allocated Player Benefits</dt><dd>{formatUsd(value.benefitMinor)}</dd>
    <dt>Allocated Expenses</dt><dd>{formatUsd(value.expenseMinor)}</dd>
    <dt>Recorded Unrestricted Additional Income</dt><dd>{formatUsd(value.additionalIncomeMinor)}</dd>
    <dt>Recorded Event Fund</dt><dd>{formatUsd(value.fundMinor)}</dd></dl>
   <p role={value.held?'alert':'status'}>{value.reviewCurrent?'The Director’s declared review matches these current recorded income and cost sources.':value.reviewStatus==='stale'?'Sources changed after the saved review. A new Director review is required.':'Recorded amounts have not yet received a current Director completeness review.'}</p>
   {value.fundMinor<0&&<p role="alert">Recorded costs exceed recorded entry and additional income. Fund review remains on hold.</p>}
   <h3>Saved Unrestricted Additional Income</h3>
   {value.incomeHeads.length?<ul>{value.incomeHeads.map(r=><li key={r.incomeId}>{r.label}: {r.voided?'Voided — original evidence remains reserved.':formatUsd(r.amountMinor)} Reference: {r.evidenceReference}</li>)}</ul>:<p>No additional income is recorded. This alone does not confirm zero outside income.</p>}
   <p>Saved records only. Q-Pool and Side Pool funds are separate. A Director’s declared recorded coverage is not independent fund verification, bank verification, payout approval or a payment.</p>
  </>}
 </section>;
}
