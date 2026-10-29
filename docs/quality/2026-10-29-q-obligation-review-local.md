# Local unpaid Q obligation review — verification checkpoint

2026-10-29. LOCAL ONLY. No push, deployment, hosted SQL, role changes, payments, refund execution, paid flags or tournament business writes. Published HEAD remains `4b424902b0fe274220b84263440067b5143671b2`. Existing director browser session was not touched.

## Implemented

- Primary-director review page/API recomputes named-pool obligations from canonical sources. Client cannot supply recipients, amounts, actor, paid state or settlement state.
- Immutable event-level revision covers all configured Q pools atomically, always `unpaid`; exact source manifest and calculator/policy/qualification/membership/allocation/receipt/obligation identities are preserved. Dollar display, integer minor-unit storage.
- Latest revision alone can be current. Any changed source makes it stale; explicit reasoned supersession appends history, never adds old amounts as additional active liabilities. Effective qualifying score digest is recomputed, rather than trusting an old qualification record alone.
- Existing equal paid-qualifier shares, qualifying-order cent remainder and zero-eligible refund obligations preserved. Unsupported formats/byes, disputes and incomplete/stale funding fail closed. Regular prize claims and canonical Q settlement remain separate and blocked.
- Stable request IDs, expected version/source hash, structured rejection receipts, exact replay and reconciliation. UI retains uncertain work using existing recovery coordinator; no automatic resubmit; retry reconciles first.

## Migration proposal — NOT registered/applied remotely

`database/migrations/0245_q_obligation_review_v1.sql`: **17,058 bytes**; SHA256 **05841725B4C6B4CF6F2CBF7E070EDD77100119A887087E14B13DE0540331894C**.

One new private forced-RLS append-only table `app.q_obligation_reviews_v1`, two private calculation/source helpers, and three service-role-only public RPCs: workspace, record review, reconciliation. No direct table access for anon/authenticated/service_role; no new human role or grants; existing writers/ACLs/settlement guards unchanged. Existing records are not rewritten. A later staging rollout requires separate review/approval and authenticated isolation checks; existing published app does not call these additive RPCs. Rollback should prefer reverting app use while preserving immutable review history, not deleting liabilities.

## Actually passed

- **964/964 application tests** using `node tests/run-application-tests.mjs`; includes five new focused contract/calculation/recovery-source tests. Log `test-results/q-obligation-full-tests.log`.
- Production `next build`, including TypeScript, passed. Provider readiness check passed with existing manual fallbacks declared. Workspace suite: 7 pass, 1 explicit private-handoff skip.
- Full lint: no errors; two pre-existing warnings plus two unused imports in the test runner, subsequently removed. New changed files targeted lint passes.
- Independent design/code review: no remaining P1/P2 issues. Cosmetic separators corrected. Review does not substitute for blocked browser acceptance.
- Reproducible **real isolated SQL** from hash-verified post-0236 baseline through 0245; reviewed image `sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`, network none, no ports/mounts, no privilege changes. Runner `tests/run-q-obligation-isolated.mjs` validates exact container identity/isolation.
  - Local synthetic 16-player foundation, $510 synthetic receipts, all canonical evidence guards enabled; 96 games with matching synthetic submissions/confirmations and real qualification RPC. This is backend fixture construction, not proof of paper workflow or real played games.
  - SQL/strict-codec parity: Q1 **667/667/666 cents**, Q2 **1000-cent refund obligation**, conservation, all unpaid.
  - Exact save/replay, changed-payload conflict, stale version, same-source new-operation duplicate rejection, paid-field rejection, co-director denial; exactly one initial review/audit, refresh and reconciliation.
  - Actual allocation correction RPC invalidates initial review, reasoned supersession preserves history.
  - **Two independent writer requests were observed simultaneously waiting on the qualification lock**; after release exactly one v2 succeeded and one stale competitor was rejected. Exactly two total reviews/audits, latest-only active state.
  - Rollback-only synthetic effective-score correction blocks with `qualification_scores_changed`. This tests reader fingerprint, not correction UI authorization. Original source state restored by rollback.
  - Forced RLS, no direct table grants, private helper denial to service role, three public RPCs service-only, all records unpaid.
- SQL evidence: `test-results/q-obligation-isolated.log`, `q-obligation-sql-checkpoint.json`, `q-obligation-race-result.json`, `q-obligation-score-stale.json`, `q-obligation-security-result.json`.
- Disposable database removed by runner; exact task-owned container `cribbage-qreview-local` (`f1a69fd5...`) stopped/removed. Browser harness cleanup removed its temporary fixture directory; no listener observed on 3245 afterward.

## Remaining gates / exact blockers

