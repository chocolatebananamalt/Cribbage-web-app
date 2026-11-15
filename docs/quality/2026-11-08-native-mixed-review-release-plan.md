# Mixed Qualifying Review: Private Candidate and Acceptance Plan

This local checkpoint adds a read-only review of completed simulated qualifying play. It is not a full rehearsal release, official qualification close, Finance adoption or payout authorization. Nothing was installed, granted, enrolled, uploaded or published. Existing hosted records were not read or changed.

## What the candidate does

A separate, default-disabled page at `/tournament/<tid>/rehearsal-review/<eid>` uses the normal signed-in cookie/session and a read-only GET endpoint. Only the current Director or Co-director can attempt a load. The server resolves the current event Start rather than accepting a Start or actor supplied by the browser. Two complete captures must agree; role, session, scope and feature state are checked around them. Responses are private/no-store and bounded to 128 KiB.

The unchanged previously tested getter checks all 108 canonical match histories, independent paper review bindings and current sealed simulation funding. The fictional captured example has 18 scorecards, 12 distinct opponents per player, five preview qualifying places and $540 simulated gross receipts. Costs, net prize fund and awards remain **Not determined**. A tied full ranking tuple is review-only, without silently selecting a qualifier. This does not create results, receipts, attendance, awards or disbursements.

The UI clears prior values on source failure, account/session/event changes and offline state; unavailable is not displayed as zero. Manual Load/Refresh only. Fixed Tournament IDs are displayed, never ACC numbers. No scoring, Start, close, editing or payout control is provided here.

## Exact local boundary

`test-results/native-mixed-review-source-closure.json` records 16 source dependencies, ten changed/new source files and no unresolved local imports. The comparison is against locally cached Git ba2845a plus 23 hash-verified preparation overlay files. The three later published support files were SQL/tests. The public 3c3d653 commit object is not cached, so this is not a fresh public-tree audit or an isolated public CI proof.

The optional changes to `native-mixed-preparation-provider-v1.tsx` and `native-mixed-preparation-screen-v1.tsx` are **excluded** from the standalone read slice. A later full-play release must review them separately. Tests and packaging updates also require a narrow baseline diff; copying the whole current RPC-audit file would include unrelated unpublished exceptions.

SQL delta over the frozen 51-source preparation package is exactly three new functions from:

- `database/proposals/native-mixed-qualification-review-v1.sql`: default-false review gate and private getter.
- `database/proposals/native-mixed-qualification-review-provider-v1.sql`: two-argument public resolver, entirely revoked.

No new table, existing-function replacement, data rewrite or ordinary Finance writer is required by this read slice. The new resolver now has broader local-fixture runtime proof; the exact minimum-51 database compatibility is still unproven. Detailed dependencies and hashes are in `2026-11-08-native-mixed-review-provider-source.md`.

## Verification

Independent source review found no definite blocking issue. Focused intake/resolver/RPC tests: 29/29 passed, including accessor/cycle/sparse/non-JSON rejection and zero client calls while disabled. The two reachability checks pass: this exact page is unadvertised only while disabled, and enabling restores the normal navigation requirement.

Actual React section and provider, with a fake client and static fictional replay, passed at four viewport widths and 100%/200% text. Cases include Director/Co-director, player/anonymous rejection, 403/session revocation, duplicate-load suppression and late account/session/event replies. Zero browser network requests, navigations or page errors. This supported offline harness does not establish actual Supabase sessions, origin storage, real page hydration, SQL or real-device acceptance. See the two offline-browser QA reports.

Final complete application/build/lint/provider/workspace/handoff outcomes are recorded in the matching `native-mixed-review-*-final.log` files. The dependency audit remains unrun after the earlier automatic-review denial; no audit or full `pnpm verify` success is claimed.

## Ordered acceptance and release gates

1. Review/freeze the smallest source, tests and SQL manifest against the actual intended public branch. Build/test that isolated overlay, without importing future play or Finance authoring changes. Do not publish yet.
2. Execute the exact three-function delta in a separately authorized disposable baseline database. Prove Director/Co-director success and anonymous/player/cross-checker/service/foreign-session rejection; expiry, revocation, held locks, stale Start/root/funding, double captures, unchanged records, owners/ACLs/history and atomic rollback. The initial source phase did not execute SQL or create grants/fixtures; the authorized local runtime follow-up is documented below.
3. Keep shared Start/publication/attendance/funding dependencies explicit: their flags also gate writers. A read-only label alone cannot prove writer isolation. Prove closed write grants/transports and `writes_enabled=false`; no private function, table or service-role access is implied.
4. Before any hosted installation, obtain scoped approval, verify the separate test target and drift, and verify a current recovery point through isolated restore. App rollback does not undo database changes. Do not rewrite the frozen installed migration or historical ledger.
5. A later explicit read-only cohort approval must name existing actors, event, expiry and exact authenticated EXECUTE on only the public resolver. No new accounts or persistent credentials are needed by this design; none were created. Completed, current mixed evidence must already exist: the preparation preview alone cannot supply it.
6. Test real signed-in Director/Co-director and denied roles on phone/laptop, session change, refresh/offline/recovery and source revision. Revoke resolver/disable intake as an exposure stop; preserve all existing records.

