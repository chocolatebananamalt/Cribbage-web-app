# Finance new-instance checkpoint recovery

## Scope

No database execution/fixture, hosted action, grant, publication, payment, denied navigation or audit retry. Existing generic device-port source was read but not opened. Changes stay within the existing operation class/component and tests; no new production layer or payout calculation.

## Contract and source changes

The operation class writes a compact reviewed-head checkpoint at the same scoped key atomically with the unchanged immutable archive. Initialization validates root/head keys, scope, UUIDs/digests, positive bounded version and exact archive ID. It restores no receipt or pending operation, sends nothing and retains exact read bytes for the next CAS. Unknown/foreign/corrupt/future formats block without clearing; stale/same-version conflicting heads do not replace a newer known guard.

The component's existing Check Retained Operation is now also available for outcome_unknown. It is guarded during active verification and reads device state only. This closes the mounted lost-archive-ack path: explicit rediscovery finds the already committed checkpoint without a second send. Its explanatory text distinguishes this from retrying a submission.

The offline fixture now separates its in-memory ports from each operation instance and can replace the whole Finance component/operation while retaining only the fake store. Counters distinguish pending requests, checkpoints and immutable archives. This is not a persistent browser database or a true navigation reload.

## Executed checks

Twenty Node operation/projection tests passed: the existing fifteen plus fresh-instance restoration without posting/receipt exposure, exact noncanonical read bytes as the next CAS/history intact, foreign/corrupt/future/authority claims blocked with raw preserved, downgrade/conflict refusal, and ambiguous archive acknowledgment recovered both in the mounted instance and a fresh instance with no new post.

Six real React offline contexts passed. Four widths (320,390,768,1440) at100/200% text retain the previous recovery/held-handler/head-barrier proof. Additional contexts cover failed read/same-instance remount and: lost archive acknowledgment; explicit read-only rediscovery; fresh operation plus component instance; stale workspace blocked; matching workspace adoption; second pending/save/archive cycle. Exact fake counts: two intended posts, two checks, two immutable archives, one callback; no submission on rediscovery or reconstruction. All pages stayed about:blank; no requests or page errors. Contexts are offline, service workers blocked, routes abort all, CSP connect/default none, local bundles inline. No server/goto/proxy/host substitution is used.

Evidence: test-results/finance-checkpoint-focused.log; finance-checkpoint-offline.log; finance-recovery-offline/result.json and observations.json. The previous controls screenshots remain QA, not a newly approved payout design. All browser/store identities are fictional; amounts still use the preexisting fixture/model and are not new payout policy.

## Prepared but not executed

The existing finance-provider-indexeddb-browser.mjs now distinguishes pending records from checkpoints, expects the checkpoint after archival, and specifies reload blocking until the mock fresh workspace is supplied. Only node --check ran. No IndexedDB open, database schema or browser navigation from that harness occurred. Its localhost target remains denied and was not retried. Syntax success does not prove the generated app/storage behavior. Its direct mock archive supplies a fixture head and would prove only class/checkpoint/reload behavior, not authenticated readback or the Verify control. Its header now correctly identifies local IndexedDB rather than claiming in-memory/no database.

## Remaining gates

Null at the key cannot distinguish a genuinely new scope from a legacy completed archive written before checkpoints. No history reader was invented, no automatic cleanup/migration occurred, and no authenticated freshness was inferred. A real host must prove current authorized workspace plus legacy handling before enabling. During in-flight operations, retain the same scope-bound operation object; reconstruction proof is after checkpoint commit.

Actual IndexedDB atomicity/persistence, full navigation reload, multi-tab concurrency, older-client binary compatibility, Next routing/CSP/auth/provider acceptance, and the wider SQL candidates remain unverified. Checkpoints are not cryptographic/server/payment authority. Old-client website rollback needs a checkpoint-compatible recovery path, not record deletion. Publication remains separately gated. Rounding/entry-fee policy and the pending layout response are not assumed.

The required dependency audit remains incomplete after the earlier denied metadata-export escalation; no retry occurred. Local check results are appended after completion; they do not make this production ready.

## Frozen local results

2,191 application tests passed. Twenty focused unit/projection checks and six offline React contexts passed. Lint exit0 with119 existing warnings; provider/build exit0; workspace8 and private handoff6 passed. The real IndexedDB harness had syntax-only exit0 and was NOT run. No database open/fixture, hosted read/write, grant, denied URL retry, audit retry or money action occurred. Independent source/evidence review GO is for the disabled new-client checkpoint path, with the legacy/storage/auth/old-client gates above.
