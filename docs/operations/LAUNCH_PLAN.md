# Hosting and launch

## Recommendation

Use Vercel for the production frontend and Supabase for PostgreSQL, Auth, private receipt storage and Realtime. This remains the approved target architecture for transaction-heavy shared tournament records with limited server maintenance.

Vercel GitHub preview deployment documentation: https://vercel.com/docs/git/vercel-for-github
Supabase services and Vercel integration: https://vercel.com/marketplace/supabase/supabase
Supabase security/availability production checklist: https://supabase.com/docs/guides/deployment/going-into-prod
As of 2026-09-09, the GitHub-connected Vercel project and Supabase pilot are
reachable and healthy. The reviewed branch has a protected Vercel Preview and
private, forced-RLS Supabase pilot boundaries for registration claims, roster
review, manual payment evidence, check-in/initial seating, event enrollment,
corrections, and versioned tournament setup. They are deliberately partial
foundations, not a production release: the production domain remains separate
from this review branch, and the complete tournament workflow has not yet been
implemented or proven. Confirm current plan eligibility, limits, backup
retention, costs, and the staging/production separation before provisioning
production data.

GitHub stores code/history. GitHub Pages can serve a demo but cannot itself provide a shared authenticated tournament database. A managed server is an alternative if venue-local hosting becomes essential, with more operational work. Cloud hosting does not solve offline synchronization by itself.

## Milestones and exit gates

1. Reconcile the approved requirements, current ACC sources, and technical decisions; create and approve a fresh accessible branded prototype. Exit: requirements traceability, expected-result fixtures, brand permission record, and phone/desktop review approval.
2. Build one two-phone game with independent entries, two confirmations, server authorization and atomic audit. Exit: unit/integration/two-session browser tests pass.
3. Complete registration/check-in, seating, hybrid/dead phone, officials, cross-checking, results and basic finance. Exit: simulated event independently reconciles.
4. Configure separate staging/production, secrets, access policies, monitoring, restore and rollback; GitHub required checks. Deploy only app build files, never repository root or handoff folders.
5. Run a 20-30 person simulated pilot including older/younger, paper/digital players and directors. Exercise connection loss and paper fallback. Exit: critical defects closed and director acceptance recorded.
6. Launch with domain/HTTPS, support contact, incident procedure and monitored first event.

## Current blockers

The app has a guarded pilot backend, but not a completed production system.
The remaining blockers are the full server-authoritative setup/check-in/seating
workflow; real authenticated dual-player verification; offline/hybrid and
paper/dead-phone operation; results, export, finalization and finance;
approved ACC rule fixtures; backup/restore, monitoring and rollback proof; and
accessibility plus a supervised simulated tournament. The Vercel and Supabase
projects exist, but separate staging/production configuration, domain,
environment contract, monitoring, backup/restore, and rollback readiness must
still be proven. See the current release matrix in
`docs/quality/2026-09-09-meta-release-readiness-audit.md`.

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
- `ACC_ACCOUNT_ACTIVATION_ENABLED=false`

The template contains only public Supabase client placeholders and these safe
switches. It must never receive the server-only Supabase credential. An
environment is not eligible to change any switch merely because a deployment
builds successfully; it must satisfy the documented release evidence first.
