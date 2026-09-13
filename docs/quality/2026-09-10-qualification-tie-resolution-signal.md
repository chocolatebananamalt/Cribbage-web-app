# Qualification tie-resolution signal — 2026-09-10

## Source

Appendix A(20) of the cached ACC Official Tournament Rules 2025 ranks cards by
game points, games won, net point spread, plus points, head-to-head results
from the current qualifying round when applicable, then a one-game playoff
when head-to-head is unavailable. The cached source checksum is
`DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`.

## Change

`previewQualification` already refused to fabricate an exact numeric tie. It
now returns every unresolved tie group, its numeric rank, its candidate IDs,
whether it crosses the qualification cut, and the required ACC sequence:
head-to-head if available, then one-game playoff. A fully tied preview remains
non-finalizable.

This makes an affected cutoff tie visible to a future director workflow and
prevents a caller from mistaking a numeric sort for an official qualification
result. It does not calculate head-to-head, schedule a playoff, decide first
deal, publish results, or assign MRPs/payouts.

## Verification

- Focused score/qualification tests: 12 passing checks.
- Lint and optimized production build: passed.
- Full project verification remains required before merge/release.
