# Next staging authorization boundary

## 2026-10-30 execution checkpoint

The owner subsequently approved this rollout and explicitly reaffirmed0248-0255
after the first approval-review stop. Schema-first application is complete in
staging only:0247history20261030013509;0248=20261030025419;
0249=20261030025439;0250=20261030025447;0251=20261030025456;
0252=20261030025506;0253=20261030025515;0254=20261030025525;
0255=20261030025536. Each exists once and stored statement bytes/SHA match the
reviewed local file. All199oldapp tables/9,863rows unchanged;8newtables empty,
forcedRLS/owners correct,23serviceRPCs/private grants and18enabledtriggers pass.
No fixture/business/payment/refund/role records were created. Source/test/evidence
selection is now158files including the verified connectivity fixes, not the
earlier150. Approved branch publication and exact-release acceptance are next.

Advisor output is not a clean production certification: private RLS/no-policy
INFO is intentional, new composite-FK/unused-index findings are performance INFO,
and authenticated legacy security-definer/leaked-password-protection warnings
remain release-review items. New23RPCs deny anon/authenticated execution. No
settings/index changes were made. See Supabase's
[database lint guidance](https://supabase.com/docs/guides/database/database-linter)
and [password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The planning text below preserves the pre-approval boundary and remaining test
scope; it must not be read as a current instruction to repeat applied migrations.

Planning only. No publication or hosted action has occurred. The local base is
`c8ad2b4a8f948d9398e8681e7f58215c032d7d5d` on
`codex/director-setup-journey`, draft PR122. The generated proposed inventory
`test-results/balanced-q-proposed-publication-inventory.json` includes source,
tests, migrations and current milestone/reference evidence; older untracked
publication/hosted reports are excluded and preserved locally. Recheck drift,
secret/private-path scan and exact final selection before any commit approval.
This planning note and later backup receipts postdate the source archive; the
verified application code and tests are included in Library version3.

The next complete operational approval should cover a non-force publication to
the same draft PR/test Preview and checksum-verified staging-only migrations
0247–0255, with exact-commit CI/READY deployment, authenticated isolation and
read-only preservation checks. Target project is `nnhcnvksxgxnpvdqjgpg`
(`cribbage-pr122-staging`); its current baseline/history/queues/writers must be
rechecked before mutation. No production/main/merge, business fixture writes,
new roles/credentials/settings or disbursement belongs in this approval.

## Disclosed schema/access effect

The full stack adds eight private append-only tables: qualification tie
resolutions, Q v2 unpaid review, Q v6 draft/final, v4 playoff outcomes,
odd-field makeup mapping, and no-Q v7 draft/final. It adds 23 service-only RPC
entrypoints across those workflows and balanced-policy publication/reconciliation,
with current server-derived actor/role checks. Private helpers, RLS, immutable
history and domain/source/replay guards remain enforced. No new human table
grants or direct service-role table DML are proposed. Existing authenticated
member prize-summary readers also support the new five-person unpaid results,
using the same audience/access check and minimal award fields.

This is more than an isolated new-page change: source validation/finalization,
old/new accounting-domain exclusion and scorecard readers change across staging,
while applicability is event/source scoped. Unsupported or disputed cases may
block rather than silently accept incorrect history. Legacy read/history and
exact accepted replay remain preserved. No historical rows are recalculated.

## Compatible order and stops

Use a quiet staging maintenance window. Validate the exact baseline and all
reviewed file hashes first. The new app requires new RPCs for card-line context
and accounting, so do not serve its schema-dependent screens against the old
schema. Apply the additive stack in numeric order while old app writers are
inactive, verify storage/ACL/source preservation, then publish/verify the exact
new app before permitting any new fixture workflow. Old records remain readable
during this interval; do not create makeup/new-policy records using old screens.

Stop on drift, failed guards/CI, unexpected active writers, uncertain outcome,
isolation mismatch or changed existing business/source hashes. Inspect outcomes
before retry. Each migration is transactional; stop after a failure rather than
apply later versions. Do not blindly reverse applied migrations or delete
new immutable history. If rollback is needed after new records exist, disable
new workflow entry and preserve compatible read/history; obtain a reviewed
forward correction. Production is never the fallback test target.

Read-only acceptance: exact stored SQL/checksums, history once, owners/empty
search paths/ACLs/RLS/triggers, current old fixture hashes/counts and unpaid
review/final applicability, supported UI availability on the exact Preview.
New fictional 17-player tie/makeup/balanced/no-Q records require a subsequent
explicit acceptance budget and role/human-login plan; this rollout approval
must not be treated as permission to create them.
