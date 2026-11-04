# Q operating schedules Preview and staging rollout — verified

Owner separately approved exact commit publication and staging0246 application at2026-10-29 07:05UTC after the earlier push rejection. The one scoped supported push retry succeeded; no bypass or force push. No further application implementation was added during rollout.

## Publication

- Commit `be7d7e669afa86b9de304a7f1bf727c990332b8d`,31 reviewed files, existing `codex/director-setup-journey` branch.
- Draft[PR122](https://github.com/chocolatebananamalt/Cribbage-web-app/pull/122) remains open/draft/unmerged.
- Exact-SHA Verify CI[push40833323010](https://github.com/chocolatebananamalt/Cribbage-web-app/actions/runs/40833323010) and[PR40833330064](https://github.com/chocolatebananamalt/Cribbage-web-app/actions/runs/40833330064) both completed successfully.
- Normal Git Preview `dpl_7eR6DUvjD8SjARvYDwULsBMZgTpd`,[immutable URL](https://cribbage-web-h0qdiymda-cribbage-app.vercel.app/), READY/sourcegit/targetnull, exactSHA/branch verified. No production deployment/promotion.
- [Stable alias](https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app/) points to that deployment, aliasErrornull. Project `prj_loMVGmwbqTNcxEOk3T0VBdg3kfEQ`, name `cribbage-web-app`, team `team_fTIlsRy2Vd3bohsVF1EfY7kO`.
- Main remains `7b318e64ef15f769f7ac2219a3324da07ed3e8dd`.

## Staging application and access proof

Target verified ACTIVE_HEALTHY: `nnhcnvksxgxnpvdqjgpg`, `cribbage-pr122-staging`. New objects/history absent and zero app-writer locks immediately before application. Existing privileged fixture and preserved authenticated director-only page were verified on the exact stable Preview first; no password or sign-out action.

Applied only `0246_q_operating_schedules_v2` once, history **`20261029071013`**, statementCount1. Stored source exactly19,616bytes / SHA256 **`B6DCB823CF86D4093404063203F273119C13C4D9C6DCF54DEB04D06B37D31944`**. All four stored function bodies match the reviewed file byte-for-byte.

Both new tables `app.q_operating_policies_v2`, `app.q_cut_attestations_v2` ownedpostgres with RLS+forcedRLS; zero PUBLIC/anon/authenticated/service_role direct table grants. Three public RPCs ownedpostgres, SECURITYDEFINER with empty searchpath; onlyservice_role has EXECUTE, anon/authenticated denied. Private guard function denied evenservice_role EXECUTE. All six new immutable/disclosure/exclusivity triggers enabled. No human grant, credential, security setting, unrelated index or migration change.

## Read-only acceptance and preservation

Existing tournament `e7bc6541-58b0-4465-8cde-3ccb7c2e6da6`, event `ee058815-1b68-49e4-b117-ad827b3ac505` used for read-only checks. New screen loads actual server-backed16-card workspace, source `2a4f70b7f5dfc2c73f837b881a8f92bc66f1c9c8f187b935e3b93d965fb1235c`. Existing legacy policy correctly yields `legacy_policy_preserved`/canPublishfalse; no retroactive reinterpretation. Graduated method and exact$10/1-in-6/page2 and$10/1-in-4/page5 catalog options visible; publish remainsdisabled. Only local dropdown choices were changed, no disclosure/consent/cut/save action. Director session/no-pending-recovery status preserved.

Old unpaid review `b5576ce8-7a59-4de5-a984-ce37f7645f2d` remainscurrent/version1/historyCount1, source `392c3da81ffe67a151e0f6c23bd839c97430479c6d6376ab6e417a2f0c60a881`, rowMD5 `4453f940dc6d9715c1f5cf1b2d8210b8`. Its$6.67/$6.67/$6.66 and$10 unpaid obligations remainunchanged. All197pre-existing app table rowcounts/contentMD5 fingerprints match before/after (6,202 rows). Only two empty new tables added; policies0/cuts0. Thus no operation receipt/audit/role/financial/scoring/qualification/finalization business writes occurred. Existing other fixtures including funded and negative rehearsals are covered by the same all-table comparison.

Evidence: ignored `test-results/q-operating-staging-rollout-evidence.json` contains deployment/catalog/function-body comparisons and complete before/after table fingerprints. Prior full989-test/local SQL/observed races/11browser groupedchecks and independent review remain in[local evidence](2026-10-29-q-operating-schedules-progress.md). No claim of new hosted graduated elections/receipts/cuts/awards or actual physical play/money.

## Advisors and limits

Two new[private RLS/no-policy INFO](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) findings are intentional because direct table access is revoked. Existing authenticated-definer40WARN and leaked-password1WARN unchanged; no new Q function is authenticated-executable. Existing[unindexed-FK INFO](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) remains191, no new related finding. Six new[unused-index INFO](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) observations reflect empty tables, not failed invariants. No settings/index follow-up applied. Supabase changelog markdown fetch returned unsupported-content-type; no undocumented API change was inferred.

## Next bounded acceptance proposal — not executed

A fresh fixture is required to demonstrate hosted graduated rank-down; the preserved fixture has only4/1 paid entrants and frozen v1 disclosures. Proposed next user-approved scope: sixteen synthetic entrants,12 paid$10graduatedQ members drawn from nonqualifiers, yielding exactchart12 $75/$45 to the highest-ranked paid nonqualifiers; optionally one$10equalQ nonqualifier demonstrating unpaid refund preview. Reuse reviewed96-game synthetic schedule only with explicit new-fixture/ledger/role/binding approval and user-operated B acceptance/password handoffs. Exact base fees/budget must be approved before records. No actual payments/refunds, new unpaid obligation batch, playoffs or final settlement are implied by this rollout.
