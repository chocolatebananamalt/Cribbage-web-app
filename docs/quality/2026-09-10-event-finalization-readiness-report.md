# Event finalization readiness report verification

Date: 2026-09-10
Environment: local source plus isolated synthetic Supabase project
`donfxulkliuyteiannir`
Shared pilot/production mutation: none

## Acceptance criteria

- Only an actor with a current exact director or co-director role may receive a
  tournament/event-scoped response. Primary-director identity alone is not
  authority, and browser roles cannot execute the database function.
- The response combines only existing score, correction, payment-event,
  payment-conflict, ruleset, and publication evidence.
- Missing event lifecycle, schedule completeness, seating/eligibility, dispute,
  finance/reporting reconciliation, attachment classification, result version,
  and director approval evidence must block every response.
- The response must never authorize finalization or calculate qualifiers, MRPs,
  Q-pools, payouts, eligibility, official results, or ACC exports.
- The HTTP surface must remain default-disabled and require an exact opt-in.

## Evidence

- `tests/finalization-readiness.test.mjs`: 5/5 passed. This covers strict response
  shape and scope, permanent blockers, inconsistent score/correction claims,
  diagnostic payment-conflict history, RPC failure, service-only controls, role
  checks, and the exact default-off release switch.
- TypeScript check: passed.
- Focused ESLint check for the reader, release control, route, and test: passed.
- Migration 0110 applied to the isolated synthetic project, then
  `tests/event-finalization-readiness.sql` ran inside one `BEGIN`/`ROLLBACK`. It proved:
  - the director report returned two persisted games, one verified and one
    pending, one pending legacy correction, two roster entries, one active
    receipt-state roster entry, one unrecorded payment state, one diagnostic
    operation conflict, and all required unavailable-evidence blockers;
  - a director from another tournament, a revoked co-director, and the primary
    director after role removal received no report while the current
    co-director received the scoped report;
  - `public`, `anon`, and `authenticated` had no execute privilege and
    `service_role` did; and
  - after rollback, the synthetic user and tournament fixtures were absent.
- An independent rerun first exposed that the fixture's synthetic verified game
  omitted the two required player submissions and confirmations. The fixture
  was corrected before shared-pilot use, now forces all deferred game
  invariants, and passed with two matching submissions plus two confirmations.
- `pnpm verify`: PASS; no known production vulnerability, lint passed, 214/214
  application tests passed, production build and workspace checks passed.
- `pnpm verify:handoff`: PASS; 6/6 private handoff checks passed.
- `git diff --check`: passed with line-ending notices only.

## Limitations and release status

- Migration 0110 is present in the isolated synthetic Supabase migration ledger.
  Its rollback fixture retains no synthetic accounts or tournament data.
- The shared pilot received migration 0110 only after independent review and
  ordered application of 0106–0110. No Vercel, Supabase Auth, feature-flag, or
  deployment setting changed.
- The route returns not found by default. Hosted browser and two-independent-
  session role proof remain required before enabling the exact staging switch.
- The HTTP route delegates authorization to the server-only reader and maps its
  null result to a private not-found response. It does not use the legacy
  unordered single-role lookup, so legitimate multi-role officials are not
  nondeterministically denied.
- This report cannot close finalization. All eight absent evidence authorities
  listed above remain genuine blockers.
