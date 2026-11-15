> Payout-policy hold, 2026-10-30 06:24 UTC: the owner requires whole-dollar prizes, preferably $5, and the shared balanced $5 formula for graduated Q/Side Pools without per-event remainder-placement questions. Historical cent-based regular/equal calculations below prove bookkeeping only, not current product policy. Graduated rank-down remains correct; the separate equal-pool refund edge case is not a graduated refund. Preserve historical records. See docs/reference/payout-policy-clarification-2026-10-30.md for the automatic-policy proposal and unresolved real-funding residue decision. No app/hosted change is authorized here.
# Local release-operations audit — 2026-10-30

Scope: local files and focused tests only. No browser control, hosted reads/writes, exports, infrastructure/security/configuration changes or publication.

## Findings and repairs

- Current unpaid Standard Main acceptance is supported by exact-release hosted evidence. It does not prove broader formats, physical independence, restore, paid-state or production operations.
- Both client preview and migration0255 server calculation block unresolved Q cash ties; historical cut records cannot override the current gate. Graduated rank-down remains separate from equal/no-qualifier refund obligations.
- CI pins Node24/pnpm11.19.0, frozen-lockfile install and `pnpm verify`. Actual GitHub branch protection/required-check settings are not visible locally and are unverified.
- Earlier LAUNCH_PLAN and OCTOBER_PILOT_REHEARSAL contain dated production/migration preflight instructions. Added current historical-warning pointers rather than rewriting prior evidence. A new release/restore checkpoint defines exact candidate scope, compatibility matrix, history-preserving rollback and protected restore acceptance before any hosted action.
- Source backup is not database/Auth/Storage recovery. Restore plan intentionally contains no credential/export commands and requires named destination/retention/isolated target approval before execution.

## Executed check

Node24 direct focused command: `node --experimental-strip-types --test tests/q-operating-balanced.test.mjs tests/q-operating-schedule.test.mjs tests/acc-weighted-pool.test.mjs tests/five-qualifier-playoff.test.mjs tests/no-q-accounting-v7.test.mjs tests/prize-schedule-setup.test.mjs`.

Result: **35 passed, zero failed**. Covers exact supported-domain conservation, historical320 chart domains, explicit domain rejection, cash ties/stale funding/acknowledgments/pre-play election, zero-Q accounting, bye/played-win separation and setup applicability. No fresh full build/browser/SQL run was needed or claimed for documentation-only changes. The earlier full1,050-test/build/audit and hosted204-game evidence is retained separately.

Deliverables: [release/restore checkpoint](../operations/RELEASE_AND_RESTORE_CHECKPOINT_2026_10_30.md), [prioritized gates](2026-10-30-production-gates-after-hosted-acceptance.md). No new application behavior or migration changes.

Open decisions: launch scope/paid-state endpoint, protected restore destination/retention/target, real independent-user outage rehearsal, and Q monetary tie policy or explicit exclusion. Current code should not be called production-ready before the relevant gates pass.

