# Rule 12 hard release stop — 2026-09-10

## Purpose

The independent-card correction workflow is incomplete and is therefore not a
releasable tournament function. This check verifies that an accidental hosting
environment change cannot expose any of its web routes.

## Acceptance criteria

1. The Rule 12 release gate returns `false` with no configuration.
2. The gate remains `false` for former and arbitrary environment values,
   including `ACC_RULE12_CORRECTION_ENABLED=approved`.
3. The protected correction pages and API routes remain behind that gate.
4. The only way to make the feature releasable is a separately reviewed code,
   migration, rule-evidence, and multi-user verification change.

## Evidence

- Implementation: `src/lib/api/rule12-correction-release.ts` is a hard stop;
  its argument is intentionally unused so environment configuration cannot
  activate the feature.
- Unit coverage: `tests/account-activation-release.test.mjs` exercises absent,
  `true`, and `approved` values and expects `false` in each case.
- Route-boundary coverage: `tests/game-api-semantics.test.mjs` verifies the
  hard-stop implementation and the correction pages/routes that call it.
- Related decision and known workflow gap:
  `docs/decisions/2026-09-10-rule12-independent-card-corrections.md`.

## Verification commands

Run from the repository root after this change:

```text
pnpm verify
pnpm verify:handoff
git diff --check
```

## Release limitation

This is a deliberate safety stop, not Rule 12 feature completion. It does not
authorize correction writing, review, reconciliation, or inclusion in standings.
