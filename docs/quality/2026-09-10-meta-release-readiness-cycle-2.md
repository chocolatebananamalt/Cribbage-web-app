# Meta release-readiness review, cycle 2 — 2026-09-10

## Scope and evidence rule

This is the requested meta review after focused review/fix/re-review cycles for
score verification, corrections, registration closure/check-in, seating,
enrollment, manual payment evidence, and exposed database functions. It tests
the current reviewed branch rather than treating a prototype screen, a green
build, or an earlier review as proof of an operational tournament system.

An item is **verified** only where the cited evidence proves its stated narrow
scope. **Partial** means useful server-authoritative work exists but required
workflow or real-world evidence is missing. **Blocked/incomplete** remains a
release blocker and is not softened by the healthy Preview.

## Evidence inspected

- Current branch head `d199abc`; changes are pushed to
  `codex/production-readiness-baseline`. Only user-owned ignored `tmp/`
  material is outside Git tracking.
- Current database migrations through `0086` were applied first to disposable
  synthetic project `donfxulkliuyteiannir`, then pilot
  `fnjkwymxpnsqvxtpronk` where applicable.
- Disposable live scoring sequence: two assigned matching submissions, first
  confirmation stays pending, a fresh duplicate confirmation is durably
  rejected, then the other assigned-player confirmation verifies the game.
- Pilot function catalog: relevant writers/reads are `SECURITY DEFINER` with
  empty `search_path`; no public-schema function with browser execution was
  found to have anonymous execute permission. Legacy enrollment and payment
  recovery signatures identified in the review are not authenticated-callable.
- Local checks after the review repairs: `pnpm test` (**114 passed**),
  `pnpm lint`, `pnpm build`, `pnpm verify`, `pnpm verify:handoff`,
  `git diff --check`, and `pnpm audit --prod --audit-level=high` all pass.
- Vercel built `d199abc` as Ready Preview deployment
  `dpl_EJsF2NoxeLKusrY7uUYCism5YPFZ`; build-error output is empty and the
  30-minute runtime-error cluster scan is empty. Vercel Authentication
  redirected the automated page fetch, so this is build/runtime evidence, not
  a substitute for browser workflow verification.
- Supabase security advisors were queried on the pilot. Their 43
  `rls_enabled_no_policy` information notices are expected for private `app`
  tables with forced RLS and revoked direct browser table privileges. The
  `SECURITY DEFINER` warnings correspond to the deliberately role-checked
  authenticated RPC boundary and remain individually reviewed; they are not
  an all-clear for unreviewed future functions. The unused-index notices come
  from synthetic/low-use data and are not grounds to remove integrity indexes
  before representative-load testing.

## Review findings and repairs in this cycle

| Finding | Repair | Verification |
| --- | --- | --- |
| A duplicate score-confirmation retry triggered a raw unique-constraint error. It did not alter a score, but could leave a player confused and an unresolved client envelope. | `0085_duplicate_confirmation_conflict_repair.sql` recognizes only the exact same-game/same-player constraint, writes the normal rejection receipt/audit, and returns `duplicate_confirmation`. The API and retry validators accept exactly that bound envelope as a 409. | Disposable execution, 114-test suite, focused high-risk re-review with no P0/P1. |
| An older five-argument payment-recovery RPC was still callable by signed-in directors despite the current app using a stricter identity-bound reader. | `0086_retire_legacy_payment_reconciliation_execute.sql` revokes all browser-role execution for only the unused signature. | Disposable and pilot catalogs show the retired signature has no anon/authenticated execute grant; active recovery remains authenticated-only. Focused review found no P0/P1. |

## Requirement-by-requirement status

