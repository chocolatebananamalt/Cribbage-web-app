# Paper game completion verification evidence

## Acceptance

- A current cross checker can record two matching original paper-card claims
  for one scheduled Standard Singles game without player accounts; this first
  record is pending and creates no scorelines.
- A second distinct current cross checker, co-director, or director must
  independently re-enter the exact claims and evidence references before the
  server creates authoritative scorelines.
- The server derives reciprocal 0/2/3 game points and 1–121 plus/minus lines.
- Missing or self-confirmed official identity, an official bound to either player,
  same-official review, mismatched cards, stale game or identity versions, prior
  digital history, changed idempotency reuse, revoked-role replay, and unauthorized
  access fail closed.
- A profile linked anywhere in the tournament cannot be declared a
  nonparticipant official. Profile-scoped locks and database triggers preserve
  that invariant if account linking or event enrollment races the binding.
- Approval revalidates both current official identities and the exact stored
  first-official binding. A correction made before review blocks approval while
  still allowing the stale case to be explicitly rejected.
- Exact accepted responses remain replayable after tournament closure, and an
  actor/tournament/operation/target-scoped reconciliation endpoint resolves all
  three saved browser envelopes even when an item leaves the live workspace.
- Only published schedule games are eligible. Pending paper and device-recovery
  cases cannot coexist, while a rejected immutable paper case may be followed by
  a new sequenced case.
- Original evidence, receipt, accepted/rejected audit, and scorelines are
  append-only and tournament/event/game scoped.
- Accepted lines feed the existing scorecard, standings, and qualification
  path; no OCR or official payout/MRP rule is introduced.

## Checks

- `node --test tests/paper-game-completion.test.mjs` — PASS (8/8) on Windows.
- Focused ESLint — PASS.
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm verify` — PASS on Windows after the identity-race, closed-lifecycle
  replay, and lost-response reconciliation hardening: dependency audit, lint,
  393 application tests, production build, and workspace checks.
- `pnpm verify:handoff` — PASS (6/6) on Windows.
- Hosted rollback fixture prepared at `tests/paper-game-completion.sql`; not run
  because migration 0144 has intentionally not been applied.

## Required before release

Apply migration 0144 to the test backend, execute the rollback fixture, and run
two distinct official browser sessions against fictional roster-backed paper
players. Verify refresh/retry, same-official and self-check rejection,
conflicting card claims, and qualification totals before enabling live use.
