# Check-in and initial-seating pilot evidence — 2026-09-09

## Scope and acceptance boundary

This increment implements only a private, director/co-director-controlled
check-in history and a single immutable **initial** Table/Seat publication.
It fulfills the narrow server boundary described in
`docs/decisions/2026-09-09-check-in-and-initial-seating-contract.md`.

It does not associate a roster entry to a player account, notify a player,
create event participation, generate per-game movement, determine a
qualification, or make a score official. It is therefore not an operational
claim that the app can yet run a tournament's seating workflow end to end.

## Design review and repairs

Focused independent Sol review found four P1 defects in the first migration
draft before pilot application:

- a duplicate composite roster constraint would fail a clean migration chain;
- an exact idempotent replay could incorrectly fail after a lifecycle state
  changed;
- current check-in state was ordered by timestamp rather than its serialized
  event version; and
- conflict evidence was missing the attempted operation/target attribution.

Those were repaired. A subsequent review found a further P1: a roster entry
could be added after seating publication, or newly checked in without an
assignment. The final migration blocks later roster inserts and rejects a
post-publication `checked_in` event for an unassigned entry. Final Sol
re-review reported no P0/P1 findings.

## Applied pilot change

Migration `0047_check_in_and_initial_seating` was applied successfully to the
isolated Supabase pilot `fnjkwymxpnsqvxtpronk`.

- `app.roster_check_in_events` is append-only and versioned per roster entry.
- `app.initial_seating_publications` permits one publication per tournament.
- `app.initial_seating_assignments` derives permanent `verification_id` from
  immutable `initial_table_seat`, prevents duplicate roster entries, table
  seats, and verification IDs within a tournament, and uses composite foreign
  keys to prevent a cross-tournament publication assignment.
- Registration must be closed and every currently checked-in roster entry must
  be assigned before publication succeeds.
- Check-in and publication both use current director/co-director authorization,
  advisory serialization, receipts, audit records, and exact replay/conflict
  handling.

## Direct pilot inspection

- All four new `app` tables have RLS enabled and forced. Neither `anon` nor
  `authenticated` has direct `SELECT` or `INSERT` privilege.
- The three exposed RPCs (`record_roster_check_in_event`,
  `publish_initial_seating`, and `get_initial_seating_workspace`) are
  `SECURITY DEFINER`, use an empty `search_path`, deny `anon`, and allow only
  signed-in invocation. Each still performs its own current tournament-role
  check.
- Catalog constraints confirm one publication per tournament, composite
  same-tournament assignment provenance, unique Table/Seat and verification
  IDs, and a positive event version. Immutable triggers cover every new
  history/publication table; the roster table additionally rejects inserts
  after initial seating has been published.
- The Supabase security advisor lists the new private tables under its existing
  informational “RLS enabled, no policy” category. That is intentional: all
  direct privileges are revoked and access goes through narrowly scoped RPCs.
  Its public-registration and authenticated-RPC warnings predate this increment;
  the three new functions are authenticated-only and internally authorized.

## Repository checks

The regression test covers private direct-access revocation, immutable event
history, one-publication/unique-ID constraints, registration closure,
checked-in completeness, replay ordering, role grants, and the explicit
non-rotation boundary. All required checks passed after the final repair:

```text
pnpm lint
pnpm test                 # 49 passing tests
pnpm build
pnpm verify
pnpm verify:handoff
git diff --check
```

## Hosted preview check

- Vercel built commit `bcb5434` as a Ready Preview deployment. Its protected
  root request returned HTTP 200 with the expected ACC Tournament Desk shell.
- Vercel reported no grouped runtime-error cluster for the project in the
  one-hour inspection after deployment. This verifies the hosted build and
  public shell only; no role-scoped check-in/seating mutation was exercised in
  a real browser session.

## Remaining release evidence

No real director/co-director/player account fixtures or real tournament roster
were created for this database migration. Before release, independent
authenticated sessions against disposable synthetic data must prove successful
check-in/publication; exact and changed replay; cross-tournament, revoked-role,
and direct-table denial; post-publication roster/check-in denial; concurrent
publication; and persisted receipt/audit assertions. Player-facing delivery,
printed seating, late-entry policy, per-game rotation, table playthrough, and
all official ACC scheduling fixtures remain separate release gates.
