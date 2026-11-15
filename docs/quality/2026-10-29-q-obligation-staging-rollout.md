> **Policy re-review hold — 2026-10-29:** Recipient selection restricted to paid playoff qualifiers and the no-eligible refund assumption are disputed pending original ACC formula/example verification. This document records earlier implementation/test evidence, not proof of ACC policy correctness. Preserve all unpaid history; do not execute payouts/refunds or continue settlement integration. See `2026-10-29-q-recipient-policy-dispute-hold.md`.
# Unpaid Q obligation review — Preview / staging rollout

2026-10-29. Terminal verified outcome. No Q obligations, financial records, role grants, payments, refunds or final settlements created. No production/main change.

## Publication

- Approved 21-file set only, zero secret/private-path scan findings. Three trailing blank lines and PROJECT_STATUS EOF whitespace removed; no behavior/migration change. Unrelated historical reports/private handoff/runtime artifacts excluded.
- Non-force pushed **362b83732dcf50599327e0ece3a961af193ba35d**, parent **4b424902b0fe274220b84263440067b5143671b2**, branch `codex/director-setup-journey`.
- [PR122](https://github.com/chocolatebananamalt/Cribbage-web-app/pull/122) remains OPEN/DRAFT/unmerged. Main remains **7b318e64ef15f769f7ac2219a3324da07ed3e8dd**.
- Exact-SHA Verify CI: [push 40807713189](https://github.com/chocolatebananamalt/Cribbage-web-app/actions/runs/40807713189) and [PR 40807721631](https://github.com/chocolatebananamalt/Cribbage-web-app/actions/runs/40807721631), both success.
- Normal Git Preview **dpl_JCnQG8YPKhh7nWYSANL9v37FcBTH**, READY, source git, target null/Preview, aliasError null, project `prj_loMVGmwbqTNcxEOk3T0VBdg3kfEQ`, team `team_fTIlsRy2Vd3bohsVF1EfY7kO` / cribbage-app.
- Immutable [Preview](https://cribbage-web-nv6s065wq-cribbage-app.vercel.app/); [stable alias](https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app/) resolves to that exact SHA/deployment.

## Isolation and exact-once migration

Existing Chrome tab 336434207 and director session preserved. Pre-reload UI had zero pending/retry records and no unsaved editable form. Reload completed through normal recovery guard; new director-only link appeared. Fresh privileged Q source digest matched rendered staging digest 54e66527a3c291224f6cca03088515857c772d8339d0ebaf9c840c143a8fad28. Only primary director for the fixture is de0f27a1-60d0-4449-af83-fdf360a9bc08 / pr122-director@test.invalid; no password entry or account switch.

Verified ACTIVE_HEALTHY **cribbage-pr122-staging / nnhcnvksxgxnpvdqjgpg**. Preflight postgres/CREATE authority, zero busy other client sessions, no 0245 objects/history; prior 0244 remains 14,344 bytes/SHA256 18E282230472996B02D4E7A2999EDF54E675BEAD626AC6EE44B87A627C981550. Captured count/hash for all 196 existing app tables (6,199 rows).

Applied only **0245_q_obligation_review_v1** once through supported apply_migration. History **20261029024527**, exactly one statement/entry, **17,058bytes**, SHA256 **05841725B4C6B4CF6F2CBF7E070EDD77100119A887087E14B13DE0540331894C**. All five actual stored function bodies also match approved source exactly.

Catalog: postgres owners; table RLS enabled/forced; no direct anon/authenticated/service-role table access; both helpers private; three public RPCs service-role-only; all empty search_paths; expected immutable before UPDATE/DELETE trigger enabled; all six indexes valid; zero unvalidated constraints. No existing writer/grant changed.

## Read-only acceptance and data invariants

Supported link opens new review page in the preserved director session:
- Correct current fixture e7bc6541-58b0-4465-8cde-3ccb7c2e6da6 / event ee058815-1b68-49e4-b117-ad827b3ac505.
- Q1 fund $20, proposed unpaid awards $6.67/$6.67/$6.66 to QPay02/01/04; Q2 fund $10, unpaid refund obligation $10 to QPay15.
- No recorded history, version 0, zero blockers. Reason blank, checkbox unchecked, Record button disabled. Automatic payouts/refunds/canonical Q settlement remain disabled.
- Fresh UI and server workspace source digest **392c3da81ffe67a151e0f6c23bd839c97430479c6d6376ab6e417a2f0c60a881** match. This expanded 0245 manifest differs intentionally from 0244 digest.
- Exactly **zero reviews, zero review operation receipts, zero review audits** after UI checks. No recording smoke write performed.
- Final counts and deterministic row hashes unchanged across **all 196 pre-existing app tables**; only added table is empty q_obligation_reviews_v1. Older fixtures therefore remain unchanged.

Read-only screenshot captured in task output. Browser remains on the review page, no form work entered. Detailed ignored evidence: `test-results/q-obligation-staging-rollout-evidence.json` (before/after all-table snapshots, exact deployment, catalog verification, workspace and advisors).

## Advisories and limits

Existing security warnings remain: 40 authenticated-definer findings and one leaked-password-protection warning; none of the new public RPCs is exposed to authenticated/anon. Intentional private no-policy RLS INFO now includes new table. Performance INFO: one additional composite event/tournament FK covering-index recommendation (191 total) and unused indexes expected for empty new table. No extra index/setting/migration applied. These remain tracked release/performance work, not evidence of a failed bounded staging rollout or production certification.

## Next separately approved acceptance

Record **one** fictional unpaid review batch in this existing fixture covering Q1 $20 awards (6.67/6.67/6.66) and Q2 $10 refund obligation, then verify exact source/version, one immutable history/audit/operation receipt and refresh persistence with unchanged receipts/allocations/scores. Existing director session suffices; no role acceptance or password handoff currently needed. No actual payout/refund, paid flag or final settlement. Source-correction business writes are separate and not needed for this smallest hosted pass; local SQL/browser tests already cover them. No such recording is authorized by this rollout.

