# GitHub release-control audit

## Evidence

- `.github/workflows/verify.yml` runs `pnpm install --frozen-lockfile`, lint,
  tests, production build, and workspace verification on every push and pull
  request using Node 24 and pnpm 11.19.0.
- The GitHub `Verify` workflow passed for the preceding reviewed changes,
  including commit `d5b47e7`.
- On 2026-09-09, GitHub’s branch-protection API returned HTTP 403 for this
  private repository with: “Upgrade to GitHub Pro or make this repository
  public to enable this feature.” The current token has repository and
  workflow access, so this is a plan capability limitation rather than a
  missing connection.

## Result

Automated checks exist and run, but they cannot currently be made an
enforceable merge/promotion gate for this private repository. Preview and
production promotion must remain manual and independently reviewed until the
repository has a plan/visibility arrangement that supports required checks.

This is a release-control limitation, not a reason to make the repository
public or change paid plans automatically. Production release remains blocked
by this and by the functional/evidence gates in the meta readiness audit.
