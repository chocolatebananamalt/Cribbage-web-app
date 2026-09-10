# Review-prototype new-tab isolation — 2026-09-10

## Acceptance criteria

- A reference or sample document opened from the review-only prototype cannot
  retain an opener handle to the operational-app tab.
- The external ACC Rulebook link does not receive an operational-page referrer.
- The change does not alter prototype content, document destinations, or any
  production release gate.

## Change

Every review-prototype anchor with `target="_blank"` now includes
`rel="noreferrer"`. This covers the cached Rulebook, online ACC Rulebook, and
sample qualification PDF. The protected production Rulebook already had this
attribute; the review surface now follows the same boundary.

## Evidence

- A new dashboard regression enumerates every `_blank` target in the prototype
  and fails unless it includes `rel="noreferrer"`.
- `pnpm verify` passed: audit, lint, 154 application tests, production build,
  and workspace verification.
- `pnpm verify:handoff` passed: 6 private-handoff integrity checks.

This is defense in depth. The prototype remains a protected review surface,
not a production workflow or a public-results release.
