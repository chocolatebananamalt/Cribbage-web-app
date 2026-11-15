# Scorecard leading-zero format review — 2026-09-10

## Acceptance criteria

- A populated one-digit, per-game spread cell on the paper-style scorecard
  renders as `01` through `09`.
- A two- or three-digit valid spread remains unaltered (`10` through `121`).
- A zero spread remains an empty scorecard cell rather than a displayed score.
- The display convention does not change stored integer values or any
  arithmetic.
- Invalid display inputs fail rather than producing a misleading value.

## Change

Added the pure `formatScorecardSpread` helper and applied it to the paper-style
scorecard's per-game Plus and Minus cells. The helper accepts only whole
numbers 1 through 121 and pads one-digit values to two characters. Zero stays
an em dash because that side of the card has no entered spread. The result
entry display and the scorecard total row deliberately retain their existing
formats; the ACC wording reviewed here applies to individual scorecard spread
entries, not aggregate totals.

This implements the Rule 12.1 scorecard convention identified in
`2026-09-10-acc-public-rule-source-review.md`. It is a rendering correction
only and makes no database, identity, or scoring-policy change.

## Executed evidence

On the local Windows workspace, 2026-09-10:

- `pnpm test` — **115 passed**. Includes `01`, `08`, `10`, and `121` positive
  cases, plus `0`, `122`, and fractional rejection cases.
- `pnpm lint` — passed.
- `pnpm build` — passed with Next.js 16.3.4.
- `pnpm verify` — passed.
- `pnpm verify:handoff` — passed.
- `pnpm audit --prod --audit-level=high` — no known vulnerabilities.
- `git diff --check` — passed.

## Limitation

Browser visual verification remains unexecuted for this small UI rendering
change. The available browser-automation bridge timed out before it could
attach to the existing preview tab, and the local agent-browser command is not
available in this workspace. The automated source and behavior tests above do
not substitute for a required phone and desktop visual check before release.