1. **Browser acceptance NOT RUN.** Actual component + recovery boundary/worker harness authored at `tests/q-obligation-browser.mjs`. Readiness GET **`http://127.0.0.1:3245/`** failed **`connect EACCES 127.0.0.1:3245`** before browser launch. No denied operation retried, no alternate port/route used. Creating local fictional fixture files was admitted; cleanup completed. Need scoped approval for one supported readiness/loopback retry; if denied again, stop. Proposed browser checks cover desktop1440/phone390, dollar amounts/overflow, validation, double click, interrupted/reloaded recovery, exact retry, server-success/lost-response, same-page reconciliation without repost, unavailable reconciliation blocking, confirmed rejection cleanup and unknown-work preservation. None may be reported passed yet.
2. **Fresh audit incomplete.** Bundled pnpm11.25 attempts bootstrap of repo-pinned11.19 and fails GET `https://registry.npmjs.org/pnpm: fetch failed`. No dependencies installed/changed. Attempted `--manage-package-manager-versions=false` is unsupported by this installed version; no audit result. Network/tool bootstrap failure, not evidence of a vulnerability or a security-policy denial. Need supported pinned runtime availability/registry access; no settings changed.
3. `tests/handoff.test.mjs` fails because the intentionally private `imports/acc-handoff-2026-09-05/ACC_Digital_Tournament_System_Pilot_Review_Prototype_v1.3.html` is absent. Standard workspace suite explicitly skips this optional private import; do not fabricate or publish it.

**Not rollout-ready.** Do not publish or apply 0245 until browser gate and applicable audit verification finish, then obtain separate bounded Preview/staging approval. No actual auth switch, multi-device/distributed deployment, real payment/refund or canonical Q final settlement coverage is claimed.

## Follow-up: audit and private handoff recovered (same local scope)

The missing private handoff was located at the exact original ZIP location documented by `docs/recovery/REVIEW.md`. All 32 entries were verified against the committed inventory SHA-256/size before missing original/organized copies were restored. Originals remained unchanged. Restored copies are Git-ignored; no private content was published, inspected as email, or used as a substitute fixture. An initial PowerShell array-expression path error created misplaced copies only under the ignored import folder; each exact sole-file tree was hash-verified and removed, then correct destinations restored. Handoff tests now **6/6 pass**; workspace tests **8/8 pass, zero skips**. Logs: `test-results/q-obligation-handoff-restored.log`, `q-obligation-workspace-restored.log`.

Fresh audit recovered using the supported scoped runner and the official, signature-verified repository-pinned pnpm **11.19.0**. `pnpm audit --prod --audit-level=high`: **No known vulnerabilities found**. No `pmOnFail=ignore`, signature bypass, alternate registry, app dependency/lockfile edit or persistent configuration change. Log: `test-results/q-obligation-audit-fresh.log`.

The earlier audit and private-handoff entries above describe the initial environment failures; they are now resolved. Browser readiness GET to `http://127.0.0.1:3245/` remains denied/unretried pending the parent's scoped approval request. No browser acceptance or rollout readiness is claimed.

Standard **`pnpm verify` completed with exit 0** after those recoveries: fresh audit clean, lint zero errors/two pre-existing warnings, 964 application tests, provider checks, production build/TypeScript, workspace 8/8 including nested handoff 6/6. Exact log `test-results/q-obligation-pnpm-verify.log`. Temporary task-local pnpm launcher removed; PATH restoration occurred in `finally`. Dependencies/lockfile/workspace configuration unchanged. Migration bytes/hash unchanged. **Only browser acceptance remains held at its denied localhost readiness operation; do not publish yet.**

## Final local browser acceptance — approved retry completed

Daron's 2026-10-29 02:24 UTC approval admitted the scoped readiness retry at **http://127.0.0.1:3245/**. The original denied operation was not retried before that new approval. No alternate port, credential, hosted origin or security setting was used.

Actual review component with existing RecoveryDocumentBoundary/worker passed **12 browser check groups**:
- Desktop1440 and phone390 dollar values ($6.67/$6.67/$6.66 and $10 refund obligation), unpaid warnings, required reason/attestation, no horizontal overflow.
- Repeated clicks create one POST; stable exact request is cleared only after a recognized receipt.
- Interrupted response survives reload; explicit retry reconciles and preserves the exact body/key.
- Server success/lost response reconciles without duplicate POST, both after reload and on the same page.
- Unknown response preserves recovery; unavailable reconciliation blocks POST; confirmed rejection clears only that exact retained request and requires source review.
- Actual SQL-produced v1/v2 workspaces render current/stale/superseded history; correction reason and exact expected-version/source binding checked.
- Changed qualifying scores block review even with immutable prior history; unrecognized retained work remains intact and blocks saves.

Evidence: `test-results/q-obligation-browser-result.json`, `q-obligation-browser-run.log`, `q-obligation-1440.png`, `q-obligation-390.png`, `q-obligation-history-phone.png`. All three screenshots visually inspected. Test APIs are fictional localhost interceptions; separate real SQL suite proves persistence/access/concurrency. Do not describe this as live browser-to-staging or actual sign-in/multi-device/crash/payment testing.

Expanded harness targeted lint passed. No application or migration changes were required after full `pnpm verify`; independent final review found no remaining P1/P2. Temporary Next fixture directory removed and no listener remained on port3245; previous disposable database/container already removed. Hosted session/fixtures, branch HEAD and business records untouched.

**Local acceptance is complete and ready for separate Preview/staging rollout review. No publication or hosted application is authorized by this result.** 0245 remains **17,058 bytes**, SHA256 **05841725B4C6B4CF6F2CBF7E070EDD77100119A887087E14B13DE0540331894C**. Actual payments/refunds, paid/discharged lifecycle and canonical Q settlement remain disabled/out of scope.
