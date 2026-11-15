# Pilot operations completion evidence

Date: 2026-09-11
Environment: Windows worktree, shared Supabase pilot, Node 24 / pnpm

## Scope

This evidence record integrates roster account activation, bounded CSV roster
intake, tournament expenses, failed-device reconstruction, immutable Standard
Singles qualification finalization, and supporting database indexes.

## Observable acceptance criteria

- Director/co-director operations are server-authorized, replay-safe, audited,
  and scoped to the selected tournament.
- Shared-device cleanup removes every new retry envelope.
- Failed-device reconstruction never allows a participant, an unresolved
  participant identity, a same-actor review, disputed evidence, or stale data
  to affect a scorecard.
- Qualification finalization requires a complete immutable event, rejects every
  unresolved workflow state and unresolved numeric ranking tie, and freezes all
  canonical game insertion or mutation afterward.
- A lost finalization/recovery response can be retried with the exact same
  operation identifier and reconciled without duplicating the action.
- Every foreign key introduced by these pilot tables has a supporting index.

## Executed evidence

| Check | Result |
| --- | --- |
| Migrations 0127-0132 on shared pilot | Pass |
| Hosted rollback fixtures for CSV roster, expenses, recovery, and qualification | Pass; no synthetic data retained |
| Supabase performance advisor | Pass for foreign-key coverage; zero unindexed foreign keys |
| Supabase security advisor | No new release-blocking finding; private `app` tables remain RPC/service-only and password login is not used |
| Independent Sol review of recovery and qualification | Pass; no remaining P0/P1 finding |
| `pnpm verify` | Pass; audit, lint, 298/298 application tests, production build, workspace checks |
| `pnpm verify:handoff` | Pass, 6/6 |
| Vercel Production | Commit `02439a8`, deployment `dpl_4BDA3NtjjDmFPqV4Ng2Lj9iczCUc`, READY |
| Stable HTTP smoke | `/`, `/demo`, and `/offline-score-sw.js` return 200; worker is JavaScript with `no-store`/`no-cache` |
| External Chrome desktop | Pass at 1536x639; meaningful content, no document overflow, no framework overlay, no browser error log |
| External Chrome phone | Pass at 375x812; public demo renders readable phone layout |
| Post-smoke Vercel runtime-error scan | Pass; no runtime errors in the selected release window |

## Known limitations and next release evidence

- Use independent real sessions to prove account activation, digital scoring,
  confirmation, recovery review, and qualification finalization.
- Run one complete director rehearsal with actual pilot configuration and
  anonymized or consented participants before operational reliance.
- Q-pool/MRP/payout, playoff results, and full financial reconciliation remain
  separate incomplete pilot requirements; no screen currently claims those
  figures are official.
