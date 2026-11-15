# CI and branch-protection audit — 2026-09-09

## Scope

Verify that the repository has a clean-clone verification workflow and
determine whether its branch can enforce that workflow before a future release
merge or production promotion.

## Evidence

- `.github/workflows/verify.yml` runs on both `push` and `pull_request` with
  read-only contents permission, pinned pnpm 11.19.0, Node 24, frozen-lockfile
  install, lint, application tests, production build, and clean-clone workspace
  verification.
- GitHub Actions `Verify` run `34408978018` completed successfully for current
  commit `b7ec366`; the immediately preceding current-branch runs also passed.
- GitHub's branch-protection API rejected the attempt to inspect or configure
  protection for this private repository because the current GitHub plan does
  not offer that capability for private repositories. No protection setting was
  changed.

## Decision and release effect

The workflow provides valuable independent build evidence but is not an
enforceable merge gate today. This is a release-readiness gap, not an app code
defect. Until branch protection is available, every production-candidate
commit must have a recorded successful `Verify` run and review before any
promotion. Do not make the repository public merely to enable this setting;
that would conflict with the private handoff and source-material boundary.

## Limits

This does not establish production readiness or replace multi-user browser,
database, recovery, accessibility, or simulated-tournament evidence. Plan or
repository-governance changes are an external owner decision.
