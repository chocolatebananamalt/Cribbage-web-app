# API mutation and database-function surface review — 2026-09-10

## Scope

This is a source review of the current `codex/production-readiness-baseline`
branch after the registration-link and account-activation work. It is not a
claim about the shared pilot catalog, which has a separately recorded migration
parity gap.

## API mutation result

The repository currently contains 26 API route files, each with a POST
handler. Every POST handler now has all of these source-enforced boundaries:

1. the shared `isSameOriginRequest(request)` rejection before it reads input
   or reaches a database operation;
2. a bounded JSON reader rather than unbounded `request.json()` or
   `request.text()`;
3. private, no-store JSON responses; and
4. an RPC-only data path for stateful operations rather than direct browser
   table writes.

The review found nine exceptions to the explicit same-origin convention:
score submission/confirmation, the hard-disabled correction and correction
policy operations, and roster-promotion operations. Commit `09bf8b4` adds the
missing guards. The new repository-wide regression test enumerates every API
POST route, so a future route cannot omit the origin check unnoticed.

## Database-function result

The source migration review found privileged functions declared with explicit
`SECURITY DEFINER` search-path hardening and grant/revoke statements. The
current registration-link and witnessed account-activation functions are
service-only in source. The independently scored game functions remain
authenticated-callable by design, but their current actor and game assignment
checks are enforced inside the functions and the browser reaches them through
the protected app routes.

Source migration history is not hosted evidence. In particular, the shared
pilot has not received source migrations `0096`–`0098`; its seven obsolete
Rule 12 correction functions must still be revoked under the approved pilot
change-control procedure before role fixtures or live pilot use. See
`2026-09-10-shared-pilot-correction-grant-gap.md`.

## Executed evidence

On 2026-09-10, after the repair:

- `pnpm verify` passed: production dependency audit, lint, 159 application
  tests, production build, and workspace integrity checks.
- `pnpm verify:handoff` passed locally.
- `git diff --check` passed.
- GitHub Actions `Verify` run `34487151689` passed for commit `09bf8b4`.

## Remaining limitations

This review cannot prove a real browser session, independent users, database
race behavior, hosted grants, or a production deployment. Those remain
release gates, not conditions that source inspection can waive.
