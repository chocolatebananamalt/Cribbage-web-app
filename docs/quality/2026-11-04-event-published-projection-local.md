# Event-published projection contract - local checkpoint

## Changes

Added pure server-only src/lib/results/event-published-projection.ts and nine focused tests. Explicit intended-public heads bind event/tournament/publication/revision/sections and digest; matching before/after heads and validated exact source are required. Missing, withdrawn, changed, wrong-audience or stale/unsupported data block. It returns prepared-not-authorized, accessGranted:false, transportEnabled:false. No publisher, route, grant, database read, fixture or hosted action.

The minimal output replaces internal participant UUID references with fixed Tournament IDs while preserving names, seeding, bracket paths/byes and truthful origin. It strips private notes/display, source/result/qualification/account/ACC identifiers and pool membership/receipt detail. Pool figures remain aggregate-only, null versus true zero preserved, projected amounts explicitly estimates and not awards. Section selection prevents an unselected bracket hitchhiking on a pool-only view. Both source and output are independent owned values for consumer display.

## Review and intermediate result

Initial eight focused tests and full suite passed, but independent review found a P2: coercing provenance with String(origin) permitted an object carrying private fields to be emitted as provenance. Corrected to require a primitive string with exact enum membership; state validation is also primitive. Added ninth regression for coercible private object and boxed string. No source guards were relaxed. Final review/verification follows below only after completion.

## Boundaries

Supplied heads/digests are NOT authoritative permissions. Future server publisher/read transport must derive visibility and snapshot from trusted event records, coordinate concurrent source and visibility updates, maintain immutable data revisions and current pointer, bind exact retries, invalidate caches on withdrawal and perform actual provider/API/database acceptance. This pure contract does not prove atomicity, liveness or publication. No new fixture operation or denied retry occurred. The public-facing product remains unavailable pending those requirements. Detailed design: docs/decisions/2026-11-04-event-published-projection-contract.md.

## Final verification

Final full pnpm verify exited0:1,386 application tests,6provider static checks,8workspace, build/lint/audit pass. Private handoff6passed. Independent reviewer independently passed9/9 focused tests and cleared remaining P1/P2 after primitive-provenance correction. Logs test-results/event-published-projection-verify-final.log, event-published-projection-handoff-final.log and event-published-projection-focused.log. No UI/render change, database/provider/hosted read, operational fixture, migration, public grant, deployment or denied-operation retry occurred.
