"use client";
import { useId, useLayoutEffect, useRef } from 'react';
import styles from './recorded-cost-review-v1.module.css';
export type RecordedCostDispositionV1 = 'unselected' | 'carry_native' | 'restore_native' | 'replace_manual' | 'introduce_recorded';
export type RecordedManualRetirementV1 = 'unselected' | 'retire_voided_manual' | 'retire_zero_manual';
export type RecordedCostDisplayRowV1 = {
 key: string; expenseId: string; expenseEventId: string; expenseVersion: number; allocationRevisionId: string;
 description: string; recordedAt: string; bucket: 'player_benefit' | 'operating_expense'; allocatedMinor: number;
 alias: string; reason: string; disposition: RecordedCostDispositionV1; allowedDispositions: Exclude<RecordedCostDispositionV1, 'unselected'>[];
 replacementLineId: string | null; eligibleManualLines: Array<{ lineId: string; label: string; category: string; amountMinor: number }>;
 beforeMinor: number | null; afterMinor: number | null; warning: string | null;
};
export type RecordedManualCostDisplayRowV1 = {
 key: string; label: string; amountMinor: number; category: string; state: 'active' | 'voided' | 'zero';
 disposition: RecordedManualRetirementV1 | 'replaced'; reason: string; blockedReason: string | null;
};
export type RecordedCostReviewViewV1 = {
 contextKey: string; eventName: string; status: 'ready' | 'pending' | 'blocked' | 'unavailable'; message: string; warnings: string[];
 costRows: RecordedCostDisplayRowV1[]; manualRows: RecordedManualCostDisplayRowV1[];
 fee: { rateMinor: number | null; eligibleCount: number | null; assessmentMinor: number | null; coveredMinor: number | null; uncoveredMinor: number | null;
  eligibleExpenseEvents: Array<{ expenseEventId: string; label: string; amountMinor: number; selected: boolean }>; message: string } | null;
 summary: { oldFundMinor: number | null; newFundMinor: number | null; oldCostsMinor: number | null; newCostsMinor: number | null; payoutTotalMinor: number | null; fundDifferenceMinor: number | null };
 reason: string; reviewed: boolean; canSubmit: boolean; busy: boolean;
};
export type RecordedCostReviewActionV1 =
 | { type: 'cost_disposition'; key: string; value: RecordedCostDispositionV1 }
 | { type: 'cost_alias' | 'cost_reason'; key: string; value: string }
 | { type: 'replace_manual'; key: string; lineId: string | null }
 | { type: 'manual_retirement'; key: string; value: RecordedManualRetirementV1 }
 | { type: 'manual_reason'; key: string; value: string }
 | { type: 'fee_expense'; expenseEventId: string; selected: boolean }
 | { type: 'review_reason'; value: string } | { type: 'reviewed'; value: boolean } | { type: 'submit' };
export type RecordedCostReviewPropsV1 = { enabled?: boolean; view: RecordedCostReviewViewV1 | null; onAction: (action: RecordedCostReviewActionV1, expectedView: RecordedCostReviewViewV1) => void };
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const usd = (n: number | null) => { if (n === null || !Number.isSafeInteger(n)) return 'Not available'; const value = BigInt(n), magnitude = value < BigInt(0) ? -value : value; return `${value < BigInt(0) ? '-' : ''}$${whole.format(magnitude / BigInt(100))}.${String(magnitude % BigInt(100)).padStart(2, '0')}`; };
const count = (n: number | null) => n !== null && Number.isSafeInteger(n) && n >= 0 ? String(n) : 'Not available';
const category = (value: string) => value === 'player_benefit' ? 'Player Benefit' : value === 'operating_expense' ? 'Operating Expense' : value;
const dispositionLabels: Record<RecordedCostDispositionV1, string> = { unselected: 'Choose Explicitly', carry_native: 'Carry Recorded Cost Unchanged', restore_native: 'Restore Current Recorded Amount', replace_manual: 'Replace a Proposed Cost', introduce_recorded: 'Include Additional Recorded Cost' };
const statuses = { ready: 'Review Recorded Costs', pending: 'Review Is Pending', blocked: 'Review Is Blocked', unavailable: 'Recorded Cost Sources Are Unavailable' };
/** Controlled presentation only. Amounts, eligibility, coverage and deductions are
 * supplied by a reviewed adapter. This component neither calculates a fund nor
 * records expenses, allocations, payments or an adoption. */
