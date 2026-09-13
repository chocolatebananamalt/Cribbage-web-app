# Standard Singles accepted-response contract

## Finding

The Standard Singles API routes correctly bound accepted RPC responses to the
requested game (and, for a submission, the requested submission). They did not,
however, reject an otherwise-valid response that contained additional fields.
That could expose an unintended future RPC field to the browser.

## Repair and acceptance criteria

The accepted response validators now accept only the response shapes emitted by
the authoritative `0003_game_submission_confirmation_rpc` functions:

- score submission: exactly `status`, `game_id`, and `submission_id`;
- score confirmation: exactly `status` and `game_id`.

Both continue to require the requested identifiers and an allowlisted accepted
status. A malformed, cross-bound, unsupported, or extended response is treated
as unavailable (`503`) and is not sent to the browser.

## Verification

- The migration was inspected: its accepted submission response is exactly the
  three documented fields, and its accepted confirmation response is exactly
  the two documented fields.
- Regression coverage rejects an injected `internal_detail` field for both
  accepted response types, in addition to the existing wrong-game and
  wrong-submission cases.
- Local checks passed: lint, 65 tests, production build, workspace
  verification, private-handoff verification, and diff check.
- Focused Sol review found no P0 or P1 finding. It confirmed exact replay
  responses remain accepted and malformed/extended responses fail closed.

## Limit

This narrows the browser response boundary only. It does not replace real
authenticated two-player browser verification, nor does it implement offline
queueing, hybrid/paper scoring, or production release controls.
