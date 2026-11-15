# Tournament operations completion evidence

Date: 2026-09-14

## Observable acceptance criteria

1. A published schedule cannot accept any online, offline, confirmation, paper, or recovery score evidence until an authorized official starts that specific event.
2. Start is bound to exact participant and schedule versions, is idempotent and append-only, and Main, Consolation, and Satellites can start independently.
3. Live Preliminary Standings contain authoritative results only and disclose refresh and stale state.
4. Each event supports zero through six uniquely named, director-configurable
   Side Pools separately from its two Q Pools, with exact-cent elections,
   payments, corrections, reviewed payouts, reconciliation, CSV, and PDF
   reports.
5. Participant status changes are event-scoped, audited, reversible through reinstatement, and never create blanket wins.
6. Two-person Traditional and Canadian Doubles preserve individual identities
   and contributions while supporting a captain-selected shared Digital or
   Paper scorecard. Digital results require independent opposing-team entries
   and confirmations; paper evidence requires independent official review.
7. Every configured event is discoverable in Results; Satellite UI states the MRP and qualification boundary.

## Evidence

- Migrations `0164` through `0189` are applied to the approved pilot Supabase
  project. The transaction-only hosted fixture passed after the live schema
  update and rolled its fictional data back.
- `pnpm verify` passes: 509 application tests, lint, production dependency
  audit, provider checks, production build, and workspace integrity.
- `pnpm verify:handoff` passes 6/6 local handoff checks. Focused team,
  Side-Pool, privacy, correction, qualification-tie, and offline-retry checks
  also pass.
- PR #43 passed both GitHub `verify` runs and Vercel Preview, then merged as
  `19a225a48a75bf72080de7e640ee5ae406edfe22`. Production deployment
  `dpl_FJVBdc5yiiCEs6dTrn5S9p2EScGV` is READY at
  `https://cribbage-web-app.vercel.app`.
- Production public-demo smoke: the Score Entry flow rendered and advanced to
  **Review Current Game Result** at desktop and 375px phone widths; no page or
  browser-console errors occurred, and the phone width had no horizontal
  overflow. Vercel runtime errors and error/fatal logs for the one-hour
  post-release window were empty.

## Deliberate remaining gates

- A supervised independent-device rehearsal must still prove the real
  director workflow with separate accounts and devices. This includes both
  Digital/Paper team paths, single-device and venue-wide offline recovery,
  then a human review of standings and finance results.

