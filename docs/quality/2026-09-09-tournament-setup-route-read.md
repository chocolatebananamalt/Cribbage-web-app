# Protected tournament setup read route — 2026-09-09

## Acceptance criteria

1. A signed-in current director or co-director can load only the current
   private setup workspace and the current official-choice bootstrap data for
   the requested tournament.
2. An unauthenticated, malformed, unauthorized, database-error, or malformed
   response fails closed without exposing private setup content.
3. The browser and intermediaries cannot cache private setup responses.
4. The route makes no direct table request and no mutation.

## Implemented boundary

`GET /api/v1/tournaments/:id/setup` validates the UUID, verifies the signed
in claim with the server cookie client, and calls only the two existing
role-scoped RPCs in parallel:

- `get_tournament_setup_workspace`
- `get_tournament_setup_official_choices`

It accepts only strict shapes for the workspace, version history, official
choices, configured event records, and Q-pool records. It returns `404` for
an unavailable private workspace, rather than distinguishing an unauthorized
tournament from another unavailable condition. All outcomes use
`Cache-Control: private, no-store`.

An RPC/database failure is instead returned as a generic `503` so an outage is
not misreported as a missing tournament. Invalid JSON on the save endpoint is
also private/no-store; no response path is left cacheable.

The parallel save route retains its same-origin check and now uses the same
private no-store policy for every response path.

## Repaired finding

The first validator draft used invented source-status values. Direct review of
the applied setup schema shows that setup event and Q-pool rows use the exact
value `director_configured_unverified`. The validator now requires that exact
value. Without this repair, valid production-style setup reads would have
failed closed.

## Evidence

On the reviewed branch, run locally with Node 24 and pnpm 11.19.0:

```text
pnpm lint                 PASS
pnpm test                 PASS (57 tests)
pnpm build                PASS
pnpm verify               PASS
pnpm verify:handoff       PASS
git diff --check          PASS
```

The regression test asserts that the route uses claims, both scoped RPCs,
strict response validators, a private no-store policy, and no direct table or
service-role access. The production build lists the route as dynamic.

Vercel built commit `3f08f27927457cbb19b3848e6084504d36c3814e` as Ready
Preview deployment `dpl_6nPsAAfGRV5mBPBxS6fE4ruuh27w`. The one-hour runtime
error scan returned no grouped error. The protected Preview remains a review
environment; this verifies deployability, not an authenticated setup workflow.

## Limits still requiring release evidence

This route does not make the setup feature complete. A protected setup page
and retry-safe browser client, real independent director/co-director sessions,
real authorized/unauthorized database assertions, concurrency testing, DST
fold policy, approved ACC option fixtures, and all downstream operational
workflows remain release gates.
