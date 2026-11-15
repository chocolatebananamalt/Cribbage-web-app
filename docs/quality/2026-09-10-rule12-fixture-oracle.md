# Rule 12.2 fixture oracle — 2026-09-10

## Purpose

Translate the exact examples and disposition rules in the permitted cached ACC
Official Tournament Rules 2025, Rule 12.2(a)-(i), into a deterministic test
oracle before any correction writer is considered for release.

## Scope and safety boundary

`src/lib/rule12-discrepancy.ts` is a pure, non-release fixture oracle. It:

- requires a human-selected Rule 12.2 case rather than guessing a rule;
- preserves both source-card claims separately from adjudicated card values;
- derives the resulting plus/minus columns and 0/2/3 game points for each
  card; and
- marks total recalculation and the qualification-change notification condition
  without writing any record or notifying anyone.

It has no database client, route, user interface, release switch, or authority
to change a game, card, standing, result, or export. Rule 12 correction routes
remain hard-disabled.

Paragraph (i) is modeled as a condition on the underlying corrective case,
not as an independent score disposition: when that correction changes the
fact or position of qualifying, the oracle requires the affected-player notice
condition. The no-change (h) example cannot itself produce that condition.

## Source and tested cases

The cached source is `public/rulebook/acc-rulebook-2025.pdf`, SHA-256
`DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`.
The tests cover the exact Rule 12.2 examples and their rejection conditions:

| Rule | Tested disposition |
| --- | --- |
| (a) | The apparent qualifier's 21-point win becomes the opponent's 16-point spread. |
| (b) | Two apparent qualifiers' 17/16 entries become independent 16-win/17-loss card values. |
| (c) | One blank card receives the only marked point spread. |
| (d)-(f) | Plus/minus column conflicts derive the mandated winner/loss columns and game points. |
| (g) | Every score-changing disposition signals recalculation and returns derived totals. |
| (h) | The documented 15-win/20-loss already-adverse result remains unchanged. |
| (i) | A qualification change on the underlying correction requires an explicit affected-player notice condition. |

Malformed margins, duplicate/no discrepancy inputs, two blank cards, and
non-applicable cases are rejected by the oracle tests.

## Verification

- `pnpm lint` — pass.
- focused Rule 12/schema test run — 23 pass.
- `pnpm build` — pass.
- `git diff --check` — pass.

This reduces the risk of silently misreading a dated ACC rule. It does not
meet the Rule 12 release criteria: database fixtures, append-only lifecycle,
authorization/concurrency, standings/result projections, notification
delivery/audit, independent browser evidence, and the separately approved
shared-pilot maintenance remain required.
