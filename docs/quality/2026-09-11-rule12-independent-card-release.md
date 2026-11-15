# Rule 12.2 independent-card release evidence

Date: 2026-09-11

## Acceptance evidence

- Source cases 12.2(a)–(f) and (h) are independently validated at the route and database boundaries, including cross-case rejection of the favorable 12.2(a) direction as 12.2(h) and vice versa.
- Original card outcome, margin/blank, spread column, and apparent-qualifier fact are immutable evidence separate from both canonical and adjudicated values.
- Only a current non-self cross checker can create a correction. The active correction-policy snapshot controls required reason and zero/one approval; review v2 rechecks the immutable policy snapshot, event eligibility, draft publication, current role, and non-self independence before granting authority. Its controlled-rejection handler reacquires the operation/game locks and repeats current authorization before persisting a receipt.
- The writer and reviewer are service-role only, same-origin/session protected at the route, transaction-serialized per operation and game, receipt-backed for accepted/replayed operations, conflict-audited for changed retries, and append-only. The browser stores the actor-scoped full proposal or review envelope and reconciles it before allowing an exact retry.
- Player scorecard and preliminary standings select only the latest applied adjudicated projection with `limit 1`; originals, pending, and rejected cases do not contribute or duplicate.
- An applied qualification-changing correction queues one immutable notice for the affected participant. Rejected corrections never block qualification finalization, while an applied qualification-changing correction without its bound notice fails closed. The player scorecard shows the notice without the private reason.
- Legacy reciprocal correction writers remain revoked.

## Local checks

- Focused ESLint: PASS for the Rule 12 TypeScript, route, workspace, and browser files.
- Focused Rule 12 release tests: PASS, 15/15. Expanded Rule 12 plus adjacent correction tests: PASS, 68/68.
- Full application test suite: PASS, 365/365.
- TypeScript: PASS (`pnpm exec tsc --noEmit`).
- Production build: PASS (`pnpm build`, Next.js 16.3.4).
- Full clean-clone gate: PASS (`pnpm verify`), including production dependency audit, lint, 365 application tests, production build, 6 workspace tests, and 6 verification-contract tests.
- Database fixtures: both rollback-only Rule 12 fixtures passed on the approved
  Supabase pilot on 2026-09-12. The full lifecycle proof returned
  `rule12b_correction_lifecycle_passed` with three corrections, six state
  events, two operation conflicts, and zero retained fixture rows.

## Required release proof still open

- Verify with separate real sessions: proposing cross checker, independent reviewer, affected player, and an excluded game participant.
- Verify the correction form and affected-player scorecard notice at phone and desktop sizes.
- Only after those pass, set the exact release value in a new deployment and run live scorecard/standings smoke tests.

Migration `0140` is installed, but its feature flag remains closed pending the
separate-session browser proof above. Hosted execution also verified the
PostgreSQL-truncated legacy constraint name and the `0138`-wrapped internal
qualification finalizer upgrade path.
