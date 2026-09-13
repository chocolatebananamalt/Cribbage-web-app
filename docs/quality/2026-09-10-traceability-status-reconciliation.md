# Traceability-status reconciliation — 2026-09-10

## Finding

`docs/product/requirements.md` is a summary, not the normative requirements
document, but its status column had drifted far enough to misstate the current
implementation. It called guarded registration, role, scoring, verification,
and scorecard work “design only,” “visual demo,” or “missing,” despite current
private schema/API boundaries and isolated database evidence. Conversely, it
called corrections merely “mock screens,” despite the deliberate Rule 12.2
suspension that now makes the incomplete writer unavailable.

## Reconciliation rule

The summary now uses three explicit meanings:

- **Partial**: a bounded, tested server/API/schema foundation exists, but the
  full requirement or release evidence does not.
- **Guidance/prototype only**: the screen or written procedure exists without
  the authoritative workflow.
- **Not started/incomplete**: no bounded implementation exists yet.

No row is labelled complete unless its normative requirement and required
positive/rejection evidence are complete. The source of truth remains
`docs/product/production-requirements.md`.

## Evidence used

- Registration, role, check-in/seating, and payment boundaries: the current
  migrations, server routes, and the isolated validation evidence recorded in
  `PROJECT_STATUS.md`.
- Scoring and verification: `2026-09-10-isolated-real-identity-score-flow.md`
  plus server/API contract tests.
- Scorecard: protected player scorecard reader and browser smoke evidence.
- Corrections: `2026-09-10-rule12-independent-card-foundation-live-check.md`
  and the explicit disabled switch; this is safety progress, not a working
  correction feature.
- Event setup: private setup revisions and current setup workspace boundaries.

## Result

The summary now accurately directs future implementation toward the actual
remaining blockers: hybrid/offline, official Rule 12 fixtures and workflow,
rotation/judge rules, results/finance/finalization, paper capture, recovery,
and real multi-user/browser evidence. It neither relaxes a requirement nor
changes the release decision.
