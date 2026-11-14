# Authenticated reviewed seating integration: one disposable local database

## Outcome

The separately approved ONE local database completed the real client -> local Next HTTP proxy -> actual reviewed-native handler factory -> public SQL wrapper -> native publication chain. Actual PostgreSQL SET ROLE authenticated exercised the wrapper ACL and auth.uid checks. The local HMAC session issuer is an isolated test substitute, NOT Supabase provider sign-in. Production composition and its hard-false gate were not enabled.

Final native state: exactly 1 publication, 18 immutable assignments and 1 reviewed bridge. Of 257 app tables, 248 protected tables remained fingerprint-identical; only the nine previously declared draw/native/receipt/audit families changed. No score, finance, payout, invitation, hosted or production records were touched.

## Executed checks

1. Installed unchanged tested private core and thin authenticated wrappers into this database only. Authenticated wrapper execution allowed; anon/service_role wrapper execution refused; authenticated private core and table reads refused. Missing subject, wrong role claim and nonofficial actor return no result.
2. Actual HTTP: anonymous/tampered local session denied; player without official role denied; raw forged external Host denied; cross-origin POST denied; private no-store workspace returns the real 18 checked-in fictional entrants.
3. Actual browser rendered 320/390/768/1440 px with the real recovery coordinator and real database workspace. Explicit review needed; synchronous double click sent only one browser POST.
4. First public-wrapper transaction held its accepted write open. A second real HTTP/public-wrapper SQL session with the exact same request returned retry_exact. First committed once. Its HTTP response was deliberately lost; the browser retained exact bytes, reloaded, and GET-only readback recovered the same full saved result and cleared only that request. Recovered table caption asserted Published starting IDs. Two total POSTs include one deliberate competing test request, not two browser submissions.
5. Exact historical replay matches the accepted receipt. Changed request/same nonce conflicts. Different actor cannot retrieve result. Current Director role revocation denies both wrapper and HTTP read; original role restored exactly. Replay after temporary source drift succeeds for historical exact request; transaction rolled back.
6. Supplemental SAME database co-director read succeeds under actual authenticated role after a transaction-local role change. Change rolled back and all-table fingerprint equality verified. ACL metadata independently matches the intended grants.

## Harness correction / same-database preservation

Initial run passed schema/ACL but failed its HTTP Host negative assertion before publication: Node global fetch did not deliver the requested forged Host header. No product gate was weakened. Original process retained its SAME database ebd02f2db53196ddee8517099c9f650317a1f8606427d753a1ca39d86ae46ba1. A corrected continuation used node:http for exact headers and an exact-ID/network-none/no-mount validator; it created no database or container. Its test proxy also uses actual HTTP preserving Host. A six-second hold replaced a timing-sensitive one-second hold. All three continuation stages and the supplement passed.

Afterward, the original owning process received stop and removed the exact container through its finally block. That original process exits 1 because it retains its earlier Host assertion failure; this is not the final continuation outcome. Independent Docker ps queries by full ID and exact task name returned empty. Cleanup JSON records this. No second container/database was created. The fixture helper's generic unhealthy Docker health status reflects its deliberately disabled TCP/no-network layout; actual local Unix-socket psql and pg_isready were used successfully.

Final harness source also introspects individually committed DDL phases, refuses to recreate/redraw after a partial plan, and refuses initial-publication stage retry after committed IDs. Those harness recovery guard improvements were linted/source reviewed after the successful run; they were not used to create another database.

## Source and evidence

Wrapper SHA256 7e27fca258ba6767c6439843498fcb7418aba9d43990f0d918d569625ef7bfd0; private core c1b91e64f8d0a31681a6835ef5440fc2d4716fa93de4ca066b05f25856cef50e. Source comments saying unexecuted predate this bounded local proof; no hosted application or numbered migration is implied.

Evidence: test-results/reviewed-native-authenticated-result.json, -supplement.json, -preservation.json, -cleanup.json, initial -failure.json, exact -submitted-request.json, and review/recovered screenshots under reviewed-native-authenticated/. The in-memory signing key is never written or logged. Source scripts: tests/reviewed-native-authenticated-integration-local.mjs, tests/fixtures/reviewed-existing-approved-local.mjs and tests/check-reviewed-auth-existing.mjs.

## Remaining gates

No real Supabase sign-in, provider/PostgREST transport, production composition or published route acceptance was demonstrated. The loopback-only and hard-false app gates remain intact. No staging migration or deployment is authorized by this local test. A separately reviewed provider/staging recovery/preflight/rollout scope is still needed before enabling. Physical tables, approved human anchor choices, genuine independent roles and the complete mixed scoring/payout rehearsal also remain separate acceptance work. Local proof does not certify ACC movement or financial policy.

## Final repository verification and review
Full pnpm verify exit0 after adding the integration harness:1,409 application tests,8workspace checks, lint, clean production dependency audit, declared provider-readiness checks and optimized production build passed. Separate private handoff6passed. Independent source/evidence review recomputed all257 table keysets/248protected and final1/18/1, confirmed exact samecontainer/cleanup and unchanged proposal hashes, noP1/P2. Reviewer performed noDB/Docker/network action. Phone before/after actual integration screenshots visually inspected; fictional names wrap, IDs remain legible.
