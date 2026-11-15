# Hosted October workflow release migrations — 2026-09-12

## Scope

Controlled application and rollback-only proof of the October-critical paper,
hybrid, progression/offline, scorecard-preference/results, and manual settlement
workflows against the approved Supabase pilot.

## Hosted database result

- `0144_paper_vs_paper_authoritative_completion.sql`: applied; self-contained
  rollback fixture passed.
- `0145_manual_settlement_finalization.sql`: applied; rollback proof passed with
  the existing five-participant settlement seed fixture in the same transaction.
- `0146_scorecard_preference_and_results_discovery.sql`: applied.
- `0147_active_game_progression.sql`: applied; rollback proof passed with a
  synthetic linked-player/two-game seed in the same transaction.
- `0148_hybrid_digital_paper_authoritative_completion.sql`: applied; self-contained
  rollback fixture passed.
- `0149_scorecard_preference_mutation_repair.sql`: applied after live execution
  proved the legacy immutable-roster trigger blocked the narrowly audited
  scorecard-preference projection.
- `0150_hybrid_revalidation_repair.sql`: applied after live execution proved the
  canonical-game invariant checker needed an explicit one-digital/one-paper
  approved-evidence branch.
- `0151_release_foreign_key_indexes.sql`: applied. The post-apply performance
  advisor reports no unindexed foreign-key finding and no warning/error finding.

All hosted fixtures ran inside transactions ending in `rollback`; no fictional
players, games, receipts, or financial rows were retained.

## Local release gate after repairs

- `pnpm verify`: PASS — dependency audit, lint, 407/407 application tests,
  Next.js 16.3.4 production build, and workspace tests.
- `pnpm verify:handoff`: PASS — 6/6.
- `git diff --check`: PASS; only Windows line-ending notices were emitted.

## Production deployment and smoke proof

- Git commit: `684588888d16d9e30f1fedfa51abc2ebfebcdcd2`
- READY preview: `dpl_5P8RDqXTRaXaXzBnixfsiHqauWeq`
- Vercel Production promotion: `dpl_CafWiJMAzHKKM5tCX6TP27PRLaqY`
- Stable URL: `https://cribbage-web-app.vercel.app`
- Public root, demo, sign-in, and registration responses: HTTP 200.
- Authenticated external-Chrome checks: tournament dashboard, setup, seating,
  event participants, finances, and event results rendered without a framework
  error page.
- Live finance mutation: a $1 synthetic release-verification expense was
  recorded and then voided; the active total returned to $0 and the append-only
  audit history retained both actions.
- Responsive production demo: 320x780, 375x812, 640x900, and 1280x900 all
  rendered meaningful content, all five primary navigation labels, no Next.js
  error overlay, and document/body width equal to the viewport.
- Vercel grouped runtime error check after release: no errors found.
- Application rollback rehearsal: production aliases moved to prior known-good
  commit `83cfd7d` as READY deployment
  `dpl_XN9ZEBoivkMmWCDzgvGLroh4qhe5`; the stable demo returned HTTP 200. The
  verified October commit `6845888` was then restored as READY deployment
  `dpl_8edunFUXR1etP6P4FxaJ4mHqtDVv`; demo, protected finance, and protected
  results returned HTTP 200 and the runtime-error scan remained empty.

## Remaining acceptance rehearsals

Pilot acceptance still requires separate signed-in player/official browser
sessions, an actual disconnect/reconnect rehearsal, a backup/restore rehearsal,
and the tournament director's operational walkthrough. Those checks cannot be
replaced by a single privileged SQL session. Account-activation and Rule 12
release flags remain closed until their required independent-session evidence
exists; this is intentional fail-closed release control, not an undiscovered
implementation gap.
