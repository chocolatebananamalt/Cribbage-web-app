# Shared-pilot Rule 12 correction-grant gap — 2026-09-10

## Finding

A fresh read-only catalog query of the shared pilot found that all seven
incomplete Rule 12 correction functions remain executable by the
`authenticated` database role:

- `propose_game_correction`
- `review_game_correction`
- `configure_correction_policy`
- four correction workspace/policy/reconciliation readers

The current application hard-disables its matching screens and API routes, but
that app boundary does **not** revoke a caller's ability to invoke a public
Supabase RPC directly. The source migration sequence (`0096`–`0098`) contains
the required authenticated-role revocations, but the shared pilot currently
ends at `0089`.

## Current exposure assessment

The same read-only aggregate check found three authentication accounts, zero
tournament-role rows, zero correction rows, and three canonical-game rows in
the shared pilot. With no director/cross-checker role fixture, the older
functions' own role checks should reject a useful correction today. That
reduces immediate practical impact but does not close the defect: adding a
role fixture before the revocations would make incomplete correction behavior
reachable outside the application.

## Required containment

The shared pilot needs an explicitly authorized maintenance change that
revokes those seven authenticated grants before any role fixture, test
tournament, or live user is added. This is a database authority change; no
such change was made during this review. It is governed by
`docs/operations/PILOT_MIGRATION_CHANGE_CONTROL.md`.

The source test now proves that all application routes/pages for this feature
remain hard-disabled and that `0096`–`0098` revoke every writer, policy writer,
and reader. This prevents source drift but cannot change the shared database
until the required pilot-change authority is given.

## Evidence

Read-only shared-pilot catalog query on 2026-09-10:

```text
all seven named functions: anon execute = false; authenticated execute = true
```

Read-only recheck later on 2026-09-10:

```text
pilot migration history still ends at logical source migration 0089,
recorded by Supabase as 20260910072735_foreign_key_coverage
all seven named functions: anon execute = false; authenticated execute = true
```

Final read-only recheck at 2026-09-10 14:11 UTC confirmed the same state.
The Supabase security advisor continues to identify the seven correction
functions among its signed-in `SECURITY DEFINER` warnings. This is not an
advisor-only informational finding: the catalog grant query directly confirms
that the incomplete functions are callable by the `authenticated` role.

The Supabase security advisor reports the corresponding signed-in
`SECURITY DEFINER` warning. Its `app`-schema RLS-without-policy notices are
expected for private, directly revoked tables and are not a substitute for the
function-grant containment repair.

## Separate validation-environment contrast

A read-only check of the separate synthetic validation database on 2026-09-10
shows source migrations through `0103_assigned_game_context_actor_scoped_retry`
and **zero** authenticated execute grants for the same seven correction
functions. Its security advisor correspondingly reports 22 remaining signed-in
`SECURITY DEFINER` functions—the reviewed current tournament operations—not
the seven suspended correction functions. This proves the revocation migration
sequence has the intended effect in validation. It does not alter, substitute
for, or authorize the required shared-pilot maintenance change.

Read-only aggregate scope check on 2026-09-10:

```text
auth users = 3; tournament roles = 0; corrections = 0; canonical games = 3
```

After the source regression change, the complete local verification suite and
private handoff check must pass before this record is committed.
