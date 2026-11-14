# Q Pool and photo recovery Preview rollout

Approved staging-only publication/application completed 2026-10-28. No fictional business records were authorized or created during rollout.

## Publication and deployment

- Existing branch `codex/director-setup-journey`, commit **86a615d3f330f7308acd934d5c8a5ae8dd2bc87a**, 32 reviewed files. Non-force remote push verified. Three unrelated earlier local reports excluded. Publication scan found zero secret/private-path matches in the selected files; no credentials or private handoff artifacts included.
- [PR 122](https://github.com/chocolatebananamalt/Cribbage-web-app/pull/122) remains OPEN/DRAFT, unmerged. Main remains `7b318e64ef15f769f7ac2219a3324da07ed3e8dd`.
- Both exact-SHA Verify checks succeeded: push **40755602448**, pull request **40755613485**. Matching local final verification: 948 application tests, audit clean, lint zero errors/two existing warnings, build/types/providers/workspace pass with one unavailable private-handoff skip; 13 local photo/offline browser groups and independent review passed. No source change occurred between those checks and publication.
- Normal Git-created Vercel deployment **dpl_FA1dEcqGXuzNgXN8AmWLhect7vFE**, project `prj_loMVGmwbqTNcxEOk3T0VBdg3kfEQ` / `cribbage-web-app`, team `cribbage-app`, source git, target null/Preview, READY, aliasError null.
- Immutable Preview: **https://cribbage-web-1mh44zrbb-cribbage-app.vercel.app**.
- Assigned stable alias: **https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app/**. Exact deployment metadata includes that alias and commit. Newly loaded Q route confirms the new app is served. No direct redeploy, promotion or settings change.

## Isolation and migration

Before application, current Chrome stable tab 336434207 showed the saved finalized staging settlement and zero pending recovery work. Normal reload retained access. Rendered server payload contained verified director profile `de0f27a1-60d0-4449-af83-fdf360a9bc08`, not B. Fresh privileged settlement data matched the isolated staging fixture and its exact saved ledger/digest; no password entered or sign-out attempted.

Staging project **cribbage-pr122-staging / nnhcnvksxgxnpvdqjgpg** had no Q migration/table and zero other active clients on both baseline and immediate preflight. Previous latest migration was 0242 / `20261027232713`. Applied only `0243_q_pool_membership_v1` once through supported apply_migration. Tool confirmed success; history now has exactly one entry:

- Version **20261028193819**.
- Stored statement count **1**, **26,580 bytes**.
- Stored SQL SHA256 **50B9C35E38EF56BE0540896D3AC3BD621FAA9D4C72081AB0CDDD131035E003FF**, exactly the approved working-file bytes. Git normalizes repository text line endings; application used and history preserves the approved raw SQL bytes.

Catalog checks: both new private tables postgres-owned, RLS enabled/forced, no direct SELECT/INSERT/UPDATE/DELETE for anon, authenticated or service_role. Immutable update/delete triggers present; zero unvalidated new constraints. All three public RPCs postgres-owned SECURITY DEFINER with empty search_path, executable only by existing service_role among those client roles. Two private helpers are not executable by anon/authenticated/service_role. No human role or credential was created. New table counts remain membership **0**, allocation **0**.

Automatic settlement payout and Q claims remain **false** in the authoritative settlement capabilities. No older migration reapplied, existing writer replaced or privilege broadened beyond the specifically approved three backend-only RPC grants.

## Read-only hosted smoke and invariants

- Funded fixture `ab275686-6349-40e3-8771-bdfb1fe18f65`: new Q page loads its $30 base and truthfully reports unsupported because no positive Q fees are configured. No attempt was made to change that finalized event.
- Existing mixed fixture `4daf7893-1d97-48b3-a97e-09d094a11ea6`: supported Q page loads $20 base and $5 named pool for both existing entrants. Membership/allocation versions remain zero. Late first elections and first allocations are disabled with explicit pre-play-history wording; existing receipt/obligation values display in dollars. No checkbox, input or Save action was used.
- Actual photo-recovery interaction remains local acceptance evidence. No image was uploaded or new photo metadata created in staging during this rollout.
- Director session preserved on the mixed Q page, no pending recovery records. Screenshot: ignored `test-results/q-photo-rollout-smoke.png`.

Before/after business counts are identical: 7 tournaments, 12 role rows, 20 payment events, 38 obligation versions, 4 expenses, 1 v2 final settlement, 412 scorelines, 0 photo captures. Funded tournament row hash remains `6d2192029476d58404bc9dc7920f2543`; negative fixture row hash remains `72e82fac8fb40ee8f75f05941054b27b`. Full funded settlement workspace digest remains **52e148eb5ec6b84e998af2663aeb2197**, matching prior validated $480/$216/$264/$0 and $408 return evidence. These are bounded counts/fingerprints, not a claim to hash every unrelated database row.

## Advisory review

Security advisor reports existing authenticated-definer warnings (40) and disabled leaked-password protection (1); no new Q RPC appears in the authenticated-definer findings. Private RLS-with-no-policy INFO includes the two Q tables, consistent with intentional RPC-only access and verified no client DML grants. No policy was added to suppress it. [RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [definer warning](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password-protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Performance advisor lists 189 unindexed-FK INFO findings (none on new Q tables) and unused-index INFO on empty new Q tables among existing indexes. These are not an authorization/data-integrity failure for this bounded smoke; no index or setting change was authorized or performed. [FK notice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys). They remain release review items; this is not production certification. Changelog markdown fetch was unavailable through web due unsupported content type; supported migration tool guidance and actual catalog/history checks were used, with no new SDK assumption or install.

## Next bounded approval

Recommend a NEW clearly TEST ONLY two-paper-entrant fixture, one Main, base $30, Q1 $5 and Q2 $10. QTest01 explicitly elects both (owed $45); QTest02 declines both (owed $30). Record fictional cumulative receipts $37.50 and $30, allocate QTest01 $30/$5/$2.50 to prove partial status. Void/replace its cumulative receipt with $45 (not an additional $45), then allocate $30/$5/$10: final synthetic ledger $75 = base $60 + Q funds $5/$10. Finish pre-play records, test the start lock and reasoned same-source corrections; record an expected rejected late-first-election attempt. No scores, Q payout, final settlement, real money, new account or official role is needed for this foundation test.

Approval must explicitly cover that new fictional setup/start, elections/obligations, receipt/void/replacement/allocation and expected rejection records. It is separate from this completed rollout and is not inferred from “continue.” Current director session can handle the initial scope without a new login; any later distinct-official access test needs its own accepted tournament role. Payout formula/tie/remainder policy remains unimplemented and separately reviewed.

No rollback or user intervention was needed. Production, existing fixtures and business records remain untouched; no Gmail or other communication source was accessed.
