> 2026-11-07 update: fresh protected backup/covered logical restore and exact candidate acceptance against its authentic292-entry history now PASS locally, including rollback/install293/repeat and cleanup. See docs/quality/2026-11-07-authentic-restored-candidate51.md. Older recovery/history-pending text below is superseded for the local gate only. No hosted installation, access or deployment occurred; provider and real-device acceptance remain unverified.

> Update: official local CLI full-candidate acceptance now passed. Read-only staging metadata and the exact proposed fresh recovery check are in 2026-11-07-staging-metadata-and-fresh-recovery-plan.md. Older runner-unverified wording below is superseded; staging installation remains held. No new backup has been created.

# Preparation-Only Staging Test Plan

2026-11-07. LOCAL CANDIDATE VERIFIED / HOSTED RELEASE HOLD. Supersedes the earlier broad plan preserved in `test-results/native-mixed-staging-plan-20261107.zip`. No hosted changes or access creation were performed.

## Verified target, read-only

Supabase **cribbage-pr122-staging**, project `nnhcnvksxgxnpvdqjgpg`, organization `dwvuityehfsjrgkkgcib`, region us-east-2, ACTIVE_HEALTHY, PostgreSQL17.11. Migration history ends at0292. Catalog inspection found no installed pilot/bootstrap functions. No tournament records were read. The user's saved draft `c029953d-7402-40bd-ac8c-c45b94e26921` is excluded and was not inspected or changed.

Vercel **cribbage-web-app**, project `prj_loMVGmwbqTNcxEOk3T0VBdg3kfEQ`, team `team_fTIlsRy2Vd3bohsVF1EfY7kO` (Cribbage App). Test alias:
`https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app`

Read-only inspection found READY preview `dpl_ZLLnTa7ChuWrGFwm2QoUksrYZkHU`, immutable URL `https://cribbage-web-7qqgxck4a-cribbage-app.vercel.app`, commit `ba2845a92a484ec66e360817709c5c6ed43aa296`, branch `codex/director-setup-journey`, repository `chocolatebananamalt/Cribbage-web-app`, target=null (preview). Project SSO deployment protection is enabled except custom domains; do not weaken protection for testing. Branch-scoped public Supabase URL matches the staging project. Existing publishable/server-secret metadata is present; secret values were not decrypted or printed, and usability was not assumed. Recheck all target facts immediately before a later rollout.

## Smallest demonstrated first test

Only Director preparation, six Digital players' own consent, and a different authorized paper checker. No draw, Start, scoring, Finance, payout or MRP operation in this stage. Use one separately approved TEST ONLY Main event with eighteen entries (six actual consenting Digital subjects, twelve explicitly fictional Paper entries), Standard12 and the tested $30 simulated entry amount. No real money or attendance claim. This does not claim support for the saved $50 multi-event draft.

Director URL: `/tournament/<new-test-tid>/rehearsal-participation/<new-test-eid>/director`.
Player URL: same path ending `/consent`.
Independent checker URL: same path ending `/paper-review`.

The full `/rehearsal-prepare` draw/Start screen is excluded from this code package. Each person uses their own account; no Director consent on another player's behalf, fake hosted Auth identities, automatic invitations or new credentials. Identify existing real account IDs, exact roles and a separate base event/roster before asking for activation. The package does not create that natively bound base event, accounts, roles or cohort. The six-human playing-official arrangement still requires explicit acceptance; the local proof's two nonplaying officials do not imply eight humans are required. Registration closure remains a distinct existing guarded action, not fabricated check-in.

## Exact local package — current 51-source atomic candidate

See `2026-11-07-native-mixed-preparation-only-package.md`, `native-mixed-bootstrap-only-inventory-20261107.json`, isolated overlay/build verification, and final min3 derived-schema/frozen manifests.

**23 changed code files** over ba2845a build successfully in isolation. Only the isolated candidate changes `bootstrapWorkflowEnabled` false to true; original workspace remains false. Post-build comparison found no other tracked file changed. Exactly four new routes exist: three bootstrap API routes and one three-mode participation page. No draw/Start/scoring/Finance routes are added. SSR rejects invalid modes/event IDs and renders unknown access without controls. No signed HTTP/browser claim.

