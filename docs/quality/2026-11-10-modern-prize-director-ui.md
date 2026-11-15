# 2026-11-10 Modern prize Director API and review UI — default off

## Implemented

Added browser-safe strict review/attempt/reply/workspace codecs, a fixed actor/tournament/event retained-request controller, normal-session server transport, GET/POST API and an authenticated Director/Co-director page at `/tournament/[tid]/finance/[eid]/modern-prizes`.

The screen displays only Equal/WinnerTakesAll with the saved increment, exact group/recipient names and Tournament IDs, explicit excluded groups and fund total. It requires a Director reason and a checkbox tied to the exact displayed view. First action retains the exact reviewed request locally; a separate button sends it. Construction/import performs no IO. Mount/reload checks account/source and local retained work but never resends. No arbitrary discard, rebasing, new operation replacement or payment control.

The normal-user server transport verifies `auth.getUser()` before/after each RPC and before writing, with no admin/service client. It independently reconstructs/sanitizes the current SQL source and compares the entire displayed review before dispatch, or recognizes the matching existing record before an exact retry. Acceptance requires an actor/event/operation/full-request-echo bound SQL receipt plus matching independently decoded immutable stored record. Unknown/changed identity or unverified readback never becomes success. Browser output is an allow-list; no profile IDs, full fund evidence or raw retained financial sources are sent.

API responses use private/no-store. POST requires same origin, exact validated scope/body and a bounded64KB reader. All3 production gates (page, read routes, verified writes) are literalfalse. Routes reject before creating an authenticated client; even if read is separately enabled later, POST remains blocked until database-write verification is explicitly completed. Environment variables cannot activate this candidate. The three proposed public RPC wrappers remain revoked and behind the SQL gate; no grants/install were performed.

## Recovery and review findings

Exact retained bytes are compared before sending and before archive. Only the matching receipt+stored record can atomically archive/clear. Lost reply, failed storage, foreign/corrupt/displaced work or ambiguous response preserves bytes and blocks replacement. Unknown responses conceal private data and require fresh same-account admission before explicit retry. A known rejection remains retained and cannot create a replacement request.

Independent review found twoP2 issues and both are fixed: private names could remain after identity loss, and refreshed values could reuse an earlier checked confirmation. The host now subscribes to normal Auth identity, synchronously conceals on mismatch/pagehide/recheck, invalidates async generations, drops in-memory private views while retaining storage, and explicitly unmasks only current admitted+identity-ready data in layout. The confirmation lease is synchronously invalidated by edits/uncheck/refresh/access loss and bound to exact view/reason; the controller separately requires the expected review before staging. Source change cannot create a nonce/request from an old checkbox. Code checks caught an omitted identityReady snapshot field and unsupported strip-only parameter-property syntax; both corrected. React lint caught render-time ref access; state now owns rendering while refs are confined to effects/event guards.

## Focused evidence

-8 API/controller groups pass: normal-session allow-list, receipt/readback and immutable exact retry, retain-before-send/lost reply, default write gate, corrupt/displaced pending, source-bound confirmation, identity switch after committed RPC and protected archive.
-5 retained modern journal/source groups passed alongside the changes; SQL candidate remains unexecuted.
-TypeScript and targeted ESLint exit0 after final implementation. No broad full-suite/build/audit is claimed.
-Actual React browser checks at390/1440 pass with actual shared Finance CSS. Explicit two steps, no auto-send, account/pagehide conceal, retained pending after conceal, fresh-admission unmask, confirmation revoked by refresh, lost reply followed by same-byte retry, one simulated write and exact archive pass. Zero network. Injected memory storage, identity subscription and transport were used; this is NOT real IndexedDB/full reload, Auth/PostgREST, signed provider or database proof. Evidence: `test-results/modern-prize-journal-browser-20261110/result.json` and screenshots (final concealed state).
-Independent final source review GO/no remainingP1/P2. PanelSHA `ce01a3dcc8d86b7bd66fe6a7267b0b03a26edb6f3a3dbc58e52ef3aab7ac560e`; controllerSHA `358be331962b6add14b555f759348db3bb33d41a96697e79cb3dbcc7a422e4ed`. SQL candidate now includes revoked wrappers/request-bound receipt fields; SHA `ebe46fdf6b6be1077c8366025de6fad1ba0dde20043456cb4d01cb61e81cc7ad`.

## Remaining gates

No SQL, fixture, hosted read/write, public upload, permission change or denied retry occurred. New/predecessor SQL remains unexecuted. Actual SQL installation/schema/ACL, transactions/concurrency/rollback, source/TS parity, immutable retry/readback and real signed-provider/multi-session/IndexedDB reload acceptance remain necessary before any enabling or release. RPC wrappers currently have no application EXECUTE grants. No navigation link into the disabled page was added to current user flows.

Unsupported methods, positive income and unmatched multi-event/optional source compositions remain held. This UI does not edit payouts or resolve leftover amounts. It cannot mark awards paid, move money or establish real play. Production and the user's saved draft are unchanged.
