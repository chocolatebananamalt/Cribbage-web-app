# Director QR registration workspace — 2026-09-10

## Scope

This source change closes an implementation gap in the QR-registration
workflow: an eligible director or co-director can now use a protected
Registration Link workspace to create, replace, close, copy, and locally
render a QR code for the single active tournament registration link.

## Security and product boundaries

- The workspace and its navigation are unavailable unless the separate
  `ACC_REGISTRATION_LINK_MANAGEMENT_V2=enabled` director-management gate is
  deliberately set. It is enabled for the October pilot Production deployment.
- Public claims remain independently unavailable until
  `ACC_PUBLIC_REGISTRATION_V2=enabled` is deliberately set. Preparing a QR
  link therefore does not itself open public registration. The public gate was
  enabled only after the live issuer/rotation path and anonymous claim boundary
  passed their release checks.
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

On 2026-09-11, live production use exposed and repaired a create-response
contract mismatch: the database accepted the link but the create route returned
HTTP 200 while the one-time-credential UI required HTTP 201. The route now
returns 201, matching the already-correct rotation route, and a regression
assertion prevents the credential display from silently failing again.
The replacement form now defaults to a 30-day expiry so a link prepared for
the October 3 pilot does not expire during the September 18 onboarding window;
closing registration still closes the active link atomically.

## Production release evidence

- Vercel Production deployment `dpl_46qi5VowQ9NcTexHfHEP63U6TPTn` served
  commit `235585a` on the stable domain. External Chrome showed the protected
  director workspace and replaced the active credential with the new 30-day
  default; the displayed expiry is October 12, after the October 3 event.
- After enabling the separate public gate and redeploying as
  `dpl_HetSrY61e896zANvD2DFAZRU1LEP`, a fresh external Chrome tab opened the
  fragment link, displayed the visitor form, accepted a fictional registration,
  and returned `Your registration was received for review.`
- The claim created no role, roster row, payment, check-in, event enrollment,
  Table/Seat, or Verification ID. The absence of a director claim-review screen
  was then treated as an implementation defect, not as successful completion;
  that protected review queue is covered by the subsequent release evidence.

Still required for the complete pilot gate: an independent physical phone scan,
expired/replaced/closed-link ceremony, and the full multi-person rehearsal.
