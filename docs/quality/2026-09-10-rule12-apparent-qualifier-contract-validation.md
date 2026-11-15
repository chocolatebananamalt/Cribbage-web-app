# Rule 12 apparent-qualifier contract validation — 2026-09-10

## Source and purpose

The cached ACC Official Tournament Rules 2025 (SHA-256
`DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`) makes
the apparent-qualifier fact part of Rule 12.2(a), (b), and (h). A future
correction writer cannot safely infer that fact from a player's name, current
ranking, card margin, or a correction outcome.

Migration `0105_rule12_apparent_qualifier_contract.sql` records the selected
card side(s) privately with the independent correction case. It requires one
side for (a)/(h), both sides for (b), and no apparent-qualifier side for the
remaining direct card dispositions. It creates no writer, reader, route, or
browser execute grant.

## Isolated validation

The migration was applied only to the synthetic validation Supabase project
`donfxulkliuyteiannir` on 2026-09-10. Catalog inspection confirmed the exact
allowed card-side shapes and their source-case cardinality requirements. A
fresh seven-function grant audit found no `anon` or `authenticated` execute
grantee for the suspended legacy correction functions.

## Local verification

- Focused lint plus Rule-12/schema tests: 26 passing checks.
- A full project verification remains required before merge/release.

## Boundary

This retains an input fact for future audited adjudication. It does not decide
who qualifies, calculate standings, send the Rule 12.2(i) notice, or authorize
any correction. The shared pilot is not at this migration and was not changed.
