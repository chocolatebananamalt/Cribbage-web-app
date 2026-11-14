# Separate Event Finance section: source-only checkpoint

## Authorized scope and acceptance

Prepare the user-requested separate Finance section around the reviewed local models: tournament/event details; player benefits; expenses; additional income; calculated payouts; and director-adjustable payout proposals. Preserve whole equal finishing groups, $5 payout increments, independent fund-balance warnings, immutable reasons/history, Q-Pool/Side Pool isolation, pending truthfulness and historical records. No Main/Consolation payout policy or source model is silently replaced.

No database, SQL, fixture, browser/app launch, actual IndexedDB, hosted record read/write, role change, invitation, publication or payment action was performed. The new section is default disabled and has no live route or persistence transport. It is not an operational Finance release.

## Implemented

- `event-finance-workspace-v1.ts`: strict complete source contract, pure editor reducer and presentation projection. Gross income is explicit source evidence, not count multiplied by fee. Source totals and proposed totals are separate. Unknown counts remain unavailable; complete known zero is distinct. Optional-pool source totals stay read-only and visible even when proposed regular expenses exceed the regular fund.
- Benefits, expenses and unrestricted additional income support free custom descriptions and repeated rows; familiar worksheet labels are optional suggestions, not ACC eligibility/approval decisions. Corrections and voids append immutable histories with required reasons. There is no preset-row business cap; the existing 10,000-record processing bound refuses further records without truncation.
- `event-finance-editor-controller-v1.ts`: default-off local state, frozen snapshots, exact rendered-view leases to reject old callbacks, source-change blocking with unsaved work retained. No storage/Save/receipt/payment API exists. State is in memory; navigation durability and archive delivery are NOT implemented or promised.
- `event-finance-section-v1.tsx` and scoped CSS: separate Tournament Details, Player Benefits, Expenses, Additional Income, regular fund, separate funds, Calculated Payouts and Actual Payout Amounts (Proposed). Source-versus-proposal figures, unsaved status, required reasons, cancel/restore, captions/headers and non-color warnings are visible. Tables can scroll horizontally; phone grids stack; controls have 56px minimum targets and figures use 20px type. Exact minor-unit formatting avoids floating-point cent loss.
- Whole-group payout adjustments reuse the reviewed source-bound model. Top 6 expands to the full equal 5th-8th finishing group, with requested/included/positive-award counts separate. Per-person overrides apply to the entire group in $5 increments, preserve history and warn independently about imbalance, rank reversal and zero awards. Manual values are not proof of payment.
- Any change to the full planning history, including net-zero or description-only changes, freezes prior adjustments rather than silently rebasing them. Prior amounts and reasons are retained for explicit later review.

## Policy and integration boundaries

The existing fund model uses source-sheet nearest-$5 rounding and displays over/under allocation; it does not automatically invent a balancing payment or change a pool policy. Custom Main/Consolation 1-in-N recipient-count population/rounding and payments beyond qualifiers remain blocked by the reviewed model. Qualification itself is not changed. Restricted/unclassified income requires review; it is not treated as regular payout funding. No optional-pool transfer/reclassification editor exists.

The old regular payout declaration and other operational safeguards remain in place until a tested replacement activation/save path exists. The new UI does not remove them. Actual disbursements, receipts and authorized financial finalization are absent; the heading explicitly marks adjusted actual-amount choices as proposals.

## Evidence

Focused pure model/controller tests: 16 groups passed, covering explicit gross, source rounding discrepancy, 25 custom rows, correction/void history, invalid/unsafe money, equal-band expansion and override/restore, full-basis staleness even for net-zero changes, optional-pool isolation, unknown versus zero, negative fund, stale callbacks and source updates. TypeScript and focused ESLint passed.

`node scripts/check-event-finance-section-ssr.cjs` passed static render checks for default-off behavior, the requested sections, null/zero money, source/proposed values, required reasons and blocked forms, unique labels, whole-band warnings, exact maximum-safe minor units, view leases and suggestions. CSS source checks cover wrapping, stacking, focus and scroll regions. These are NOT mounted/browser responsive or accessibility certification.

Two independent source reviews reported no remaining P1/P2 in the model/controller or component/CSS. Full `pnpm verify` exited 0: 1,688 application tests, six provider checks, dependency audit (no known vulnerabilities), ESLint, production build and eight workspace checks. `pnpm verify:handoff` passed six checks. Logs: `test-results/event-finance-ui-verify.log`, `event-finance-ui-handoff.log`, `event-finance-section-ssr.log`. No runtime database or browser acceptance is implied.

## Remaining gates

- Authenticated, atomic, complete source producers and validated event/role ownership; injected props alone establish no real permission or receipt authority.
- Reviewed durable save/amend/retry/recovery and archive workflow, with isolated runtime SQL/ACL/concurrency proof and explicit later staging authorization. No database was created or run here.
- Actual browser phone/desktop/200% text, keyboard/focus/error/live-region and screen-reader tests; mounted controller integration; navigation/reload preservation. These were not attempted during the hold.
- Source refresh/rebinding decisions when existing payout proposals are stale; no discard/rebase button has been invented.
- Final paid-entry/result evidence, expense classification approval, any unresolved payout policy, real disbursement reporting and financial closure. This checkpoint is not weekend or real-money readiness.
