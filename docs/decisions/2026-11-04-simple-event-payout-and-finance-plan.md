# Simple regular payout settings and separate Finance — local plan2026-11-04

## Setup replacement

User requests Payout Type: Graduated,1-in-#(Custom),Top#(Custom), plus incrementfactor default1.5 and editable. Apply to Main/Consolation regular event payouts, not voluntary Q/Side pools. Preserve all old immutable declarations/disclosures/audit records and current activation checks until new versioned settings replace their contract. Do not merely hide required fields or force arbitrary legacy weights.

Parent verified MainCon Sheet mapping: fund=entrycount×entryfee−playerbenefits−expenses+additionalincome. Factor1.5 advances knockout finish-band weights (1st,2nd,3–4,5–8 etc), not Side's per-rank formula.10qualifiers in40×50 example, benefits120/expenses100/income20 =>fund1800, worksheet calculated1805 before adjustment. The raw source-model output must remain distinguishable from a separately reviewed fund-conserving alternative; a red/green total alone does not prove method correctness or payment.

User confirmed Custom1-in-N/TopN changes PAID FINISHING PLACES ONLY, with factor controlling group increases. Sanctioned qualification remains fractional-quarter rounded UP. Still unresolved: the ratio population/paid-count rounding, a cutoff inside an equally placed knockout band, and whether any awards beyond qualifiers are permitted. Do not infer these from the Sheet, which does not define the new modes. Current code cannot safely finalize a partially paid tied band by picking IDs or changing qualification.

## Separate Finance

Sections: tournamentdetails, benefits, expenses, additionalincome, calculatedpayouts and actualpayouts. Spreadsheet's suggested labels can seed UI, but they do not establish ACC eligibility. In particular roomrent appears in both Sheet benefit/expense rows and requires correct source classification; do not automatically count it as eligible playerbenefit. Door-prize print omission and lookup-table5–128 limitation are source defects, not app rules.

Use stable line IDs, amount integer cents/approved denomination, event/fund scope, provenance estimate/documentedactual/simulation, attachment/reference and reviewed classification. Add custom rows without an arbitrary business count limit; paginate/batch safely. Append corrections/voids rather than overwriting audit. Two events must never silently share expenses or a financial source; split allocation requires explicit reconciled amounts.

Optional Q/Side contributions stay restricted to their own elected, paid, eligible pools. Regular expenses do not reduce these funds implicitly. Additionalincome should have explicit fund/purpose; unclassified/restricted money must not become distributable automatically. Totals distinguish budget estimates, funds received/allocated, calculated awards, manual override proposals, approved obligations and recorded disbursements.

An editable actual-payout cell in the Sheet is an override proposal, not proof of cash movement. App needs separate reason/review/history, total balance AND equal-place/method checks, then existing authorized payment evidence. No actual funds/payment writes are authorized by current local design work.

## Implementation sequence

1. Preserve the confirmed paid-place/qualification separation; resolve remaining Custom cutoff/count semantics. The local source-model comparison now retains exact raw outputs; it is not an operational award method.
2. Add simple Setup presentation backed by reviewed settings/disclosure pins; preserve historic declaration read/replay. No blanking old records.
3. Add event-scoped Finance estimates/custom rows and classification review using existing ledger/source ownership safeguards.
4. Recompute immutable funded awards; require exact conservation, equal-place protection, stale-source rejection and independent review where required.
5. Separately authorize disposable database lifecycle/role/concurrency tests, then a reviewed staging release with verified recovery. No hosted action now.

This is a plan, not delivered Finance functionality. CustomN transaction candidates and playoffseries controls remain separate checkpoints.

## Implemented comparison/proposal checkpoint (local only)
`maincon-source-model-v1.ts` reproduces verified raw rounded285vs280 and1805vs1800 outcomes using exact rational geometric weights. No automatic balancing or qualifier calculation. Its uniform-entryfee×entrycount budget assumes no waivers/partialpayments; future actual Finance must use confirmed ledger gross and separate played/paid/comp counts, not pretend every entrant paid.
`maincon-proposed-payouts-v1.ts` validates retained/current event+source+completebudget assumptions, reasoned whole-band$5 adjustments and independent fund/rank/zero-paid checks. A435→430champion proposal balances the1800example, but review/finalization/paymentauthority remainsfalse. Balancing by swapping champion/runner-up awards still flags rankviolation; a shared3–4band cannot be split. Four puretests and independentreview passed. No ledgerwrites, paymentrecords, liveUI replacement or actualfinancialfinalization exists in this checkpoint.
Old declaration presentation is not removed until compatible versioned settings, actual Finance sources and approval/activation safeguards work. Historical rules/receipts remain immutable. Director adjustments are proposals with reason/history, not evidence of cash disbursement.
