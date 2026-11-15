# Rehearsal Setup UUID compatibility verification

**Date:** 2026-09-16
**Scope:** prevent an authorized PostgreSQL-valid tournament identifier from
being listed in the chooser but rejected as a Setup-route 404.

## Change

The shared UUID validator now accepts canonical PostgreSQL `8-4-4-4-12`
hexadecimal UUID formatting. The chooser now imports that exact validator,
eliminating two incompatible ID definitions. Role authorization remains in
the existing server-side `get_tournament_role` boundary.

## Local evidence

| Check | Result |
| --- | --- |
| Focused chooser/setup compatibility tests | Passed: 5/5 |
| TypeScript | Passed: `pnpm exec tsc --noEmit` |
| Full release verification | Passed: `pnpm verify`, including audit, lint, 528/528 application tests, provider readiness, Production build, and workspace checks |
| Data mutation | None; no Supabase migration or application-data operation was performed |

## Production evidence

- Pull request #73 merged as `e0e858adad3ff186595254791651a0451e3130f4`.
  GitHub reported the Vercel Production deployment successful.
- In a separate signed-in Production session, **Your tournaments → Genesis
  Rehearsal → Set Up Tournament** loaded the saved finalized setup without a
  404.
- HTTP smoke probes: stable root returned `200`; anonymous Setup returned
  `307` to sign-in.
- Detailed Vercel runtime-log review is not recorded for this release because
  the separate verification browser had no Vercel dashboard session. This is
  a verification limitation, not an app failure.
