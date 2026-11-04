# Q operating schedule UI/API integration checkpoint

Local UI/API worker scope: new v2 policy/cut contract, verified-subject service-only routes, primary-director page and exact-operation client recovery. Existing v1 policy client, API and immutable review behavior are unchanged. One navigation link was added to the existing v1 page.

## Acceptance implemented

- Explicit equal or graduated choice; graduated selects an exact named chart matching pool fee. No hybrid, implicit scaled chart or unpublished-policy preview.
- Disclosure/reference required before freeze; requests preserve explicit method/ratio/schedule and exact pool version.
- Read-only preview checks current eligible allocation, full exact fee, matching policy acknowledgment, finalized source cards and global blockers. Award/refund text is explicitly unpaid/not executed. Missing service/migration fails closed.
- Director records an observed physical low-card order only with an explicit UI attestation, exact participant UUIDs, source digest and reason. Server owns group, role, freshness and policy validation.
- Mutation persists the exact actor/tournament-scoped recovery envelope before POST; single-flight/repeated click guarded; lost/unknown response retains operation identity; reload reconciliation can clear only matching known result; no automatic replay or storage clearing.
- Contracts reject unknown/extra fields, invalid action/method combinations, duplicate participant/rank identities, unknown cut cards, malformed/source digest data and mismatched result action/pool before clearing recovery.

## Executed checks

- Bundled Node `--experimental-strip-types --test tests/q-operating-contracts.test.mjs`: 5/5 groups pass.
- Targeted ESLint for owned contract/routes/client/page/tests: passes (correct bracket-directory glob used).
- TypeScript run reached one parent-owned in-progress catalog error (`0n` target under ES2020), reported to lead. No owned UI/API type error in that run. Lead completes final aggregate verification after integration.

## Browser gate blocked, not passed

Created `tests/q-operating-browser.mjs` and fictional `tests/fixtures/q-operating-source.mjs`. Actual component plus RecoveryDocumentBoundary/worker fixtures are designed for 390px/1440px exact dollars, equal/graduated/refund/partial previews, chart/disclosure input, repeated-click protection, lost-response reload/retry, server-success reconciliation and observed physical cut payload. APIs are intercepted at localhost only; no real credentials, hosted writes, physical cut proof or SQL persistence is claimed.

The first runner readiness GET to `http://127.0.0.1:3247/publish` failed `connect EACCES`, errno -4092, before launching Chrome. No retry or alternate path was attempted. Harness `finally` closed the task child and removed its generated fixture tree. Failure log: ignored `test-results/q-operating-browser-run.log`. This operation needs scoped approval before retry; browser acceptance remains unrun. No published changes or hosted action in this worker scope.

## Remaining integration

Lead owns migration/catalog/source/SQL integration, independent final review/full verification/publication. Existing membership UI must read new policy IDs/disclosures to generate correct exact acknowledgments; lead was notified. Existing v1 policies/reviews are not adapted to new semantics.

## Additional regular playoff setup integration

At lead request, added optional explicit director-entered first/second/third/fourth percentages to the existing Main prize schedule. `parsePrizePercentBasisPoints` accepts exact positive up-to-two-decimal percentages without floating rounding, exponent, percent sign or currency syntax. Four entries must total exactly 100%; the lead's `combineSemifinalChartShares` converts them to per-person weights, combining third/fourth percentages and splitting equally. No unverified page-one chart data, automatic chart import or ACC-mandated split is claimed.

Conversion is disabled during pending/locked work and does not save. It resets review confirmation and clears applied raw percentage draft. Unapplied percentage text blocks setup completion and saving until explicitly applied or discarded. Existing integer weights, total-award convention and champion-cent rounding are preserved. New `tests/prize-percentage-input.test.mjs` four groups plus existing prize schedule ten groups pass (14 total); targeted lint passes. Pending 3247 browser harness now includes both phone and desktop real-component percent parsing/conversion/dirty-block/review-reset/no-autosave/overflow checks. The denied readiness operation has not been retried.

React best-practices skill was read for the multiple TSX edits: state remains local and serializable, derived selection/preview values are not synchronized by extra effects, recovery identity dependencies remain actor/tournament scoped, controls retain explicit labels, and no third-party UI/auth dependency was added. Final aggregate review remains with the lead.
