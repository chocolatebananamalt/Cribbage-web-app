# Native mixed draw-review exact-key fix — source ready, runtime pending

## Change

Reordered one expected-key array in database/proposals/native-mixed-simulation-publication-v1.sql: fictionalPaperAcknowledged now sorts before humanPresenceNotVerified, matching array_agg(k ORDER BY k). Byte reconstruction against the second fixture install manifest proves this replacement is the only SQL-byte change, including original formatting/trailing newlines. New source SHA256: c2df296644950947e201995e7fd866e16c0a89bac8881bc7a094673f95d7c40e.

No new field/value, relaxed validation, permission, default-on gate, table, payout policy or ordinary attendance behavior. Existing exact-key checks, UUID/digest/reason checks, accepted-test-only decision and three required true acknowledgments remain. Independent source review GO. No fixture, SQL execution, hosted access or app publication in this phase; both prior fixtures remain verified removed.

## Regression and checks

Added two structural source regressions to tests/native-mixed-simulation-publication-v1.test.mjs. They failed on the original SQL (7 pass/2 fail) and pass on the corrected SQL (9/9). Intended fields and property-order independence are covered, extra/missing fields rejected, all four action key arrays canonical/unique. These emulate only the SQL exact-key comparison; they do not prove PostgreSQL execution.

Prepared tests/native-mixed-review-validator-local-regression.sql for six actual PostgreSQL cases: valid=true; extra key, missing acknowledgment, false acknowledgment, malformed digest and wrong decision=false. UNEXECUTED; no fixture permission inferred.

- Full application source suite:2193/2193 pass.
- Production build:pass.
- ESLint:0 errors,129 warnings (workspace-wide existing warnings; no unrelated cleanup).
- Provider readiness check:pass; unsupported providers disabled.
- Workspace/handoff:14/14 pass.
- pnpm verify aggregate NOT rerun because it begins the previously denied dependency audit; no audit retry or metadata transmission. Its safe components above ran separately.

Evidence logs and scope.json: test-results/native-mixed-review-key-fix-20261106.

## Exact next runtime acceptance

Requires separate approval for one fresh disposable local DB, including local-only fictional schedule save; the second fixture was removed and its authorization consumed. No hosted permission is needed or assumed.

1. Verify isolation and install corrected pinned source with a fresh manifest. Execute six-case SQL validator regression before seeding.
2. Reuse the guarded18 fictional registered entrants path:6 linked Digital/12 unlinked Paper; simulated funding and own-account consent; independent paper review/seal; closed-registration fixture prerequisite.
3. Plan/draw; require accepted draw review; save fictional seating/schedule inside that same DB. Verify18 fixed Tournament IDs,12 rounds,108 unique canonical pairs, mandatory simulation sidecars and matching operation/audit/receipt/source captures. Exact retries must preserve IDs, be historical, and never redraw.
4. Call normal Start with actual schedule ID/current participant digest and18 entrants,12 games per player (108 is total matches). Capture expected attendance_or_seating_incomplete, zero Start/score rows and progression not_started. Do not fabricate ordinary attendance or use old synthetic admission as a substitute. A positive simulated Start/scoring path remains separate missing integration.
5. Wrong actor/subject/stale source/revocation checks; verify ordinary payment/check-in untouched, restore temporary fixture gates and remove exact fixture; independently verify absence.

A passed validator/source test is not successful schedule publication, scoring readiness, provider acceptance or a complete18-player trial. No new payout-policy decision is needed for the key fix.
