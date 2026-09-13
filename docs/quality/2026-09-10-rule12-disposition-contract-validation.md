# Rule 12 disposition and qualification-notice contract validation — 2026-09-10

## Change reviewed

The dated cached ACC Official Tournament Rules 2025, Rule 12.2, was re-read
before this change. Paragraph (g) requires totals to be adjusted when needed,
and paragraph (i) requires the director to inform an affected player when a
scorecard error changes the fact or position of qualifying. They do not supply
independent corrected scorecard outcomes. Paragraph (h) expressly leaves both
cards unchanged in its no-harm/no-foul example.

Migration `0104_rule12_disposition_and_qualification_notice_contract.sql`
therefore adds the private `qualification_changed` fact to an independent
correction, restricts its selectable disposition to Rule 12.2(a)-(f) and (h),
and rejects a claim that the no-change (h) disposition itself changed
qualifying. It adds no public table access, reader, writer, route, release
switch, or execute grant.

## Isolated validation evidence

On 2026-09-10, the migration was applied only to the separate synthetic
validation Supabase project (`donfxulkliuyteiannir`), never to the shared
pilot. Catalog inspection confirmed both exact constraints:

- the permitted set is `12.2a`, `12.2b`, `12.2c`, `12.2d`, `12.2e`, `12.2f`,
  and `12.2h`; and
- `12.2h` with `qualification_changed = true` is rejected.

The direct-grant recheck found zero `anon` or `authenticated` execute grantees
across all seven suspended legacy correction functions. The Supabase security
advisor reported only the pre-existing private-table/no-policy informational
findings, the already-reviewed intended callable-function warnings, and the
known free-plan leaked-password-protection warning; it reported no new access
surface created by this migration.

## Local verification

- Focused lint and Rule-12/schema suite: 24 passing checks.
- Full `pnpm verify`: passed (audit, lint, 166 application checks, optimized
  production build, and workspace check).
- `pnpm verify:handoff`: passed (6 checks).
- `git diff --check`: passed.

## Boundary

This is a private foundation correction, not implementation of corrections.
The complete append-only correction lifecycle, server authorization, Rule 12
database fixtures, standings/result versioning, notification delivery/audit,
independent-browser evidence, and approved shared-pilot maintenance remain
open release gates.
