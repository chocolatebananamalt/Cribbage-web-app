# Fresh Prototype Shell Verification - 2026-09-06

## Acceptance criteria

- App Router TypeScript page builds successfully.
- Responsive dashboard visibly presents the user-authorized ACC logo asset, score entry, paper-style scorecard, and static operations cards using synthetic data only.
- Score utility accepts integer margins 1–121, derives reciprocal plus/minus and 0/2/3 game points, and labels informal 31–60/61–90/91–121 skunk bands without treating them as ACC terminology.
- Score utility rejects 0, 122, decimals, and non-numeric values.
- Phone and desktop browser checks at 320px, 375px, and 1280px show the key regions, no Next.js error overlay, and no page-level horizontal overflow.

## Changes

- Added `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/tournament-dashboard.tsx`, and `src/app/globals.css`.
- Added `src/lib/score.ts`, `tests/score.test.mjs`, `public/branding/acc-logo.jpg`, and `eslint.config.mjs`.
- Added linting and corrected the static prototype so pending live input is visibly uncertified and excluded from settled scorecard rows/totals/net. Lead setup added the Next.js/React/TypeScript dependencies and `pnpm-lock.yaml`; this pass did not alter dependency versions or the lockfile.

## Commands and results

Environment: Windows PowerShell; bundled Node 24.19.0 runtime; Next.js 16.3.4.

- `pnpm install --frozen-lockfile` — PASS with pnpm 11.19.0; lockfile is up to date.
- Initial `pnpm dev` dependency preflight was blocked by pnpm's ignored `unrs-resolver` build script; lead added the narrowly scoped `pnpm-workspace.yaml` `allowBuilds: unrs-resolver` approval. Subsequent frozen install and direct Next.js dev/build validation passed.
- `pnpm audit --audit-level=high` — PASS; no known vulnerabilities found.
- `pnpm lint` — PASS.
- `pnpm test` — PASS, 11/11 (including readiness gating, dashboard initial-state semantics, missing/invalid-winner rejection, opponent normal/skunk paths, signed-net formatting, margin rejection boundaries, and the local schema contract).
- `pnpm build` — PASS; route `/` statically prerendered.
- `pnpm verify` — PASS, 6/6.
- `pnpm verify:handoff` — PASS, 6/6 direct handoff suite (the outer `pnpm verify` suite is 6/6; handoff remains mandatory local-only and is intentionally not run by clean-clone CI).
- `pnpm verify:all` is the clean-clone-safe lint/test/build/verify aggregate; `pnpm verify:local` adds the private handoff check for this workstation.
- `git diff --check` — PASS, no whitespace errors.
- Browser desktop check at default viewport — page loaded, key headings/table/keypad rendered, no Next.js overlay.
- Browser checks at 320px, 375px, and 1280px requested viewports — score entry, scorecard, keypad, logo, pending preview, and operations cards rendered; `document.documentElement.scrollWidth === clientWidth` at each tested size (reported client/scroll widths: 305/305, 360/360, and 1265/1265 due browser scrollbar space).
- Accessibility snapshot check — winner controls expose `aria-pressed`, logo exposes accurate alt text, decorative VS is hidden from assistive technology, essential labels/status/table text use 16px CSS targets, keypad controls use 56px minimum targets, and no runtime font import remains.
- Interactive browser check — keypad produced margin 31 and informal skunk notice; switching winner produced reciprocal plus/minus display. Pending live values remained outside settled scorecard totals.

## Limitations

This is a design-review shell only. It has no authentication, Supabase client, persistence, server verification, offline queue, or production data. The authorized screenshot asset is retained as a prototype branding reference and was copied without altering the source file. Browser checks did not perform a 200% zoom usability exercise; that remains a required future accessibility gate. Build, lint, and recovery checks do not establish production readiness.

## Local database contract evidence

- `database/migrations/0001_vertical_slice_core.sql` is present and intentionally unapplied. `tests/schema-contract.test.mjs` checks all 13 private core tables, UUID primary keys, forced RLS, direct DML revocation, scoring boundaries, normalized game-pair uniqueness, format/scoring-method boundaries, and absence of client-derived totals.
- No Supabase connection, migration apply, auth setup, RPC, policy, or production route was attempted in this pass. A real database integration test and reviewed server-side authorization policies remain required before any apply step.
- The schema contract now additionally statically checks private `app` schema placement, `auth.users` identity linkage, non-cascading FKs, composite scope, exact two submission slots, immutable submission protection, distinct submission-bound confirmations, pending-game score rejection, game state/version, and scoped idempotency. These are static checks only; no SQL engine or Supabase integration execution has occurred.
- The schema contract also checks two distinct confirmation actors with self-confirmation allowed, immutable confirmation/audit history, reciprocal verified-score requirements, assigned-side submission actors, Table/Seat snapshots, approved matching digital rulesets, and actor/client-operation-only idempotency. Request-hash conflict comparison remains a future RPC responsibility.
- The third remediation adds static coverage for deferred child-mutation revalidation, exact reciprocal score math and side/seat mapping, submission slot/player linkage, immutable receipts/rulesets, stored replay responses, and tournament-scoped audit receipt linkage. These remain static checks; no SQL engine or Supabase integration execution occurred.

