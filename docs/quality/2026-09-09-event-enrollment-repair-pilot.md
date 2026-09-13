# Event-enrollment repair pilot evidence

Date: 2026-09-09
Environment: connected Supabase pilot `fnjkwymxpnsqvxtpronk`; local Node 24 / pnpm workspace.

## Acceptance criteria

1. A changed retry using an existing enrollment idempotency key must create immutable conflict evidence, never a second operation receipt.
2. A director/co-director lifecycle rejection must occur after the tournament row is locked and role authority is established, so it can be receipted and audited.
3. An enrollment must lock both its tournament and its qualifying event row before creating a participant.
4. The repair must preserve private-table access, empty-search-path function execution, and anonymous denial.

## Repair and review

- Added `database/migrations/0050_event_enrollment_idempotency_and_lifecycle_repair.sql`.
- The first focused Sol review found one P1 concurrency defect: the qualifying event was checked but not locked. The migration now uses `FOR UPDATE OF e`, and the semantic regression test requires it.
- The final Sol re-review reported no remaining P0/P1 findings. It rechecked transaction order, lifecycle, scope, replay/conflict behavior, RLS/grants, and audit paths.

## Executed checks

| Check | Result |
| --- | --- |
| `pnpm test` | Pass — 51 tests, 0 failures |
| `pnpm lint` | Pass |
| `pnpm build` | Pass — optimized production build completed |
| `pnpm verify` | Pass — 6 tests, 0 failures |
| `pnpm verify:handoff` | Pass — 6 tests, 0 failures |
| `git diff --check` | Pass; Git emitted only its pre-existing LF-to-CRLF working-copy warning |
| Pilot migration `event_enrollment_idempotency_and_lifecycle_repair` | Applied successfully |

## Pilot catalog evidence

- `public.enroll_linked_roster_entry_in_event` is `SECURITY DEFINER`, has `search_path=""`, is not executable by `anon`, and is executable by `authenticated` callers only.
- `app.event_enrollment_operation_conflicts` has RLS and forced RLS enabled, with no direct anonymous or authenticated select/insert/update/delete access.
- Its immutable-history trigger is present.
- The security advisor lists this private no-policy table as informational, consistent with its revoked direct grants. Existing authenticated `SECURITY DEFINER` notices are expected for narrowly granted RPCs and do not identify a new public grant from this repair.

## Limitations

This is schema/catalog and static regression evidence. It is not a real independent-session enrollment exercise, concurrency race execution, or an ACC rule/fixture approval. Those remain release gates.
