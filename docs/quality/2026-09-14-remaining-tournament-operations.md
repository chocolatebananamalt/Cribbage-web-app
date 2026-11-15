# Remaining tournament operations verification

Date: 2026-09-14
Environment: local release branch plus approved hosted Supabase pilot `fnjkwymxpnsqvxtpronk`

## Acceptance baseline

- Defined late, missing, sit-out/makeup, departure, final-game substitute, excluded-extra-game, refund, reinstatement, and playoff-absence outcomes are source-backed and audited.
- Mixed rotations are previewed and conflict-checked manual director amendments, not invented automatic pairings.
- Side Pools are event-scoped, independent from Q Pools, cent-conserving, and present in finance/result exports.
- Every configured Satellite supports versioned draft/final/correct/reopen results, cross-check evidence, no-MRP/no-qualification enforcement, and a printable retained report.
- Browser roles have no direct mutation privilege; all writes require verified identity, same origin, a server-only RPC, immutable receipts, and idempotent replay.

## Evidence

- Hosted migrations `0169` through `0173` applied successfully. `0173` repairs the release review findings: final-game substitution is allowed while final-game forfeiture remains prohibited; a current-game forfeit must be current for both participants; a forfeited game becomes a completed scorecard task.
- Hosted rollback fixture `tests/remaining-tournament-operations.sql`: pass after the full migration chain, leaving no synthetic records.
- Hosted targeted foreign-key coverage query: zero uncovered foreign keys in the new operations tables after migration `0172`.
- Focused Node test: 11/11 pass.
- `pnpm verify`: pass; dependency audit found no known production vulnerability, lint passed, 481/481 application tests passed, provider fallbacks passed, Next.js production build passed, and 7/7 workspace checks passed.
- `pnpm verify:handoff`: 6/6 pass.
- Pull request [#41](https://github.com/chocolatebananamalt/Cribbage-web-app/pull/41): both independent GitHub verification jobs and Vercel Preview passed; merged as `bb1d6a89d7dc7a138dab94466bc42f947ddded8b`.
- Vercel Production deployment `dpl_CNrJGfri1iUgtnZcveTgLj9r1Mpz`: READY on `https://cribbage-web-app.vercel.app/`.
- `pnpm verify:live-demo`: pass at 320, 640, and 1280 pixels across 20 distinct screens; no horizontal overflow, CSP violation, failed HTTP request, console error, or page error. Both generated PDF probes parsed.
- Vercel post-release runtime-error scan (30-minute window): no runtime errors.

## Remaining evidence boundary

The implementation is automated and hosted-database verified. Independent signed-in devices, physical paper cards, venue-wide disconnection/reconnection, printing on the director's hardware, and a full human-operated rehearsal remain physical acceptance evidence. They are not missing ACC rules or unfinished code and must not be described as an engineering or owner-information blocker.
