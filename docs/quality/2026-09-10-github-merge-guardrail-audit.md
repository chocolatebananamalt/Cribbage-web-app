# GitHub merge-guardrail audit — 2026-09-10

## Acceptance criterion

Determine whether the repository has both (1) a repeatable verification
workflow and (2) an enforceable merge gate that prevents a later change from
bypassing it.

## Evidence

The repository includes `.github/workflows/verify.yml`, which runs on each
push and pull request using pinned pnpm 11.19.0 and Node 24. It executes:

1. frozen dependency installation;
2. production dependency audit at high severity;
3. lint;
4. the full application test suite;
5. production build; and
6. workspace verification.

The GitHub branch-protection API was checked for `main` and
`codex/production-readiness-baseline`. GitHub returned HTTP 403 with the
message that branch protection for this private repository requires GitHub Pro
or making the repository public.

## Conclusion

The automated checks exist and run, but required-status-check enforcement is
not currently available through this private repository's plan. This is not a
reason to make the repository public: that would be inappropriate for a
tournament system and its private handoff material. It is a release-operation
gap that must be resolved before a production launch by either:

- enabling an appropriate private-repository plan feature and requiring the
  Verify workflow before merges; or
- adopting a documented, director-approved release procedure that promotes
  only a manually verified, immutable commit after its recorded checks pass.

The latter is a temporary operational control, not equivalent to protected
branches. No GitHub billing, visibility, access, or branch rule was changed by
this audit.

## Verification performed

- Queried GitHub's branch-protection endpoint for both active branches.
- Inspected the committed workflow file and its exact checks.

This remains a production release gate under Step 6 of the working outline.
