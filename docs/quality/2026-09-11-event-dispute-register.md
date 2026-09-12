# Event dispute register and qualification guard verification

Date: 2026-09-11

## Scope and acceptance evidence

This slice adds an event-scoped, append-only dispute register for published
Standard Singles games. It does not create, modify, confirm, or correct a
score. A linked game participant or current event official may open a dispute.
Only a current director, co-director, cross-checker, or judge who is not either
game participant may resolve it.

The database owns the release gate: an open dispute blocks qualification both
in the public finalization RPC and in a trigger on the canonical qualification
result table. The existing reviewed finalization implementation is moved behind
the new wrapper and has no direct grant, so callers cannot bypass the guard.

Accepted and rejected operations have actor-scoped idempotency receipts. Exact
retries return the saved response; changed reuse records an immutable conflict.
Disputes, state transitions, and operation conflicts are private RLS-forced,
append-only records. The official workspace returns only currently open
disputes within the requested tournament and event.

A follow-up concurrency review hardened both expected-rejection handlers. After
reacquiring the actor/operation lock, each handler now re-reads any receipt
created by a competing request: exact requests return the saved response and
changed reuse appends the immutable idempotency-conflict record. Static
regressions cover this ordering for both open and resolution operations.

The protected event-dispute page provides the tournament-day staff workflow:
it lists published games, opens a dispute without accepting any score data,
lists open disputes, and enables resolution only when the workspace marks the
current official independent. Ambiguous browser operations retain their full
request and retry identity in scoped session storage. Event results link to the
register for authorized staff.

## Checks run

- `pnpm exec node --conditions=react-server --experimental-strip-types --test tests/event-dispute-register.test.mjs tests/qualification-finalization.test.mjs`
  - PASS: 13 tests, 0 failures.
- `pnpm eslint src/lib/api/event-disputes.ts src/lib/api/qualification-finalization.ts "src/app/api/v1/tournaments/[id]/events/[eventId]/disputes/route.ts" "src/app/api/v1/disputes/[id]/resolution/route.ts" "src/app/tournament/[tournamentId]/events/[eventId]/disputes/page.tsx" "src/app/tournament/[tournamentId]/events/[eventId]/disputes/dispute-client.tsx" "src/app/tournament/[tournamentId]/results/page.tsx" tests/event-dispute-register.test.mjs`
  - PASS: no findings.
- `pnpm build`
  - PASS with Next.js 16.3.4; both dispute API routes were present in the route inventory.
- Focused `git diff --check` for the migration, API, routes, and tests.
  - PASS.

## Hosted proof and remaining limitations

Migration `0138` was applied to the approved Supabase pilot on 2026-09-12.
`tests/event-dispute-register.sql` passed there after its test harness was
corrected to set the service JWT claim without dropping the database-owner
assertion privileges. The first attempt failed inside its transaction and
rolled back; the corrected proof also rolled back and retained no synthetic
records. The protected staff UI still requires phone/desktop and independent-
session browser verification before operational use.

The SQL fixture uses synthetic identities and data only. No private player data
or credentials were included.
