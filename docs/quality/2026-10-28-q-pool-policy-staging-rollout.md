# Q Pool policy/preview staging rollout — 2026-10-28

Terminal outcome: approved Preview publication and staging migration verified. No policy, payment, refund, award, role or final settlement was created during rollout. No production change.

## Publication identity

- Exactly 21 reviewed feature/test/evidence files committed and non-force pushed to `codex/director-setup-journey`.
- Commit **4b424902b0fe274220b84263440067b5143671b2**. Parent/base **86a615d3f330f7308acd934d5c8a5ae8dd2bc87a**. Final remote branch matches.
- [PR122](https://github.com/chocolatebananamalt/Cribbage-web-app/pull/122) remains OPEN/DRAFT/unmerged. Main unchanged **7b318e64ef15f769f7ac2219a3324da07ed3e8dd**.
- Selected-file secret/private-path scan: 21 files, zero findings. Unrelated historical reports left unstaged. A trailing blank line in the browser test was removed after Git's staged whitespace check; syntax and staged inventory verified, no behavior or migration-byte change.
- Both exact-SHA CI Verify runs succeeded: push **40788649727**, pull request **40788654220**. Local evidence remains 955 tests, audit/build/types/providers/workspace; eight browser groups, three SQL/codec/calculator states, six real overlaps and final independent no-P1/P2 review.
- Normal Git-created Vercel Preview **dpl_74QrQ6UrNgACKr9bVMZBJ36LKZiL**, project `prj_loMVGmwbqTNcxEOk3T0VBdg3kfEQ`, team `cribbage-app`: READY, source git, target null/Preview, aliasError null, exact commit above.
- Immutable [Preview](https://cribbage-web-qhz3rzt15-cribbage-app.vercel.app).
- Assigned [stable branch Preview](https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app/).

## Isolation and preflight

Reconnected to existing Chrome tab 336434207; no stale-window inference. It showed the staging Q fixture, no unsent/retry records and no changed form values. Normal reload after READY served the new policy link, retained verified director `de0f27a1-60d0-4449-af83-fdf360a9bc08`, and freshly rendered exact staging QTest01/QTest02 membership/allocation/receipt state. No password entry or account switch.

Supabase metadata verifies **cribbage-pr122-staging / nnhcnvksxgxnpvdqjgpg**, ACTIVE_HEALTHY. Immediate preflight: postgres actor/CREATE authority; zero busy other clients; no 0244 table/RPC/history entry; latest 0243 unchanged. Business baseline captured before writes. No prior migration repeated.

## Migration exactly once

Applied only `0244_q_pool_policy_preview_v1` through supported `apply_migration`; success returned once. Stored migration:

- History version **20261028233957**, exactly one matching entry/one statement.
- **14,344 bytes**.
- SHA256 **18E282230472996B02D4E7A2999EDF54E675BEAD626AC6EE44B87A627C981550**, exact approved working bytes and stored SQL.
- Prior 0243 SHA256 remains **50B9C35E38EF56BE0540896D3AC3BD621FAA9D4C72081AB0CDDD131035E003FF**.

Catalog verification: policy table postgres-owned, RLS enabled/forced, anon/authenticated/service_role SELECT/INSERT/UPDATE/DELETE all false. All three new public RPCs postgres-owned SECURITY DEFINER/empty search_path, service_role EXECUTE true, anon/authenticated false. Private trigger helper has no client/service EXECUTE. Policy immutable trigger and receipt/election insertion triggers enabled with expected targets/functions. Zero unvalidated new constraints. Only the specifically approved backend API expansion; no new human access.

## Read-only hosted acceptance and invariants

New policy page loads through existing supported link. Earlier paid/started Q fixture correctly has publication disabled, missing-policy/qualification/acknowledgment blockers and no authoritative awards. It displays $5/$10 valid allocated contributions without reclassifying historical consent. No textbox/checkbox/Save was used. Server source digest matches SQL exactly: **e5b07f1b5fbddc9efa716a04000335b96be71f278bbe61c10913589304fc072d**. This verifies the new privileged reader against staging, not only static deployment metadata.

Policy table and policy operation receipts remain **zero**. Canonical capabilities `qPoolClaims:false`, `automaticPayout:false`; `settlement_award_blocked_v5` remains true for this Q event. No actual refunds, payouts or claims enabled.

Before/after and terminal counts identical: **8 tournaments, 13 roles, 24 payment events, 40 obligations, 4 expenses, 1 finalization, 412 scorelines, 2 Q membership versions, 3 Q allocation versions**.

Funded settlement workspace digest unchanged **52e148eb5ec6b84e998af2663aeb2197**. Scoped tournament row hashes unchanged:

- Funded ab275686: `6d2192029476d58404bc9dc7920f2543`.
- Negative c59f74ae: `72e82fac8fb40ee8f75f05941054b27b`.
- Q allocation 3cbae2fc: `75d85da7aecebd55223d0e7674c48675`.

Screenshot evidence: ignored `test-results/q-policy-staging-rollout.png`, `q-policy-staging-blocked.png`. Full-page CDP capture timed out without mutation; viewport capture succeeded. Director session remains on the read-only policy page with zero pending work. No Gmail, external messages, settings changes or production interaction.

## Advisory limits

Security advisor: existing authenticated-definer warnings 40 and leaked-password-protection warning 1; none of the three new RPCs appears in authenticated-definer warnings. New policy table appears in intentional [RLS without policies INFO](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy); catalog proves no direct client/service table access and RPC-only boundary.

Performance advisor: unindexed-FK INFO 190, including new `q_pool_policies_v1_tournament_id_fkey`; prior report 189. This is a covering-index performance recommendation, not an integrity/access failure for the empty policy table. New actor-index unused INFO is expected while empty. No extra index/migration was authorized or applied. Track the [FK index recommendation](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) in later performance work. Existing warnings remain release gates; this is not production certification.

## Next bounded step — not authorized by rollout

Prepare a new fictional **policy-before-payment** hosted acceptance fixture, preserving all existing paid fixtures because retroactive policy publication is correctly forbidden. Suggested compact design for independent validation before asking for business-write approval: eight paper entrants at $30 base; Q1 fee $5.01 with three full contributors including two finalized qualifiers (fund $15.03, previews $7.52/$7.51 by qualifying order); Q2 fee $10 with one nonqualifying contributor (refund obligation $10 only). Total fictional receipts $265.03. Both policies must be frozen before elections/receipts. No actual refund, payout or final settlement.

The deterministic qualification schedule/results and needed tournament-specific Cross-Checker role acceptance/binding must be planned and reviewed before execution. New fixture creation, synthetic receipts/results/policy records and any B nomination/attestation need separately scoped authorization; no prior role carries over automatically. This software test would not be sanction certification. Preparation can proceed read-only; no business action was taken here.

No rollback or user login was needed. Local evidence/status updates after this terminal report remain unpublished; no second commit was added to the approved 21-file release.
