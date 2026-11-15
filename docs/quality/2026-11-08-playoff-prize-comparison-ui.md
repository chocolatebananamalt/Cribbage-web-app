# Read-only Playoff prize comparison UI

Implemented `PlayoffPrizeComparisonV2({plan, field, fundMinor})` with local CSS.
It calls the lead-owned pure comparison calculator, shows the supplied fund,
method, requested/actual paid counts and equal finishing-group per-person/total
proposals. Paid-count expansion has its own section when the calculator supplies
a warning. Fund balance, zero-rounded groups and first-round intention status
are separate. Source-model nearest selected-increment rounding is explicit;
amounts and differences are not redistributed or solved to meet an intention.
The component has no inputs, actions, storage, recipient assignment, finalization
or payment authority. Nothing was wired into Setup, hosted Finance or a provider.

Money uses the existing integer-cent `formatFinanceMoneyV1` formatter. Review
identified that `Intl(minor / 100)` loses a cent near the supported safe-integer
limit. The actual component now renders `MAX_SAFE_INTEGER - 100` cents as
`$90,071,992,547,408.91`, with the exact `$0.09` rounding discrepancy. The
technical-limit message is ASCII-only to avoid smart-apostrophe ambiguity in
shell displays. The final proof was rerun after both corrections.

Executed commands, all exit 0:

- `node tests/playoff-prize-comparison-offline-browser.mjs`
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- `node node_modules/eslint/bin/eslint.js src/components/playoff-prize-comparison-v2.tsx tests/playoff-prize-comparison-offline-browser.mjs`

The offline harness bundles the actual component, actual calculator, existing
money formatter and actual app global CSS using the installed compiler. Four
fresh Playwright Chrome contexts use widths 320/390/768/1440, remain at
`about:blank`, block service workers, run offline, abort all external routes and
set CSP `connect-src 'none'`. No navigation, server or dependency install occurs.

Seventeen fictional cases passed at every width: the MainCon 40-entry/$280
source baseline; equal; Top Four; winner multiplier; winner takes all; regular
$1/$10 increments; satisfied/unsatisfied/incompatible/missing entry-fee
intentions; missing first-round evidence; zero-rounded groups; exact cents near
the supported limit; unknown field; incomplete factor; and excess paid places.
The baseline keeps $70/$45/$30/$20/$15 per person and $285 total against $280.
Winner multiplier keeps $275 total and exposes $5 unallocated. Whole-group
equality, read-only controls and unchanged input drafts were checked.

Representative over- and under-fund displays passed normal and doubled computed
text at all four widths, with no horizontal page overflow. Their screenshots
were visually inspected. No keyboard interaction is required within this
read-only component; the only controls belong to the fictional test-case picker.

Evidence: `test-results/playoff-prize-comparison-offline/result.json`,
`observations.json`, and sixteen source/under WIDTH/SCALE screenshots. Observed
requests, page errors and frame navigations are empty. Result JSON records
SHA-256 for the component, CSS, calculator and formatter, and the harness checks
those sources did not change during the browser run. Final component SHA-256:
`e66a6a19b628d30a93d08ea6653e79a465aeaeada58492906154071dbc1a4717`.

Coverage limit: the current valid recipient choices are All and powers of two,
plus winner-only. None can request a partial equal finishing group, so the
calculator's paid-count expansion warning is not naturally reachable with valid
V2 input. The display branch is present; no unsupported Top Six option or new
policy was invented to exercise it.

Independent final source review reported GO after the quote/cent-format fixes.
This proof concerns proposal rendering only. It does not establish provider or
ledger authority, official payout policy, final awards, disbursement, database
acceptance, full Finance integration or production readiness. No DB, hosted
action, grant or previously denied navigation/audit action was attempted.
