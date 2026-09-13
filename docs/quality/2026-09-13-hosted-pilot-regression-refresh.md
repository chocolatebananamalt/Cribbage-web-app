# Hosted pilot regression refresh — 2026-09-13

## Purpose

Re-run the October-critical database lifecycles against the approved Supabase
pilot after migrations through `0161_cross_checker_assignment`. Every proof
used synthetic data inside an explicit transaction ending in `rollback`.

## Environment

- Supabase project: `fnjkwymxpnsqvxtpronk`
- Production schema state: migrations `0001` through `0161`
- Execution identity: Supabase SQL service boundary
- Retention rule: no fixture user or tournament may survive

## Hosted results

| Lifecycle | Fixture | Result |
| --- | --- | --- |
| CSV roster import | `tests/roster-csv-import.sql` | PASS |
| Registration close and roster freeze | `tests/registration-roster-freeze.sql` | PASS |
| Schedule publication | `tests/event-schedule-publication.sql` | PASS |
| Active-game progression | schedule fixture plus `tests/active-game-progression.sql`, one transaction | PASS |
| Paper/paper completion | `tests/paper-game-completion.sql` | PASS |
| Digital/paper completion | `tests/hybrid-digital-paper-completion.sql` | PASS |
| Failed-device reconstruction | `tests/device-failure-recovery.sql` | PASS |
| Rule 12 correction | `tests/rule12-correction-release.sql` | PASS |
| Qualification finalization | `tests/qualification-finalization.sql` | PASS |
| Settlement finalization | settlement-draft fixture plus `tests/settlement-finalization.sql`, one transaction | PASS |
| Expense ledger | `tests/tournament-expense-ledger.sql` | PASS |
| Cross-checker assignment | `tests/cross-checker-assignment.sql` | PASS |

Active-game progression intentionally consumes the schedule created by the
schedule fixture. Settlement finalization intentionally consumes the
two-qualifier snapshot created by the settlement-draft fixture. Combining each
dependency pair in one rollback transaction proves the lifecycle without
seeding or retaining a fake production record.

## Fixture corrections

- The paper-completion fixture now expects the current common mutual-exclusion
  response, `another manual evidence case already open`, introduced by the
  hybrid-evidence release.
- Expense assertions now count events, conflicts, and audit rows only within
  their synthetic tournament/operation. This preserves exact replay,
  authorization, reversal, and audit checks while allowing the fixture to run
  safely in a non-empty pilot database.
- Contract tests pin both corrections so a future message or scoping drift
  fails the repository gate.

## Retention and advisor checks

A post-run read found `0` retained fixture tournaments across the synthetic IDs
used by this suite and `0` users with the fixture-only `@test.invalid` suffix.

The Supabase advisor returned no newly introduced schema problem. Current
advice remains:

- 113 `INFO` notices for RLS-enabled tables without direct policies. This is
  intentional for the private RPC-only design: direct authenticated table
  access is revoked and narrowly scoped server functions enforce authority.
- 36 `WARN` notices for authenticated security-definer functions. These are
  the intentional authenticated RPC surface and remain covered by role,
  self-check, scope, replay, and rejection-path tests.
- one `WARN` for leaked-password protection. The pilot uses passwordless email
  sign-in; the Supabase Free plan cannot enable this Pro-only password option.
- 247 `INFO` unused-index notices. Low use is expected before the live pilot;
  indexes are retained until production query evidence supports removal.

Advisor reference: https://supabase.com/docs/guides/database/database-linter

## Interpretation

The shared hosted backend passes the October-critical roster, schedule,
scoring, paper/digital reconciliation, device recovery, correction,
qualification, settlement, cash/check expense, and official-assignment
lifecycles without contaminating production data. Physical independent-device,
disconnect/reconnect, backup/content-restore, and director rehearsals remain
acceptance activities rather than implementation gaps.
