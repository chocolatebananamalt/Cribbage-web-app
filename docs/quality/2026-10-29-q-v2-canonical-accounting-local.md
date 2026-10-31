# Q v2 canonical unpaid accounting — local evidence

Base branch `codex/director-setup-journey`, local base commit `c8ad2b4a8f948d9398e8681e7f58215c032d7d5d`. No commit, push, deployment, hosted data read/write or shared migration was performed. Qualification 0247 and this accounting work are unpublished local proposals.

## Implementation

- 0248: one private immutable forced-RLS Q v2 review table; exact server catalog/calculator, full source fingerprint and three service-only workspace/save/full-request reconciliation RPCs. V1 history is preserved with bidirectional domain exclusion.
- 0249: private immutable accounting draft/final tables; base/Q receipt partition; structured pre-collection regular-prize schedule support; independent base 85% validation; exact source/schedule/review/expense binding; controlled old/new writer exclusion; four service-only RPCs. Final state remains unpaid and cannot reopen automatically.
- Director pages/API routes use verified session subjects, same-origin mutation checks and strict contracts. Recovery uses an existing financial namespace/coordinator, stable operation IDs, single-flight protection and full-request reconciliation before retry. Dollar displays preserve integer minor units.
- Existing history and no-Q paths remain readable. Original no-Q financial helper OID is retained, with its original body, owner, ACL and configuration cloned exactly. No blanket access revocation or payment writer was added.

## Terminal verified checkpoint before downstream tie bridge

`pnpm verify` passed **1,010 application tests**, fresh audit with no known vulnerabilities, lint zero errors/two pre-existing warnings, provider checks, production build/TypeScript and eight workspace checks. Log: `test-results/q-accounting-full-verify-final.log`.

Real isolated SQL run5 passed **10 Q review groups and 8 canonical accounting groups**, plus all **320 exact chart cases** and strict actual SQL-to-TypeScript workspace/result contract checks. Log: `test-results/q-accounting-sql-run5.log`.

The SQL proof includes graduated 16-paid and rank-down 13-paid examples; equal odd cents and no-qualifier refund obligations; partial/stale/voided/replaced funding; modern JSON-only JWT context and wrong/missing-role denial; full request replay/conflicts; revoked authority; private ACL/RLS/immutable history; unchanged legacy v1 review; observed overlapping reviews and receipt-void/review connections; reasoned source supersession; three observed competing old/new draft connections; independent 85% rejection even when cash balances; malformed/cross-event/manual-entry rejection; closure gate and once-only unpaid finalization; immutable stale final after a same-value funding correction, with new review/second final blocked.

The full canonical fixture uses actual supported local setup/policy/election/receipt/allocation, expense, qualification/playoff and closure RPCs: **$650 receipts = $480 base + $170 Q**, **$216 expenses + $264 regular prizes = $480 base**, **$160 graduated Q awards + $10 contributor refund obligation = $170 Q**. Participant return is **$408 / $480 = 85%**, excluding all Q dollars. No actual money moves.

Phone390/desktop1440 browser suites passed **9 Q review groups** and **8 accounting groups**. They exercise actual React clients/recovery boundary with intercepted fictional APIs, not a hosted browser/database proof. Separate real SQL tests establish persistence and transaction races. Screenshots were inspected locally; no horizontal overflow. Logs/results: `q-obligation-v2-browser-run1.log`, `q-obligation-v2-browser-result.json`, `q-accounting-v6-browser-run2.log`, `q-accounting-v6-browser-results.json` under ignored `test-results/`.

Supported cleanup inspection found Q review server PID32560/port3251 absent and accounting server PID17944/port3250 absent. Final SQL container `eba3c5ef9e2cbbd476e972356fc6638d8cb1b84e17c100aadb4b01561aaefb1d` and database were removed; absence verified `2026-10-29T23:13:25.856Z`. Only task-owned temporary resources were targeted. Reviewed Docker image remains cached; original Docker data and its verified backup are preserved.

Independent read-only review found no confirmed P1/P2 issue in frozen 0248/0249/API/UI. Review separately confirmed all 320 SQL catalog rows are deep-equal to the TypeScript catalog, with correct recipient counts and pot totals. React review checks covered effect lifecycle, authenticated boundaries, labels, bounded/versioned recovery data and minimal public serialization.

## Recoverable failures corrected

Run1 passed catalog mathematics then exposed a null-blocker SQL expression; explicit JSON operand parentheses fixed the source adapter. Run2 found JSON-null schedule redaction; it now redacts only available objects and returns SQL null for unavailable support. Run3 reached closure but the test lacked the existing guard's modern JWT context; the test now provides both forms without weakening the guard. Browser run1 found an inactive StrictMode effect could clear recovery before the active effect processed its receipt; inactive responses/finally paths no longer finish or reset active work. Subsequent suites passed. These were local failures, not access denials or evidence of a hosted defect.

