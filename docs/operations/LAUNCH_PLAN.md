# Hosting and launch

## Recommendation

Use Vercel for the production frontend and Supabase for PostgreSQL, Auth, private receipt storage and Realtime. This remains the approved target architecture for transaction-heavy shared tournament records with limited server maintenance.

Vercel GitHub preview deployment documentation: https://vercel.com/docs/git/vercel-for-github
Supabase services and Vercel integration: https://vercel.com/marketplace/supabase/supabase
Supabase security/availability production checklist: https://supabase.com/docs/guides/deployment/going-into-prod
As of 2026-09-13, GitHub, Vercel Production/Preview, Supabase Auth, the approved
pilot database, and the disposable verification database are connected and
healthy. The Standard Singles October release candidate is live at
`https://cribbage-web-app.vercel.app/` with database migrations through 0162.
The required setup, registration/manual/CSV roster, cash/check, check-in,
initial seating, event enrollment, reviewed schedule, digital/paper/hybrid
scoring, correction, offline/recovery, results, settlement, expense, final PDF,
and private paper-card capture/readback boundaries are implemented. Production
readiness is still conditional on the independent-person, physical-device,
backup/content-restore, and director rehearsals in
`OCTOBER_PILOT_REHEARSAL.md`; a live deployment is not evidence that those
exercises passed.

GitHub stores code/history. GitHub Pages can serve a demo but cannot itself provide a shared authenticated tournament database. A managed server is an alternative if venue-local hosting becomes essential, with more operational work. Cloud hosting does not solve offline synchronization by itself.

## Milestones and exit gates

1. Reconcile the approved requirements, current ACC sources, and technical decisions; create and approve a fresh accessible branded prototype. Exit: requirements traceability, expected-result fixtures, brand permission record, and phone/desktop review approval.
2. Build one two-phone game with independent entries, two confirmations, server authorization and atomic audit. Exit: unit/integration/two-session browser tests pass.
3. Complete registration/check-in, seating, hybrid/dead phone, officials, cross-checking, results and basic finance. Exit: simulated event independently reconciles.
4. Configure separate staging/production, secrets, access policies, monitoring, restore and rollback; GitHub required checks. Deploy only app build files, never repository root or handoff folders.
5. Run a 20-30 person simulated pilot including older/younger, paper/digital players and directors. Exercise connection loss and paper fallback. Exit: critical defects closed and director acceptance recorded.
6. Launch with domain/HTTPS, support contact, incident procedure and monitored first event.

## Current blockers

No missing API, database, hosting connection, or known October-critical
implementation blocks the focused Standard Singles pilot. Remaining go/no-go
conditions require evidence from the real operating context:

- independent player and official accounts on separate sessions/devices;
- disconnect, reload/restart, reconnect, conflict, and failed-device recovery;
- a real anonymized paper-card upload reopened by a different eligible official;
- approved-pilot backup/content restore into an isolated environment; and
- the director's complete simulated tournament and acceptance.

ACC authorization for official digital operational records and the
current-effective values used for official MRP/Q-pool/payout reporting remain
external approval inputs. ACC portal automation, online payments, SMS, flyer
creation/import, live OCR, the rich Judge Desk, and automatic rotation are
post-pilot capabilities with manual October fallbacks. Supported two-person
Traditional/Canadian Doubles team scoring, participant seating lookup, and six
Side Pools are October release blockers. The current tracker is
`WORKING_OUTLINE.md`, and the evidence
checklist is `OCTOBER_PILOT_REHEARSAL.md`.

A successful protected-preview root response is not evidence that an
authenticated route has the current Supabase public URL and publishable key.
Each candidate must have an authenticated `/sign-in` and magic-link callback
smoke test, followed by a deployment-specific runtime-error review. See
`docs/quality/2026-09-10-protected-preview-auth-preflight.md`.

## Registration release sequence

The QR workflow has two deliberately independent, default-off environment
gates. They are not general configuration toggles and must never be enabled
just to make a preview look more complete.

1. `ACC_REGISTRATION_LINK_MANAGEMENT_V2=enabled` exposes only the protected
   director/co-director workspace for preparing, rotating, or closing a QR
   link. It does not allow a visitor to submit a registration.
2. `ACC_PUBLIC_REGISTRATION_V2=enabled` separately allows the `/register`
   fragment-link claim route. It must remain absent until the named migration
   packet, independent-session tests, and director approval cover the
   particular test or event.

Before either gate is enabled for a shared environment, complete the named
change-control packet in `PILOT_MIGRATION_CHANGE_CONTROL.md`, confirm the
server-only Supabase credential and public values are scoped to the intended
environment, and run a real two-browser test. That test must prove that a
director can obtain the QR code once, a visitor can claim only while the link
is active, a closed/replaced/expired link is denied, and a public claim creates
neither a role nor a payment, check-in, seat, or verification ID.

## Safe environment defaults

`.env.example` deliberately keeps all staged capabilities closed:

- `ACC_REGISTRATION_LINK_MANAGEMENT_V2=disabled`
- `ACC_PUBLIC_REGISTRATION_V2=disabled`

The reviewed October roster-account activation and Rule 12 correction
workflows no longer depend on deployment switches. Their server role, non-self,
lifecycle, and service-only RPC checks remain mandatory. The template contains
only public Supabase client placeholders and remaining safe switches. It must
never receive the server-only Supabase credential.
