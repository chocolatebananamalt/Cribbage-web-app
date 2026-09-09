# Check-in and initial seating API boundary — 2026-09-09

## Scope and acceptance criteria

This pass exposes the `0047_check_in_and_initial_seating` director/co-director operations through two private application routes. Follow-up pilot migrations `0060`–`0064` add application-facing wrappers that require a current director/co-director role, recompute the exact request fingerprint, retrieve the only matching authoritative operation receipt for the caller/tournament/operation/target, and then bind the returned envelope to the request's tournament and idempotency key. The receipt lookup repeats the current-role requirement in the same query to eliminate a role-change race. If no receipt proves the reply or the caller no longer holds the role, the wrapper returns no envelope and the application route fails closed. A protected director/co-director check-in and initial-seating screen is now present, but player delivery, round rotation, and an end-to-end tournament workflow remain outside this slice.

Acceptance required:

1. Only same-origin, authenticated browser requests can reach either RPC.
2. Each request is restricted to the migration-defined input shape, including UUIDs, bounded check-in reasons, allowed check-in states, table capacity, uppercase Table/Seat syntax, and no duplicate roster or seat assignments.
3. Only exact, migration-defined accepted and rejected responses that match the submitted tournament and operation can cross the route boundary. Extra or cross-operation fields fail closed.
4. Every response is `private, no-store`; claims or dependency failures return a generic unavailable response rather than database details.
5. The routes use RPCs only and never direct tables, service-role access, or client-supplied authorization.

## Implementation

- Added `src/lib/api/seating.ts` with strict request and response validators.
- Added `POST /api/v1/tournaments/[id]/seating/check-in`, which calls `record_roster_check_in_event_v2`.
- Added `POST /api/v1/tournaments/[id]/seating/publish`, which calls `publish_initial_seating_v2`.
- Applied pilot migration `0060_check_in_seating_operation_response_binding`, followed by `0061_check_in_seating_receipt_provenance_repair`, `0062_check_in_seating_unreceipted_fail_closed`, `0063_check_in_seating_current_role_replay_guard`, and `0064_check_in_seating_receipt_role_lookup_guard`. The final wrappers are security definer with an empty search path only to require the current official role and retrieve the caller's exact operation receipt: matching actor, tournament, operation type, target, idempotency key, and a recomputed `0047` SHA-256 request fingerprint. The receipt query itself repeats the current-role predicate. They return that stored payload—not an unproven inner reply—then append only the submitted `tournamentId` and `operationId`. If the lookup misses or the role no longer exists, they return SQL `null`, which the route converts to generic `503`; no unreceipted or revoked-role replay can be treated as terminal. They do not mutate existing receipt/audit history.
- Before applying `0060`, queried the pilot receipt history: it contained no `record_roster_check_in_event` or `publish_initial_seating` receipts. Existing-receipt replay would nevertheless remain safe because the wrapper adds those two binding fields at return time.
- Added regression coverage for rejected malformed/overlong/extra check-in requests; malformed, duplicate, and out-of-capacity seating assignments; exact accepted/rejected envelopes; same-count/same-state cross-operation response rejection; private-field rejection; and route source boundaries.
- Added `src/app/tournament/[tournamentId]/seating`: a director/co-director-only workspace that reads the narrow `get_initial_seating_workspace` DTO through a server-only loader, records bounded check-in states, prepares a full starting Table/Seat list, and prints a published list. The client uses only the existing private routes, stores one exact unresolved request under an actor-scoped session key, and locks unrelated actions until the same request is retried or the server gives a terminal answer. The publication warning deliberately makes clear that the initial list is permanent verification ID assignment, not per-round seating or rotation.
- Added a pure DTO validator with regression cases for extra/private fields, invalid state, duplicate data, and Table/Seat-to-verification-ID mismatch. Shared-device sign-out now clears the seating-operation recovery key.

## Executed evidence

On the local Windows workspace using the repository-pinned tooling:

- `pnpm lint` — pass.
- `pnpm test` — pass, 73 tests.
- `pnpm build` — pass; both API routes are listed as dynamic application routes.
- Pilot SQL smoke check as an unauthenticated caller — both wrappers return SQL `null` when no exact current-authorized receipt exists. Catalog verification confirms anonymous execute is revoked, authenticated execute is granted, both wrappers are security definer with an empty search path, and both definitions contain the current director/co-director role guard before their exact operation-receipt lookup. A real role-revocation replay needs independent authenticated-session evidence and remains a release gate.

The first implementation attempt failed two new checks (an unknown-value TypeScript narrowing issue and a test which omitted the shared cache boundary); both were fixed before this record.

## Limitations and remaining required evidence

- Migrations `0060`–`0064` are applied to the pilot. They are narrow response-binding repairs; they do not grant a role, alter seating/check-in authority, or create player data.
- No authenticated director/co-director browser session, independent-session authorization test, real roster/check-in lifecycle, or deployed route smoke test was run in this pass. A local Next development server compiled and started, but the available browser surface blocked `http://localhost:3000` (`ERR_BLOCKED_BY_CLIENT`), and the required browser automation executable is unavailable on this host. Consequently phone/desktop visual verification of the new screen is explicitly unverified.
- The protected interface and a basic browser print action now exist, but player account linking/delivery, late-entry policy, round rotation, table-playthrough guidance, and proven multi-session operation remain release gates.
- The database remains authoritative for membership, tournament lifecycle, registration closure, complete checked-in roster coverage, idempotency receipt history, immutable initial seating, and audit history.
