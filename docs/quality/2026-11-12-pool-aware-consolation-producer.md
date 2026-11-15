# Pool-aware Consolation receipt producer — local source checkpoint

2026-11-12. Built locally, default off; SQL/provider/device acceptance pending.

## Connected implementation

`database/proposals/pool-aware-consolation-receipts-v3.sql` connects the existing separate Consolation fee transaction semantics to a current reviewed Main V3 receipt partition. The original whole Main receipt, regular fee and Q allocations remain unchanged. A new full-fee Consolation receipt has its own operation, scope and event identity. The normal and actor-bound service native readers include that actual receipt and its immutable Main-part binding; the existing coexistent partition writer consumes these facts rather than inventing allocation data.

The authenticated Director payment route and existing UI select this producer only behind a separate literal-off gate. Co-director/legacy behavior remains delegated. Fresh collection requires current primary-Director/session authorization and existing admission guards; post-operation identity loss rolls back SQL and withholds a UI success. Exact saved recovery remains separate from new writes. Collection after financial award liabilities is held.

The frozen receipt validator reads immutable ownership/operation and exact current receipt/Q rows without calling the native source reader, avoiding recursive validation. Sequential separate fees may change the global raw envelope without changing any reviewed Main receipt material. A fresh full Main ownership/fund review is still required after collection before current combined funding can be approved.

## Focused verification

Five new changed-path tests passed, including pooled-base conservation, source tags, primary/session routing, legacy delegation and SQL-source structural checks. Three existing Director-handler tests also passed. Scoped ESLint passed after renaming a helper that was incorrectly recognized as a React hook. TypeScript no-emit passed before that mechanical rename. Independent source review returned GO after fixing the cloned scope UUID/session-ID name collision and including addon facts in the actor-bound service reader.

These are source/DTO/mock-RPC checks. The SQL lexical check is not PostgreSQL parsing or execution. No database, container, hosted change, publication or real payment occurred; no disposable resources require cleanup. Frozen release files were not changed.

## Remaining limits and smallest acceptance

Supported collection is separate full-fee linked Consolation receipts, with existing Main Q/Side shares retained, under the exact two-event/current ownership context. Prepaid Consolation cash inside a Main receipt, partial/discounted fees, inferred allocation ratios and unsupported shared-cost reassignment remain held. The coexistent funding slice does not establish sanctioning assessment coverage when a valid Consolation-owned expense partition is absent. This is not complete sanctioned-event finalization.

Next bounded fictional SQL acceptance should join the actual Main ownership/Q receipt, scope, two consecutive separate Consolation receipts, both real native readers, fresh Main review, coexistent writer and Consolation fund source, with exact retry/readback/rollback and stale/session guards. No whole-tournament rehearsal is required. Signed-in provider/device acceptance and release approval remain separate.

## Publication status correction

Parent reports a separately approved bounded upload was merged as PR122. The older interrupted publication outcome is unknown, not a proven denial. This checkpoint neither retries that operation nor includes these later local additions in any release approval. Production remains held.
