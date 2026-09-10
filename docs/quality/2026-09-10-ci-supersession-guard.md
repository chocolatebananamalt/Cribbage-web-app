# CI supersession guard — 2026-09-10

## Finding

The repository's GitHub verification workflow ran on every push and pull
request but did not cancel an obsolete in-progress verification when a newer
commit arrived on the same ref. This can waste hosted build capacity and leave
reviewers comparing an older check with a newer source revision.

## Change

`.github/workflows/verify.yml` now uses a workflow-and-ref concurrency group
with `cancel-in-progress: true`. A new push to the same branch replaces an
in-progress verification for that branch; checks on another branch or pull
request ref stay independent.

## Acceptance evidence

- `tests/workspace.test.mjs` asserts the exact concurrency group and
  cancellation setting, in addition to the existing clean-install and full
  verification assertions.
- This improves GitHub CI behavior only. It cannot change Vercel's separate
  daily deployment allowance or prove production branch protection.
