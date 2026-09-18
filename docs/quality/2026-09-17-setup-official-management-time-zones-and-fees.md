# Setup official management, time zones, and fee controls — verification record

**Status:** Implemented and hosted migrations applied; authenticated-browser,
email-delivery, and Production application verification pending.

## Acceptance coverage added

- Setup input validation now rejects a missing or invalid State/Territory and
  accepts a recognized territory such as Hawaii.
- The new official DTO rejects missing name, malformed email, and malformed
  adult/youth ACC numbers. The workspace accepts complete current identities
  plus historic read-only entries that intentionally lack fields the app did
  not collect in the past.
- Static contract coverage checks the migration for State/Territory persistence,
  local-time invitation expiry, 12-person per-role capacity, exact-email
  acceptance, append-only receipts/audit events, immediate removal, and no
  separate workspace menu entry.
- Sanctioning-fee coverage checks the side-by-side controls, one-at-a-time
  adjustment labels, required reason, no periodic timer, manual refresh, and
  Board-approval warning.
- Existing database fixtures that save a setup revision now include
  `stateTerritory: Hawaii` so they remain compatible with the new write
  contract.

## Local commands run

- `pnpm lint` — passed after the implementation edits.
- `pnpm build` — passed, including the optimized Next.js production type check.
- `pnpm test` — passed: 556 application tests, 0 failures.
- `pnpm verify` — passed: production dependency audit, lint, 556 application
  tests, provider-readiness check, optimized build, and workspace test.
- `pnpm verify:handoff` — passed: 6 private-handoff integrity/render checks.
- Browser attempt: the host does not provide the `agent-browser` executable;
  the available in-app browser rejects local loopback with
  `net::ERR_BLOCKED_BY_CLIENT`. Consequently no visual browser result is
  claimed from this host.

## Remaining required evidence

- Apply and rollback-test migration
  `0211_setup_official_management_timezones_and_fee_controls.sql` in the
  isolated Supabase validation database, including the direct SQL fixture
  checks. The Supabase CLI is not installed on this host, so no migration was
  applied from this worktree.
- Perform primary-director, co-director, cross-checker, judge, player, and
  platform-emergency independent-session authorization tests against a real
  backend.
- Configure/verify the controlled email provider and prove accepted delivery,
  exact-email sign-in, expiry at local midnight, and a delivery-failure status.
- Verify phone and desktop layouts for the combined fee panel, State/Territory
  selectors, compact finalized details, and all official-management screens.
- Use the normal reviewed migration/deployment path, then smoke-test Production
  and inspect runtime errors. Until then this release must not be described as
  deployed or ready for the rehearsal.

## Disposable migration finding

- The first disposable apply of migration 0211 was rejected by the existing
  immutable-history trigger because the draft attempted to backfill old Setup
  revisions. The transaction failed atomically. The migration was corrected to
  leave all historical revisions unchanged and require a newly saved revision
  for State/Territory selection.

## Hosted database evidence

- Migration 0211 was applied to disposable project `donfxulkliuyteiannir` and
  rehearsal project `fnjkwymxpnsqvxtpronk` after the immutable-history repair.
- Migration 0214 adds the database-side State/Territory and IANA time-zone
  match for Arizona, Hawaii, Puerto Rico, U.S. Virgin Islands, American Samoa,
  Guam, Northern Mariana Islands, Alaska, and DST-observing U.S. zones.
- Final local verification passed with 561 application tests and the optimized
  Production build. `pnpm verify:handoff` passed 6/6.
