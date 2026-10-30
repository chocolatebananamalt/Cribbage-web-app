> **Policy re-review hold — 2026-10-29:** Recipient selection restricted to paid playoff qualifiers and the no-eligible refund assumption are disputed pending original ACC formula/example verification. This document records earlier implementation/test evidence, not proof of ACC policy correctness. Preserve all unpaid history; do not execute payouts/refunds or continue settlement integration. See `2026-10-29-q-recipient-policy-dispute-hold.md`.
# Next Q slice: auditable obligation review, no money movement

2026-10-29. Read-only architecture assessment after successful 16-player hosted acceptance. No application behavior, migration, permission or hosted business data changed. Existing director session and fixture preserved.

## Recommended bounded outcome

Add an explicit director action **Record reviewed Q obligations** for the existing single Standard Main, Equal paid-qualifiers policy, no Side Pools/byes scope. Save one immutable event-level revision covering every configured named Q pool atomically, with rows tagged award obligation or refund obligation. Display **recorded, unpaid** and current/stale status, printable audit summary and revision history. This is an accounting liability record, not a payment receipt, external transfer, refund execution, regular playoff prize, ACC sanction certification or final tournament settlement.

The verified fixture would record Q1 obligations 667/667/666 cents to QPay02/01/04 and Q2 refund obligation 1000 cents to QPay15; base income 48000 cents remains separate. Total Q funding 3000 cents equals total Q obligations 3000 cents. No synthetic hosted recording is authorized by this planning task.

## Evidence and why this is a new slice

- `src/lib/results/q-pool-preview.ts`: deterministic read-only TypeScript `previewQPools`; funds all valid full contributors, awards only fully funded finalized qualifiers, ordered remainder, no-eligible refund obligations. The mutation must not trust caller-supplied amounts or this browser preview as authority.
- `database/migrations/0244_q_pool_policy_preview_v1.sql`: immutable disclosed exact-pool policies and authorized source reader. Digest covers context, workspace, policies, finalized qualification record and complete membership/allocation/payment/obligation histories. Reuse as a conservative change detector; it may invalidate after unrelated historical additions, which is safe but should be explained rather than silently refreshed.
- `src/lib/api/settlement-v5.ts`: exact contracts require capabilities `qPoolClaims:false`, `automaticPayout:false` and `noQPoolClaimsRecorded:true`. `database/migrations/0240_versioned_settlement_v5.sql` has `app.settlement_award_blocked_v5`, positive-Q guard, source/ledger currentness, conservation, cross-check/dispute and sanctioning evidence checks. These remain enabled in the proposed slice. Do not drop Q obligations into `prizeClaims` or falsify its no-Q attestation.
- 0243 writers and qualification/payment writers lock tournament/roles plus operation scopes. A new writer must coordinate with these actual locks; a preview hash alone does not prevent concurrent source changes.

## Local design acceptance