## Supabase auth scaffolding evidence

- Added pinned Supabase SSR dependencies and static tests for fail-closed environment validation, browser/server client separation, publishable-key-only usage, sign-in OTP flow, callback code exchange, and same-origin relative redirect allowlisting.
- No Supabase project was contacted, no environment variables were set, and no auth/RLS policy, RPC, service key, or public client database access was added. The server-only membership lookup is intentionally a future-policy-dependent boundary and currently cannot grant access without configured Supabase/RLS.
- Auth review hardening is now covered by static tests for direct Next env inlining, `getClaims` proxy refresh/cookie propagation, invite-only OTP, same-origin callback handling, and server-side membership gating. The protected route performs a server DAL membership lookup; no tournament data is rendered before access is granted.
- Final auth blockers are covered by static tests for response-aware callback cookie propagation, the unapplied private-schema membership function and narrow grant, safe `next` preservation, and tracked blank `.env.example` contents. No environment values or Supabase deployment actions were performed.
- The final boundary correction additionally checks request-header refresh propagation, callback header copying, public-wrapper grant/revoke configuration, and absence of direct app-table grants. No migration was applied.

## Game API vertical slice evidence

- Added static route/RPC contract tests for UUID/input validation, `getClaims` authentication, RPC-only handlers, security-definer/search-path/auth.uid checks, actor assignment/tournament scope, idempotency conflict handling, two-confirmation derivation, and absence of direct table grants.
- `pnpm test` passes 18/18. Routes build as dynamic handlers; migration `0003_game_submission_confirmation_rpc.sql` remains unapplied and has not been executed against a SQL engine or Supabase project.
- Review remediation is covered by static assertions for own-submission-only confirmation, confirmation-pending/mismatch persistence, internal SQL digest computation, idempotency locking, digital/open/checked-in gates, accepted receipt/audit linkage, and the rejected-transaction rollback boundary.
- Final review coverage adds open-tournament rechecks, current checked-in confirmation assignment, internal subtransaction rejection receipts/audits, removal of the client-callable logger, and deterministic `pgcrypto` schema qualification. No migration was applied.
- Pilot read-only verification subsequently confirmed `pgcrypto` is installed in `extensions`; static tests now require `extensions` qualification throughout 0001/0003. No migration was applied.

- Rejection-integrity remediation is covered statically: immutable conflict records retain attempted idempotency key/hash and prior receipt, known and unscoped rejects are classified after lookup, routes map structured domain rejects to non-2xx stable responses, and unexpected/audit-write failures are rethrown rather than converted into false rejection success. No SQL engine or Supabase apply was run.

- Idempotency/null remediation is also static-only: required direct-RPC null inputs are rejected, actor/key requests are transaction-serialized, and exact replays are resolved before mutable eligibility checks without rejection-auditing an accepted replay. A live concurrency/integration test remains required before applying the migration.

- The pilot's 0003 apply failed atomically before mutation because each PL/pgSQL function contained two `EXCEPTION` clauses in one block. The local draft now has one valid clause per function with a domain branch and unexpected-error rethrow. No `psql` executable/parser is available in this workspace; this correction is statically checked and must be parse-validated in the controlled database environment before retrying.

- A later pilot mutation test reached 0003 and found the deferred submission trigger invoking `app.revalidate_game` as the authenticated invoker, causing `permission denied for schema app`. The base migration now hardens all deferred/internal trigger functions as `SECURITY DEFINER` with empty search paths and no client grants; unapplied `0004_trigger_security_hardening.sql` provides the correction for an existing pilot schema. No pilot mutation was made here.

- Applied reviewed `0003` and `0004` to the isolated synthetic-data Supabase pilot. An actual independent-submission flow produced a `verified` game only after two matching assigned-player submissions and two own-submission confirmations. A mismatch test persisted `mismatch` with no canonical winner/margin or confirmations; an attempted cross-confirmation was retained as `not_submission_owner`; a non-assigned authenticated actor was rejected as `not_assigned`; a closed-tournament attempt was rejected as `tournament_closed`; an exact idempotency replay was returned without mutation and a changed replay was rejected as `idempotency_conflict`.
- `0005_pilot_index_and_advisor_baseline.sql` was reviewed then applied to that same pilot. The nine required index definitions were queried from `pg_indexes`; the performance advisor now reports only expected unused-index information for the low-traffic pilot, not missing FK indexes. The private-schema RLS/no-policy and authenticated security-definer warnings are intentional and covered by explicit revocations, function grants, `auth.uid()` checks, and live anonymous/direct-table denial tests.
- The Auth leaked-password-protection warning remains unresolved: the UI uses OTP, but hosted Supabase Auth password enablement has not been independently verified or configured. Production release is blocked until the service is proven passwordless or leaked-password protection is enabled.
