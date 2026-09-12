# Offline score replay foundation verification — 2026-09-11

## Outcome

An assigned Standard Singles player can now prepare a device-bound offline
capability while connected, save one signed score entry in browser IndexedDB,
and replay that exact entry through the existing authoritative score writer
after connectivity returns. Local state says `Saved Offline — Waiting to Sync`
and never creates a server-verified result by itself.

## Evidence

- Supabase migrations `0122_offline_submission_replay_foundation.sql` and
  `0123_offline_submission_foreign_key_indexes.sql` are applied to project
  `fnjkwymxpnsqvxtpronk`.
- The permanent rollback-only fixture
  `tests/event-schedule-publication.sql` passed against that hosted database.
  It provisioned two different players at the same game version, replayed both
  entries, proved exact retry idempotency, quarantined a changed replay, checked
  immutable receipt/conflict counts, and verified least-privilege grants. The
  transaction retained no synthetic data.
- Supabase security and performance advisors were rerun. All four new private
  tables are RLS-forced and have no browser table grants or policies by design.
  The four new foreign-key coverage warnings were repaired by migration 0123;
  only expected unused-index informational notices remain for these new
  indexes. The project-level leaked-password warning is accepted because the
  pilot uses passwordless email sign-in and the free Supabase plan cannot
  enable that paid password feature.
- `pnpm verify` passed: production dependency audit, lint, 251/251 application
  tests, Next.js production build, and 6/6 workspace checks.
- `pnpm verify:handoff` passed 6/6 recovered private-handoff checks.
- Independent Sol review found no remaining P0/P1 issue in the migration and
  replay boundary after lost-response issuance and changed-replay repairs.

## Remaining release evidence

This is the first offline submission slice, not the complete October offline
gate. Production browser deployment and visual checks remain for this commit.
Two independent real sessions must still prove disconnect, reload/restart,
reconnect, account switch, concurrent replay, and shared-device clearing. A
fresh page cannot yet start while entirely offline, offline confirmation is
not enabled, and failed-device recovery from opponent/paper evidence remains a
separate server-authoritative workflow.
