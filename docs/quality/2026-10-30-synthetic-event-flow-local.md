# Truthful synthetic event flow — local extension 0267

## Scope and status

Local implementation only. No hosted enrollment, migration, scoring retry, commit, publication, or production action was performed for this extension. The earlier 15 hosted games and all existing records are untouched. This extends the verified 0266 paper-card slice; it does not turn generated records into physical play or human review.

See `2026-10-30-synthetic-flow-attestation-inventory.md` for the complete attestation inventory and excluded branches. Source backup version 19 predates this extension; the integration lead owns the next verified backup. The aggregate verification completed with 1,122 application tests, build, security audit, provider and workspace checks; the later narrow simulated-playoff success wording was rechecked with focused contracts and the browser harness.

## Security and evidence

0267 adds two private, forced-RLS, immutable tables: `app.synthetic_event_artifacts_v1` and `app.synthetic_event_provenance_v1`. Four service-role-only RPCs expose the scoped context and three explicit normal-workflow wrappers: `get_synthetic_event_context_v1`, `save_synthetic_qualification_tie_v1`, `record_synthetic_playoff_v1`, and `close_synthetic_event_v1`. No human grants, payment writers, generic SQL dispatcher, fixture enrollment, or artifact records are seeded. Owner-only artifact preparation is not granted to service-role or browser roles.

The existing 0266 exact staging runtime gate and private enrollment are required. An ordinary or unknown deployment cannot enable simulation via a request flag, name, or query. Every event-specific UI checks its exact enrolled event ID; ordinary sibling events keep their normal requirements. Tournament-level banners identify enrolled IDs explicitly.

Generated tie, playoff and closure artifacts bind immutable UTF-8 text/SHA-256, event, exact source digest and typed decision. H2H winners still come from canonical qualifying evidence. A simulated manual playoff changes ranking only. Four simulated playoff series preserve three separate bye credits and original qualifying totals. Closure records distinguish 102 verified games from structured synthetic evidence and legacy history without structured proof. No historical record is relabeled.

Fresh simulated financial rows require the stable `TEST ONLY SYNTHETIC:` memo, exactly one active event that is the enrolled Standard Main, and receipt roster membership in that event. New-row-only provenance links the original operation receipt, entity and exact record hash with `actual_money_received`, `physical_play`, `human_review_claimed` and `money_moved` all false. A failed annotation rolls back its business row and accepted receipt atomically; the canonical writer may retain a rejected-operation receipt. Old accepted replays never backfill provenance.

Actual funding, void and disbursement paths are unavailable in enrolled mode. The $285 upward-rounding example requires a real $4.50 funding source and remains unfunded; no simulated received contribution is fabricated. Both intended fresh hosted budgets legitimately round down to $280 because $160 of eligible benefits makes participant return $440, above the $433.50 minimum.

Migration 0267 is 30239 bytes; SHA-256 `1800E7E8B276F9E318BB0AD47D98688766C988C21393C2965F48BD14A2FEE57B`. Final enrollment hardening changes 0266 to 23037 bytes, SHA-256 `779DBF95973667E32F4BD4FAB7483968AEC40E224553223D5E641973DEA6EE41`; it now rejects unresolved roster mappings, not only known non-paper rows. The verified CLI-generated scaffold is byte-identical. Stage schema must precede app deployment; a missing context RPC fails closed. Existing data is not rewritten; rollback must preserve immutable evidence/history rather than delete it.

## Recovery

Tie and playoff requests retain their canonical envelopes and reconciliation. Synthetic close adds an actor/tournament/event-bound recognized recovery key, guarded storage writes, exact request retention through reload and same-operation recovery. Wrong-event, reopened, malformed or inconsistent-HTTP responses do not clear retained work. A conflicting envelope is never overwritten. Accepted exact wrapper replays remain recoverable after later lifecycle/source changes; changed same-operation payloads conflict. Normal production close behavior is unchanged.

## Verification evidence

- Five focused codec/API/security tests passed, including an old accepted close POST routed through the enrolled wrapper with null artifact.
- Scoped ESLint and source TypeScript passed after deferred, exact-key-bound closure hydration.
- Headless API-intercepted acceptance at localhost 3273 passed: phone/desktop playoff layout, four simulated series/three byes, manual and H2H tie evidence, missing/stale evidence blocking, exact close recovery after lost response/reload, wrong-event/reopened/500 outcome retention, ordinary sibling wording, ordinary Add Expense label/payload versus simulated expense/prefix, and blocked funding/void controls. This is browser/API-contract testing, not hosted backend acceptance.
- The corrected expanded real isolated SQL run passed both full 17-player workflows, canonical H2H and manual tie paths, observed-lock close/tie races, raw-path/forged-evidence rejection, revoked-role replay, old accepted-request recovery, atomic provenance rollback and ordinary non-enrolled void behavior. Evidence: `test-results/synthetic-event-resumed-final-sql.log`. The final adversarial receipt fixture now starts with a populated receipt and asserts the exact scope guard; it no longer fails earlier on a null fixture field. No application guard was weakened. The disposable database and exact task-created container were removed; absence was verified.
- No-Q fixture: 102 verified games (15 unchanged legacy records, 87 new structured synthetic), manual ranking tie, five qualifiers, four simulated series, three byes, v8 unpaid accounting. $510 receipts = $229.50 expenses + $280 prizes + $0.50 restricted residual. Regular prizes: $95/$70/$45/$45/$25.
- Q+Side fixture: 102 new structured synthetic games, five qualifiers, four simulated series/three byes, v9 unpaid accounting. All 17 pay $30 base + $10 Q + $10 Side: $850 = $229.50 expenses + $280 regular prizes + $170 Q + $170 Side + $0.50 residual. Each graduated 1-in-6 pool awards $85/$55/$30. There is no extra equal pool or refund in this fixture.

The disposable SQL runner restores the verified empty baseline, applies local migrations only, uses the pinned reviewed image with no network, host mounts, published ports or privilege, and removes only its exact task-owned container. Generated browser app files are removed on exit. No physical-paper/camera field rehearsal, real money movement, hosted disaster recovery or production readiness is implied.

## Remaining gates

Expanded SQL evidence passed on the hashes above. Independent read-only review found no confirmed new P1/P2 defects and nine focused contracts passed. The final aggregate rerun passed: 1,122 application tests, dependency audit, lint, providers, production build and eight workspace checks (test-results/synthetic-complete-frozen-verify.log). The expanded curated manifest and private source backup package this verified milestone. Hosted migration/enrollment/artifact preparation/publication and resumed fictional scoring need separate exact authorization. Multiway/ambiguous qualification ties and unresolved Q cash ties remain blocked. Production and real disbursements are excluded.
