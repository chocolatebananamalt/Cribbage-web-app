# Meta release-readiness audit — 2026-09-09

## Purpose and evidence rule

This is a fresh, requirement-by-requirement meta review after the payment
recovery hardening changes. It distinguishes implemented and directly verified
boundaries from prototype-only displays and from work that is intentionally
not yet implemented. A successful build, Preview deployment, or mock screen is
not evidence that a tournament workflow is safe to release.

## Evidence inspected

- Current branch `codex/production-readiness-baseline`, commit `8f5bec1`.
- Repository static checks and production build run locally on Node 24.
- Pilot Supabase project schema/RPC catalog and security/performance advisors.
- Vercel project/deployment metadata and the current protected Preview shell.
- The normative requirement matrix in
  `docs/product/production-requirements.md` and the mandatory checks in
  `docs/quality/VERIFICATION.md`.

## Requirement coverage matrix

| Requirement | Current evidence | Honest status |
|---|---|---|
| `R-REG-01` registration/roster/payment/check-in/seating | Public claim, private review, roster promotion, manual receipt, append-only check-in, initial immutable Table/Seat, director-authorized account linking, and guarded Standard Singles enrollment boundaries exist. Player delivery, dynamic rotation, and real multi-session evidence do not. | Partial — release blocker |
| `R-ROLE-01` server roles | Protected routes and narrowly scoped RPCs derive identity from verified claims and tournament role. Real independent role sessions are absent. | Partial — release blocker |
| `R-OPS-01` rotation/eligibility | Prototype controls only; approved dated ACC scheduling/eligibility fixtures are absent. | Incomplete — release blocker |
| `R-SCORE-01` score derivation | Unit/rejection tests and private server RPC boundary cover 1–121, reciprocal lines, and 0/2/3 game points. | Partial — needs real backend/browser proof |
| `R-VERIFY-01` dual submission/confirmation | Server contract requires two independent matching submissions and two confirmations. | Partial — needs two real independent authenticated sessions and persisted assertions |
| `R-OFFLINE-01` offline/hybrid | Shared-device clearing exists; secure queue, reconnect/replay, and paper/dead-phone operation do not. | Incomplete — release blocker |
| `R-CORR-01` corrections | Append-only correction, immediate/approval policy, audit, retry and private workspace boundaries exist. Published-result supersession and real concurrency/browser proof do not. | Partial — release blocker |
| `R-RULE-01` judge/cross-check | Source-backed requirements exist; complete judge/dispute/capacity workflow does not. | Incomplete — release blocker |
| `R-BOUND-01` event formats | Standard Singles is the bounded digital slice; team scoring remains gated. | Partial — safely bounded, not full product |
| `R-RET-01` retention/recovery | No proven backup, restore, retention, or deletion/hold implementation. | Incomplete — release blocker |
| `R-EXP-01` ACC export | No approved `acc-results-v1` artifact/golden contract or tested export route. | Incomplete — release blocker |
| `R-FIN-01` finance/reporting | Immutable manual payment evidence is implemented; reconciliation, fees, Q-pools, payouts, expenses, attachments, reports, and finalization are not. | Incomplete — release blocker |
| `R-FINAL-01` event finalization | No authoritative finalization state machine ties verification, disputes, finance, results, and approval together. | Incomplete — release blocker |
| `R-FLYER-01` flyer | Review prototype only; no authoritative validated PDF/form workflow. | Incomplete — release blocker |
| `R-ATTACH-01` attachments | No classified, access-controlled attachment system. | Incomplete — release blocker |
| `R-UX-01` UX/accessibility | Current Preview displays the approved score-entry shell; real mobile, zoom, screen-reader, and older-player usability evidence is absent. | Partial — release blocker |
| `R-GUIDE-01` Start Here | Protected How To view exists, but the actual hybrid workflow it describes is not complete. | Partial — must be retested with the implemented workflow |

## New hardening finding and resolution

The review found that the new exact payment-operation recovery RPC coexisted
with an older three-argument `SECURITY DEFINER` overload. The old function was
role-gated and did not create a current disclosure, but it lacked exact
operation-type and request-hash binding. Migration `0044` revokes and drops it
without `CASCADE` after a pilot dependency check returned none. Direct pilot
catalog inspection now finds only:

`get_roster_payment_operation_reconciliation(uuid,uuid,text,text,uuid)`

It has an empty search path, denies `anon` execution, and permits only
`authenticated` invocation; the function itself checks the current
director/co-director role and exact scope. A focused Sol review agreed this
retirement removes a material future-misuse path.

## Deployment reality

- Vercel built commit `ecb9fb2` as a Ready **Preview** deployment on the
  reviewed branch. The protected Preview loaded the ACC Tournament Desk
  score-entry shell; Vercel reported no runtime-error cluster for the last
  seven days.
- The project remains `live: false`; its production domains still follow the
  separate `main` flow. This is correct for an unreleased pilot, but it means
  there is no production release to certify.
- Vercel reports framework auto-detection (`framework: null`) while builds
  successfully use Next.js 16. This is not an observed build failure, but the
  production promotion checklist must pin/verify the Next.js preset rather
  than assume the current auto-detection remains stable.
- Security-advisor warnings about RLS tables without policies are expected for
  private `app` tables whose direct client privileges are revoked. The two
  anonymous registration RPCs are intentional public intake endpoints; the
  authenticated `SECURITY DEFINER` warnings are individually role-checked
  narrow RPCs. The user-approved magic-link/no-upgrade decision leaves leaked
  password protection disabled; password login is not offered by this app.
- The performance advisor has no unindexed-foreign-key finding. Its unused
  index notices are expected on the empty synthetic pilot and are not a basis
  for index removal before representative-load testing.

## Executed checks

All passed after `0044`:

```text
pnpm lint
pnpm test                 # 48 passing tests
pnpm build
pnpm verify
pnpm verify:handoff
git diff --check
```

## Critical, non-waivable release blockers

1. Complete the server-authoritative tournament setup, check-in, and seating
   workflow using dated approved ACC fixtures.
2. Execute the supported Standard Singles normal and rejection paths in two
   independent authenticated browser sessions against disposable synthetic
   records, including persisted database assertions.
3. Build and test the offline/hybrid queue and paper/dead-phone flow; a local
   success indicator must never count as verification.
4. Implement authoritative results/versioning/export/finalization and the
   required finance/reconciliation controls; do not treat the prototype
   financial totals or results PDF as records.
5. Obtain/record approved fixtures for rotation, Consolation eligibility,
   Q-pool/MRP/payout logic, and the ACC export contract; block official
   calculations where a source remains unapproved.
6. Prove backup/restore, rollback, monitoring, required GitHub protection,
   accessibility at phone/desktop/zoom, and a director-supervised simulated
   tournament before a production promotion.

## Conclusion

There are no newly discovered P0/P1 defects in the implemented payment
recovery boundary after `0044`, but the app is **not production-ready**. The
remaining blockers are missing full-product capabilities and real-system
evidence, not items that a build or Preview can prove away. The next
implementation review must continue to close these requirements without
weakening their server-authoritative and audit boundaries.
