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

## Remaining release gates

- Perform the protected-hosted deployment check and a follow-up independent
  high-risk review.
- Add director-facing rotate/close controls only with their private atomic
  database operation and independent-session evidence.
- Prove the complete lifecycle against a real service-role backend, including
  concurrent requests and browser behavior, before enabling public
  registration.
