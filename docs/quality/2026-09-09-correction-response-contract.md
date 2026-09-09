# Correction response contract

## Finding

The correction proposal and review routes already checked essential response
values, but their accepted replies did not require the exact current database
shape. Their rejection helper was also shared across two different operations
without binding a rejection to the requested game or correction.

## Repair and acceptance criteria

The routes now accept only the response objects emitted by the current
authoritative migrations:

- proposal success (`0029`): exactly `status`, `game_id`, `correction_id`,
  `version`, and `policy_version`, bound to the requested game and correction;
- proposal rejection: exactly `status`, `code`, and the requested `game_id`;
- review success (`0028`): exactly `status`, `decision`, `correction_id`,
  `game_id`, and `version`, bound to the requested correction and decision;
- review rejection: exactly `status`, `code`, and the requested
  `correction_id`.

Each rejection code is allowlisted from its operation’s migration. Mixed,
extended, unsupported, malformed, or cross-request response data fails closed
as unavailable and is not returned to the browser.

## Verification

- Inspected current applied migration sources `0029` and `0028`, including
  their exact accepted/rejected response builders and replay behavior.
- Queried the pilot’s aggregate receipt shape for correction operations; it
  contains no prior correction receipts, so no historical response requires a
  compatibility path.
- Regression coverage now rejects missing required fields, injected private
  fields, cross-game/correction IDs, unknown operation codes, and mismatched
  review decisions.
- Local checks passed: lint, 65 tests, production build, workspace
  verification, private-handoff verification, and diff check.
- Focused Sol review found no P0/P1 findings and confirmed exact idempotent
  replays retain the documented shapes.

## Limit

This fixes browser response validation for correction operations. Real
independent cross-checker/director sessions, correction concurrency, and
authoritative standings/result supersession tests remain release gates.
