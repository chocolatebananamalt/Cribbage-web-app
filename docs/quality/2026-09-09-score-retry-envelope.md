# Exact score-retry envelope

## Finding

Focused review found that an interrupted score submission retained identifiers
only under a score-dependent browser key. A player could change the score after
an ambiguous network or server failure and create a second request while the
first one might already be authoritative.

## Repair and acceptance criteria

The live Standard Singles score page now persists one versioned, exact
submission envelope before it sends a mutation. It includes only the server
request identity and fixed score fields: tournament, game, assigned side,
submission slot, winner side, margin, submission ID, and idempotency key.

- If session storage cannot persist the envelope, the client does not send.
- An ambiguous transport, malformed-success, unknown 4xx, or 5xx outcome
  keeps the card locked and offers only **Retry This Same Entry**.
- Only an explicitly recognized request-validation/session/origin failure or
  a request-bound server rejection clears it. Rejections must be the exact
  three-field game response with an allowlisted server code; mixed, unknown,
  cross-game, and unrecognized platform responses stay locked.
- On reload, the exact pending entry is restored and locked. If the server
  already supplies any own submission, server state wins and the local record
  is discarded without changing the displayed result.
- The accepted response must name the persisted submission ID before clearing
  the envelope.
- Shared-device sign-out already removes all `acc-score:` session records.

## Verification

- Executed regression test covers exact persistence, wrong-side isolation,
  malformed-envelope removal, stale local/server submission conflict, a
  validated 409 rejection, and unknown 404/429 retention.
- Local checks passed: lint, 65 tests, production build, workspace
  verification, private-handoff verification, and diff check.
- A focused Sol review found three P1s in the initial repair (changed request
  after ambiguity, stale local/server mismatch, and overly broad terminal
  handling) and one residual P1 (permissive 409 validation). All were fixed;
  final re-review found no P0/P1.
- Local Next development server started successfully. The available automated
  browser surface blocks `localhost`, so it could not visually exercise the
  protected screen. This is recorded as unavailable evidence, not a browser
  pass.

## Limit

This is deliberate recovery from an interrupted request, not an offline queue.
It does not queue work in the background, claim a local result is verified,
or satisfy `R-OFFLINE-01`. Real offline/reconnect and independent two-user
browser evidence remain release gates.
