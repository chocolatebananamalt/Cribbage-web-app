"use client";
import { useId, useState } from 'react';
import { type EventFinanceSectionViewV1, type EventFinanceActionV1 } from '../lib/finance/event-finance-workspace-v1';
import styles from './event-finance-section-v1.module.css';

import { formatFinanceMoneyV1 as money } from '../lib/finance/format-finance-money-v1';
/** Explicit proposal review only; never adopts a changed native ledger source. */
export function EventFinancePayoutReviewV1({view,enabled=false,onAction}:{view:EventFinanceSectionViewV1;enabled?:boolean;onAction:(action:EventFinanceActionV1,expectedView:EventFinanceSectionViewV1)=>void}) {
 const id=useId(), [input,setInput]=useState({key:'',reason:''});
 if(!enabled)return null;
 const review=view.payoutReview;
 if(!review)return null;
 if(review.status==='not_required')return null;
 if(review.status==='blocked')return <section className={styles.alert} aria-label="Payout Review"><p role="status">Payout review is unavailable. Retained amounts are unchanged. Finish any open edit; changed source records require a separate review.</p></section>;
 const reason=input.key===review.reviewKey?input.reason:'';
 return <section className={styles.details} aria-labelledby={`${id}-title`}>
  <h3 id={`${id}-title`}>Review Payouts After Fund Changes</h3>
  <p>Review the amounts below before continuing. Manual group amounts are retained. Formula amounts can change with the fund. This does not save a ledger record or make a payment.</p>
  <dl className={styles.figures}><dt>Previous Proposed Fund</dt><dd>{money(review.previousFundMinor)}</dd><dt>Current Proposed Fund</dt><dd>{money(review.currentFundMinor)}</dd><dt>Proposed Awards After Review</dt><dd>{money(review.proposedTotalMinor)}</dd><dt>Fund Minus Awards</dt><dd>{money(review.differenceMinor)}</dd></dl>
  <div className={styles.scroll} role="region" aria-label="Payout Review Amounts" tabIndex={0}><table className={styles.table}><caption>Per-Person Amounts — Equal Within Each Group</caption><thead><tr><th scope="col">Places</th><th scope="col">Before</th><th scope="col">After Review</th><th scope="col">Method</th></tr></thead><tbody>{review.groups.map(group=><tr key={`${group.firstPlace}:${group.lastPlace}`}><th scope="row">{group.firstPlace===group.lastPlace?group.firstPlace:`${group.firstPlace}–${group.lastPlace}`}</th><td>{money(group.previousPerPersonMinor)}</td><td>{money(group.afterReviewPerPersonMinor)}</td><td>{group.manual?'Retained Manual Amount':'Formula'}</td></tr>)}</tbody></table></div>
  {review.differenceMinor!==0&&<p role="alert">The proposed awards do not balance with the fund. Review does not correct this difference.</p>}
  <label htmlFor={`${id}-reason`}>Reason for Review (Required)<textarea id={`${id}-reason`} required disabled={view.blocked} maxLength={2000} value={reason} onChange={event=>setInput({key:review.reviewKey,reason:event.target.value})}/></label>
  <button type="button" disabled={view.blocked||!reason.trim()} onClick={()=>{if(!view.blocked&&reason.trim())onAction({type:'review_payout_basis',reviewKey:review.reviewKey,reason,confirmed:true},view);}}>Confirm These Proposed Amounts</button>
 </section>;
}
