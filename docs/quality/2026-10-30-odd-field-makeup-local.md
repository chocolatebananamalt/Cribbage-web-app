# Odd-field qualifying makeup: local implementation evidence

This is local, unpublished work. It does not certify an ACC-sanctioned event or change hosted records. The source review is [five-qualifier and bye sources](2026-10-29-five-qualifier-bye-source-review.md).

## Implemented contract

The narrow supported plan is seventeen players, twelve qualifying games, zero stationary anchors and twelve different sit-outs. The director supplies the 96 regular matches and six physical makeup seat pairs. The server derives the makeup participants in sit-out order 1/12, 2/11 through 6/7. It rejects repeated sit-outs, stationary physical seats, foreign identities, duplicate or out-of-plan seats and wrong cardinalities. This is the Director Manual's offered even-game makeup solution, not a universal rotation mandate.

There are 102 real matches. Scheduling batch 13 contains six makeups, each filling the two players' respective original blank scorecard lines. No bye/free win or score is invented. All seventeen players have exactly twelve qualifying results.

Proposed migration `0252_odd_field_qualifying_makeup_v1.sql` adds one private, forced-RLS, immutable six-row-per-publication mapping table and four service-role-only RPCs: publication, official mapping read, full-request reconciliation and sanitized own-game/official card-number read. It adds private construction/currentness/display helpers, preserves the old publisher, narrowly adapts the existing start implementation and projects original card lines through the existing authorized readers. There are no direct human table grants or payment writers.

Publication request: `{regularMatches, makeupSeats, anchorCount:0, reason, reviewed:true}` plus a separate operation key. Server-derived identities and original card numbers cannot be overridden. Existing tournament/event locks, current director or co-director authority and full request hashing protect retries and competing requests. Reconciliation distinguishes an authorized unknown outcome from a denied read. The API checks same origin, bounded JSON, verified subject and exact response shape.

## User interface and compatibility

The new director page previews all six pairings, original card lines and 102-match count before explicit review. It retains one exact pending request under the existing schedule recovery namespace. Interrupted requests never automatically resubmit; a known conflict preserves the pending work and blocks another attempt. Existing unpublished seventeen-player/twelve-game scheduling links to this complete workflow instead of offering a new incomplete 96-match publication. Already published legacy history remains readable.

Mapped digital games carry optional, strictly bound `cardNumbers` metadata. Ordinary game 13 in a longer event retains the old shape and label. Digital, paper and hybrid entry/review show each original card line and explicitly identify the scheduling batch. The own-card reader sorts makeup results into their original twelve card lines, without changing scores. Official paper/hybrid forms fail closed if batch-13 metadata cannot be loaded. This adds a deployment-order consideration: those forms need the additive 0252 reader before the new app is enabled; an app-first window on an old schema would temporarily block those game-13 forms. Existing service and human authorization remain in force.

## Executed verification owned by this component task

- Six new test groups pass: 102 matches and per-player twelve; no input mutation; wrong/repeated sit-outs and zero-anchor rejection; strict request/read/result/card-number contracts; separate no-Q fixture without pool writers; source-bound optional reader fields and ordinary game-13 compatibility; exactly one two-card residual qualification tie from actual winning-margin changes.
- Together with existing schedule/progression/My Games tests, 22 focused tests pass. The legacy score-entry heading is preserved rather than weakening the static requirement that it uses the round number, never match instance. `game-api-semantics` plus new tests pass 58 checks.
- TypeScript `--noEmit --incremental false` passes. Targeted ESLint passes with zero warnings.
- Final browser run 5 passes eight groups at 390/1440: complete preview/review, single-flight publication, interruption/reload/exact retry, lost-response reconciliation, full-request conflict preservation, controlled duplicate rejection, and the actual digital, paper and hybrid entry components' original-card-line displays. No score or paper-comparison attestation was submitted in those display checks. Pixels were inspected. The first run exposed an implicit textarea-label issue; explicit labels fixed it. The first visual review exposed inherited two-column form layout; the corrected single-column form was rerun and visually checked. The final fixture also rotates physical seats so its zero-anchor claim is true.
- Temporary browser fixture directories are removed by the harness. Prior task server PIDs 32716, 784, 36724 and 10324 were verified absent with no listener on port 3254. Final PID 15800 cleanup is recorded in `test-results/odd-field-makeup-browser-cleanup.json`.

Evidence: `tests/odd-field-makeup.test.mjs`, `tests/odd-field-makeup-browser.mjs`, `test-results/odd-field-makeup-browser-results.json`, browser run logs and 390/1440 screenshots. Browser APIs are fictional local interceptions, not a combined hosted-backend acceptance. Root's separately executed real SQL suite owns the 102-game publication/start/scoring/qualification/accounting proof; this component report does not claim an unrun SQL result.

## Fixture and outstanding integration gates

`tests/fixtures/seventeen-main-foundation.mjs` exports phase-separated setup, finance, attendance/seating, publication, start, scoring and qualification scripts. Setup, roster identities, account links and initial seating are explicitly direct synthetic baseline. All money-recording, day attendance, publication/start, 204 independent score submissions, 204 own confirmations and qualification use the existing/new supported RPCs. The expected rank is 2, 1, 3, 4, 5, with game points 24, 24, 22, 22, 20. The zero-anchor circle pairings are fictional director-reviewed test data, not an asserted ACC rotation algorithm.

The default fixture has $510 base fees and $35 in separately allocated Q funds. `{withQ:false}` uses a separate namespace, $510 base receipts and no Q versions, policies, memberships or allocations. Both preserve every original qualifying score and have no actual payments or executed refunds. Root's final SQL, whole-repository verification, independent review, migration registry and exact checksums are required before a rollout-readiness claim. No source backup is claimed to include later edits until a new confirmed version is saved.

`{withQ:false,topSeedTie:true}` uses a third distinct namespace and changes only the actual winning margins of players 1 and 2 to ten. Each then has 24 game points, twelve wins, +120 and zero minus; no other four-field tie exists. They did not meet in qualifying. The fixture does not finalize that unresolved order: root's acceptance must record the supported separately played one-game winner and verify unchanged raw scores before v4 playoffs. This variant rejects Q participation rather than adopting an unresolved monetary tiebreak rule.