## Frozen proposals at this checkpoint

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `0247_qualification_tie_resolution_v1.sql` | 33,954 | `2AEF8ECFF490FCCE780493C9C2E8B378AE870246F0EE90A7E36BC71A25013303` |
| `0248_q_obligation_review_v2.sql` | 136,154 | `726FC5E4C09584E2669B095B148906B658DB39DA518D41333012B8B01B593497` |
| `0249_q_accounting_v6.sql` | 35,899 | `E5B175E08534BF0C26637F8FE8DBE2B96F420E86977AD3F8D8127EE33C470DBA` |
| `0250_qualification_playoff_source_bridge_v1.sql` | 6,066 | `C5B8A3893B9E5ACD312F2EC26A9ACB4A23066FF1ED2316B117495F668DF8AF0C` |

All are local SQL proposals tested directly in an isolated disposable database, not registered/applied to a shared migration history. Rollout needs separate exact-artifact compatibility/security review and authorization. No production readiness claim follows from these tests.

## Remaining integration/release gates

A subsequent review identified and reproduced an older playoff/MRP predicate requiring numeric rank to equal seed ordinal. The qualification tie feature intentionally retains raw numeric ties while producing an explicitly resolved seed order. Additive0250 now permits the mismatch only for a latest, source-current, fully matching resolved qualification snapshot; legacy placement restrictions remain unchanged. Any mismatch anywhere in the snapshot, including the nonqualifier side of a cutoff tie, requires this validation. Scores, raw numeric ranks and historical rows are never rewritten.

Final run9 (`test-results/q-accounting-sql-run9.log`) passes **24 SQL groups**:6 staged bridge groups +10Q review groups +8canonical accounting groups, plus320chart cases and strict real SQL/API validation. The staged test first reproduces the pre0250 public writer rejection, then records actual v3 playoff outcomes, available canonical MRP97/76/12/12, equal Q review and v6 accounting sources after0250. Exact scores/qualification snapshot SHA is unchanged before/after: `3cbeb01df614627cb2d9d717a4b899c37e18373f17896e0e9d6ed4e9ea082f2f`.

The distinct real cutoff fixture resolves the only raw tie at ranks4/5: winner5 remains numeric4/ordinal4, nonqualifier3 remains numeric4/ordinal5. Actual v3/MRP accepts the resolution. A rollback-only mutable event-name fixture change invalidates its source and blocks derivation/MRP globally even though every qualified row has numeric rank equal to ordinal. This is a source-identity negative test, not proof that the UI permits post-final score correction. Existing public Rule12 and dispute APIs correctly reject post-final mutations; immutable history remains unchanged. Earlier prequalification correction/dispute proof is separate and retained.

An observed resolution-first/finalizer-waiting overlap verifies timestamp ordering. The existing public wrapper already takes the event lock before the core, so the late accepted timestamp assignment is defensive post-validation audit precision, **not a reproduced public race bug**. Historical timestamps and exact replays remain unchanged. Old anomalous source/timestamp records, if any, would fail closed rather than be silently repaired.

Run9 executed0250 at6058bytes/SHA`50F4A39C2DCC88239A6ED83575D1A34B1EB35AD7A6859C3FBBAA293BE1FF987B`. The final6066byte version only corrects misleading comments about that timestamp rationale. Root and independent reviewer verified executable SQL is identical; normalized SHA`d1482ae801410c00d551ac7f981a051beaf8d61d7f7bfbdfab7284a71614d5b8`. Evidence: `test-results/0250-comment-only-verification.json`. No functional SQL changed after the passing run.

Fresh full verification including0250 passed1,010tests/audit/build/types/providers/workspace8 (`test-results/q-accounting-0250-full-verify-final.log`). Independent final review found no confirmed P1/P2 issue, including the exact cutoff regression. Final container`7288014656b3441eeb34b9d916322898c8abaf94c49e660ae4eee46cfac507f1` and database removed; absence verified`2026-10-29T23:33:28.416Z`. No hosted action or publication occurred.

Actual disbursement/paid-state, unresolved Q-only cash ties, unsupported formats/byes, physical multi-user/offline proof, hosted acceptance, database restore/rollback and exact-release operations remain separate gates. **Four-qualifier accounting does not cover a sanctioned Main at the sourced17-player minimum, which produces five qualifiers and requires a larger/bye bracket.** The ACC calculator is the owner's preferred future source; research and pending balancing choice are retained separately and did not change stored policies. The earlier private Library source snapshot predates this new accounting implementation; no additional external export was made under local-only authority.
