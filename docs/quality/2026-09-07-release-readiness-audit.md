# Release-readiness audit — 2026-09-07

## Scope and method

This audit compares the current repository, pilot service evidence, and hosted Preview against the release-blocking requirements in `docs/product/production-requirements.md` and `docs/quality/VERIFICATION.md`. A green build or a rendered prototype is not treated as production evidence.

## Verified evidence

| Area | Current evidence | Status |
|---|---|---|
| Repository integrity | `pnpm verify:local` on 2026-09-07: lint, 24 tests, production build, workspace, and local handoff checks passed | Pass, limited scope |
| Score derivation | Unit tests cover 1–121 bounds, winner requirement, reciprocal Plus/Minus, 0/2/3 points, and informal band display | Pass |
| Preview hosting | Git-driven Vercel Preview deployment `dpl_5bSnYDX5KiPTiwkQeXbPTd5nNYgt` built successfully; authenticated browser rendered the score-entry page | Pass for Preview only |
| Pilot score API | Prior pilot evidence records applied private-schema migrations, dual submissions, two confirmations, mismatch, authorization, closed-event, and replay rejection paths | Pass for the bounded pilot slice |
| Prototype accessibility baseline | Prior browser checks cover key targets and responsive layout; the most recent hosted browser check confirms the score-entry panel renders | Partial; 200% zoom and user testing remain open |

## Critical release blockers

| Requirement area | Current gap | Evidence needed to close it |
|---|---|---|
| Production deployment | Vercel Production still deploys `main`, not the reviewed branch; Production environment values are absent | protected staging and production deployments from reviewed release commit; production smoke test and rollback record |
| Real score-entry workflow | The hosted score-entry screen is a design-review shell. It does not authenticate a player, load an assigned game, or submit/confirm through the pilot API | two independent browser sessions completing submit/compare/confirm against a real test backend, with persisted records inspected |
| Role-aware application views | Navigation and Operations cards are static prototype sections; player/cross-checker/director views are not connected to server-enforced capabilities | server authorization and independent-session UI tests for each role and self-check denial |
| Corrections and disputes | No operational correction/dispute UI or applied/pending approval workflow exists | append-only correction and dispute integration tests, including self/role/published-result rejection paths |
| Offline/hybrid path | No authenticated offline queue, replay, shared-device clear action, or hybrid/paper workflow exists | offline/reconnect/forgery/replay tests and a simulated paper/dead-phone workflow |
| Event, finance, results, export | Flyer/event configuration, finance ledger/reconciliation, result publication/versioning, and `acc-results-v1` artifact are not implemented | rule fixtures plus end-to-end authorization/reconciliation/export tests |
| Operations rules | Seating/rotation, Consolation eligibility, Q-pool rounding, MRP/byes, and retention policy lack approved dated fixtures | approved ACC sources/fixtures or product gates that block official use |
| Operational readiness | Monitoring, backup-and-restore, rollback drill, required GitHub checks, incident procedure, and supervised simulated tournament have not been evidenced | recorded exercises and director acceptance |

## Non-blocking current decisions

- Preview uses only the Supabase Publishable key and project URL; no server/service key is exposed.
- The sign-in UI uses email OTP and rejects account creation. Leaked-password protection is not treated as a required paid feature while password login remains unavailable to the app; hosted Auth behavior still needs a release-time passwordless verification.
- Skunk/Double Skunk/Triple Skunk labels are approved player-facing aids. They do not change official game points, standings, or exports.

## Next implementation priority

Integrate the approved one-screen score-entry UI with the existing pilot API and authenticated assignment context. This is the smallest end-to-end path that can convert the currently verified score logic and pilot RPC evidence into a real two-session browser workflow. It does not make the broader release blockers disappear; those remain explicit gates.
