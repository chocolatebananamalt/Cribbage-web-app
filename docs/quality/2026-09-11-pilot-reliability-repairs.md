# Pilot reliability repairs verification

**Date:** 2026-09-11 (Pacific/Honolulu)
**Backend:** shared pilot Supabase project

## Verified behavior

- Registration closure rejects a new manual roster identity while an accepted
  pre-close request replays its exact receipt after closure.
- Approved setup activation opens the initial registration window.
- Roster-only paper opponents remain visible on verified player scorecards.
- Paper-card capture identity resolution accepts roster-only participants,
  retains no-self checks after account linking, and remains provider-pending,
  default-off, non-authoritative, and service-only.
- Player scorecard lines and totals use only the latest applied Rule 12
  projection; a rejected correction leaves the original score intact.
- Preliminary standings include paper-only participants and validate schedule
  completion evidence before describing scorecards as complete.

## Evidence

- Independent high-risk review found no remaining P0/P1 defect after the
  correction-aware scorecard repair.
- `pnpm verify`: pass — audit, lint, 266 application tests, production build,
  workspace checks.
- `pnpm verify:handoff`: pass — 6/6.
- Supabase migrations `registration_roster_freeze`,
  `hybrid_scorecard_reconstruction_repair`, and
  `paper_inclusive_qualification_preview`: applied successfully.
- Hosted rollback fixtures passed for setup activation, roster closure/replay,
  paper-only preliminary standings, paper capture identity, and the Rule 12
  correction lifecycle. The Rule 12 fixture reported three corrections, six
  state events, one expected conflict, and zero retained fixture rows.
- Post-DDL advisors report the existing intentional private-schema RLS/no-policy
  notices and public RPC security-definer notices. Direct tables remain
  inaccessible; the reviewed RPC grants are intentional application boundaries.
- Commit `9e2917d` was promoted to Vercel Production as deployment
  `dpl_D6axn8Nzs6wTtiZYeNi9GHJ3Fdba`. The stable root, public demonstration,
  and offline worker returned HTTP 200; external Chrome rendered the stable
  demonstration, and the post-smoke error/fatal runtime-log query was empty.

## Remaining release proof

Real independent-user sessions, physical phone disconnect/reconnect, and a
director-led full tournament rehearsal remain required. Official MRP, Q-pool,
payout, and final export authority is not claimed by this slice.
