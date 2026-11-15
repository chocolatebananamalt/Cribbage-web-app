# Registration roster-promotion pilot evidence — 2026-09-09

## Scope

This evidence covers the narrow `R-REG-01` bridge from an immutable,
director-approved public registration claim to one private tournament roster
identity. It does not claim account linking, player roles, event enrollment,
payment, check-in, seating, verification IDs, or scorecards.

## Acceptance criteria

- A roster entry can only reference a same-tournament immutable
  `approved_for_roster` decision and source claim.
- A caller cannot submit roster identity fields; the database copies an
  immutable claim snapshot.
- Direct `anon` and `authenticated` access to roster tables is denied; only
  authenticated director/co-director RPCs may read or create entries.
- The write is idempotent, auditable, and immutable, and states every omitted
  operational side effect explicitly.
- Foreign-key coverage has no `unindexed_foreign_keys` advisor finding.

## Executed evidence

| Check | Result |
|---|---|
| `pnpm test` | Pass: 46 tests, including roster-promotion and index regression checks |
| `git diff --check` | Pass |
| Supabase migration `0036_registration_claim_roster_boundary.sql` | Applied successfully to pilot `fnjkwymxpnsqvxtpronk` |
| Supabase migration `0037_registration_review_roster_indexes.sql` | Applied successfully to the same pilot |
| Security-definer/grant inspection | Both new RPCs are `SECURITY DEFINER` with `search_path=""`; `anon_execute=false`, `authenticated_execute=true` |
| Private-table inspection | `tournament_roster_entries` and `roster_entry_operation_conflicts` both force RLS and deny all direct `anon`/`authenticated` DML/read access |
| Supabase performance advisor after index migration | No `unindexed_foreign_keys` finding remains; unused-index notices are expected on a new, unused pilot |
| Supabase security advisor | New private-table/RPC entries match the intended restricted design; existing public registration functions remain intentionally anonymous, and the user previously declined paid leaked-password protection |
| Focused Sol security review | Initial P1 (replay disclosure/rejection audit before current authorization) was repaired in `0038`; final re-review found no P0/P1 |

## Limits / remaining release evidence

The connected database interface cannot safely create or impersonate disposable
authenticated director/player identities. Therefore this pass does **not** prove
real actor authorization, cross-tournament denial, concurrent promotions,
exact replay, rollback after an injected audit failure, or browser UI behavior.
Those require a dedicated test backend with independently signed-in sessions and
persisted-data assertions before production release.
