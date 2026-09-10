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

- `ACC_RULE12_CORRECTION_ENABLED` defaults to off and accepts only the value
  `approved` at the web boundary.
- The correction page plus proposal/review routes return absent/not-found while
  the switch is off.
- Migration `0096_suspend_incomplete_rule12_corrections.sql` revokes direct
  authenticated execution of the two mutation RPCs. Re-enabling requires a
  separately reviewed migration after the replacement model and all fixtures
  exist.

## Exit criteria

1. Model original claims and adjudicated values independently for both cards.
2. Implement dated, executable Rule 12.2(a)–(i) fixtures, including both
   apparent-qualifier and no-harm/no-foul examples.
3. Verify card totals, standings inputs, qualification notices, append-only
   audit history, authorization, concurrency, and result-version supersession
   against a real backend.
4. Obtain independent high-risk review and real cross-checker/director browser
   evidence before a new explicit release decision enables mutation.
