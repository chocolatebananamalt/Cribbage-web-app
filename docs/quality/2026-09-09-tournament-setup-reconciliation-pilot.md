# Tournament setup retry reconciliation — pilot evidence

Date: 2026-09-09
Environment: connected Supabase pilot `fnjkwymxpnsqvxtpronk`; local Node 24 / pnpm workspace.

## Scope and acceptance criterion

An interrupted setup-save request must be recoverable without retaining private
setup content in browser storage. A current director/co-director may retrieve
only their own same-tournament `save_tournament_setup_version` receipt by its
opaque idempotency key. An unauthorized actor must receive no result.

## Evidence

- Focused Sol UI review found the prior design had a P0 recovery gap: the
  opaque client envelope could not distinguish a lost response from another
  director's later version. Migration `0055` adds a separate actor/tournament/
  target/operation/key-scoped reconciliation RPC before any setup UI is built.
- Pilot migration `tournament_setup_operation_reconciliation` applied.
- In one rollback-only fixture, an authenticated director saved a private setup
  draft and reconciliation returned its exact accepted response under the same
  key. A non-member claim received `NULL`. All fixture rows rolled back.
- The function uses `SECURITY DEFINER` with an empty search path; `public` and
  `anon` execution are revoked and only `authenticated` is granted execution.

## Remaining limits

The UI/API client has not yet been built. It must use a same-origin route,
strict request/response validation, `private, no-store`, opaque key/version/
change-detector envelopes only, and lock on all ambiguous outcomes. Real
independent browser sessions remain release evidence gates.