The complete 18-player human rehearsal remains NO-GO: normal draw/Start/scoring publication and consent, role-separated provider/device acceptance, durable mixed qualification close and its Finance source bridge are separate gates. This review does not resolve regular-prize remainder/fee-comparison decisions, optional-pool funding, unsupported Satellite cases, mixed playoffs or actual payments. Retain the questions in `docs/decisions/2026-11-08-prize-remainder-and-fee-open-questions.md`.

## Final local gates

- Complete application suite: 2,553 passed, zero failures.
- Production Next build: passed (includes TypeScript checks).
- Full lint: zero errors, 201 warnings.
- Provider configuration: passed; online payment/SMS/OCR remain disabled with declared manual fallbacks. This is configuration evidence, not live-provider acceptance.
- Workspace and recovered-handoff suite: 14 passed.
- Focused intake/resolver/RPC suite: 29 passed; reachability: two passed.
- Final section/browser result SHA256: `4d6df132cdc35020e3126f2f23b431472b91cc7d58c775bf0d7f3d3690767e42`.
- Final fake-client provider/browser result SHA256: `5d1741961c6ece55efbf9513e41a83cc920e9e98d0dedb34f3ba79bae7b630f2`.

One complete-suite run initially caught the unlinked disabled candidate page. The narrow gate assertion now follows the existing closed-route convention: only that exact single page is exempt while false, with `notFound()` preceding parameter consumption. Independent review approved the fix; opening the flag restores the normal navigation test. The complete suite was rerun after this change and passed.

## Follow-up: isolated app build passed; resolver runtime pending

The reconstructed app build passed on 2026-11-08. The isolated source was assembled from 632 allowlisted Git-baseline source/public/config files, 23 hash-pinned preparation-overlay files and the ten standalone review additions. Git blob IDs and all overlay/candidate SHA256 values were checked before copying; candidate bytes matched after build. Exactly two routes were added (review page and GET), none removed; both new gates remain false. No top-level `.env` files were copied. Existing ancestor `node_modules` were used: this is not a clean dependency install, fresh remote-tree audit, full isolated CI or proof that inherited process environment is empty. Independent review found no definite P1/P2 issue in this isolation method.

Evidence: `test-results/native-mixed-review-isolated/manifest.json`, `verification.json` and `build.log`. The initial dependency-junction attempt failed with Windows EPERM and created no junction; the safe alternative used normal ancestor dependency resolution in a private worktree. No security setting or denied browser access was changed. Both temporary source copies were removed with containment-checked paths and absence checks; evidence is `cleanup.json`.

**Exact pending runtime gate:** the existing completed-18-player fixture harness installs temporary `GRANT EXECUTE` permissions for its fictional signed-in test roles. The current delegation authorizes disposable resources but explicitly says not to grant access. No fixture, SQL or grant was executed in this follow-up. The resolver test is pending clarification that these ephemeral fixture-only permissions are included; this is an instruction-scope hold, not an automatic-review denial or a failed SQL result. Hosted grants, accounts and deployments remain excluded. The planned tests remain the Director/co success and denied-role/session/scope cases, expiry/revocation/stale-source/lock behavior, preservation and rollback listed above.

## 2026-11-08 Resolver runtime follow-up

The temporary-grant clarification resolved the earlier instruction hold. The completed and restored-partial fictional resolver tests passed, with closed-state readback and container cleanup verified. This supersedes the pending-runtime status above for the **broader local fixture only**. See `2026-11-08-native-mixed-resolver-runtime.md` for exact evidence, test-harness corrections and remaining minimum-51/provider/funding-drift gates. No hosted change or publication occurred.

## Later local verification: minimum51 and supported drift now pass

The exact frozen51 schema plus only the three review functions now passes local populated-fictional compatibility, unchanged source/review digests and the supported expense-drift/rollback test. This supersedes those two remaining-local-gate entries above; real provider/device and hosted release gates remain. See `2026-11-08-native-mixed-minimum51-and-funding-drift.md` for the exact scope, construction limitations, diagnostic permission correction and cleanup. No hosted system was changed.
