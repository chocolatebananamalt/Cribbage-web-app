# Vercel build-rate-limit evidence — 2026-09-10

## Observation

The GitHub commit-status API for commit `1a0b0f6` reports Vercel status
`failure` with the provider message: `Deployment rate limited — retry in 24
hours.` Vercel subsequently accepted and marked Ready one Preview for commit
`6508e4c` (the ACC MRP-source documentation change), returning `200 OK` for
its public landing page. It then rate-limited the immediate later commit
`8fbba96` with the same message. The Vercel project remains configured for
Next.js, Node 24, and Preview deployments.

The quota intermittently accepted another Preview, deployment
`dpl_BhZ7zZdvTqjKzN68KpqLrfBwynjg`, for commit `87cc65b` on the review branch;
Vercel marked it `READY`. The protected endpoint fetch correctly reached the
project but returned Vercel SSO `302`, so it does not substitute for a
signed-in browser test. GitHub's Vercel status for the immediately following
commit `c46b5f5` again reports `Deployment rate limited — retry in 24 hours.`
Therefore that registration-page repair has local verification only until the
provider accepts another build.

## Interpretation

This is a hosting-plan build quota limit, not a failed application build or a
runtime error. Vercel reports one historical missing-Supabase-environment
error on an older deployment and no current Preview runtime-error cluster. The
project is still Preview-only (`live: false`), so this does not affect a
production audience. It prevents hosted verification of the most recently
pushed commit until Vercel accepts another build.

## Boundary

No plan, billing, deployment target, custom domain, or environment variable
was changed. The app must not be called hosted-current or production-ready
until a Ready deployment contains the intended commit and the required
independent-session browser checks have passed. The Ready Preview is evidence
that the Vercel routing/build configuration can currently serve a Next.js
landing page; it is not evidence of the protected authenticated workflow.
