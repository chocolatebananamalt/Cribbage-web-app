# Hosting and launch

## Recommendation

Use Vercel for the production frontend and Supabase for PostgreSQL, Auth, private receipt storage and Realtime. This remains the approved target architecture for transaction-heavy shared tournament records with limited server maintenance.

Vercel GitHub preview deployment documentation: https://vercel.com/docs/git/vercel-for-github
Supabase services and Vercel integration: https://vercel.com/marketplace/supabase/supabase
Supabase security/availability production checklist: https://supabase.com/docs/guides/deployment/going-into-prod
As of 2026-09-06, the GitHub-connected Vercel project and Supabase project are reachable and healthy. The Vercel project has only a placeholder production deployment; it returns 404 because no application has been built. Supabase has no migrations or public tables. Confirm current plan eligibility, limits, backup retention and costs before provisioning production data.

GitHub stores code/history. GitHub Pages can serve a demo but cannot itself provide a shared authenticated tournament database. A managed server is an alternative if venue-local hosting becomes essential, with more operational work. Cloud hosting does not solve offline synchronization by itself.

## Milestones and exit gates

1. Reconcile the approved requirements, current ACC sources, and technical decisions; create and approve a fresh accessible branded prototype. Exit: requirements traceability, expected-result fixtures, brand permission record, and phone/desktop review approval.
2. Build one two-phone game with independent entries, two confirmations, server authorization and atomic audit. Exit: unit/integration/two-session browser tests pass.
3. Complete registration/check-in, seating, hybrid/dead phone, officials, cross-checking, results and basic finance. Exit: simulated event independently reconciles.
4. Configure separate staging/production, secrets, access policies, monitoring, restore and rollback; GitHub required checks. Deploy only app build files, never repository root or handoff folders.
5. Run a 20-30 person simulated pilot including older/younger, paper/digital players and directors. Exercise connection loss and paper fallback. Exit: critical defects closed and director acceptance recorded.
6. Launch with domain/HTTPS, support contact, incident procedure and monitored first event.

## Current blockers

No backend/database, authentic roles, dual verification, durable audit, offline queue or real calculation engines. Demo PIN and feedback injection defects; incomplete official rule fixtures. No production tests/restore/user-pilot evidence. The Vercel project and Supabase project exist, but separate staging/production configuration, domain, environment contract, monitoring, backup/restore, and rollback readiness remain to be established. Original chat is missing but recovered artifacts are sufficient to start implementation.