| Requirement | Current direct evidence | Honest status |
| --- | --- | --- |
| `R-REG-01` registration, roster, check-in, seating | Private claim/review/promotion boundaries, manual payment evidence, atomic registration close, check-in closure guard, and immutable initial seating exist. | Partial — real registration lifecycle races, user delivery, and operational rotation remain required. |
| `R-ROLE-01` roles and identity | Verified claim checks, tournament-scoped roles, no direct private-table access, and narrow authenticated RPCs exist. | Partial — independent user sessions remain unproved; hosted Email/Password provider remains enabled outside the intended magic-link flow. |
| `R-OPS-01` rotation and eligibility | Registration must close before permanent starting seating; enrollment closes after seating. | Incomplete — actual rotations, partial-table/play-through handling, late/forfeit workflow, and dated ACC fixtures are not implemented. |
| `R-SCORE-01` Standard Singles derivation | 1–121 validation, reciprocal plus/minus, 0/2/3 points, append-only scorelines, and a synthetic persisted verification sequence are exercised. | Partial — real concurrent independent-session and browser workflows are still required. |
| `R-VERIFY-01` independent verification | Database requires two assigned submissions and two distinct confirmation actors; duplicate confirmation cannot satisfy it or mutate the result. | Partial — hybrid/paper entry and independent browser-session proof remain required. |
| `R-CORR-01` corrections | Immediate/approval policy, append-only values/audit, independent review, self-correction restrictions, and publication guard were inspected. | Partial — standings/result-version supersession and real multi-user execution remain required. |
| `R-RULE-01` judges/cross-check | Requirements and rule references exist. | Incomplete — dispute/judge/capacity workflow and dated test fixtures are missing. |
| `R-OFFLINE-01` hybrid/offline | Selected online operations preserve exact retry envelopes and shared-device clearing exists. | Incomplete — no authenticated offline queue, replay, dead-phone, or paper/digital operational workflow. |
| Paper capture/OCR | Security and human-review contract is documented. | Incomplete — no approved provider, restricted storage, capture/comparison interface, retention implementation, or device tests. |
| `R-FIN-01` finance/reporting | Private, append-only manual receipts/voids cannot imply paid-in-full or eligibility; unused recovery surface was removed. | Incomplete — fees, expenses, Q-pools, payouts, reconciliation, attachments, and reporting are not implemented. |
| `R-EXP-01` ACC export | Requirements define an internal director-assisted export boundary. | Incomplete — no approved fixture/schema, artifact generator, or reconciliation proof. |
| `R-FINAL-01` results/finalization | Requirements define gates and corrections cannot silently change published data. | Incomplete — no result versioning, finalization transaction, or publication workflow. |
| `R-FLYER-01`, `R-ATTACH-01` | Prototype/design requirements only. | Incomplete — no authoritative flyer PDF or classified attachment system. |
| `R-RET-01`, `R-UX-01`, `R-GUIDE-01` | Restricted-hold policy and guidance intent exist; Preview shell has baseline static checks. | Incomplete — backup/restore/rollback/monitoring drills, phone/desktop/zoom/screen-reader evidence, and supervised older-player usability tests are absent. |

## Current non-waivable release blockers

1. Disable or otherwise formally verify the hosted password grant is not an
   active alternative sign-in path; then run a no-account authentication probe.
2. Obtain dated ACC fixtures and build the server-authoritative rotation,
   play-through, dispute/judge, qualification, payout, and reporting rules.
3. Build and test the hybrid/offline/paper evidence workflow, including
   authenticated replay and independent player actions.
4. Build results versioning, finalization, reconciliation, the private finance
   ledger, and director-assisted export as one audited system.
5. Execute independent authenticated browser sessions, race/reconnect tests,
   backup/restore and rollback drills, monitoring validation, accessibility
   tests, and a director-supervised tournament simulation.

## Conclusion

No unresolved P0/P1 defect remains in the implemented paths reviewed during
this cycle. The app is **not production-ready**: the blockers above are
missing required capabilities and real-world verification, not optional polish.
This review is evidence that the existing boundaries are safer than before; it
is not evidence that an ACC tournament can yet be run or reported officially.
