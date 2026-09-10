# 2026-09-10 Review Prototype Production Boundary

## Acceptance criteria

1. The synthetic review dashboard remains available in local development and
   Vercel Preview, so the approved format-review process is not disrupted.
2. A Vercel Production deployment, promoted Preview, custom production host,
   and a production-like build without an explicit safe host cannot render the
   synthetic dashboard as a live tournament operations surface.
3. The boundary is small, deterministic, regression-tested, and does not
   alter authenticated tournament routes.

## Evidence

- Added `src/lib/review-prototype-boundary.ts`. It permits only local
  development and an actual Vercel Preview host; it denies Vercel Production,
  the default production hostname, unlisted custom hosts, and an unspecified
  production-like environment. This host check matters because Vercel can
  promote an already-built Preview deployment without rebuilding it.
- The root route reads the request host and calls `notFound()` before rendering
  `TournamentDashboard` whenever that guard denies it. This prevents the
  sample tournament, fictional finance values, and editable review controls
  from becoming a public production surface by deployment mistake or Preview
  promotion.
- `tests/supabase-auth-semantics.test.mjs` exercises Production/default-domain
  denial, actual Preview-host allowance, local-development allowance,
  unlisted-custom-host denial, unspecified-production denial, and verifies
  that the root route reads the request host before enforcing the guard.

## Executed verification

Run locally on 2026-09-10:

```text
pnpm lint                 PASS
pnpm test                 PASS (82 tests)
pnpm build                PASS (Next.js 16.3.4)
pnpm verify               PASS (6 workspace checks)
pnpm verify:handoff       PASS (6 private-handoff checks)
```

Hosted evidence on 2026-09-10:

- Vercel Preview deployment `dpl_5fxwHsoEhyL6n7KCQzJWS36wGxCG` for commit
  `b120d58` reached `READY` with no alias error. Its preview host returned
  HTTP 200 and the expected review dashboard.
- The project default production hostname returned HTTP 404. No production
  deployment was created or promoted for this test because the app is not
  release-ready. That observed 404 therefore does not substitute for the
  guard's automated custom-host/promotion rejection coverage.
- Vercel reported no runtime errors in the preceding hour.

The protected Preview dashboard remains a visual-review surface; no visual
layout changed.