1. Backend recomputes all obligations from freshly authorized canonical sources in the same transaction. Implement a reviewed SQL calculator or equivalent transaction-owned canonical validator with exhaustive parity tests against current TypeScript calculator; reject supplied recipient/amount tampering. No client-controlled paid or final state.
2. Bind immutable tournament/event, exact pool-version and policy IDs, calculator version, qualification ID/version, participant/roster identities, allocation/membership IDs/versions, obligation and receipt IDs/versions, contributor funding manifest and source digest. Labels are snapshots, never lookup keys. Store integer minor units and render dollars.
3. Actor is verified current director under existing supported authority; no new human role or cross-checker finance access. New private append-only revision and detail storage plus service-only write/read/reconciliation RPCs require local schema design and separate staging access review. No direct browser table access or broad legacy grant changes.
4. Use existing operation receipts/audit/recovery coordinator patterns: stable operation ID, request hash, expected review version and exact source digest. Same retained request returns original result; same ID/different request conflicts; uncertain responses reconcile before retry. An operation receipt never means payment received. No automatic submission after reconnect.
5. Transaction locking must serialize against source writers: inspect current lock order, acquire relevant tournament/event/policy/qualification/allocation/receipt locks consistently, then recompute currentness and hash. Different concurrent requests with one expected version produce one accepted revision and one explicit conflict. Qualification disputes, changed rules/policy, partial/stale allocations, voids, removed contributors, unsupported formats or ambiguous rankings fail closed.
6. Enforce per-pool `fund = award obligations + refund obligations` exactly; the two dispositions are mutually exclusive under current policy. No retained pennies, cross-pool borrowing or base-fund subsidy. Existing approved remainder-by-qualifying-order and zero-eligible refund rules stay unchanged. Base 85% denominator excludes optional Q receipts/obligations; do not count a $35 receipt as $35 base plus another $5 Q.
7. Correction history is append-only: a changed source makes the prior review stale immediately. Director explicitly records a reasoned superseding review against new sources/version; never silently edits or recalculates old rows. Latest valid review is the active liability; superseded reviews are history, not additional liabilities. Because this slice has no paid/discharged state, it cannot correct or net out real paid amounts. That later lifecycle requires separate design.
8. No canonical settlement completion in this slice. A read-only settlement page may link the separate Q review with clear unsupported-finalization status, but existing v5 contracts/guards remain untouched. A later versioned canonical settlement adapter must partition funding globally, consume each allocation slice once, bind exact Q review versions, reject stale reviews and reconcile base/prizes/expenses/Q liabilities before finalization. Historical v5 records remain readable and unchanged. Do not infer that merely saving this review enables settlement.

## Test plan before rollout readiness

- Golden accepted hosted-fixture replica: $510 receipts = $480 base + $20 Q1 + $10 Q2; 667/667/666 awards and 1000 refund liability, no transaction/prize/expense record.
- Boundary/property tests: zero members, one recipient, all paid qualify, nonqualifier funding, qualified nonmember exclusion, odd cents, safe integer limits; exact conservation and deterministic TS/SQL parity.
- Authorization/cross-tournament/identity/unknown-field and tampered-amount rejection; service-only ACL/RLS/owner/search-path audit; unchanged legacy settlement and unsupported Q finalization tests.
- Real isolated SQL races: receipt void/replacement, allocation or membership correction, qualification replacement/dispute versus save; two overlapping revisions; exact retry and changed-payload conflict. Prove no stale accepted revision, duplicate active liability or inconsistent cross-pool snapshot.
- Recovery/browser: phone/desktop, interrupted/repeated save, server success/lost response using retained exact request, check status, reload, pending-work account-switch protection, stale-tab review and explicit reasoned supersession. No real credentials or external financial/OCR service.
- Current source regression tests executed: bundled Node `--test tests/q-pool-preview.test.mjs tests/q-pool-policy.test.mjs`: **7 passed, 0 failed**. These prove existing preview/guard boundaries only; none of the proposed persistence has been implemented or tested.
- Implementation would require full repository verification, independent high-risk design/code review and isolated database/browser proof. No expensive full suite needed for this documentation-only assessment.

## Decisions / approval

No further equal-share formula, penny or no-eligible policy decision is needed: those were approved and tested. The actual next decision is to authorize LOCAL implementation/testing of an unpaid, auditable Q obligation-review record, leaving money movement and canonical final settlement disabled. Suggested wording:

> May I implement and test locally the ability to record reviewed Q award and refund obligations as immutable, unpaid records, with exact source locking, duplicate protection and reasoned correction history? This would not move money, mark anything paid, enable final Q settlement, publish changes or alter staging/production.

Approval for local implementation does not approve future private-table/RPC rollout or hosted test writes; return exact reviewed migration/ACL/file scope separately. If user instead requires complete Q tournament finalization immediately, that is a materially larger versioned settlement integration and should receive its own concrete scope rather than silently expanding this slice.

## Remaining project gates

Actual award/refund discharge/payment evidence and reversals are unimplemented, as is canonical Q settlement. Graduated/reduced methods, disputed qualification, supported byes/other formats and external ACC reporting remain separate. Photo/OCR with reviewed corrections, multi-device/offline stress, backup/restore/rollback and existing security/performance advisories remain release gates. The successful synthetic 16-player event is not ACC sanction eligibility proof and must not be finalized merely to exercise this plan. No access or infrastructure blocker prevents local design; the next gate is scoped implementation authorization.
