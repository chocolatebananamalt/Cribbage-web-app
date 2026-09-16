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

## Required post-deployment evidence

- In a signed-in Production session, open the rehearsal from **Your
  tournaments**, open **Tournament workspace**, then open **Set Up
  Tournament** without a 404.
- Confirm the protected Setup API remains inaccessible to an anonymous
  session and malformed IDs remain rejected.
- Record the deployment and post-release runtime-error scan before calling
  the repair Production-verified.
