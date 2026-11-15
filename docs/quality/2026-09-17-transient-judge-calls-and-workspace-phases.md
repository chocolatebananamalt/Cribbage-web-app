# Transient Judge Calls and workspace phases — verification record

**Status:** Implemented and hosted migrations applied; independent-session,
responsive-browser, and Production application verification pending.

## Behavior covered locally

- The workspace groups ordinary activity into Setup, Registration and payments,
  Check-in and seating, Cross-check and recovery, and Results and reporting.
- Judge Calls use a transient, RLS-protected table and service-only RPCs. The
  database accepts current started Singles and team games, requires an event
  participant to call, permits only Judge-role actors to accept, rejects a
  Judge playing in that game, limits acceptance to two, and deletes the call
  when either assigned Judge selects **Situation Resolved**.
- The player control and Judge Desk do not contain a ruling, score, correction,
  or financial mutation. The permanent dispute/correction path is unchanged.
- Static regression coverage also checks same-origin, verified-subject,
  tournament-ID, server-only RPC boundaries, and the user-visible two-Judge
  copy.

## Local commands run

- `node --test tests/live-judge-calls.test.mjs tests/tournament-workspace-phases.test.mjs` — passed after the final assertion repair.
- `pnpm lint` — passed.
- `pnpm build` — passed.
- `pnpm verify` — passed: production dependency audit, lint, 561 application
  tests, provider readiness, optimized production build, and workspace tests.
- Browser attempt: this host has no `agent-browser` executable, so a local
  phone/desktop visual result cannot be claimed from this machine.

## Evidence still required

- Apply and rollback-test `0212_transient_judge_calls.sql` in an isolated
  Supabase validation project.
- Prove with independent player and Judge sessions that the first two accepts
  are atomic, other Judge alerts change to the two-accepted state, a
  player-Judge conflict is rejected, resolution clears every live view, and
  the same behavior works for a team game.
- Verify phone and desktop layout for the grouped workspace, player call
  control, and Judge Desk. Then use the normal reviewed deployment path and
  inspect Production runtime errors.

## Disposable migration findings

- The first 0212 disposable apply failed atomically on a trailing comma in the
  new table definition. The SQL was corrected before any 0212 object was
  created. This is exactly why the disposable apply precedes the rehearsal
  database.

## Hosted database evidence

- Migrations 0212, 0213, and the related 0214 time-zone integrity repair were
  applied first to disposable project `donfxulkliuyteiannir`, then to rehearsal
  project `fnjkwymxpnsqvxtpronk`.
- `tests/transient-judge-calls.sql` passed under a transaction and rolled back
  on both projects. It proved participant scoping, playing-Judge rejection,
  first-two acceptance, third-Judge rejection, Judge workspace projection,
  assigned-only resolution, idempotent resolved state, no permanent receipt or
  audit/ruling record, and private grants.
- Rehearsal counts were unchanged before and after: 3 tournaments, 7 events,
  and 0 active Judge Calls.
- Hosted permission inspection confirmed `authenticated` cannot execute the
  open RPC while `service_role` can.
