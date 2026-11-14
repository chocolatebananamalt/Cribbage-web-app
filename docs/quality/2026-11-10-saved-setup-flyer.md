# Saved tournament events and printable flyer draft

Built locally, 2026-11-10, from the established flyer/setup requirements. No hosted changes, SQL, database fixture or rejected-operation retry.

## User-facing functionality

Setup now links to a separate-tab Preview Saved Events and Flyer Draft. It leaves the editable setup form in its original tab. The new Director/Co-director-only page reads the existing saved setup workspace through the normal authenticated client, with verified subject checks before and after the RPC. It does not create a new API, privilege or publication path.

The printable draft shows the saved tournament name/date range/time zone, structured venue, deliberately selected public Director contact, event times, styles/formats, game counts, entry fees, Fee Includes, qualifying/eligibility/payout notes, Muggins disclosure, Q-Pools and Side Pools with separate fees. Main and Consolation preserve their relative saved order; Satellites have their own section. It never computes a fund, payout, qualifier count or entry-fee total.

The view is an explicit public-field allow-list. It omits account/profile/official identifiers, sanctioning overrides/reasons, financial totals, old free-text public-name fallback and private account contact. Missing structured contact/venue produces a review note. Invalid dates, offset/unknown time formats, bad time zones and unsupported workspace shapes hold the preview instead of silently converting or guessing. Setup timestamps are local `timestamp` values in the existing schema (0051), so the model formats their calendar components without timezone conversion.

Print or Save Draft as PDF uses the user's browser print dialog after a review checkbox. No tool printed or created a PDF. Review resets when the supplied saved model changes. The Director-review/version stamp and omission warnings stay visible in print; print controls and Setup navigation are hidden. Browser printing itself confers no approval, publication or payment authority.

## Deliberate remaining gap

The current base setup reader does not carry separately versioned Playoff series/prize snapshots or Custom pool policy records. The view therefore keeps an explicit warning visible on screen and in print that those settings are not included and need separate review before distribution. Saved Payout Information notes are shown verbatim, with no interpretation as approved amounts. This is a functional saved-details/flyer draft, not a completed final flyer with all newer payout settings. No historical draft or payout policy is altered.

## Files and focused checks

- `src/lib/setup-flyer.ts`: validated allow-list and calendar projection.
- `src/components/setup-flyer.tsx` / `.module.css`: grouped printable view and review controls.
- `src/app/tournament/[tournamentId]/flyer/page.tsx`: authorized saved reader.
- Existing Setup page: separate-tab preview link.
- `tests/setup-flyer.test.mjs`: four focused privacy, calendar, separate-fund and route-guard cases pass.
- `tests/setup-flyer-browser.mjs`: actual React, offline390px/200%text and1440px/normaltext. Draft review/print-dialog stub, version reset, escaped HTML-like notes, separate Satellite section, print-visible warnings/stamp, hidden screen controls/navigation and no overflow pass. Zero network requests. Evidence/screenshots in `test-results/setup-flyer-browser-20261110/`. This does not prove real Next routing, signed-in provider access or a physical/PDF print.
- TypeScript `--noEmit`, targeted ESLint and independent source review GO. Model SHA256 `300489286720d7257f6314c04eedc0647c69322c05c57ad275bddde35d0b5faf`; component `f7df2c07e3e2e9386b76daef9f7fa07f22faf900dfaa9ef1f94476743fabd379`; page `9d4e83b8997125bb5f84e949cd4da5ab05311ad11c4c2d9a2f87e51b2a45cd2b`.

No database update or repeat tournament simulation was necessary. Full pnpm verify/handoff was not run; denied audit/origin/DB operations remain untouched. The stationary-request feature remains separately unverified and disabled following its rejected database check. All new app code remains local pending the supported release process.

Follow-up: local saved Playoff/prize and Custom-policy projection/wiring has now been added where authoritative sources exist; Custom read adapter remains disabled/unexecuted. See 2026-11-10-flyer-saved-policies.md for current scope and gates.
