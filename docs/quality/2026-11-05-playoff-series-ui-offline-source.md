# Playoff series UI and offline recovery: source checkpoint

## Scope and acceptance

This work adds a default-disabled, injected game-entry UI and retained-action controller. Observable source acceptance: own-name WON/LOST choices, separate submission and own confirmation, stable event/match/generation/game/request binding, persistence before send, exact retry after lost response, no automatic rebase or confirmation, fresh authenticated readback before clearing, and no verification claim from an ACK or cached state. This is not app activation or weekend readiness.

No SQL execution, database fixture, browser/app fixture, real IndexedDB exercise, hosted access, publication, account/role action, invitation or money movement occurred. The private operational activation predicate remains false. Existing drafts and histories were not accessed or changed.

## Implementation

- Controlled, readable `playoff-series-entry-v1` presentation plus injected connected wrapper and pure view projection. Names map to both exact participant IDs in the trusted event/generation. Cached figures are labeled last checked. Recovery remains available without current names/score claims.
- `series-game-client-transport-v1` strictly maps 17-key wire requests to immutable server row IDs; operation identity is actor plus UUID, not global UUID. Explicit row maps permit valid coincident UUID values. Required historical game rows prove a saved action even when the current game advances. Server game reservation/current workspace production is still missing.
- `series-game-offline-v1` stores before sending and uses one active request, epoch cancellation, immutable snapshots, atomic compare-and-swap, fresh-read generation checks, nonregressive history, explicit rejection review, and immutable archival before clearing/replacement. Storage is keyed by actor/tournament/event so a changed match cannot hide earlier pending work. Reconnect does not silently POST or confirm.
- `series-game-retained-v1` is a lazy browser IndexedDB source adapter. Construction does not open storage. Atomic pending/archive transitions preserve unknown/corrupt work; no expiry/sign-out clearing exists. Its actual browser durability has NOT been tested.
- A narrow SQL proposal delta binds immutable actor/event/qualification/slot/request into receipts. It is source-reviewed only and UNEXECUTED. Receipts always deny current verification authority; a separate fresh workspace is required.

## Independent review and source tests

Transport review closed historical game-ID proof and actor-scoped identity mapping. Recovery review closed held initialization/late-CAS reads, mutation of exported pending requests, same-binding stale read regression, and carrying an unsent winner into a new generation. UI review covers cleanup ownership, stale callback dispatch, offline-current labels and recovery visibility. Source/model/SSR checks do not establish mounted React or browser behavior.

Frozen source gate passed: `pnpm verify` exited 0 with 1,672 application tests, six provider checks, dependency audit, ESLint, production build and eight workspace checks. `pnpm verify:handoff` passed six checks. TypeScript, 25 dedicated offline-controller memory cases, three dedicated view groups, transport/protocol tests and static-render checks passed. Independent source reviewers reported no remaining P1/P2. No mounted lifecycle or IndexedDB execution is implied.

The first restricted-network attempt failed resolving npm and stopped before lint/tests. The network-enabled repeat succeeded without vulnerabilities. Logs: `test-results/playoff-series-ui-offline-verify.log` (failed network audit), `playoff-series-ui-offline-verify-network.log` (complete passing gate), `playoff-series-ui-offline-handoff.log`, and `playoff-series-entry-ssr.log`. Reproducible static-render script: `scripts/check-playoff-series-entry-ssr.cjs`.

## Remaining verification and implementation gates

1. Separately authorized isolated PostgreSQL installation, actual roles/ACL, trigger, concurrent game actions, rollback, receipts and first-to-wins runtime tests. No SQL was attempted in this task.
2. Authenticated atomic workspace producer, stable reserved game allocator, no-store transport endpoints and owner/capability integration. The injected interfaces are not backend evidence.
3. Mounted React ownership/lifecycle tests, actual IndexedDB failure/quota/upgrade/concurrent-tab behavior, genuine offline reload/reconnect and two independent signed-in players, plus phone/desktop/200% text visual inspection. These require further authorized runtime testing; none was attempted.
4. Shared-device pending-work/sign-out/recovery integration and usable archive review/export. The adapter preserves archived copies but does not provide an archive management page.
5. Paper/mixed scoring, legacy result/public bracket linkage, linked Consolation eligibility, correction/amendment reconciliation and finance/MRP finalization remain explicitly unsupported by this new series path. Existing guarded legacy and finance backstops are preserved.

This is a source-only checkpoint, not deployed functionality, a database recovery backup, or proof of real-money operation.
