# Qualification preview evidence — 2026-09-10

## Acceptance criteria

- Rank only by public ACC numeric order: game points, games won, net spread,
  then positive spread.
- Calculate qualifying players as one in four, rounded up, and first-round
  byes from the next power-of-two bracket.
- Do not silently resolve an exact numeric tie or publish/finalize a tied
  result.

## Evidence

`src/lib/qualification.ts` has no browser, database, finance, or export
dependency. Tests prove the ranking order, 121 entrants to 31 qualifiers,
108 entrants to 27 qualifiers with five byes in a 32-player bracket, and a
cutoff tie that remains unresolved.

Executed locally on 2026-09-10:

```text
pnpm test              PASS — 121 tests
pnpm lint              PASS
pnpm build             PASS
pnpm verify            PASS — 6 workspace checks
pnpm verify:handoff    PASS — 6 private-handoff checks
git diff --check       PASS
```

## Limitations

This is not standings ingestion, result finalization, payout calculation,
Master Rating Point assignment, a playoff pairing UI, or an ACC report. Those
remain release-gated by the decision and source record.
