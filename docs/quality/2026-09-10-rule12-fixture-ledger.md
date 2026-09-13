# Rule 12.2 executable-fixture ledger — 2026-09-10

## Purpose

This ledger turns the dated, cached ACC Official Tournament Rules 2025,
Rule 12.2(a)–(i), into an implementation checklist. It is deliberately not a
user-facing correction workflow and must not be used to enable the suspended
feature. Its purpose is to prevent a future writer from silently collapsing
individual scorecard outcomes into one reciprocal match result.

The source edition checksum is
`DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`.

## Fixture contract common to every case

Each eventual database fixture must establish two original card claims,
canonical-game linkage, the adjudicated value of both cards, plus/minus and
game-point totals, standings inputs, append-only audit records, and expected
authorization. Where a correction changes a qualification fact or position,
the fixture must also assert an affected-player notification. An executable
fixture must reject a cross-tournament card, mismatched card side, malformed
plus/minus arithmetic, stale base version, missing second card projection,
and any direct signed-in caller bypassing the approved server workflow.

## Source-case ledger

| Case | Required positive fixture outcome | Additional required assertion | Status |
| --- | --- | --- | --- |
| 12.2(a) | An apparent qualifier's claimed 21-point win against an opponent's 16-point loss changes the apparent qualifier's card to a 16-point win; the opponent card remains the recorded 16-point loss. | Card values are independent, not forced reciprocal. | Pure source-bound oracle pass; database/workflow not implemented. |
| 12.2(b) | Two apparent qualifiers' 17-point-win and 16-point-loss cards become a 16-point win and a 17-point loss respectively. | Preserve both originals and prove non-reciprocal adjudicated values. | Unreleased service-only lifecycle and private foundation live-checked; pure oracle pass. Correction-aware totals/standings, qualification notice, real sessions, and release approval remain missing. |
| 12.2(c) | Where only one card supplies a spread, accept that spread for both cards and fill the blank card. | Populate the correct card column and recompute the affected totals. | Pure source-bound oracle pass; database/workflow not implemented. |
| 12.2(d) | If both cards say win or both say loss but one spread is plus and the other minus, the plus-column card wins. | Preserve the two separate card records and recompute 0/2/3 points. | Pure source-bound oracle pass; database/workflow not implemented. |
| 12.2(e) | If both cards say win or both say loss and their spreads are in the same column, both cards become losses and any plus spread moves to minus. | Both cards' game points become 0 and their totals update. | Pure source-bound oracle pass; database/workflow not implemented. |
| 12.2(f) | If only one card says win but both spreads are in the same column, that win stands and the incorrect card moves to the appropriate column. | Do not alter the correctly recorded win. | Pure source-bound oracle pass; database/workflow not implemented. |
| 12.2(g) | Any discrepancy correction adjusts affected game-point and spread-point totals. | Totals, standings input, qualification preview, and result version derive from adjudicated cards. | Pure source-bound derivation/recalculation signal pass; database/workflow not implemented. |
| 12.2(h) | If an apparent qualifier's discrepancy is already adverse (15-point win versus 20-point loss), both cards stand as recorded. | A no-change decision remains append-only evidence and produces no score rewrite. | Pure source-bound oracle pass; database/workflow not implemented. |
| 12.2(i) | A discrepancy changing qualification fact or position notifies the affected player with relevant card evidence. | Notification is attached to the underlying (a)-(f) correction and is queued/audited without exposing private correction reasons publicly. | Pure source-bound notification condition pass; delivery/audit/workflow not implemented. |

## Current evidence and honest boundary

The live isolated check documented in
`2026-09-10-rule12-independent-card-foundation-live-check.md` proves only the
storage/integrity form needed for (b), including rejection of inconsistent
plus/minus arithmetic. It does not make any row authoritative, alter a
scorecard, change standings, notify anyone, or provide a user-visible
correction command.

The correction switch and all prior public correction RPCs remain disabled.
The ledger remains open until every row has a dated, executable, reviewed
database fixture plus independent browser evidence.
