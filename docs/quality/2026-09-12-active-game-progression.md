# Active-game progression evidence

Date: 2026-09-12

## Acceptance

- A player sees one earliest unresolved game per event as Current and later scheduled games as Upcoming/locked.
- New online submission, offline capability issuance, and offline replay fail closed for a future game.
- Only authoritative verification/correction, approved recovery, or approved paper completion advances progression.
- Exact prior receipts replay before current-state gating; participant/event serialization prevents competing new submissions from bypassing ordering.
- A rejection can bind a capability only after matching its actor, session,
  device, tournament, event, and game scope. Missing, unavailable, or foreign
  capability identifiers remain unbound so they cannot consume the rightful
  owner's one-use receipt slot.

## Verification

- Focused roster/results/progression/API suite — PASS (82/82), including all
  active-game progression assertions.
- Focused ESLint over the progression TypeScript/TSX and test files — PASS.
- `pnpm verify` — PASS after integrating the concurrent roster/results work.
- `pnpm verify:handoff` — PASS (6/6).
- The rollback fixture includes a foreign-capability poisoning attempt, exact
  replay of that unbound rejection, and a subsequent successful bind by the
  rightful owner.

## Limits

The rollback fixture is intentionally data-preserving and requires a
disposable/test backend with a linked player and two unresolved published
assignments. It has not been applied to hosted Supabase. Independent-session
reconnect and concurrent-device browser proof remain release evidence after
controlled deployment.
