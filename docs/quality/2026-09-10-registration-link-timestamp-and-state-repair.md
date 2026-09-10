# Registration-link timestamp and state repair — 2026-09-10

## Acceptance criteria

- A database response representing the exact requested expiry instant is
  accepted even when PostgreSQL serializes that timestamp differently from the
  JavaScript request.
- Director link state is `open` only when the current link is issued, enabled,
  unexpired, headed open, and its tournament and registration are open.
- All other lifecycle combinations fail closed as `closed`; an otherwise
  current issued link whose expiry has elapsed is `expired`.

## Implementation and evidence

- `registration-link-issuer.ts` now compares parsed epoch milliseconds instead
  of raw timestamp text before returning a one-time credential. A regression
  test covers PostgreSQL's `+00:00` representation of the requested `.000Z`
  instant.
- Migration `0076_registration_link_state_usability_repair` replaces the
  service-only state function with the complete lifecycle and tournament-status
  predicate. It preserves the narrow, secret-free response and service-only
  execution grant.
- Migration `0076` was applied first to disposable synthetic project
  `donfxulkliuyteiannir`, then to pilot `fnjkwymxpnsqvxtpronk`.
- Catalog inspection after each application confirmed the replacement requires
  an issued enabled link and open tournament registration before reporting
  `open`, and otherwise falls through to `closed`.
- `pnpm lint`, `pnpm test` (**98** tests), `pnpm build`, `pnpm verify`,
  `pnpm verify:handoff`, and `git diff --check` pass locally.

## Follow-up review and expired-state repair

- Independent review found that the first repair could label an elapsed link
  `expired` after registration had closed. That distinction is misleading:
  when the tournament is no longer eligible, the only safe state is `closed`.
- Migration `0077_registration_link_expired_state_repair` repeats the enabled,
  issued, headed-open, eligible-tournament, and open-registration predicates
  before returning `expired`; every other condition returns `closed`.
- Migration `0077` was applied first to disposable synthetic project
  `donfxulkliuyteiannir`, then to pilot `fnjkwymxpnsqvxtpronk`. Catalog checks
  on both confirm `anon` and `authenticated` cannot execute the function,
  `service_role` can, the expired branch requires eligible/open registration,
  and the final branch fails closed.
- The issuer regression suite additionally proves a timestamp-only mismatch
  returns no one-time credential. `pnpm lint`, `pnpm test` (**99** tests),
  `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check`
  pass locally.

## Remaining release gates

- Complete a seeded disposable-backend state/privilege outcome matrix; the
  catalog test proves the predicate/grant structure but is not a substitute
  for executing every lifecycle combination.
- Add director-facing rotate/close controls only with their private atomic
  database operation and independent-session evidence.
- Prove the complete lifecycle against a real service-role backend, including
  concurrent requests and browser behavior, before enabling public
  registration.
