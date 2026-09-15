# Tournament operations completion evidence

Date: 2026-09-14

## Observable acceptance criteria

1. A published schedule cannot accept any online, offline, confirmation, paper, or recovery score evidence until an authorized official starts that specific event.
2. Start is bound to exact participant and schedule versions, is idempotent and append-only, and Main, Consolation, and Satellites can start independently.
3. Live Preliminary Standings contain authoritative results only and disclose refresh and stale state.
4. Each event supports the four Side Pool categories separately from its two Q Pools.
5. Participant status changes are event-scoped, audited, reversible through reinstatement, and never create blanket wins.
6. Team records preserve individual identities and contributions while digital team scoring remains disabled.
7. Every configured event is discoverable in Results; Satellite UI states the MRP and qualification boundary.

## Evidence

- Migrations `0164` through `0168` applied to the approved pilot Supabase project.
- `pnpm verify` passes: application tests, lint, provider checks, production build, and workspace integrity.
- `tests/tournament-operations-completion.test.mjs` provides regression proof for the cross-layer contracts.

## Deliberate remaining gates

- A supervised independent-device rehearsal must prove event start, reciprocal scoring, outage/reconnect, paper evidence, correction, standings, and finalization together.
- General late walk-in, sit-out, rotation, and replacement schedule rewriting remains disabled because the cached ACC sources do not establish a complete algorithm. Narrow Rule 11.4 and Rule 13.1 fixtures remain available without being generalized.
- Side Pool definitions and normalized election/payout storage are present; director election/payout mutation screens and a final reconciliation report require completion before Side Pools are called operational.
- Paper-scored Satellite result pages are discoverable, but placement/payout entry and the director-reviewed Satellite report require completion before Satellite reporting is called operational.