The current locally validated conservative closure is **51 SQL sources**, reduced from57. See `2026-11-07-native-mixed-sql-closure51.md` and `test-results/native-mixed-closure51-report-20261107.json` for every source and dependency. The six cuts are the older pilot Director lease, preparation reader, draw reservation and status reader, plus the unrelated Custom Q bridge and combined-accounting extension. The Side guard/calculator/setup-column cluster, own/Paper binding sources and reviewed-seating security remain because of explicit or dynamic dependencies. This is not a globally minimum object-level schema.

The current local atomic transaction is `test-results/native-mixed-bootstrap-atomic51-20261107/closed-install.sql`, SHA256 `41000e612ade0fc36a6374bf6806f0ac13821fe0d18d9e1c2fc48660fbb6ce88`. It merges51 source bodies in one transaction and revokes execution on all379 new functions before commit. Raw proposals contain inline grants and separate commits; never apply them sequentially as a substitute. Injected rollback and second-connection invisibility passed. Official hosted migration transport still needs review to preserve the single-transaction boundary, without untested nested transaction behavior.

All five previously excluded accounting functions remain exact; the existing Q-policy constraints also remain unchanged. All781 existing function owners and ACLs are preserved. Two existing activation-trigger bodies still gain a narrowly guarded native-activation branch with old-body fallback: `app.require_event_prize_activation_pins_v1()` and `app.bind_prize_schedule_on_activation_v1()`. This is not purely additive. Remaining existing-table DDL adds a Side ratio column, expands Side-policy method/ratio constraints, and adds a simulation schedule-source method. Those coupled changes require explicit restored-staging review; do not describe the package as leaving every constraint unchanged.

There are118 new private tables and one identity sequence. Local checks cover RLS/table/column denials,379 function permissions, existing and new sequence privileges, ten actual denied RPC calls, preserved prior rows and30 preparation operations. No Finance/Custom-pool capability is authorized by this trimmed schema. Generate official migration records only after exact packaging/review; do not invent0293+ numbers or reapply hosted0237–0292. No hosted migration, grant or schema-cache reload has run. Source ZIP is not a recovery backup.
## Minimal access and enablement, later authorization only

No direct application-table access, anon/PUBLIC grants, or private/raw writer grants. Five RPC EXECUTE grants are sufficient for the tested first stage:

| Role | Function |
| --- | --- |
| authenticated | `public.get_native_mixed_bootstrap_session_v1(uuid,uuid,text,boolean)` |
| authenticated | `public.get_native_mixed_own_consent_offer_v1(uuid,uuid)` |
| authenticated | `public.execute_native_mixed_own_consent_v1(uuid,uuid,jsonb,boolean)` |
| service_role | `public.get_native_mixed_bootstrap_offer_v1(uuid,uuid,uuid,uuid,text)` |
| service_role | `public.execute_native_mixed_bootstrap_v1(uuid,uuid,uuid,uuid,text,jsonb,boolean)` |

These are role-level function permissions, not assignment of people to roles. Each call still requires the fixed staging project/issuer, current own subject/session, named event/actor scope and expiry, plus Director/checker authorization where relevant. Consent never constructs a privileged client. Do not grant the old raw consent writer.

Only bootstrap/admission/funding/attendance/own-consent SQL flags are enabled after approved scope configuration. Draw, Start, scoring and operational-activation flags remain false; nine installed Finance/award gates were observed false, broader Finance provider absent. The staging deployment marker is an owner attestation, not discovery of physical hosting. Actual PostgREST must validate signatures; injected local claims do not prove that.

## Required fresh recovery point

The successful pre0290 backup from **November4** (SHA256 `efb7dec6d2b45879a06818b008f24025e04eefa99405d78f12d4a64bd95ced75`) predates schema updates and user edits. Do not reuse it as current recovery proof.

After separate authorization, agree on a short no-edit window. Recheck target and CA/host, take a new owner-private PostgreSQL17 logical export with `sslmode=verify-full` and existing password entered privately through the supported native prompt. No password in chat, files, arguments or logs; no reset, credential creation, billing or security change. Use a fresh path/operation and require real exit0, size, SHA256 and complete archive TOC.

