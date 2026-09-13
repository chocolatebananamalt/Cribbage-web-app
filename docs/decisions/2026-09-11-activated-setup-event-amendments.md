# Activated setup event amendments

Date: 2026-09-11
Status: implemented locally; migration and live proof pending

## Decision

An open tournament may gain later Consolation, Satellite, or Custom events without replacing its activated Main Event. A current director or co-director submits only the new event definitions plus the exact latest setup revision/version. One service-only database transaction serializes the tournament, validates the fixed event menus and limits, creates a new immutable full setup snapshot, and creates operational ruleset/event/activation rows only for the additions.

Existing setup revisions, event versions, rulesets, operational events, participants, games, scores, seating, finance, and results remain untouched. The activation projection reads all immutable activation records while identifying the latest setup snapshot.

Standard Singles additions are digital. Doubles, Canadian Doubles, team, and custom formats remain manual/paper-scored. The Standard Singles ruleset reference remains limited to the approved 2025 scoring core; setup notes do not become official rules.

## Reliability and authority

- The route requires the existing setup-activation release gate, same-origin POST, verified session, strict bounded JSON, and the server-only Supabase client.
- The database independently requires a current director/co-director role and denies browser roles direct execution.
- The request is receipt-bound and replay-safe. Changed operation-key reuse is preserved as a conflict. Authorized business rejections receive immutable receipt/audit evidence.
- A tournament-scoped transaction advisory lock plus latest-revision comparison makes concurrent additions deterministic: one may succeed, while a request based on the former latest revision is rejected as stale.
- A second Main, duplicate event/client identity, second Consolation, unsupported menu combination, invalid Q-pool, or more than 32 total events is rejected atomically.

## Non-goals

The amendment does not enroll participants, generate rounds/games or seating, calculate finance/results/payouts/qualifiers, publish an event, or submit anything to the ACC. Those remain separate explicit operations.
