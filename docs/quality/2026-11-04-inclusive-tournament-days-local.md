# Inclusive tournament days — local preparation

## Acceptance and scope
Owner requests start date/time, inclusive Number of days and a visible Ends on date, with no end date/time input. Explicit date/duration edits derive local23:59; timezone remains explicit and backend endsAt contract unchanged. Existing saved end times are preserved on load, unrelated edits and start-time-only edits. No template, series, MRP, Q/Side monetary method, API/schema, permission or hosted data changes. Every future template configuration field, including public director name, must be editable; template copy cannot copy grants/credentials or transactional records.

## Implementation
- setup-dates.ts: strict date-only calendar arithmetic, inclusive count, invalid/fractional/overflow rejection.
- TournamentDateFields: accessible required duration and live Ends on date, historic-time disclosure and existing start controls.
- setup-client.tsx: uses component and matches missing-duration validation wording.
- Existing UI source-contract tests updated for extracted fields; meaningful calendar regression and actual component browser harness added.

## Evidence
Bundled Node24.19.0, pnpm11.19.0, Next16.4.2; Windows. Focused12/12; full application1231/1231. Production build passed. Lint0errors/64existing warnings. Providers check and handoff6 passed. Audit reports no known vulnerabilities after supported per-command escalation resolved sandbox DNS. Full ordered verify result recorded at test-results/date-duration-verify-final.log — exit0, all stages PASS, including8workspace checks.
Browser uses actual component and production setup form CSS with fictional local state, no backend calls. Eight viewport/timezone groups:320/390/768/1440px × Hawaii/Eastern; invalid duration, historical18:00 preservation, time-only edits, start/date recomputation, DST calendar days and doubled computed text checked. Native date UI screenshot inspected at390normal/enlarged; no page horizontal overflow. Evidence test-results/setup-duration-browser/result.json and PNGs. Browser task-owned servers/contexts closed. This is not a real-phone or hosted acceptance claim.
Independent gpt6.1-sol review (available substitute for repository5.6-sol) found noP1/P2; minor missing-duration wording corrected. git diff --check passed.

Initial verification failures preserved in logs: old source assertions expected removed End date control (updated), task-owned prior q-policy diagnostic entered rootTypeScript scan (archived unchanged outside repo at task/q-policy-back-audit-local-evidence-20261104), package-manager auto-download failed in sandbox (pinned existing11.19 + supported local shim, no installs). Initial workspace check ran before build completed; full ordered gate resolves sequencing. No security settings changed.

## Limitations
No migration or publication. User saved draft and fixtures not read or modified. Existing backend timezone conversion remains responsible for actual instants; date arithmetic intentionally does not add24-hour elapsed periods. Templates/series deferred pending workbook research; Q/Side policy decisions remain held.