Capture current aggregate data fingerprints and schema/security/ownership/column-grant/RLS/trigger/extension/role-membership/sequence metadata privately. Restore all covered objects exactly once in isolated no-network/no-port/no-mount local PostgreSQL, compare tables and metadata, then exercise the exact candidate against that restored copy and legacy writer paths. Do not restore to hosted staging. Recheck source drift before installation; if anything material changed, refresh recovery and preservation baseline first.

Document exclusions: prior logical recovery did not prove operational Auth sign-in or external API/signing/provider configuration, Storage object bytes, off-device durability or production disaster recovery. Supabase's current backup documentation confirms Storage object bytes and custom-role passwords are not included in its database backups. Backups may contain sensitive data; keep them out of Git, Library and source artifacts. An owner decision is needed for any material recovery gap; no Auth/config/Storage mutation is included here.

## Later rollout sequence and recovery

1. Independently review final exact code/derived-SQL/grant/enable/disable manifests; generate official migration packaging and rerun scoped checks. The local isolated build/runtime proof is complete; these hosted-release gates are not.
2. Verify fresh recovery and current staging preservation baseline. Stop before migrations on failure or drift.
3. Only with later exact authorization, install reviewed schema with all new access closed/default-off. Verify object/ACL diff, retained five functions, migration history and preserved records.
4. Publish only frozen23-file candidate with its explicit isolated-tested enablement change to the same preview branch/alias. No main merge, production promotion, environment-secret change or protection weakening. Require CI and READY on exact commit. The denied local audit was not retried or claimed passed; CI's audit outcome remains an explicit check.
5. Under separate named event/account/role authorization, prepare exactly one native TEST ONLY base event and cohort, propose one-hour expiry, then apply only the five grants/required bootstrap flags. No enrollment of the saved draft, invitation or consent-for-another person.
6. Verify actual signed sessions, private responses and own/nonself roles, each preparation step, refresh/offline recovery, expiry and revoke/readiness behavior in supported independent browser sessions. Preserve unknown/pending bytes; no silent resend or redraw. Do not bypass the denied localhost browser access.
7. Stop writes while unexpired reads remain available for reconciliation. Settle pending work before scope/access expiry. Expiry blocks historical reads too; any same-event/actor recovery renewal must be explicitly bounded, never discard retained data.

Containment is disable pilot writes/app gate, preserve evidence and retained requests, and revoke only approved new grants as appropriate. Restore preview alias to old immutable deployment `dpl_ZLLnTa7ChuWrGFwm2QoUksrYZkHU` if needed. That restores the website only. Database rollback requires separately approved restore or forward repair using the fresh verified recovery package, with downtime and any writes after the backup accounted for. Do not drop evidence-bearing tables or blindly reverse migrations.

## Approval wording, not a current request

First: “May I take a fresh private backup of the test database and verify it in an isolated local restore? You would enter the existing database password privately. This would not install changes, publish, create accounts or move money. If recovery fails, I will stop.”

After exact packaging/recovery review: “May I install the reviewed preparation-only database package in cribbage-pr122-staging and publish the tested23-file candidate to the test preview only? The five existing accounting functions and Q constraints stay unchanged. Two guarded activation-trigger changes and the listed table DDL remain; all new execution permissions close atomically before commit and rehearsal access initially stays closed. Your saved setup and other tournaments will not be enrolled. Production and real money are excluded. Website rollback alone does not undo database changes.”

Then obtain separate activation approval naming actual new tournament/event IDs, existing accounts/roles, $30 simulated-only entries, one-hour expiry, exact five grants and flag hashes. Do not ask an open-ended enablement question without those details.

Current local readiness: package/build/preparation and five-function exclusion PASS. Hosted readiness: HOLD for fresh recovery, official migration/catalog/grant review, named base event/cohort and real provider/browser acceptance. No unresolved payout-policy choice blocks preparation-only; Finance/payout work remains outside this scope.

Sources: read-only connected Supabase/Vercel metadata, local frozen acceptance evidence, [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups). The changelog markdown endpoint was unsupported; no implementation change was based on an assumed changelog result.