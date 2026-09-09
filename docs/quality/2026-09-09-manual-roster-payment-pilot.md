# Manual roster-payment pilot evidence — 2026-09-09

## Scope

This increment implements only a director/co-director-entered, private,
append-only manual-payment evidence ledger for a pre-existing private roster
entry. It is not online card processing, a balance calculation, payment
reconciliation, payout, check-in, event enrollment, or a claim that a player
is paid in full.

## Design review

Focused Sol review of migration `0040_manual_roster_payment_ledger.sql` found
two P1 issues before application: an accepted optional receipt note was not
persisted, and a changed retry could create a foreign-key failure or misleading
cross-tournament conflict reference. Both were repaired. The re-review reported
no remaining P0/P1 findings.

## Applied pilot changes

- Applied `manual_roster_payment_ledger` (repository migration `0040`) to the
  isolated Supabase pilot `fnjkwymxpnsqvxtpronk`.
- Applied `roster_payment_history_indexes` (repository migration `0041`) after
  the performance advisor identified the missing `(roster_entry_id,
  tournament_id)` foreign-key covering index.
- Applied `payment_operation_reconciliation_hardening` (`0043`) and
  `remove_legacy_payment_operation_reconciliation` (`0044`). The only
  callable reconciliation signature now requires tournament, roster identity,
  exact operation type, canonical request hash, and idempotency key.
- Applied `payment_operation_identity_reconciliation` (`0045`) for the
  future browser client. It reconciles a caller's immutable receipt by exact
  operation identity rather than requiring the browser to recreate PostgreSQL
  JSONB/timestamp/hash normalization. It is a distinct function, not an
  ambiguous overload.

## Direct inspection

- `app.roster_payment_events` and
  `app.roster_payment_operation_conflicts` both have RLS enabled and forced;
  neither `anon` nor `authenticated` has direct table DML/read privilege.
- The payment RPCs are `SECURITY DEFINER`, have an empty `search_path`,
  deny `anon` execution, and allow only `authenticated` invocation. Each writer
  performs its own `auth.uid()` and current tournament-role check.
- Direct catalog inspection confirms the legacy
  `get_roster_payment_operation_reconciliation(uuid,uuid,uuid)` signature has
  no dependencies and was removed without `CASCADE`; only the exact five-arg
  function remains. It is `SECURITY DEFINER`, has an empty search path, denies
  `anon`, and permits `authenticated` execution.
- The four-argument identity-reconciliation function is likewise
  `SECURITY DEFINER` with an empty search path, denies `anon`, is callable by
  `authenticated` only, and performs current director/co-director, tournament,
  roster target, and exact record/void-kind checks before returning a caller's
  own immutable receipt. A focused Sol re-review found no P0/P1 issue.
- The append-only payment table has both the composite roster/tournament FK and
  deferred sequence/transition revalidation. The pilot exposes its received /
  voided receipt state only through the narrow writer and caller-scoped
  reconciliation RPCs.
- The post-index performance advisor reported no `unindexed_foreign_keys` lint.
  Its unused-index notices are expected for an empty pilot and do not authorize
  index removal.
- The security advisor's RLS-no-policy entries are intentional for private
  `app`-schema tables with all direct client privileges revoked. Existing public
  registration and authenticated RPC warnings predate this increment; the new
  payment RPCs are intentionally authenticated-only and internally
  authorization-checked. The existing leaked-password-protection warning
  remains the user-approved magic-link/no-upgrade decision.

## Local checks

All passed after the final repair:

```text
pnpm lint
pnpm test                 # 48 passing tests
pnpm build
pnpm verify
pnpm verify:handoff
git diff --check
```

## Protected mutation boundary

- Receipt and void HTTP routes are same-origin-only, validate a current
  Supabase claim, and call only the role-authorized RPCs. A receipt requires
  positive USD integer cents at or below PostgreSQL's integer maximum, an
  allowlisted manual method, canonical UTC RFC3339 time, and an optional
  bounded note. A void requires the exact current receipt and a bounded,
  nonblank reason.
- Both accepted and rejected JSON shapes are strict and mutually exclusive;
  a malformed mixed payload is treated as unavailable rather than terminal.
- The recovery route carries no amount, method, timestamp, note, or reason.
  It requires an expected payment version and, for a void, the exact source
  receipt. `0046` exposes `{ authorized: true, result }` only after server
  role/scope checks, so only explicit authorized-null can prove no operation
  committed. Authorization or response uncertainty remains retry-locked.
- Focused Sol review repaired five P1 response/recovery boundary issues and
  the final re-review found no P0/P1. The page intentionally remains read-only
  until the browser retry client is implemented and independently exercised.

## Remaining release evidence

No real authenticated disposable pilot accounts or director/co-director
membership fixtures were created in this pass. Before release, independent
authenticated sessions must prove receive, void, exact replay, changed replay,
stale concurrent writer, cross-tournament, revoked-role, direct-table-denied,
and injected-rollback behavior with persisted receipt/event/audit assertions.
Finance reconciliation, fees, waivers, refunds, Q-pools, payouts, attachments,
reports, and finalization remain separate unimplemented release gates.
