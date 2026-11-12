# 0240 isolated database validation

**Superseded design:** the tested database-wide writer shutdown is rejected for compatibility. This document preserves historical test evidence, not a recommendation to register or apply that SQL. See `2026-10-27-playoff-compatibility-revision.md`. The recorded proposal hash predates the withdrawal comment added to its header.

Scope: disposable local testing only. No staging or production migration, registration, deployment, hosted record, credential or role change was authorized or performed.

## Runtime and fixture

Used the existing cached official `public.ecr.aws/supabase/postgres:17.11.0.004` image, image ID `b15d862126dd`. Container `cribbage-0240-isolated` was labeled with that exact fixture name, with network `none`, no port bindings and no host-folder mounts. No new image was downloaded. Restored the reviewed empty post-0236 archive, SHA256 `e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc`, then local migrations 0237–0239.

Initial failures were test infrastructure defects, not proposal changes: roster creation happened after registration closed; the setup revision lacked its required director snapshot; and the disposable database was owned by `supabase_admin` while the expected migration owner was `postgres`. Corrected the fixture setup order and complete snapshot, created the disposable database with owner `postgres`, and ran proposal/fixture as `postgres`. Owner, ACL, registration and deferred integrity assertions were retained. A later actual legacy denial assertion incorrectly executed as the owner; corrected it to execute as `service_role`, without changing grants. No Windows permission or security setting was changed.

## Actual SQL evidence

The expanded rollback fixture executed successfully with `ON_ERROR_STOP=1`, all deferred constraints made immediate, and final rollback. Confirmed zero users and zero tournaments afterward. It tests correct 97/76/12/12 MRP outcomes, canonical seed/finalist validation, rejected malformed/client-derived claims, authorization and reconciliation scope, null/stale versions, exact replay, changed-key conflict, immutable update/delete, correction supersession, closed-tournament replay, legacy conflict and audit/receipt preservation.

Captured five retained legacy reader/reconciliation functions before the proposal and verified identical owner, ACL and search path afterward. Both old playoff writer versions and every existing named settlement draft/finalization overload lose service-role execution. Actual anon/authenticated RPC calls and service-role legacy writer and direct SELECT/INSERT/UPDATE/DELETE attempts are denied. New public RPCs remain service-only; private helpers remain uncallable by those application roles. This is synthetic local evidence, not a played tournament or user-session acceptance test.

Four real two-connection scenarios passed with bounded lock/statement timeouts:

The first harness incorrectly acquired the event lock before invoking each writer. Independent review rejected that as writer-concurrency proof. Corrected the runner to use a third holder connection; both labeled workers must be observed waiting inside the RPC on advisory locks before releasing the holder. All four scenarios below passed again with the corrected harness. The preliminary serialized runs are not the concurrency acceptance evidence.

| Scenario | Outcome versions | Operation receipts | Conflict records | Audit records |
| --- | ---: | ---: | ---: | ---: |
| Competing initial writes by different authorized actors | 1 | 2 | 0 | 2 |
| Exact concurrent replay, same actor and operation | 1 | 1 | 0 | 1 |
| Changed-payload replay, same actor and operation | 1 | 1 | 1 | 2 |
| Competing corrections by different authorized actors | 2 | 3 | 0 | 3 |

Competing writes yield one accepted result and one stale-version rejection. Exact replays return identical responses. Changed replay yields an idempotency conflict. Correction supersession remains intact. The runner is `tests/run-playoff-outcomes-v3-isolated.mjs --isolated-container`; it requires the exact existing labeled no-network container and reviewed archive hash, and only resets database `fixture_0240` within that container. Local logs are ignored under `test-results/`.

## Rollout consequences and next approval boundary

The migration remains an unregistered local proposal. Its restrictions apply across the target database: service-role execution is removed from legacy placement writers v1/v2 and legacy settlement draft writers v1–v4 plus manual finalization v1. Existing history/readers/reconciliation remain available. The replacement supports only four-qualifier, no-bye Standard Singles Main with 12 games; unsupported formats would have no new writer, and financial settlement remains unavailable. This is not a general settlement replacement.

Revocation alone does not stop an old call already authorized and waiting on a lock. Any separately approved staging rollout must therefore: register the exact reviewed migration locally; pass normal CI; publish the compatible branch Preview with legacy write routes frozen; verify staging isolation; drain in-flight legacy requests before applying the migration; verify no old/new dual-domain results and exact post-apply owner/ACL/hash; then run separately authorized synthetic hosted acceptance. Production is excluded. Do not treat the disposable tests as permission to register, publish, apply or attest playoff outcomes.

Remaining application gate: the strict migration/RPC test still fails because three v3 calls have no registered migration. No check was weakened. Browser phone/desktop proof remains unavailable after controller localhost timeouts; integrated build remains blocked by the previously observed generated-directory EPERM. No alternate permission route was attempted. Cleanup and final review outcomes are recorded below.

## Final checkpoint

Independent Sol review found no material issue in the corrected barrier runner or expanded SQL fixture. Minor future harness hardening remains possible for blocker timeout cleanup; the successful run did not encounter that path. Full application tests rerun: **817 total, 816 passed, 1 failed**, solely the preserved migration/RPC coverage gate. Focused source/math/API checks passed **9/9**; changed runner/test ESLint and diff checks passed. No application source or proposed migration SQL changed during isolated validation. Proposal SHA256: `EE098AA7D6255070B8E8E990391C63A9067FE949A61426B5584FC0E2F2C30D2A`.

Rechecked the container label, network, ports, privilege and mount guards, removed only `cribbage-0240-isolated` with its disposable volumes, and verified no matching container remained. Docker Desktop remains available; no system restart or user cleanup is required. All hosted sessions and data are untouched. Migration registration and staging rollout remain **not performed and awaiting separate approval**, not denied or uncertain. Build/browser gates remain the previously observed verification blockers; no denied action was retried through another route.
