# 2026-09-10 Review Prototype Production Boundary

## Acceptance criteria

1. The synthetic review dashboard remains available in local development and
   Vercel Preview, so the approved format-review process is not disrupted.
2. A Vercel Production deployment, and a production-like build without an
   explicit Preview environment, cannot render the synthetic dashboard as a
   live tournament operations surface.
3. The boundary is small, deterministic, regression-tested, and does not
   alter authenticated tournament routes.

## Evidence

- Added `src/lib/review-prototype-boundary.ts`. It permits only local
  development and explicit Vercel Preview/Development environments; it denies
  Vercel Production and an unspecified production-like environment.
- The root route calls `notFound()` before rendering `TournamentDashboard`
  whenever that guard denies the environment. This prevents the sample
  tournament, fictional finance values, and editable review controls from
  becoming a public production surface by deployment mistake.
- `tests/supabase-auth-semantics.test.mjs` exercises Production denial,
  Preview allowance, local-development allowance, unspecified-production
  denial, and verifies that the root route enforces the guard.

## Executed verification

Run locally on 2026-09-10:

```text
pnpm lint                 PASS
pnpm test                 PASS (82 tests)
pnpm build                PASS (Next.js 16.3.4)
pnpm verify               PASS (6 workspace checks)
pnpm verify:handoff       PASS (6 private-handoff checks)
```

The protected Preview dashboard remains a visual-review surface; no visual
layout changed. The production denial is intentionally not deployed as a
public test because the application is not release-ready and its hosted
production environment must not be used as a test tournament surface.
