# Satellite recorded fund-to-entered-award reconciliation — local candidate

2026-11-10. No hosted change, public upload, access activation or money movement.

## Inspection and bounded implementation

The existing Satellite Sheet module is an amount-only comparison, with explicit blocks for one recipient, below-baseline fund, rounded-baseline conflicts, unresolved ties and source-row coverage. Existing Satellite results save manually entered regular/Q/Side amounts, not funded liabilities. Main/Con Finance and native additional-income journals depend on playoff proposal/recipient models; relabeling those as Satellite would fabricate support.

New private default-off `database/proposals/satellite-recorded-reconciliation-v1.sql` reserves the existing current native allocation read and current Satellite result/participant identity. It reads active standard-singles Satellite events only. Missing/stale allocations, unreviewed/reopened results and known Satellite income requiring a proper bridge block. No new table, public RPC, grant, calculation, receipt or writer.

New `src/lib/finance/satellite-recorded-reconciliation-v1.ts` independently projects selected-event regular receipts minus selected-event classified benefits/costs; sibling event and Q/Side money cannot fill the regular prize fund. It binds current result participant IDs to distinct roster IDs (not names), sums already-entered regular awards, and reports matches/unallocated/overallocated with signed difference. Optional entered awards remain separately labeled funds-unverified. It never changes awards or claims receipt verification, complete income/fund review, independent sporting placement proof, final awards or disbursement. A match means only that entered regular awards equal the current recorded allocation amount.

## Verification and limits

Eight unit groups passed: event/pool isolation, identical display names, signed over/under balance, stale allocation/scope rejection, reopened/missing review evidence, ambiguous/manual/team IDs, unreviewed/mixed/unsafe sources, and preservation of historical cent amounts without silently rounding. TypeScript and focused ESLint passed. The original pure-source checkpoint was subsequently extended by the verified local runtime and default-off view below; there is still no operational award writer. Independent source review completed: no high-confidence defect found in current-source/result atomicity, separate-fund math or false-authority handling. The original source-only review preceded the runtime/view follow-up below. No tournament simulation or database fixture was needed for the initial pure checks.

## Actual decisions before automatic Satellite awards

1. **One paid place:** 4 entrants, $10 fee, 1-in-4, $40 event fund. Sheet graduated denominator for the baseline branch is zero when p=1. Should the single recipient receive the full fund? Current module holds `one_recipient_undefined`.
2. **Low fund:** 20 entrants, $10 fee, 1-in-6 means four paid places. A $40 net fund cannot pay the Sheet's $12.50-per-person baseline ($50 total). Should the baseline be lowered/replaced, or require director adjustment? Current module holds `fund_below_source_baseline`; no pool/sibling money is borrowed.
3. **Baseline after rounding:** 18 entrants, $10 fee, 1-in-6, $100 net fund: raw prizes $54.166..., $33.333..., $12.50. Independent nearest-$5 gives $55/$35/$15 = $105. Conserving largest-remainder gives $55/$35/$10 = $100 but drops last prize below $12.50. Is 125% a formula reference or a hard post-round minimum? Current module holds `rounded_baseline_unresolved`. Do not silently pick $55/$30/$15 or another distribution.

Unresolved sporting ties require verified order before assigning individual ranked awards. Thirty-row Sheet evidence is a source-coverage limitation, not an ACC maximum. Existing Satellite payout ratio wording is not changed by regular Main/Con policy discussion. A real authoritative Satellite income/completeness review, final recipient eligibility, durable unpaid awards and provider acceptance are still required for financial readiness.


## SQL runtime and Director view follow-up

- Successful local proof: test-results/satellite-reconciliation-2026-11-10T08-01-45-583Z/satellite-reconciliation-proof.json; cleanup.json confirms exit0 and database/container absent by exact ID/name. Uses the hash-verified fictional funded checkpoint (zero real emails/auth sessions). A fictional Consolation event was converted to Satellite metadata without disabling guards so the reader could exercise existing split receipts. **This is not normal Satellite setup, enrollment, Start or result-entry end-to-end proof.** No games were replayed.
- Actual SQL tests: defaultfalse/private ACL; outsider held; non-Satellite rejected; reviewed result required; authenticated public wrapper ACL excludes anon/service;16000c selected event receipts compare with16000c entered awards; reopened and manual-team IDs held; corrected awards show500c over-allocation; valid500c cost classification changes recorded Satellite amount to15500c with a new source/allocation revision; Main receipt history unchanged.
- Earlier harness import and invalid fee-cap test-amendment attempts were corrected after cleanup was verified. Fee guards were not weakened; the valid follow-up classified an existing expense instead of exceeding Main's entry-fee cap. All owned disposable attempts were removed.
- Added separate proposed authenticated cookie SQL wrapper. It delegates to the private role/gate check; no hosted grant or installation. The private gate remains false in source.
- Added server-only normal-cookie provider with captured actor/event, verified user/session and Director/Co-director role both before and after the RPC. Returns only the validated event comparison, never raw tournament ledger. Page gate is literal false, so current page behavior makes no new source call. Provider unavailable/foreign/stale states display unavailable, never zero funds.
- Added read-only view on Satellite Results before the result editor. It names the event and saved result/allocation versions, excludes unsaved edits, reports signed mismatch without changing any amounts, and never approves awards. Existing manual result workflow unchanged.
- Twelve focused unit groups (8 reconciliation+4 provider), TypeScript and scoped lint passed. Actual React offline about:blank390/768/1440 enlarged-text checks passed null/unavailable, balanced/over/under, explicit separate pools/coverage warnings, zero controls and zero network requests. Evidence test-results/satellite-reconciliation-view-20261110/result.json and screenshots. Conservative harness CSS, not full app visual acceptance.
- Real signed-in cookie/provider, normal Next navigation/refresh and full reload acceptance remain unverified. Automatic formula policy decisions above, Satellite income/completeness review and durable final unpaid award records remain blockers to payout readiness. No publication retry, hosted change or real money.

Independent follow-up review: source GO, no high-confidence authorization, saved-event binding or false-authority defect. Normal cookie pre/post actor/SID/role and authenticated-only wrapper confirmed in source; actual session/full navigation remains unproved.
