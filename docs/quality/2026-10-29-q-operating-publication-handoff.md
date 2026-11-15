# Q operating schedules publication handoff

**Resolved:** the owner explicitly approved both exact actions at 07:05 UTC. Push and staging 0246 are verified; see [rollout evidence](2026-10-29-q-operating-staging-rollout.md). The denied-state text below is historical, not a current blocker.

Reviewed local commit: `be7d7e669afa86b9de304a7f1bf727c990332b8d`, 31 files, existing `codex/director-setup-journey` branch/draft PR122. Full989-test verification, audit/build/types/providers/workspace/handoff, 11 grouped phone/desktop browser checks, real isolated SQL/source/access/replay/legacy checks and actual overlapping writer/role races passed. Final tightened race also proves v2-first publication prevents legacy policy in the other correctly configured pool (`policy_frozen`). Independent review no P1/P2. All temporary databases/containers/servers/fixtures cleaned.

## Exact blocked action and state

`git push origin HEAD:refs/heads/codex/director-setup-journey` was rejected by automatic approval review **before process creation**. Reason returned: pushing to remote draft PR is an external commitment, and trusted supplied approval was judged to cover local verification retries rather than this exact remote publication. No push/retry/workaround occurred. Read-only reconciliation confirms remote branch still `362b83732dcf50599327e0ece3a961af193ba35d`, main unchanged `7b318e64ef15f769f7ac2219a3324da07ed3e8dd`. No exact-new-SHA CI or Git Preview exists yet. Local commit is preserved. Only unrelated historical notes remain dirty/untracked; none were included in the31-file commit.

Needed next authorization/evidence for the parent: explicit permission to non-force push this exact commit to the existing branch/draftPR122 and verify exact-commit CI plus normal Git-created test Preview. No merge/main/production or hosted migration permission is implied. Prior local access retry gates are resolved; do not ask to repeat those approvals.

## Separately proposed staging update

`0246_q_operating_schedules_v2.sql`: **19,616 bytes**, SHA256 **`B6DCB823CF86D4093404063203F273119C13C4D9C6DCF54DEB04D06B37D31944`**. No hosted application/registration attempted.

- Private forced-RLS, immutable tables: `app.q_operating_policies_v2`, `app.q_cut_attestations_v2`.
- Private trigger helper: `app.guard_q_operating_disclosure_v2()`, no public/anon/authenticated/service-role EXECUTE.
- New service-role-only RPC EXECUTE: `public.get_q_operating_workspace_v2(uuid,uuid)`, `public.save_q_operating_policy_v2(uuid,uuid,jsonb,uuid)`, `public.get_q_operating_reconciliation_v2(uuid,uuid,uuid)`.
- No human grants/direct service table access. Existing primary director authorizes policy/cut actions; actor-role/tournament/advisory locks and immutable operation/audit receipts protect concurrency/replay. No payment/refund/obligation/settlement writer introduced.
- Shared guards on old/new policies, receipts and membership prevent mixed policy domains, backdated payment and wrong disclosure acknowledgments for new v2 events. Existing legacy-only histories and current unpaid review remain unchanged.

Order: app-first is compatible with0245; absent0246 produces truthful disabled new screen/API while legacy paths remain usable. After separately approved migration, recheck exact staging ref `nnhcnvksxgxnpvdqjgpg`, hash/history/idle writers and authenticated isolation, apply once, then read-only SQL/ACL/RLS/owner/search-path/trigger verification and unchanged business counts. No business smoke write authorized. Roll back app Preview on compatibility failure; do not delete immutable data/operation history. Once v2 records exist, older clients fail closed and cannot manage them, so forward repair is preferred to destructive database rollback.

Director session is preserved at the existing unpaid-review page, showing one current unpaid batch and no unsent score/retry work. No password, sign-out, payment/refund or hosted business action occurred during publication preparation.