export function RecordedCostReviewV1({ enabled = false, view, onAction }: RecordedCostReviewPropsV1) {
 const id = useId(), lease = useRef<{ view: RecordedCostReviewViewV1; onAction: RecordedCostReviewPropsV1['onAction'] } | null>(null);
 useLayoutEffect(() => { const current = enabled && view ? { view, onAction } : null; lease.current = current; return () => { if (lease.current === current) lease.current = null; }; }, [enabled, view, onAction]);
 if (!enabled || !view) return <section className={styles.panel} aria-label="Recorded Cost Review"><h2>Recorded Cost Review</h2><p role="status">Recorded-cost review is unavailable. No record can be changed here.</p></section>;
 const locked = view.status !== 'ready' || view.busy;
 const emit = (action: RecordedCostReviewActionV1) => { if (!locked && lease.current?.view === view && lease.current.onAction === onAction) onAction(action, view); };
 const selectedFeeRows = view.fee?.eligibleExpenseEvents.filter(expense => expense.selected) ?? [];
 const invalidFeeSelection = selectedFeeRows.length > 1 || (view.fee?.assessmentMinor === 0 && selectedFeeRows.length > 0);
 const allowFeeChoice = view.fee?.assessmentMinor !== null && view.fee?.assessmentMinor !== undefined && Number.isSafeInteger(view.fee.assessmentMinor) && view.fee.assessmentMinor > 0;
 const canSubmit = !locked && !invalidFeeSelection && view.canSubmit === true && view.reviewed === true && view.reason.trim().length > 0;
 return <section className={styles.panel} aria-labelledby={`${id}-title`}>
  <h2 id={`${id}-title`}>Review Recorded Costs — {view.eventName}</h2>
  <p className={styles.notice}>This reviews existing recorded costs and proposed replacements. It does not create an expense, change an allocation, mark anyone paid, or move money.</p>
  <div role="status" aria-live="polite"><strong>{Object.hasOwn(statuses, view.status) ? statuses[view.status] : statuses.unavailable}</strong>{view.busy && <p>Working on the retained review. Keep pending work intact.</p>}{view.message && <p>{view.message}</p>}</div>
  {view.warnings.length > 0 && <div className={styles.warning} role="alert"><h3>Review Required</h3><ul>{view.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
  <section aria-labelledby={`${id}-costs`}><h3 id={`${id}-costs`}>Current Recorded Costs</h3>
   {!view.costRows.length && <p>No current recorded cost rows are supplied. This does not establish a zero recorded fund.</p>}
   {view.costRows.map((row, index) => <fieldset className={styles.card} disabled={locked} key={row.key}>
    <legend>Recorded Cost {index + 1}: {row.description}</legend>
    <dl className={styles.figures}><dt>Current Allocated Classification — Read Only</dt><dd>{category(row.bucket)}</dd><dt>Current Allocated Amount</dt><dd>{usd(row.allocatedMinor)}</dd><dt>Recorded at</dt><dd>{row.recordedAt}</dd><dt>Prior Proposed Deduction</dt><dd>{usd(row.beforeMinor)}</dd><dt>Proposed Deduction After This Choice</dt><dd>{usd(row.afterMinor)}</dd></dl>
    <p className={styles.help}>Changing the recorded allocation requires its separate guarded workflow. A custom label here is an audit alias, not a reclassification or a second deduction.</p>
    <details><summary>Recorded Evidence and Version</summary><dl className={styles.evidence}><dt>Expense ID</dt><dd>{row.expenseId}</dd><dt>Expense Event ID</dt><dd>{row.expenseEventId}</dd><dt>Expense Version</dt><dd>{count(row.expenseVersion)}</dd><dt>Allocation Revision ID</dt><dd>{row.allocationRevisionId}</dd></dl></details>
    <div className={styles.grid}>
     <label htmlFor={`${id}-choice-${index}`}>Recorded Cost Choice <span>(Required)</span><select id={`${id}-choice-${index}`} required value={row.disposition} onChange={event => emit({ type: 'cost_disposition', key: row.key, value: event.target.value as RecordedCostDispositionV1 })}><option value="unselected">Choose Explicitly</option>{row.disposition !== 'unselected' && !row.allowedDispositions.includes(row.disposition) && <option disabled value={row.disposition}>{dispositionLabels[row.disposition]} — Retained; Unavailable</option>}{row.allowedDispositions.filter(value => Object.hasOwn(dispositionLabels, value)).map(value => <option key={value} value={value}>{dispositionLabels[value]}</option>)}</select></label>
     <label htmlFor={`${id}-alias-${index}`}>Custom Audit Label<input id={`${id}-alias-${index}`} value={row.alias} onChange={event => emit({ type: 'cost_alias', key: row.key, value: event.target.value })} /></label>
    </div>
    {row.disposition !== 'unselected' && <p className={styles.help}>Selected Choice: <strong>{dispositionLabels[row.disposition]}</strong></p>}
    {row.disposition === 'replace_manual' && <label htmlFor={`${id}-replacement-${index}`}>Proposed Cost to Replace <span>(Required)</span><select id={`${id}-replacement-${index}`} required value={row.replacementLineId ?? ''} onChange={event => emit({ type: 'replace_manual', key: row.key, lineId: event.target.value || null })}><option value="">Choose a Proposed Cost</option>{row.replacementLineId && !row.eligibleManualLines.some(line => line.lineId === row.replacementLineId) && <option disabled value={row.replacementLineId}>Retained Proposed Cost — Not Currently Eligible</option>}{row.eligibleManualLines.map(line => <option key={line.lineId} value={line.lineId}>{line.label} — {category(line.category)} — {usd(line.amountMinor)}</option>)}</select></label>}
    {row.disposition === 'restore_native' && <p className={styles.warning}>Restoration uses the current recorded allocation shown above instead of the edited or voided proposed amount. Previous records and edits remain in history.</p>}
    {row.warning && <p className={styles.warning}>{row.warning}</p>}
    <label htmlFor={`${id}-reason-${index}`}>Reason for This Cost Choice <span>(Required)</span><textarea id={`${id}-reason-${index}`} required value={row.reason} onChange={event => emit({ type: 'cost_reason', key: row.key, value: event.target.value })} /></label>
   </fieldset>)}
  </section>
  <section aria-labelledby={`${id}-manual`}><h3 id={`${id}-manual`}>Previously Proposed Costs</h3>
   <p>Every active proposed cost must have an explicit replacement. Voided or zero-dollar proposed lineages need a separate archive choice; they are not assigned to an actual expense.</p>
   {!view.manualRows.length && <p>No manual cost lineages are supplied.</p>}
   {view.manualRows.map((row, index) => <fieldset className={styles.card} disabled={locked} key={row.key}><legend>Proposed Cost {index + 1}: {row.label}</legend><dl className={styles.figures}><dt>Category</dt><dd>{category(row.category)}</dd><dt>Current Proposed Amount</dt><dd>{usd(row.amountMinor)}</dd><dt>Lineage State</dt><dd>{row.state === 'active' ? 'Active' : row.state === 'voided' ? 'Voided' : 'Zero Amount'}</dd></dl>
    {row.disposition === 'replaced' ? <p className={styles.notice}>An explicit recorded-cost replacement is selected for this lineage.</p> : row.state === 'active' ? <p className={styles.warning}>This active proposed cost still needs an explicit recorded-cost replacement. Submission remains blocked.</p> : <><label htmlFor={`${id}-retire-${index}`}>Archive Choice <span>(Required)</span><select id={`${id}-retire-${index}`} required value={row.disposition} onChange={event => emit({ type: 'manual_retirement', key: row.key, value: event.target.value as RecordedManualRetirementV1 })}><option value="unselected">Choose Explicitly</option>{row.state === 'voided' ? <option value="retire_voided_manual">Archive This Voided Proposed Lineage</option> : <option value="retire_zero_manual">Archive This Zero-Amount Proposed Lineage</option>}</select></label><p className={styles.help}>Archiving retains the old lineage in history and creates no expense or deduction.</p><label htmlFor={`${id}-manual-reason-${index}`}>Reason for Archiving <span>(Required)</span><textarea id={`${id}-manual-reason-${index}`} required value={row.reason} onChange={event => emit({ type: 'manual_reason', key: row.key, value: event.target.value })} /></label></>}
    {row.blockedReason && <p className={styles.warning}>{row.blockedReason}</p>}
   </fieldset>)}
  </section>
  <section aria-labelledby={`${id}-fee`}><h3 id={`${id}-fee`}>Sanctioning Assessment and Recorded Coverage</h3>
   {view.fee ? <><dl className={styles.figures}><dt>Rate per Eligible Entry</dt><dd>{usd(view.fee.rateMinor)}</dd><dt>Eligible Entry Count</dt><dd>{count(view.fee.eligibleCount)}</dd><dt>Assessment — Rate × Count</dt><dd>{usd(view.fee.assessmentMinor)}</dd><dt>Recorded Cost Coverage</dt><dd>{usd(view.fee.coveredMinor)}</dd><dt>Uncovered Assessment</dt><dd>{usd(view.fee.uncoveredMinor)}</dd></dl><p className={styles.notice}>Covered expenses are counted once in the cost rows. The assessment is coverage information, not an additional deduction or a payment record.</p>{view.fee.message && <p>{view.fee.message}</p>}<fieldset disabled={locked} className={styles.card}><legend>Choose One Recorded Cost for Coverage</legend>
     {view.fee.assessmentMinor === 0 && <p>A zero assessment requires no expense selection. Clear any retained selection before review.</p>}
     {!allowFeeChoice && view.fee.assessmentMinor !== 0 && <p>Coverage selection is unavailable until the assessment amount is known.</p>}
     {invalidFeeSelection && <p className={styles.warning}>The retained coverage selection is inconsistent. No coverage review can be submitted until it is resolved.</p>}
     {view.fee.eligibleExpenseEvents.length ? view.fee.eligibleExpenseEvents.map((expense, index) => <label className={styles.check} key={expense.expenseEventId} htmlFor={`${id}-fee-${index}`}><input id={`${id}-fee-${index}`} name={`${id}-fee-expense`} type="radio" disabled={!allowFeeChoice} checked={expense.selected} onChange={event => { if (event.target.checked) emit({ type: 'fee_expense', expenseEventId: expense.expenseEventId, selected: true }); }} /><span>{expense.label} — {usd(expense.amountMinor)}<span className={styles.evidenceId}>Expense Event ID: {expense.expenseEventId}</span></span></label>) : <p>No current eligible expense events are supplied. No coverage is inferred.</p>}
     <button type="button" disabled={locked || selectedFeeRows.length === 0} onClick={() => { const selected = selectedFeeRows[0]; if (selected) emit({ type: 'fee_expense', expenseEventId: selected.expenseEventId, selected: false }); }}>Clear Coverage Selection</button>
     <p className={styles.help}>Select at most one current expense event. Its eligible allocation parts may supply coverage; separate expense events are not summed here.</p>
    </fieldset></> : <p>Assessment and expense-coverage evidence are unavailable. No amount is inferred.</p>}
  </section>
  <section aria-labelledby={`${id}-summary`}><h3 id={`${id}-summary`}>Proposed Review Summary — Not Payments</h3><dl className={styles.figures}><dt>Prior Proposed Costs</dt><dd>{usd(view.summary.oldCostsMinor)}</dd><dt>Proposed Costs After Review</dt><dd>{usd(view.summary.newCostsMinor)}</dd><dt>Prior Proposed Fund</dt><dd>{usd(view.summary.oldFundMinor)}</dd><dt>Proposed Fund After Review</dt><dd>{usd(view.summary.newFundMinor)}</dd><dt>Proposed Payout Total</dt><dd>{usd(view.summary.payoutTotalMinor)}</dd><dt>Fund Minus Proposed Payouts</dt><dd>{usd(view.summary.fundDifferenceMinor)}</dd></dl><p>Totals and eligibility come from the reviewed source model. This panel does not adjust awards, fill a funding gap, or approve a final settlement.</p></section>
  <fieldset disabled={locked} className={styles.card}><legend>Explicit Review</legend><label htmlFor={`${id}-review-reason`}>Reason for This Recorded-Cost Review <span>(Required)</span><textarea id={`${id}-review-reason`} required value={view.reason} onChange={event => emit({ type: 'review_reason', value: event.target.value })} /></label><label className={styles.check} htmlFor={`${id}-reviewed`}><input id={`${id}-reviewed`} type="checkbox" checked={view.reviewed} onChange={event => emit({ type: 'reviewed', value: event.target.checked })} /><span>I reviewed the recorded expense versions, explicit proposal replacements, and once-only fee coverage. This does not authorize payment.</span></label><button type="button" disabled={!canSubmit} onClick={() => { if (canSubmit) emit({ type: 'submit' }); }}>Submit Recorded-Cost Review</button></fieldset>
 </section>;
}
