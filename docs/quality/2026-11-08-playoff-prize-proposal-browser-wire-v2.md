# Browser-safe proposal wire projection

Bounded change: one pure codec, one server-only projector, focused tests. Existing
store/native/basis modules and raw API contracts are unchanged. No endpoint,
network, storage, SQL, provider client, grant or enablement is introduced. The
lead owns optional handler projection, client operation state and UI integration.

`src/lib/api/playoff-prize-proposal-browser-v2.ts` exports browser DTO types,
`readPlayoffPrizeBrowserWorkspaceV2`, `readPlayoffPrizeBrowserHeadV2`,
`preparePlayoffPrizeBrowserSaveV2` (alias `prepareBrowserSave`),
`readPlayoffPrizeBrowserPreparedV2`, and `readPlayoffPrizeBrowserReplyV2`.
Prepare/retained/reply functions are asynchronous because request SHA256 uses
WebCrypto. Prepared value is exactly `{request,raw,hash,scope}`. Canonical JSON
and TextEncoder byte length agree with the unchanged server serializer/Node
hash. Request bound remains 1 MB, complete response bound 8 MB. Raw reasons,
zero values and exact history are preserved; NUL/unpaired surrogate text rejects.

Workspace carries authenticated scope, current native digest/input and complete
actor-independent `{capture,coverage}` evidence plus projected proposal basis,
and an optional historical head with metadata/evidence/full proposal history.
All financial authority flags are false. Full evidence comparison recomputes
staleness, including context/activation/binding/intent IDs. Co-directors can
share evidence while caller-specific native digests differ. Missing current
source preserves a historical head and remains stale; no fallback fund/fee or
source absence is inferred.

`src/lib/finance/playoff-prize-proposal-browser-projector-v2.ts` exports
`projectPlayoffPrizeBrowserWorkspaceV2(raw,scope)` and
`projectPlayoffPrizeBrowserReplyV2(raw,scope,request)`. Both first use the existing
full store/native validators. The server still owns qualification validation,
complete native-source reconstruction and ledger/results content digests. The
browser cross-checks carried projection/source pins, saved policy, actual
qualifier count, isolated regular ledger projection and pure proposal math.
It does not infer authentication or full sporting authority from client data.

An immutable projected operation includes exact raw request/hash and full saved
head or recorded rejection; each saved head must match retained actor, scope,
operation, prior revision, native digest, native input, whole history, mode and
raw reason. Bound attempts retain their separate original kind and cannot be
mistaken for an immutable result. No pending-clear instruction is emitted.
DTOs are detached/frozen after validation, including before hash awaits, to
prevent later object mutation changing the verified request or receipt.

Retained prepared validation proves wire shape/scope/canonical bytes/hash and
database text compatibility, not fresh source eligibility or independent full
server qualification validation. Historical recovery must use these original
bytes after current source/head changes. Root controller must retain and compare
the original reviewed current evidence and head before prepare/send; it must
not silently substitute a newly fetched workspace for a dirty UNSAVED proposal
whose smaller pure basis pins happen to remain unchanged. Pending/unknown
cleanup, archive CAS and current authenticated access remain controller duties.

Executed 2026-11-08, bundled Node 24, no network:

```text
node --conditions=react-server --experimental-strip-types --test tests/playoff-prize-proposal-browser-v2.test.mjs tests/playoff-prize-proposal-store-v2.test.mjs tests/playoff-prize-proposals-v2.test.mjs
exit 0: 27/27 (6 new protocol groups plus existing store/proposal checks).

node node_modules/typescript/bin/tsc --noEmit --incremental false
exit 0 after fixing two local TypeScript closure narrowing diagnostics.

node node_modules/eslint/bin/eslint.js src/lib/api/playoff-prize-proposal-browser-v2.ts src/lib/finance/playoff-prize-proposal-browser-projector-v2.ts tests/playoff-prize-proposal-browser-v2.test.mjs
exit 0, no diagnostics.
```

New coverage: real WebCrypto/server SHA and serializer parity; recursive browser
runtime import graph excludes server-only/node/Buffer; exact source projection
and immutable receipts; malformed/accessor/cross-scope/authority rejection;
co-director evidence and provenance adoption; history/pins/reason/prior bindings;
unavailable current source; distinction between rejection and every attempt;
historical prepared retention and tampered/database-incompatible text rejection.

Limits: no actual browser, endpoint/provider, persistence or new DB execution
was performed for this codec slice. Initial about:blank lacks secure-context
WebCrypto; any offline controller/browser fixture must explicitly mock a digest
port and disclose it, while production HTTPS uses normal WebCrypto. Independent
financial review and integrated root tests/build remain lead gates. Previously
denied network audit/navigation actions were not retried or bypassed. Shared
project status/memory are lead-owned to avoid concurrent edits.
