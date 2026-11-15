# Dependency-audit CI safeguard — 2026-09-09

## Finding

GitHub's hosted Dependabot, Code Scanning, and Secret Scanning alert services
are disabled for this private repository under the current account/plan. An
attempt to enable Dependabot alerts did not change that unavailable service;
the repository remains private and no visibility or plan setting was changed.

## Mitigation implemented

The existing clean-clone `Verify` workflow now runs:

```text
pnpm audit --prod --audit-level=high
```

immediately after frozen-lockfile installation and before lint, tests, build,
and workspace verification. This makes high-severity production dependency
findings a normal CI failure without relying on unavailable hosted alert
features.

## Evidence

- The local audit returned `No known vulnerabilities found`.
- `pnpm verify:all` passed: lint, 78 application tests, production build, and
  clean workspace verification.
- `pnpm verify:handoff` and `git diff --check` passed.
- GitHub Actions run `34409826764` completed successfully for the exact CI
  change. Its clean-clone job ran the new audit step followed by lint, all 78
  application tests, production build, and workspace verification.

## Limit

This is dependency-vulnerability coverage, not a substitute for GitHub secret
scanning or a code-analysis service. The repository remains private; do not
make it public merely to obtain security features. Any future secret-scanning
or advanced code-scanning plan decision is an owner-controlled release-governance
choice.
