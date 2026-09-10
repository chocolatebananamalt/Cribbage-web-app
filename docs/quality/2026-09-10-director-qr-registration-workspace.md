# Director QR registration workspace — 2026-09-10

## Scope

This source change closes an implementation gap in the QR-registration
workflow: an eligible director or co-director can now use a protected
Registration Link workspace to create, replace, close, copy, and locally
render a QR code for the single active tournament registration link.

## Security and product boundaries

- The workspace and its navigation are unavailable unless the separate
  `ACC_REGISTRATION_LINK_MANAGEMENT_V2=enabled` director-management gate is
  deliberately set. It is off in the current shared pilot.
- Public claims remain independently unavailable until
  `ACC_PUBLIC_REGISTRATION_V2=enabled` is deliberately set. Preparing a QR
  link therefore does not itself open public registration.
- The page requires the existing server-side tournament role check and then
  uses a server-only client for the already service-only link-state read.
- A raw registration credential is created only by the existing server-only
  issuer/rotator. The database receives a salt and fixed-size digest, not the
  credential.
- The browser holds the returned credential only in component memory long
  enough to build `https://current-origin/register#credential`, copy it on an
  explicit action, or render a local QR image. It uses neither `localStorage`
  nor `sessionStorage`; dismissing/replacing/closing clears the displayed
  credential and QR image.
- The QR image is generated with the bundled `qrcode` dependency as a local
  data URL. No third-party QR endpoint receives the registration URL.
- The UI re-reads non-secret link state after a successful create/replace
  before permitting a later compare-and-swap replace or close action. A
  conflict or unavailable re-read does not invent a state or regenerate a
  credential.
- If the server-only state reader itself is unavailable after authorization,
  the page renders a clear temporary-unavailable state. It neither attempts a
  mutation nor reveals any link state; the generic framework error page is not
  used as operational guidance.

## Acceptance checks

1. A new semantic regression test proves the page is release- and role-gated,
   uses a server-only metadata reader, makes a fragment URL, renders QR data
   locally, and has no browser-storage use.
2. The existing route and database-contract tests continue to enforce
   same-origin, verified-subject, private RPC-only, one-time credential,
   compare-and-swap, and release-gate boundaries.
3. `pnpm verify` (including lint, 157 application checks, production build,
   workspace checks, and dependency audit) and `pnpm verify:handoff` passed
   locally on 2026-09-10. `git diff --check` also passed.

## Still required before it can be enabled

- Apply the reviewed migration sequence to a separate validation environment,
  then the shared pilot only with the named change approval required by
  `docs/operations/PILOT_MIGRATION_CHANGE_CONTROL.md`.
- Test creation, scanning, claim, replacement, close, concurrent director
  actions, and the unavailable/retry paths in independent signed-in browser
  sessions against a real test backend.
- Perform phone and desktop accessibility/print review. Browser automation on
  this host cannot reach the local app, so no visual claim is made here.
