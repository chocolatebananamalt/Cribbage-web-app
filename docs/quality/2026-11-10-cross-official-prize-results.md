# Cross-official current prize Results (local, default off)

Existing authorized Directors and Co-directors can now validate another official's recorded modern awards against current event evidence without impersonating the recorder or changing any stored record.

The Results-only SQL path reads current native fund evidence and the current prize workspace under the currently authenticated official. It compares complete captured content while excluding only these known observation-dependent envelope paths:

- Fund capture: `actorId`, `sourceDigest`, `recipientSource.actorId`, `recipientSource.sourceDigest`, `recipientSource.nativeFinanceSource.actorId`.
- Prize workspace: `actorId`, `nativeSource.actorId`, `nativeSource.sourceDigest`.

There is no recursive actor/hash stripping. Stored review actors and digests, proposal intent actor/operation, revisions, immutable head history, game submissions/confirmations/actions, results, receipt allocations, independent content digests and all authority flags remain exact. The existing award writer is unchanged and never uses these Results-only comparison helpers.

For a record that used first-round fee evidence, SQL additionally freezes and reads the complete current qualification-to-roster mapping and latest receipt/amount-owed identities, versions, states and full-fee amounts. They must match the captured evidence. Same-amount replacement records still hold. Missing, voided, changed, discounted or otherwise ambiguous heads never become a current award claim.

The server independently validates the original record with its original recorder's identity; a reviewer-found scope-spread bug was fixed by explicitly constructing the historical scope from `recordedBy` and the event/tournament IDs. Current fund, sporting replay and workspace are validated under the reader's identity, then their complete semantic evidence is compared. The required ordinary-page qualification-version pin is retained. Names, fixed Tournament IDs, whole award groups and totals remain the only result data rendered; private reasons, actors, profile IDs and receipt/obligation evidence stay server-side.

Twenty focused test groups pass across current Results, true two-official cases and existing journal/controller regressions. Tests include both fee-free and paid-first-round records, unchanged original audit identities, changed review/action/content/fee-head evidence, qualification-version mismatch, user/gate changes and private-field exclusion. TypeScript and scoped lint pass. Independent final source review reports no remaining P1/P2 findings. The browser-visible view/component is unchanged, so the previous responsive check was not repeated.

All application and SQL gates remain false; functions are revoked. No SQL/database fixture, hosted read/write, grant, publication, credential or denied-operation retry occurred. SQL syntax/runtime, real cross-role provider acceptance and lock/race behavior remain unverified. This source completion supersedes the prior cross-actor implementation hold; it is not live enablement or payment authorization.

SQL SHA-256: `50d22fb00e00c3e0d9f6405b3b2e31b14b9f65616c7e204135ce0f10560a2ef5`.
