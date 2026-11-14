"use client";
import { useId, useLayoutEffect, useRef } from 'react';
import type { EventFinanceSectionViewV1, EventFinanceActionV1, FinanceEditableCategoryV1 } from '../lib/finance/event-finance-workspace-v1';
import styles from './event-finance-section-v1.module.css';
import { EventFinancePayoutReviewV1 } from './event-finance-payout-review-v1';
export type EventFinanceSectionPropsV1 = { enabled?: boolean; view: EventFinanceSectionViewV1 | null; onAction: (action: EventFinanceActionV1, expectedView: EventFinanceSectionViewV1) => void };
const wholeFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const money = (minor: number | null) => {
 if (minor === null || !Number.isSafeInteger(minor)) return 'Not available';
 const value = BigInt(minor), absolute = value < BigInt(0) ? -value : value;
 return (value < BigInt(0) ? '-': '') + '$' + wholeFormatter.format(absolute / BigInt(100)) + '.' + String(absolute % BigInt(100)).padStart(2, '0');
};
const count = (value: number | null) => value !== null && Number.isSafeInteger(value) && value >= 0 ? String(value) : 'Not available';
const bandName = (first: number, last: number) => first === last ? `Place ${first}` : `Places ${first}â€“${last}`;
const categories: Array<{ key: FinanceEditableCategoryV1; title: string; singular: string; suggestions: string[] }> = [
 { key: 'player_benefit', title: 'Player Benefits', singular: 'Player Benefit', suggestions: ['Sanctioning', 'Trophies', 'Room Rental', 'Meals', 'Coffee', 'Door Prizes'] },
 { key: 'operating_expense', title: 'Expenses', singular: 'Expense', suggestions: ['Room Rental', 'Copying', 'Advertising', 'Cards', 'Miscellaneous'] },
 { key: 'unrestricted_income', title: 'Additional Income', singular: 'Income', suggestions: ['Advertising', 'Donations', 'Fundraising', 'Raffles'] },
];
/** Controlled, proposal-only presentation. No transport, storage, ledger save,
 * payment or finalization action. Native disclosure sections need no local state. */
