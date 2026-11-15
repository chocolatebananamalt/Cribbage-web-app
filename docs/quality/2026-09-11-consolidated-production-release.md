# Consolidated production release — 2026-09-11

## Release candidate

- Source commit: `33b8300` (`Clean settlement evidence formatting`)
- Preview deployment: `dpl_EhKiHWadiidVRGaKkcpsXo66Xy2w`
- Production deployment: `dpl_GgPSHW6jar6MzmARoDLWgs4bzdhu`
- Stable domain: `https://cribbage-web-app.vercel.app`

The READY preview was promoted through Vercel's Production workflow. Vercel
rebuilt it with the Production environment, assigned the stable domain, and
reported no alias error. The deployed source is exactly commit `33b8300`.

## Observable checks

- The protected registration-link workspace loads for the authenticated
  director and shows the existing active October link without rotating,
  closing, or exposing its one-time credential.
- The protected Players and Registration workspace loads with an empty public
  claim queue and the two pre-existing pilot roster identities unchanged.
- The public `/register` route and production root return HTTP 200.
- The registration workspace and roster produced no browser error entries.
- Vercel's grouped Production runtime-error scan for the release window found
  no runtime errors.

The first request to the registration workspace occurred while Vercel was
still moving the stable alias and briefly rendered a 404. Repeating the same
read-only request after the deployment reached READY loaded the expected
workspace. This was an alias-transition observation, not an application route
failure.

## Historical deliberately closed capability

At the time of this release, roster-account activation was release-gated and
its production URL returned 404. The owner-approved October activation
decision dated 2026-09-12 supersedes that availability boundary after the
private migrations, hosted fixtures, and independent review were completed.
The witnessed independent-session ceremony remains operational acceptance
evidence; the protected workflow is now available so that rehearsal can occur.

## Remaining proof

- Authenticated download of a real immutable settlement working copy cannot be
  exercised against the October event until that event has a finalized
  qualifying result and saved draft. No synthetic settlement was inserted
  into the real event for this release.
- The consolidated build did not receive a new phone-layout run because the
  external Chrome viewport control did not resize the already-open desktop
  window. The same registration and roster UI had previously passed at 375
  pixels, and this release changes no layout code; this is still recorded as
  verification remaining rather than silently claimed as rerun.

## Post-release navigation acceptance criteria

- A director or co-director can open a tournament-bound Results index from the
  tournament home screen, then open each activated digital Standard Singles
  event by its visible name without knowing or copying an internal event ID.
- The tournament Results index is not shown to player-only or
  cross-checker-only roles.
- Paper/manual and unsupported team formats are not presented as digitally
  calculated results.

## Post-release candidate integration progress

- Migrations `0137` through `0141` are applied and recorded in the approved
  Supabase pilot. Their rollback-only hosted fixtures pass without retaining
  synthetic data, including the complete qualification, playoff placement,
  and settlement working-copy chain.
- Independent Sol review found no P0/P1 issue in the final database and export
  bindings. Supabase's performance advisor reports no warning/error findings;
  its private-schema no-policy notices are intentional because browser roles
  cannot access those tables and all live access is through server-only RPCs.
- The combined local release tree passes 365/365 application tests, dependency
  audit, lint, production build, workspace verification, and all 6 private-
  handoff checks.
- Production remains on commit `33b8300` until this reviewed release candidate
  is committed, deployed to Preview, browser-verified, and promoted.
