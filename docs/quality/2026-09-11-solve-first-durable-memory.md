# Solve-first durable-memory verification - 2026-09-11

## Acceptance criteria

1. Every repository task reads a durable correction/source ledger before
   planning, reporting blockers, or asking the owner a project question.
2. A worker must inspect available evidence and make at least one safe,
   concrete attempt before escalating a solvable issue.
3. Owner corrections trigger reconciliation of the durable ledger and all
   affected requirements, decisions, outline entries, tests, and status.
4. ACC rules already present in the cached source are classified as available
   inputs; unfinished scoring, results, finance, and offline work is described
   accurately as implementation or verification work.
5. The protocol is protected by an executable repository check.

## Result

- `AGENTS.md` and `START_HERE.md` now require the solve-first protocol and
  `docs/operations/DURABLE_PROJECT_MEMORY.md` at task entry.
- The durable ledger records the September pilot scope, the cached 2025
  Rulebook identity, reviewed score/cross-check/qualification facts, owner
  corrections, the offline/recovery requirement, and genuine external
  dependencies.
- The working outline and ACC checklist now distinguish source availability
  from remaining implementation and proof.
- `tests/workspace.test.mjs` fails if the entry-point references or core
  solve-first/correction requirements are removed.

## Verification

- `node --test tests/workspace.test.mjs` - pass, 6/6 workspace tests and 6/6
  private handoff checks invoked by the workspace suite.
- `pnpm verify` - pass: dependency audit, lint, 223/223 application tests,
  production build, 6/6 private handoff checks, and 6/6 workspace checks.
- `git diff --check` - pass.

The repository instructions govern work performed in this project. They do
not override platform-level system/developer instructions, but they persist
across new project tasks and context compaction.
