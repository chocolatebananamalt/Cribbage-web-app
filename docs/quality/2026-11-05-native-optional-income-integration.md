# Native optional income and legacy-first accounting - local verification

Scope: extend the private, default-off V2 Finance path with immutable additional-income corrections and a V3 fund review, while preserving regular/Q-Pool/Side Pool separation and genuine historical finals. No hosted access, publication, actual payment, invitation or credential change is part of this work.

## Acceptance and implementation

- New income records bind genuine V2 proposal and ownership revisions. Shared physical-evidence roots have no fabricated V1 proposal FK. A correction replaces the active amount; it is not an additional cash receipt. Voids are explicit append-only records.
- The full pending proposal suffix must match the recorded journal. Orphan roots and incomplete histories block review rather than mean zero income. Receipt/reference collisions, cross-domain journal reuse, stale sources and revoked-role replay are rejected.
- Additional income changes only the regular event fund. Q-Pool and Side Pool funds remain separate. Costs, including matching sanctioning coverage, are subtracted once.
- V3 fund review pins the income head and complete source. A correction requires a new review. Existing zero-income review rows, full source JSON/digest and exact replay survive installation unchanged.
- The final writer retains atomic all-or-nothing unpaid award recording, exact retries, concurrency and current-role checks. There is no new refund or disbursement operation.
- A genuine historical V9 final blocks native ownership, Finance, income and final liability creation. Tests preserve the original final, draft and operation receipt.

## Runtime evidence

Canonical income run `test-results/native-optional-income-v3-2026-11-05T19-51-33-613Z` exited zero. It installed the 94 prior SQL inputs, created and captured a genuine zero-income V2 review, then installed the two current income candidates. Before/after review row, full old source/hash and old exact replay match. Four income versions across two physical roots pass: $100, correction to $150, void to $0, then a separate $200 donation. Orphan-root rejection, incomplete history, physical collision, late child-failure rollback, cross-domain journal rejection, simultaneous writers, exact reconciliation, stale review, revoked-role replay and post-final rejection pass.

The independent Python oracle imports no app calculation helpers. It verifies $810 native receipts plus $200 active additional income minus $50 costs equals $960 unpaid awards: regular $630, Q-Pool $170 and Side Pool $160, in 12 recipient/fund rows. The regular equal finishing band receives $110 each; all amounts are $5 multiples. Corrections are not summed as cash. Exact full-source capture and old-zero equality pass. A separate live-local read-only catalog check verifies 21 private tables and 52 routines, postgres ownership, forced RLS, pinned search paths and no anon/authenticated/service_role direct privilege. The fixture was removed after completion; no payment or refund occurred.

The canonical legacy-first run is `test-results/native-optional-legacy-first-v2-2026-11-05T19-45-51-295Z`. It installed the income stack and exited zero. It created one genuine V9 unpaid final using the existing V10 combined writer, then rejected all new native liabilities. The direct V2 trigger returned `other_final_award_liability_exists`; all seven V2 and three income/root counts remained zero. Frozen helper assertions compared the full original final/draft/receipt and fingerprint before and after. An independent review confirmed all 138 frozen inputs, actual rejection codes and cleanup receipt. This run predates the later SQL table-alias correction; its exact earlier bytes remain in frozen inputs, not misrepresented as current.

Two early installation runs failed a generated-function `THEN` anchor; a subsequent income run reached exact old-zero upgrade compatibility, then the orphan-root assertion exposed a SQL alias/PLpgSQL-variable ambiguity. Both fixes were narrow, independently reviewed and all failed disposable containers were removed. Diagnostic logs and frozen inputs are retained.

## Suite and review

`pnpm verify` exited zero: dependency audit has no known vulnerabilities; lint has zero errors and 119 existing warnings; 1,980 app tests, provider checks, optimized build and eight workspace tests pass. Six handoff tests pass. No application UI changed in this extension, so earlier responsive UI evidence remains bounded to that earlier UI checkpoint rather than a new provider session.

Independent source review covered immutable V2 FKs, income lineage, SQL alias fix, exact old-zero compatibility, locks/CAS/current-role ordering, source-size/integer bounds and final atomic composition. Boundary conditions not exercised in actual SQL must not be described as runtime-certified.

Independent executed-evidence review confirmed all 142 current/frozen canonical income hashes, exact old-zero source/row comparison, lineage, fund/recipient arithmetic, full source capture, concurrency and role/closure checks. The six disposable containers created in this phase (successful and diagnostic) were independently confirmed absent by exact IDs and names. Final workspace checks pass after the status update. The archive receipt `test-results/native-optional-income-checkpoint-archive.json` records the preserved source/evidence archive hash and limitations.

## Limits and release gates

All tests use explicitly fictional isolated bookkeeping. Sixteen identity-bound digital participants and native game confirmations prove protocol behavior, not independent humans or actual Supabase provider sessions. Initial profiles, qualification schedule/scores, Start snapshot and sanctioning assessment remain synthetic. This is not the planned 18-person mixed rehearsal, normal physical movement, or bank/payment evidence.

Unsupported funded Consolation, Satellite, mixed-mode playoffs, five-qualifier/18-player completion, post-final amendments and normal-provider/Start acceptance remain blocked. Older legacy writers may be rejected by earlier integration guards; that composed rejection is distinct from executing each new liability trigger branch.

Before any test release: review an isolated manifest and migration/grant dependencies, verify a fresh recoverable staging backup, obtain publication/database approval, and perform provider-role and human acceptance tests. Local source/evidence archives are not hosted database recovery backups, complete checkout backups or off-device storage.
