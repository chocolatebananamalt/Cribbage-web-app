# Assigned game-context contract gate — 2026-09-10

## Acceptance criteria

- An authenticated player with no assigned game continues to receive the
  authorization-safe not-found outcome.
- An RPC failure or a response missing a required assigned-game field renders
  no score-entry controls and exposes no backend detail.
- The protected page tells an authorized user that recording is unavailable
  and provides only a safe route back to the tournament.
- A valid, server-authoritative response still reaches `LiveScoreEntry`.

## Change

`getAssignedGameContext` now distinguishes an absent authorized result from an
unavailable/invalid backend response. The game page renders a non-actionable
availability notice only for the latter. This closes a deployment-drift gap:
the current shared pilot lacks migration `0103`, whose response adds `actorId`
required by the current retry isolation boundary. No pilot data, setting,
credential, or migration was changed.

## Evidence and limits

The direct regression in `tests/game-api-semantics.test.mjs` asserts the
required `actorId` migration contract and executes the not-found, unavailable,
cross-tournament, same-side, and valid-context decisions. It also asserts the
protected page's non-actionable unavailable branch.

Executed locally on 2026-09-10:

- `pnpm verify` — PASS (152 application tests, production dependency audit,
  lint, production build, and workspace integrity).
- `pnpm verify:handoff` — PASS (6 recovered-source checks).
- `git diff --check` — PASS.

This is a safe release boundary, not migration parity. The protected scoring
workflow remains unavailable against a database that has not been brought to
the reviewed schema level, and it still requires independent-session browser
and real-backend release evidence.
