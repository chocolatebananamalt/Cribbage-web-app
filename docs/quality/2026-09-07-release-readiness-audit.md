# Release-readiness audit — 2026-09-07

## Scope and method

This audit compares the current repository, pilot service evidence, and hosted Preview against the release-blocking requirements in `docs/product/production-requirements.md` and `docs/quality/VERIFICATION.md`. A green build or a rendered prototype is not treated as production evidence.

## Verified evidence

| Area | Current evidence | Status |
|---|---|---|
| Repository integrity | On 2026-09-09, `pnpm lint`, `pnpm test` (43 tests), and `pnpm build` passed after the director correction-policy workspace change. Full handoff verification is rerun before this change is committed. | Pass, limited scope |
| Score derivation | Unit tests cover 1–121 bounds, winner requirement, reciprocal Plus/Minus, 0/2/3 points, and informal band display | Pass |
| Preview hosting | Git-driven Vercel Preview `dpl_12XA3jjFi9ZsczErUEAdgytXPQxL` built commit `3ac5f13`; its root returned the expected app shell with HTTP 200 and no runtime-error cluster in the one-hour scan | Pass for Preview only |
| Live score-entry boundary | Protected assigned-game route reads only a server-authorized game context; its client uses the private submit/confirm RPC routes, validates 1–121 spread points, and holds game verification until two independent matching submissions and confirmations | Pass for source and pilot-RPC boundary; real independent-browser proof remains open |
| Correction workflow boundary | Protected correction workspace, director/co-director policy controls, append-only policy/review lifecycle, expected-policy-version stale-write rejection, and caller-scoped retry reconciliation are implemented. Pilot permissions confirm the writer/read/reconciliation RPCs deny `anon`, use empty-search-path SECURITY DEFINER functions, and the obsolete writer signature is absent. A focused Sol re-review found no P0/P1 after the stale-policy repair. | Pass for source, pilot migration, and focused review; real-role browser and concurrency proof remain open |
| Pilot score API | Prior pilot evidence records applied private-schema migrations, dual submissions, two confirmations, mismatch, authorization, closed-event, and replay rejection paths | Pass for the bounded pilot slice |
| Prototype accessibility baseline | Prior browser checks cover key targets and responsive layout; the most recent hosted browser check confirms the score-entry panel renders | Partial; 200% zoom and user testing remain open |

## Critical release blockers

| Requirement area | Current gap | Evidence needed to close it |
|---|---|---|
| Production deployment | Vercel Production still deploys `main`, not the reviewed branch; Production environment values are absent | protected staging and production deployments from reviewed release commit; production smoke test and rollback record |
| Real score-entry workflow | The protected implementation now authenticates, loads an assigned game, and calls the pilot submit/confirm routes. It has not yet been exercised by two independent authenticated browser sessions against a disposable real backend fixture. | two independent browser sessions completing submit/compare/confirm against a real test backend, with persisted records inspected |
| Role-aware application views | Navigation and Operations cards are static prototype sections; player/cross-checker/director views are not connected to server-enforced capabilities | server authorization and independent-session UI tests for each role and self-check denial |
| Corrections and disputes | Operational correction workspace and immediate/pending approval policy lifecycle exist for the supported Standard Singles slice. A general dispute/judge workflow, real-role browser proof, two-connection concurrency proof, and published-result supersession remain absent. | append-only correction and dispute integration tests, including self/role/published-result rejection paths; a two-connection race exercise; result-version/supersession tests |
| Offline/hybrid path | The protected app now has a local-only sign-out and shared-device-clear boundary that removes app retry/registration state and requests browser cache/storage clearing. Authenticated offline queue, replay, and hybrid/paper operational workflows remain absent. | real HTTPS browser sign-out/Back/Forward exercise; offline/reconnect/forgery/replay tests and a simulated paper/dead-phone workflow |
| Event, finance, results, export | Flyer/event configuration, finance ledger/reconciliation, result publication/versioning, and `acc-results-v1` artifact are not implemented | rule fixtures plus end-to-end authorization/reconciliation/export tests |
| Operations rules | Seating/rotation, Consolation eligibility, Q-pool rounding, MRP/byes, and retention policy lack approved dated fixtures | approved ACC sources/fixtures or product gates that block official use |
| Operational readiness | Monitoring, backup-and-restore, rollback drill, required GitHub checks, incident procedure, and supervised simulated tournament have not been evidenced | recorded exercises and director acceptance |

## Non-blocking current decisions

- Preview uses only the Supabase Publishable key and project URL; no server/service key is exposed.
- The sign-in UI uses email OTP and rejects account creation. Leaked-password protection is not treated as a required paid feature while password login remains unavailable to the app; hosted Auth behavior still needs a release-time passwordless verification.
- Skunk/Double Skunk/Triple Skunk labels are approved player-facing aids. They do not change official game points, standings, or exports.

## Next implementation priority

Provision disposable test identities and one synthetic assigned game, then exercise the existing protected score-entry flow in two independent browser sessions. Record both the normal matching path and rejection paths (self/cross-account/closed event/replay). This closes a specific evidence gap without inventing ACC rules. It does not make the broader release blockers disappear; those remain explicit gates.
