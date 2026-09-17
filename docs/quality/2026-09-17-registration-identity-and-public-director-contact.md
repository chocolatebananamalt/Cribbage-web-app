# Registration identity and public Director contact — release evidence

**Date:** 2026-09-17
**Database project:** `fnjkwymxpnsqvxtpronk`
**Migration:** `registration_identity_and_public_director_contact`

## Delivered

- New public, manual, and CSV participant intake has separate first/last name
  values; historic display-name-only records remain intact.
- All roster/public selectors state **Scorecard Type** and offer only Digital
  and Paper.
- CSV import requires First Name and Last Name; validates each nonblank ACC #
  as `HI296`-style, supplies the failing row, rejects old Player Name headers,
  and defaults a blank scorecard type to Digital.
- Public Director names are append-only tournament-scoped contact history.
  The public reader never joins an account profile. Only the primary director
  can perform the protected, auditable post-finalization correction.

## Local and database evidence

| Check | Result |
| --- | --- |
| Focused identity/contact, roster CSV, setup contact, sanctioning tests | Pass, 14/14 |
| `pnpm exec tsc --noEmit` | Pass |
| `pnpm verify` | Pass, 537 application tests; audit, lint, provider check, optimized build, and workspace checks passed |
| `pnpm verify:handoff` | Pass, 6/6 |
| Database migration | Applied successfully; table, roster columns, and v3/contact functions confirmed by read-only query |
| Local responsive browser attempt | Blocked by this host Chrome extension (`ERR_BLOCKED_BY_CLIENT`) for `localhost:3001`; used external production browser instead |

## Production release evidence

| Check | Result |
| --- | --- |
| Pull request | [#82](https://github.com/chocolatebananamalt/Cribbage-web-app/pull/82) passed GitHub Verify and Vercel Preview |
| Merge | `8eb5430dfae720253d26d36a57ed8513462aae8d` |
| Production deployment | READY: `dpl_HyPRRdbqBuVnuGkYeTnSCMKbj7Up`; stable URL [cribbage-web-app.vercel.app](https://cribbage-web-app.vercel.app/) |
| Public route smoke check | `GET /register` returned HTTP 200 |
| Signed-in external Chrome | Genesis Setup loaded the primary-director-only public-name correction field; the protected roster page displayed the exact First name, Last name, Scorecard Type, Digital/Paper choices, and CSV contract |
| Runtime errors | Vercel scan after the release: none in the selected one-hour period |

## Preservation boundary

The migration does not issue, replace, close, or reveal Genesis Rehearsal’s
legacy registration credential. It does not mutate existing roster, event,
payment, seating, role, or audit records.
