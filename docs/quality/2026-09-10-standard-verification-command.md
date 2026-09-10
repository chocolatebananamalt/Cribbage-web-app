# Standard verification command repair — 2026-09-10

## Gap

Project instructions require `pnpm verify` after material work, but the
script previously ran only the workspace/recovery checks. Lint, application
tests, production build, and the production dependency audit happened only in
separate commands or in CI. That made a locally reported successful
verification weaker than the documented gate.

## Repair

`pnpm verify` now runs, in order:

1. `pnpm audit --prod --audit-level=high`;
2. lint;
3. the complete application test suite;
4. the Next.js production build; and
5. workspace/recovery integrity checks.

`verify:all` aliases that clean-clone-safe command and `verify:local` adds
the private-handoff check. The GitHub workflow now calls the same command
after frozen installation, preventing its list of checks from drifting from
the local release gate.

## Regression evidence

The workspace suite now asserts the exact command contents and CI invocation.
Executed locally on 2026-09-10:

```text
pnpm verify                 PASS — audit clean, 124 application tests, lint,
                            production build, 4 workspace checks
pnpm verify:handoff         PASS — 6 private-handoff checks
git diff --check            PASS
```

This strengthens repeatable local and CI evidence. It does not replace
independent-session, real-browser, hosted, recovery, or tournament-simulation
release gates.
