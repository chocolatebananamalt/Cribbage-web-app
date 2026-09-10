# Rule 12.2 requires independent corrected card projections

**Status:** Accepted safety decision — 2026-09-10

## Decision

Do not enable the current correction writer for tournament use. It models a
correction as one shared canonical winner/margin and rewrites two reciprocal
card lines. That is insufficient for the ACC Official Tournament Rules 2025,
Rule 12.2.

The replacement design must retain a canonical game only as the identity and
audit link between the two cards. It must retain each player's original card
claim and permit an adjudicated card value to differ from the other player's
card value when the rule requires it. Totals, standings inputs, qualification
effects, notifications, and export versions must derive from those adjudicated
card projections rather than from a forced single match margin.

## Evidence

The permitted cached 2025 Rulebook (SHA-256
`DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`) states:

- Rule 12.2(b): if two apparent qualifiers claim a 17-point win and a
  16-point loss, the respective cards become a 16-point win and a 17-point
  loss. Those are intentionally non-reciprocal card values.
- Rule 12.2(h): when an apparent qualifier's discrepancy is already to that
  player's disadvantage, both existing card entries stand. The example keeps
  a 15-point win and a 20-point loss.
- Rule 12.2(a), (c)–(g), and (i) separately require adverse adjustment,
  blank-card completion, column correction, total adjustment, and affected
  qualifier notification as applicable.

The existing correction migrations update `canonical_games.winner_side` and
`canonical_games.margin`, then require two reciprocal `card_scorelines`. They
cannot represent the cited (b) or (h) outcomes faithfully.

## Immediate safety control

- The web boundary is hard-disabled. No environment value can enable the
  incomplete feature; a future reviewed release must deliberately replace the
  hard stop after every exit criterion has direct evidence.
- The correction page, correction-policy page, proposal/review routes, and
  their reconciliation routes return absent/not-found while the switch is off.
- Migrations `0096_suspend_incomplete_rule12_corrections.sql` and
  `0097_suspend_incomplete_rule12_correction_policy.sql` revoke direct
  authenticated execution of the score-correction and correction-policy
  mutation RPCs. Migration `0098_suspend_incomplete_rule12_correction_readers.sql`
  also revokes the correction workspace, policy, and replay readers. Re-enabling
  requires a separately reviewed migration after the replacement model and all
  fixtures exist.

## Exit criteria

1. Model original claims and adjudicated values independently for both cards.
2. Implement dated, executable Rule 12.2(a)–(i) fixtures, including both
   apparent-qualifier and no-harm/no-foul examples.
3. Verify card totals, standings inputs, qualification notices, append-only
   audit history, authorization, concurrency, and result-version supersession
   against a real backend.
4. Obtain independent high-risk review and real cross-checker/director browser
   evidence before a new explicit release decision enables mutation.

## Foundation progress

Migrations `0099` through `0102` add private, immutable, ungranted structures
for an independent correction case and exactly one original/adjudicated
projection for each card side. The canonical scoreline is an identity link only,
not a substitute for the original claim: Rule 12.2(b) and (h) require that each
source card's independently recorded value be retained even when it differs
from the shared verified baseline or the other card. The projection checks
require correct game/card scope and internally consistent original and
adjudicated values without forcing the two cards to be reciprocal. The feature
intentionally has no writer, reader, lifecycle transition,
standing calculation, or release switch, and therefore does not reduce any
exit criterion or enable correction handling.

The isolated live database check records the Rule 12.2(b) 17/16-to-16/17
example and malformed-claim rejection in
`docs/quality/2026-09-10-rule12-independent-card-foundation-live-check.md`.
The source-case-by-case executable-fixture ledger is maintained separately in
`docs/quality/2026-09-10-rule12-fixture-ledger.md`; no ledger row is a release
approval until its stated database and browser evidence exists.