export function EventFinanceSectionV1({ enabled = false, view, onAction }: EventFinanceSectionPropsV1) {
 const id = useId();
 const details = useRef(new Map<FinanceEditableCategoryV1, HTMLDetailsElement>());
 const addButtons = useRef(new Map<FinanceEditableCategoryV1, HTMLButtonElement>());
 const reviewButtons = useRef(new Map<string, HTMLButtonElement>());
 const bandButtons = useRef(new Map<string, HTMLButtonElement>());
 const description = useRef<HTMLInputElement>(null), bandAmount = useRef<HTMLInputElement>(null);
 const previousLine = useRef<{ category: FinanceEditableCategoryV1; lineId: string | null } | null>(null);
 const previousBand = useRef<string | null>(null);
 const lineKey = view?.lineForm ? `${view.lineForm.category}:${view.lineForm.lineId ?? 'new'}` : null;
 const bandKey = view?.bandForm ? `${view.bandForm.firstPlace}:${view.bandForm.lastPlace}` : null;
 const lineCategory = view?.lineForm?.category ?? null, lineId = view?.lineForm?.lineId ?? null;
 useLayoutEffect(() => {
  if (!enabled) return;
  if (lineKey && lineCategory) {
   const section = details.current.get(lineCategory); if (section) section.open = true;
   description.current?.focus();
  } else if (previousLine.current) {
   const prior = previousLine.current;
   const target = prior.lineId ? reviewButtons.current.get(prior.lineId) : null;
   (target && !target.disabled ? target : addButtons.current.get(prior.category))?.focus({ preventScroll: true });
  }
  previousLine.current = lineCategory ? { category: lineCategory, lineId } : null;
 }, [enabled, lineKey, lineCategory, lineId]);
 useLayoutEffect(() => {
  if (!enabled) return;
  if (bandKey) bandAmount.current?.focus();
  else if (previousBand.current) bandButtons.current.get(previousBand.current)?.focus({ preventScroll: true });
  previousBand.current = bandKey;
 }, [enabled, bandKey]);
 if (!enabled || !view) return <section className={styles.section} aria-label="Event Finance"><h2>Event Finance</h2><p role="status">Finance editing is unavailable. No financial record or payment can be created here.</p></section>;
 const locked = view.blocked;
 const action = (value: EventFinanceActionV1) => { if (!locked) onAction(value, view); };
 const form = view.lineForm, band = view.bandForm;
 const excluded = view.rows.filter(row => !categories.some(category => category.key === row.category));
 return <section className={styles.section} aria-labelledby={`${id}-heading`}>
  <h2 id={`${id}-heading`}>Event Finance</h2>
  <p className={styles.notice}>Local proposal only. Applying a row or adjustment does not save a ledger record, mark anyone paid, or move money.</p>
  <p role="status">{view.blocked ? 'Review required â€” editing is blocked. Your unsaved work is retained.' : view.pending ? 'Unsaved proposal changes.' : 'No unsaved proposal changes.'}{view.message && ` ${view.message}`}</p>
  {view.warnings.length > 0 && <div className={styles.alert} role="alert"><strong>Review Before Continuing</strong><ul>{view.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
  <section aria-labelledby={`${id}-details`}>
   <h3 id={`${id}-details`}>Tournament Details</h3>
   <dl className={styles.figures}>
    <dt>Tournament</dt><dd>{view.tournamentName}</dd><dt>Event</dt><dd>{view.eventName}</dd>
    <dt>Event Type</dt><dd>{view.eventKind === 'main' ? 'Main' : 'Consolation'}</dd><dt>Start</dt><dd>{view.startLabel}</dd>
    <dt>Finance Mode</dt><dd>{view.modeLabel}</dd><dt>Source Entries</dt><dd>{count(view.entryCount)}</dd>
    <dt>Source Paid Entries</dt><dd>{count(view.paidEntryCount)}</dd><dt>Playoff Qualifiers</dt><dd>{count(view.qualifierCount)}</dd>
    <dt>Gross Entry Income â€” Source Basis</dt><dd>{money(view.grossEntryMinor)}</dd>
    <dt>Source Basis Last Saved</dt><dd>{view.savedAt ?? 'Not available'}</dd>
   </dl>
   <p className={styles.muted}>Gross entry income comes from the supplied evidence. It is not inferred by multiplying entry count and entry fee.</p>
  </section>
  {categories.map(category => <details className={styles.details} key={category.key} ref={element => { if (element) details.current.set(category.key, element); else details.current.delete(category.key); }}>
   <summary>{category.title}</summary>
   <p>{category.key === 'unrestricted_income' ? 'Only unrestricted regular-event income can be proposed here. Q-Pool, Side Pool and restricted funds remain separate.' : 'Add custom rows as needed. Corrections and voids retain the prior history.'}</p>
   {view.rows.filter(row => row.category === category.key).map((row, index) => <div className={styles.row} key={row.lineId}>
    <h4>{row.label}{row.voided ? ' â€” Voided' : ''}{row.pending ? ' â€” Unsaved Proposal' : ''}</h4><dl className={styles.figures}><dt>Source Amount</dt><dd>{money(row.basisAmountMinor)}</dd><dt>Proposed Amount</dt><dd>{money(row.amountMinor)}</dd></dl>
    {row.canEdit && <button type="button" ref={element => { if (element) reviewButtons.current.set(row.lineId, element); else reviewButtons.current.delete(row.lineId); }} disabled={locked || !!form} onClick={() => action({ type: 'edit_line', lineId: row.lineId })}>Review {category.singular} {index + 1}</button>}
   </div>)}
   {!view.rows.some(row => row.category === category.key) && <p>No rows recorded in this proposal.</p>}
   <button type="button" ref={element => { if (element) addButtons.current.set(category.key, element); else addButtons.current.delete(category.key); }} disabled={locked || !!form} onClick={() => action({ type: 'add_line', category: category.key })}>Add {category.singular}</button>
   {form?.category === category.key && <fieldset className={styles.row} disabled={locked}>
    <legend>{form.lineId ? `Correct ${category.singular}` : `New ${category.singular}`}</legend>
    <datalist id={`${id}-${category.key}-suggestions`}>{category.suggestions.map(suggestion => <option key={suggestion} value={suggestion} />)}</datalist>
    <p className={styles.muted}>Suggestions are optional worksheet examples, not ACC approval. You may enter any custom description.</p>
    <div className={styles.grid}>
     <label htmlFor={`${id}-${category.key}-description`}>Description <span className={styles.required}>(Required)</span><input ref={description} id={`${id}-${category.key}-description`} required list={`${id}-${category.key}-suggestions`} value={form.label} onChange={event => action({ type: 'line_field', field: 'label', value: event.target.value })} /></label>
     <label htmlFor={`${id}-${category.key}-amount`}>Amount (USD) <span className={styles.required}>(Required)</span><input id={`${id}-${category.key}-amount`} required inputMode="decimal" value={form.amount} onChange={event => action({ type: 'line_field', field: 'amount', value: event.target.value })} /></label>
    </div>
    <label htmlFor={`${id}-${category.key}-reason`}>Reason for This Proposal <span className={styles.required}>(Required)</span><textarea id={`${id}-${category.key}-reason`} required value={form.reason} onChange={event => action({ type: 'line_field', field: 'reason', value: event.target.value })} /></label>
    <div className={styles.actions}>
     <button type="button" disabled={locked || !view.canApplyLine} onClick={() => { if (view.canApplyLine) action({ type: 'apply_line' }); }}>Apply to Unsaved Proposal</button>
     {form.lineId && <button type="button" disabled={locked || !form.reason.trim()} onClick={() => { if (form.reason.trim() && form.lineId) action({ type: 'void_line', lineId: form.lineId, reason: form.reason }); }}>Void This Line with Reason</button>}
     <button type="button" disabled={locked} onClick={() => action({ type: 'cancel_line' })}>Cancel Line Edit</button>
    </div>
   </fieldset>}
  </details>)}
  <section className={styles.details} aria-labelledby={`${id}-fund`}>
   <h3 id={`${id}-fund`}>Regular-Event Fund (Proposed)</h3>
   <dl className={styles.figures}><dt>Source Player Benefits</dt><dd>{money(view.basisBenefitsMinor)}</dd><dt>Source Expenses</dt><dd>{money(view.basisExpensesMinor)}</dd><dt>Source Additional Income</dt><dd>{money(view.basisAdditionalIncomeMinor)}</dd><dt>Source Regular-Event Fund</dt><dd>{money(view.basisFundMinor)}</dd></dl>
   <dl className={styles.figures}><dt>Player Benefits</dt><dd>{money(view.benefitsMinor)}</dd><dt>Expenses</dt><dd>{money(view.expensesMinor)}</dd><dt>Additional Income</dt><dd>{money(view.additionalIncomeMinor)}</dd><dt>Available Regular-Event Fund</dt><dd>{money(view.fundMinor)}</dd></dl>
   <p>Gross entry income âˆ’ player benefits âˆ’ expenses + additional income. Q-Pool and Side Pool money is excluded.</p>
  </section>
  <details className={styles.details}><summary>Separate or Restricted Funds â€” Read Only</summary>
   <dl className={styles.figures}><dt>Excluded Q-Pool Amount</dt><dd>{money(view.excludedQMinor)}</dd><dt>Excluded Side Pool Amount</dt><dd>{money(view.excludedSideMinor)}</dd></dl>
   {excluded.map(row => <p key={row.lineId}>{row.label}: {money(row.amountMinor)}{row.voided ? ' â€” Voided' : ''}</p>)}
   {!excluded.length && <p>No separate or restricted rows are supplied.</p>}
  </details>
  {view.registrationForecast && <section className={styles.details} aria-labelledby={`${id}-forecast`}>
   <h3 id={`${id}-forecast`}>Registration Payout Forecast</h3>
   <p>Planning estimate only for this regular Standard singles event. Registration entries include comped players. Estimated qualifiers are one quarter of entries, rounded up. Official qualification and payouts have not been approved.</p>
   <dl className={styles.figures}><dt>Payout Type</dt><dd>{view.forecastPayoutType}</dd><dt>Increment Factor</dt><dd>{view.forecastIncrementFactor}</dd></dl>
   {view.registrationForecast.status === 'blocked' ? <p className={styles.alert}>Forecast unavailable: {view.registrationForecast.code === 'custom_ratio_paid_count_policy_unresolved' ? '1-in-N is not a Main or Consolation regular-prize method. Review the saved setting.' : 'The entry count, fund or payout settings are not supported for a forecast.'}</p> : <>
    <dl className={styles.figures}><dt>Registration Entries</dt><dd>{view.registrationForecast.entryCount}</dd><dt>Estimated Qualifiers</dt><dd>{view.registrationForecast.estimatedQualifierCount}</dd><dt>Regular Fund Used</dt><dd>{money(view.registrationForecast.fundMinor)}</dd><dt>Requested Paid Places</dt><dd>{view.registrationForecast.comparison.requestedPaidPlaces}</dd><dt>Included Places after Whole-Group Expansion</dt><dd>{view.registrationForecast.comparison.actualPaidPlaces}</dd></dl>
    <p>This forecast uses the current unsaved cost and income proposal and saved payout settings. It excludes Q-Pool and Side Pool funds, manual payout adjustments and player recipient assignments.</p>
    {view.registrationForecast.comparison.cutoffWarning && <p className={styles.alert}>{view.registrationForecast.comparison.cutoffWarning}</p>}
    <div className={styles.scroll} role="region" aria-label="Registration Forecast Table" tabIndex={0}><table className={styles.table}><caption>Estimated Finishing Groups - No Awards or Payments</caption><thead><tr><th scope="col">Finishing Group</th><th scope="col">Players</th><th scope="col">Per Person</th></tr></thead><tbody>{view.registrationForecast.comparison.bands.map(row => <tr key={`${row.firstPlace}:${row.lastPlace}`}><th scope="row">{bandName(row.firstPlace,row.lastPlace)}</th><td>{row.people}</td><td>{money(row.perPersonMinor)}</td></tr>)}</tbody></table></div>
    <p>Forecast total: <strong>{money(view.registrationForecast.comparison.roundedAwardsTotalMinor)}</strong></p>
    {view.registrationForecast.comparison.balanceWarning && <p className={styles.alert}>{view.registrationForecast.comparison.balanceWarning} Review is required; no automatic balancing adjustment is made.</p>}
   </>}
  </section>}
  <EventFinancePayoutReviewV1 enabled view={view} onAction={(value,expected)=>{if(expected===view)action(value);}} />
  <section className={styles.details} aria-labelledby={`${id}-calculated`}>
   <h3 id={`${id}-calculated`}>Calculated Payouts (Proposed)</h3>
   <p>Requested paid places: {count(view.requestedPaidPlaces)}. Included Places after whole-group expansion: {count(view.actualPaidPlaces)}. Places With Positive Proposed Awards: {count(view.positiveAwardPlaces)}. These amounts are not payments.</p>
   <div className={styles.scroll} role="region" aria-label="Calculated Payout Table" tabIndex={0}><table className={styles.table}><caption>Calculated Amounts â€” Equal Within Each Finishing Group</caption><thead><tr><th scope="col">Finishing Group</th><th scope="col">Players</th><th scope="col">Per Person</th></tr></thead><tbody>{view.payoutBands.map(row => <tr key={`${row.firstPlace}:${row.lastPlace}`}><th scope="row">{bandName(row.firstPlace, row.lastPlace)}</th><td>{row.people}</td><td>{money(row.calculatedPerPersonMinor)}</td></tr>)}</tbody></table></div>
   {!view.payoutBands.length && <p>Calculated amounts are not available.</p>}<p>Calculated total: <strong>{money(view.calculatedTotalMinor)}</strong></p>
  </section>
  <section className={styles.details} aria-labelledby={`${id}-adjusted`}>
   <h3 id={`${id}-adjusted`}>Actual Payout Amounts (Proposed)</h3>
   <p>These are proposed amounts to use, not amounts paid. A change applies to every player in the entire finishing group. No automatic balancing adjustment is made.</p>
   <div className={styles.scroll} role="region" aria-label="Adjusted Payout Table" tabIndex={0}><table className={styles.table}><caption>Adjusted Proposals â€” No Disbursements</caption><thead><tr><th scope="col">Finishing Group</th><th scope="col">Per Person</th><th scope="col">Group Total</th><th scope="col">Review</th></tr></thead><tbody>{view.payoutBands.map(row => <tr key={`${row.firstPlace}:${row.lastPlace}`}><th scope="row">{bandName(row.firstPlace, row.lastPlace)}{row.adjusted ? ' â€” Adjusted' : ''}</th><td>{money(row.adjustedPerPersonMinor)}</td><td>{money(row.bandTotalMinor)}</td><td><button type="button" ref={element => { const key = `${row.firstPlace}:${row.lastPlace}`; if (element) bandButtons.current.set(key, element); else bandButtons.current.delete(key); }} disabled={locked || !view.canEditPayout || !!band} onClick={() => action({ type: 'edit_band', firstPlace: row.firstPlace, lastPlace: row.lastPlace })}>Review {bandName(row.firstPlace, row.lastPlace)}</button></td></tr>)}</tbody></table></div>
   {!view.payoutBands.length && <p>Adjusted amounts are not available.</p>}
   <dl className={styles.figures}><dt>Proposed Payout Total</dt><dd>{money(view.adjustedTotalMinor)}</dd><dt>Proposed Total Minus Regular Fund</dt><dd>{money(view.differenceMinor)}</dd></dl>
   {view.differenceMinor !== null && view.differenceMinor !== 0 && <p className={styles.alert}>The proposed payout total does not equal the available regular-event fund. Review is required; no payment is authorized.</p>}
   {band && <fieldset className={styles.row} disabled={locked}><legend>Adjust Entire Group: {bandName(band.firstPlace, band.lastPlace)}</legend>
    <label htmlFor={`${id}-band-amount`}>Per-Person Amount (USD, $5 Increments) <span className={styles.required}>(Required)</span><input ref={bandAmount} id={`${id}-band-amount`} required inputMode="decimal" value={band.amount} onChange={event => action({ type: 'band_field', field: 'amount', value: event.target.value })} /></label>
    <label htmlFor={`${id}-band-reason`}>Reason for This Adjustment or Restoration <span className={styles.required}>(Required)</span><textarea id={`${id}-band-reason`} required value={band.reason} onChange={event => action({ type: 'band_field', field: 'reason', value: event.target.value })} /></label>
    <div className={styles.actions}><button type="button" disabled={locked || !view.canApplyBand} onClick={() => { if (view.canApplyBand) action({ type: 'apply_band' }); }}>Apply Whole-Group Proposal</button><button type="button" disabled={locked || !view.canRestoreBand} onClick={() => { if (view.canRestoreBand) action({ type: 'restore_band' }); }}>Restore Calculated Amount with Reason</button><button type="button" disabled={locked} onClick={() => action({ type: 'cancel_band' })}>Cancel Group Edit</button></div>
   </fieldset>}
  </section>
  <p className={styles.muted}>Retained finance history: {view.historyRecordCount} records. Retained payout-adjustment history: {view.overrideRecordCount} records. Corrections append history; they do not rewrite previous records.</p>
 </section>;
}
