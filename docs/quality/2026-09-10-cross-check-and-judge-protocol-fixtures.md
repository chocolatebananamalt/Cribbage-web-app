# Cross-check and judge-protocol fixtures — 2026-09-10

## Source

The cached ACC Official Tournament Rules 2025 (SHA-256
`DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`) states:

- Judge Protocol (a): two judges must be present before a hearing begins.
- Rule 11.5(a): if either player disagrees with the first two judges, a third
  judge may be summoned and the three-judge decision is final.
- Appendix A(2): tables of 24 or fewer need at least two checkers; tables of
  more than 24 need at least three.
- Appendix A(3): related couples, significant others, or relatives checking a
  table where one or both qualify should include a third cross-checker.

## Implemented source fixture contract

`src/lib/cross-check-protocol.ts` is a pure, server-neutral contract that
encodes only these documented thresholds and safeguards. Tests prove it:

- applies the 24-player boundary exactly;
- rejects duplicate officials and insufficient checker/judge counts;
- raises the required checker count to three when an authorized operational
  workflow supplies the qualifying-relationship fact; and
- rejects a disputing player as a hearing judge and requires three judges for
  a post-decision disagreement.

The helper deliberately does not infer relationships from names or accounts,
does not assign a role, write a record, or authorize anyone. Appendix A says
“if possible” for assigning a checker away from their playing table, so that
preference is not elevated into a fabricated automatic prohibition. The
product's stronger non-self correction/adjudication controls remain a required
future server workflow.

## Verification

- Focused lint and protocol/Rule-12 fixtures: 10 passing tests.
- Optimized production build: passed.
- Full project verification remains required before merge/release.

## Remaining gate

No database assignment/lifecycle, auditable relationship declaration,
cross-check queue, judge screen, real-session test, or director operating
procedure has been enabled by this change. Those remain open under `R-RULE-01`
and `R-OPS-01`.
