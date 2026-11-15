# Standard Singles qualification finalization verification

**Date:** 2026-09-11
**Environment:** local Windows worktree, Node 24 / pnpm, and shared Supabase pilot

## Acceptance criteria

- Only a tournament director or co-director can finalize the activated digital
  Standard Singles event in that tournament.
- The server requires a complete published schedule and one effective scoreline
  for every configured game on every checked-in card.
- Unresolved games, recoveries, corrections, qualification notices, cutoff
  ties, and ambiguous High Non-Qualifier ties reject finalization.
- One exact replay returns the same result; altered reuse is rejected.
- The immutable snapshot uses the sourced ranking sequence and `ceil(n/4)`,
  lists High Non-Qualifier after qualifiers, and cannot be invalidated by a
  later score/correction mutation.
- The UI keeps qualifying-round results separate from playoffs, MRPs, Q-pools,
  payouts, and ACC export.

## Checks executed

- `node --conditions=react-server --experimental-strip-types --test tests/qualification-finalization.test.mjs` — pass, 5/5.
- Focused ESLint on the new API, client, and results page — pass.
- `pnpm exec tsc --noEmit --pretty false` — pass after correcting the route import depth.
- `git diff --check` on this slice — pass (line-ending warning only).
- Hosted `tests/qualification-finalization.sql` rollback fixture after migration
  0131 — pass; no synthetic data retained.
- Supabase performance advisor after migration 0132 — zero unindexed foreign
  keys remain for the recent pilot tables.
- Independent Sol high-risk re-review — no remaining P0/P1 finding after adding
  deterministic event locks, unresolved-tie rejection, insert/update/delete
  score freeze, and exact browser retry reconciliation.
- Integrated `pnpm verify` — pass: audit, lint, 298/298 application tests,
  production build, and workspace checks.
- Integrated `pnpm verify:handoff` — pass, 6/6.

## Required remaining proof

Desktop/phone browser checks and a real director finalization after independent
player sessions remain release gates. MRP, Q-pool, payout, playoff results, and
ACC reporting are deliberately separate from this qualifying-round snapshot
and still require their own sourced implementation and proof.
