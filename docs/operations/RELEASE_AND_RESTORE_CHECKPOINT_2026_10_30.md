> Payout-policy hold, 2026-10-30 06:24 UTC: the owner requires whole-dollar prizes, preferably $5, and the shared balanced $5 formula for graduated Q/Side Pools without per-event remainder-placement questions. Historical cent-based regular/equal calculations below prove bookkeeping only, not current product policy. Graduated rank-down remains correct; the separate equal-pool refund edge case is not a graduated refund. Preserve historical records. See docs/reference/payout-policy-clarification-2026-10-30.md for the automatic-policy proposal and unresolved real-funding residue decision. No app/hosted change is authorized here.
# Release and restore checkpoint — 2026-10-30

Planning only. No export, restore, credentials, infrastructure change or production release is authorized by this file. Historical September migration numbers and production URLs in earlier runbooks are not current execution instructions.

## Candidate and scope ledger

- Tested application commit: `72c1c6571e33a53e7a204927e02e9a4dae22f3f9`, existing draft PR122 branch `codex/director-setup-journey`.
- Exact-commit CI runs 41003981196 and 41003985805 passed. READY test deployment `dpl_8KvoH2PfpWBagXHUGoZz8NsBxeqm`; this does not establish production parity.
- Staging `nnhcnvksxgxnpvdqjgpg` applied reviewed 0247–0255 once; checksum/ACL/RLS verification is in `test-results/staging-0247-0255-verified.json`. Production `fnjkwymxpnsqvxtpronk` was not inspected or modified by this local audit. Never assume its history matches staging.
- Exact hosted acceptance: two synthetic 17-player Standard Singles Main events, 12 qualifying games per player, five qualifiers, three first-round byes, four played playoff series and current immutable unpaid accounting. Optional Q and genuine zero-Q paths pass. [Evidence](../quality/2026-10-30-hosted17-terminal-acceptance.md).
- Current formula policy domain is 1–256 paid entrants, $10/$20/$50 fees, 1-in-4 or 1-in-6 and $5 largest-remainder rounding; this is an application limit, not an ACC limit. It does not establish support for that many players in every tournament workflow.
- Broader formats/brackets, arbitrary graduated fees, multiway/ambiguous qualification ties, automated OCR and actual disbursement are not established by this acceptance. Initial launch scope requires an owner decision or additional scoped work/evidence.

## Verified safety boundaries

| Boundary | Local evidence / limitation |
| --- | --- |
| Q cash ties fail closed | `src/lib/results/q-operating-workspace-preview.ts` returns `cash_tie_policy_unresolved`; migration 0255 calculator returns `q_cash_tie_unresolved`. Current review calculations ignore historical cuts. Qualification H2H/one-game playoffs do not invent Q monetary rules. |
| Graduated/equal distinction | Graduated ranks all fully paid members down the qualifying-card order; equal selects paid playoff qualifiers and records unpaid contributor refunds only when none qualifies. Historical chart policies remain separately versioned. |
| Regular/Q separation | `src/lib/results/prize-schedule-setup.ts`, no-Q v7 and Q v6 accounting retain base-only budgets, equal elimination bands and independent 85% checking. No paid status follows from accounting finalization. |
| Unsupported setups | Setup prize editor applies only to one Standard 12-game Main with a positive integer base fee and no Side Pools. Backend scopes independently block unsupported accounting; hiding an editor alone is not an authorization control. |
| Registration flags | `src/lib/api/public-registration-v2.ts` requires literal `enabled` for public registration and link management independently. No environment values were read or changed in this audit; actual release configuration is unverified. |
| Build/CI | Node 24 and pnpm 11.19.0 are pinned in package/workflow; CI runs frozen-lockfile install and `pnpm verify`. Private handoff checks are intentionally local-only. Repository required-check/branch-protection configuration cannot be established from the workflow file and remains to be verified read-only. |
| Authentication | Password fallback uses the app's coordinated server route before Supabase; app code does not add password logging here. Hosting-provider request/log retention/redaction and real-device/browser-crash recovery are not certified by local source review. Review those operational controls before production credentials are used. Never collect passwords in release evidence. |

Focused local recheck: 35/35 tests passed across balanced operating policies, amount calculation, historical schedules, five-qualifier playoffs, no-Q accounting and setup applicability. Existing full 1,050-test/build/audit and phone/desktop evidence remains dated evidence; it was not rerun or represented as a new production test for this documentation-only audit.

## Safe release and rollback packet

