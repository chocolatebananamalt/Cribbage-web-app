# Requirements Reconciliation Verification - 2026-09-06

## Scope

Updated active requirements, launch planning, design catalog, project status, and a decision record to incorporate user-approved product feedback and current ACC rule sources. No prototype or production application code was changed.

## Acceptance criteria

1. Active requirements use separate Plus Points and Minus Points, full opponent name, and Table/Seat rather than opponent initials.
2. Requirements distinguish official ACC scoring/tie-break rules from informal skunk graphics.
3. Correction reason and second-approval behavior are recorded as tournament-director configuration, optional by default, without weakening server-verification safeguards.
4. Flyer, Q-pool, results, ACC export, branding, and live-service facts agree with the approved product decisions.
5. No private handoff material is added to tracked production paths.

## Evidence

- Reviewed `docs/product/requirements.md`, `docs/operations/LAUNCH_PLAN.md`, `docs/design/README.md`, `PROJECT_STATUS.md`, and `docs/decisions/2026-09-06-product-and-release-decisions.md`.
- Checked active planning documents for superseded terms; the remaining occurrences of "Opponent initials" and "Reserve Fee" are explicit removal/rename statements, not active UI requirements.
- Current rule sources recorded in requirements: ACC Official Tournament Rules 2025, accessed 2026-09-06.
- Vercel project inspection: connected placeholder deployment is `READY` but returns 404; no application framework is configured.
- Supabase project inspection: active/healthy, no migrations, no public tables, and no current security/performance advisor findings.

## Commands and results

Environment: Windows PowerShell; bundled Node 24.19.0 runtime.

- `node --test tests/workspace.test.mjs` - PASS, 3/3.
- `node --test tests/handoff.test.mjs` - PASS, 6/6.
- `git diff --check` - PASS, no whitespace errors.

## Limitations

These are documentation and recovery-integrity checks, not production certification. No real application, backend, authentication, database policy, browser acceptance test, multi-user test, backup/restore drill, or simulated event exists yet.
