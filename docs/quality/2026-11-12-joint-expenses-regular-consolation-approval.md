# Joint Main/Consolation expenses and regular-only approval

2026-11-12. Local/default off. Source implementation and SQL installation are verified; positive business-transaction acceptance is NOT complete.

## Built

`database/proposals/joint-main-consolation-expenses-v3.sql` consumes exact expense partitions from a real accepted native allocation revision, operation and outcome. It deliberately consumes only the expense intent: older receipt allocations or their raw-source digest are not promoted to current receipt ownership. Every physical expense must still be the latest recorded USD row, appear once, conserve its full amount, and have explicit Main/Consolation regular-cost shares. Missing shares, changed rows, other-event/pool allocations and incomplete expense coverage hold.

The existing Main V3 review writer records a fresh immutable ownership review of Main's assigned costs while retaining receipt/Q/Side derivation. Main's ledger keeps full physical expense rows, including Consolation-only rows, while deducting only Main shares. Consolation's coexistent source consumes the identical reviewed rows once, populates its real expense basis, and requires its separate V3 ownership review. Historic heads are not rewritten. Category mismatch cannot become a usable regular ledger. The Main range validator now supports these conserved two-event cost rows while keeping optional pools owned by Main. Reciprocal sanctioning checks require current matching ledgers and adequate event shares, with no second deduction and no weakening of legacy reuse holds.

The Director ownership/fund projections support the event-owned costs and full physical amount. Source review found a genuine ordering mismatch between Main capture construction order and sorted ledger order; equality now compares unique source-ID sets with exact row/partition equality rather than changing stored digest order.

`database/proposals/regular-consolation-finalization-v1.sql` adds explicit primary-Director approval for completed manual Consolation4 results and existing regular unpaid awards. It pins qualification, ownership, modern prize revision, fund review and award-set IDs, plus the genuine current pool-absence proof. It creates no pool proposal/final, payment, new prize liability, ACC award or submission. Immutable snapshots, insertion-time source revalidation, exact operation recovery and audit follow the existing finalization transaction pattern. The existing final-review API transport/UI now has a separately default-off regular-only branch and retained exact request. This approval does not yet close play through the older Main-only closure transaction.

## Executed evidence

- `test-results/joint-expense-install-20261112/result.json`: final SQL installation passed against actual predecessor migrations/proposals; all dynamic clone anchors compiled. New joint source and regular-only provider returned null while disabled. Public/anon/authenticated/service-role INSERT access to the new snapshot table was absent. No final operations were created. Container removal and absence were verified (`cleaned: true`). No fictional player, receipt, game or approval rows were created by this installation check.
- The first installation exposed an earlier producer defect: replacing `auth.uid()` with bare `actor` generated `actorand`. It was corrected to `(actor)`, then installation passed. A later bounded installation also compiled the new regular-only transaction. These were local schema checks, not a tournament rehearsal or genuine positive collector acceptance.
- Nineteen changed-path tests passed across joint expense decoding, Consolation source/results and final-review contracts. Six receipt-producer tests passed, including the token-boundary regression. Synthetic DTO/mock-RPC tests do not establish provider or database journal acceptance.
- TypeScript no-emit and scoped lint passed. Independent source review returned GO after the source-order fix. No broad suite, hosted changes, release upload, real money or frozen-release modification occurred.

## Exact remaining limits

The positive receipt producer -> accepted joint expense intent -> fresh Main/Con ownership reviews -> approved current fund transaction still needs one coherent fictional fixture using the actual contracts. Installation is not that proof. In particular the current Main Q/Side readers under the two-event context must be exercised, not assumed from source compilation. Signed-in provider/device acceptance remains separate.

This source consumes already-saved explicit expense partitions. It does not add a new allocation-authoring route that bypasses the old native allocator's optional-funding hold. A supported fixture can save expense intent before optional funding and then prove unchanged current physical rows; authoring new shares after pools are funded remains a source gap. No ratio is inferred. Prior whole-expense Main fund reviews that conflict with a later split, prepaid receipt redistribution, unsupported partial fees, income and post-award amendments remain held.

Regular-only approval scope is linked Consolation with four qualifiers, actual independently verified manual series, complete current fund review, and no own optional pools. Positive write/retry/rollback/current-readback of this new approval is not yet database-proven. Event closure for this new snapshot, broader fields and release/provider acceptance remain pending. Membership/API availability and unresolved registration overrides do not block reports; proposed MRPs do not become official awards here.