1. Name one immutable candidate commit, app artifact/deployment and ordered migration manifest with exact bytes/hashes. Ensure clean curated publication excludes private/generated files. Changes after acceptance require affected verification and refreshed evidence.
2. Before any production action, separately approve read-only production history/schema/access/configuration and quiet-window checks. Compare actual dependencies and writers; stop on drift, pending recovery work or missing isolation. Never kill unrelated sessions or clear user queues to create a quiet window.
3. Produce a compatibility matrix for current production app/schema, candidate app/current schema, candidate app/proposed schema and the proposed rollback app/new schema. Test the rollback pairing with synthetic data in an approved isolated environment. An old successful rollback from September does not prove this changed version safe.
4. Preserve verified backups first. For the additive 0247–0255 lineage, do not reverse migrations by dropping private tables/functions or deleting immutable records. If a candidate fails, use only a verified compatible app rollback or approved forward repair, preserving audit/recovery work. If no compatible artifact exists, stop affected operations and obtain an explicit recovery decision.
5. Define operator, maintenance window, observable runtime/auth/error/financial invariants, stop thresholds, support contact and communication path. No test here proves alert delivery or operational ownership.
6. Obtain explicit production migration/deployment approval for the exact packet. Then apply each missing migration once in dependency order and release only the artifact verified against that resulting schema. Never replay staging history blindly.
7. Verify exact production artifact/schema identity, role and outsider denial, current authenticated runtime isolation, read-only totals and runtime errors. Any consequential test write needs its own approved fictional scope. Record the final evidence and director acceptance.

No rollback was executed in this audit, and no production promotion is implied.

## Protected restore rehearsal plan — no data exported

**Decision before execution:** owner chooses the named source project, approved encrypted off-device destination and access/retention policy, isolated restore target, permitted data categories, quiet-window/cutoff and acceptable recovery point/time. Prefer first proving the procedure with synthetic staging data. Rehearsing real production content later requires separate specific approval; a staging rehearsal does not certify production recovery.

1. Inventory only metadata first: schema/history, dependent extensions/functions, row-count/checksum coverage, Auth relationship requirements, private Storage buckets/object ownership, and provider-supported recovery capabilities. Do not include passwords, tokens, environment secrets, connection strings or unrelated private records in logs/source snapshots.
2. Document exactly what each approved backup captures and omits. Database rows, Auth identity/session behavior and Storage object bytes/metadata require distinct coverage checks; source/Git/Docker copies are not substitutes. Do not invent an export command or assume one provider backup includes all three.
3. Validate destination access, encryption and recoverability before any data leaves its source. Use existing approved credentials only through supported tooling. If recovery requires new credentials, settings, billing or a new project, stop and obtain that named approval. Do not configure outbound emails, webhooks or payments in the isolated target.
4. Capture a consistent approved snapshot, its cutoff, schema manifest, scoped counts/content hashes and Storage object byte hashes. Record identifiers and checksums without recording sensitive contents. Retention/destruction must follow the owner's explicit policy; do not auto-delete backups or source data.
5. Restore into the named isolated target using the provider-supported method reviewed at execution time. Verify schema/migration/ACL/RLS/owner parity, all intended row/object counts and hashes, Auth-to-profile relationships, private image access, role isolation, representative scorecards, immutable history and accounting totals. The target must not send emails or contact payment/OCR services.
6. Measure actual restore duration/data loss relative to the captured cutoff. Perform a synthetic read/write/replay exercise only if separately included in the approved target scope. Confirm original source counts/content are unchanged.
7. Produce a signed-off restore receipt with coverage gaps, recovery point/time and exact repeatable procedure. Keep original backups until retention instructions authorize disposal. A successful content restore remains separate from a physical multi-user/offline rehearsal and production rollout approval.

No current backup provider plan, destination, Auth export method or restore permission is assumed. No database/Auth/Storage backup has been created by this plan.

## Smallest owner decisions

1. Initial launch scope: the tested Standard Singles/unpaid slice, or which additional formats/paid-state work must be completed first?
2. Restore rehearsal: approve a named isolated staging restore and protected destination/retention scope, or identify the existing approved backup location. No export can start without these specifics.
3. Physical rehearsal: identify the independent participants/devices and a suitable outage-test time. Continue local preparation while scheduling it.
4. Q monetary ties: approve a sourced operating policy or retain explicit blocking/exclusion. Do not infer it from qualification or penny-rounding order.

The [production gates checklist](../quality/2026-10-30-production-gates-after-hosted-acceptance.md) remains the prioritized acceptance map.

