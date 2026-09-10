# Registration lifecycle hosted audit — 2026-09-10

## Scope

This follow-up review tests the deployed pilot database boundary for director
registration-link issue, rotation, closure, state read, and tournament
registration closure. It does not claim that public registration, a full
director workflow, or real concurrent browser sessions are complete.

## Hosted evidence

On pilot project `fnjkwymxpnsqvxtpronk`, the five registration lifecycle
functions have the expected exact signatures. Each is a `SECURITY DEFINER`
function with an empty `search_path`; anonymous and authenticated roles have
no execute grant, while `service_role` alone has execution. The Next.js server
routes are therefore the only reviewed browser-facing path for those functions.

The local migration series `0001` through `0086` was compared with the pilot
migration history. The pilot includes every current migration in the reviewed
series, including:

- exact link/version compare-and-swap for rotation and closure (`0078`–`0081`);
- atomic registration closure (`0082`);
- seating closure-state read and server check-in closure enforcement
  (`0083`–`0084`);
- controlled duplicate score-confirmation rejection (`0085`); and
- retired legacy payment-reconciliation execution (`0086`).

## Source-level boundary review

The issue, rotate, and close routes use one bounded JSON reader (2 KiB maximum
by both declared and actual byte length), require JSON content type, validate
an exact request shape, require a verified subject, enforce same-origin on
mutations, and return private/no-store responses. Rotation and closure carry
the expected current link ID and version. The server-only credential adapter
sends only a generated link ID, salt, and digest to the database; it never
sends a raw bearer credential to the RPC and never reconstructs one from a
replayed receipt.

Existing regression tests cover bounded parsing, exact request shapes,
credential non-disclosure, one-time retry handling, version advance, and
response mismatch rejection.

## Re-run checks

Executed in the local worktree after the hosted inspection:

- `pnpm test` — 114 passed, 0 failed;
- `pnpm lint` — passed;
- `pnpm build` — passed (Next.js 16.3.4 optimized production build);
- `pnpm verify` and `pnpm verify:handoff` — passed;
- `pnpm audit --prod --audit-level=high` — no known vulnerabilities; and
- `git diff --check` — passed.

These checks validate the current code and recovery material. They do not
replace the independent authenticated-session and real-database race tests
listed below.

## Finding

No new P0/P1 defect was found in this boundary review. Supabase still reports
its generic signed-in `SECURITY DEFINER` warnings for other deliberate,
role-checked application RPCs and its expected private-schema RLS-no-policy
information notices. Those advisor entries do not alter the service-only grant
evidence above and remain subject to review whenever a function changes.

## Remaining release evidence

This audit leaves the following non-waivable work open:

1. Real independently authenticated browser sessions, including concurrent
   claim/rotate/close races and reconnect behavior.
2. Formal confirmation of the hosted password sign-in configuration and a
   no-account probe.
3. The ACC-backed operational rules, hybrid paper workflow, results/finance
   finalization, and supervised tournament simulation identified in the
   release-readiness review.
