# Minimal event-published projection contract (local proposal)

## Scope and acceptance

Pure server-only preparation, no publisher, transport, endpoint, grant, database table, fixture, source reader or hosted/provider action. This is a proposed contract for the already requested player-visible bracket and running Q-Pool/Side Pool totals; it does not itself authorize exposing them. Every success returns **prepared-not-authorized**, accessGranted:false and transportEnabled:false. Supplied JSON heads, booleans and digests are not proof of server permission or current source state.

The contract requires matching before/after heads bound to exact event, tournament, publication UUID, positive revision and intended players-and-public audience. Both heads must be explicitly published. Withdrawal, missing/unpublished/malformed heads, changed revision/source/sections, wrong event or mismatched source blocks preparation. Source digest covers validated bracket input/provenance and exact aggregate snapshot including observation time; arbitrary private display/notes are excluded. No guessed grant or actual publication record is created.

Sections are explicit. A pool-only publication cannot carry a bracket as extra data. Null means unavailable/absent, never no players or a zero fund; no-data publications block. Sources must satisfy existing current-review/chart/qualification/tie/parent-result guards and exact-scope aggregate codec, with matching-double-read observation. Unsupported >64/small field and stale/unresolved sources remain blocked. Matching supplied snapshots are NOT a database transaction, real-time guarantee or visibility proof.

## Minimum output

Bracket includes only name, fixed Tournament ID and seed, round/match path and bye/pending/recorded status, fixed-ID opponent/winner/champion references and explicit synthetic/unverified-origin label. It drops internal participant UUIDs, account/ACC/contact data, qualification/result IDs, source digests, evidence notes and review reasons. No table/seat, scoring writer, money calculation or independent-play authority is implied. Stable Tournament IDs are unchanged by the output mapping.

Pools include pool metadata ID/type/name/fee, entered/fully paid/eligible counts, recorded/eligible contributions, projected-if-all-pay estimate, source availability and contribution-review flag. No roster, member list, receipt, allocation detail, consent note, policy UUID, individual contribution or held individual amount. Projection is not awards or bank confirmation. Unknown amounts remain null; verified known zero remains0. Exact observedAt is retained; source/private warning codes are not exposed. Displaying aggregate data still needs the future audience/disclosure review, especially small groups.

## Atomic publication / concurrency requirements, not implemented

A future authoritative publisher must capture all required current source revisions and explicit event visibility under one supported transaction or prove an equivalent serializable protocol. Locking/source writers must include role/visibility withdrawal, event publication, qualification and tie changes, result corrections and parent revisions, pool definition/policy/election/allocation/receipt/participant lifecycle changes. It must reject stale bindings and commit immutable source/projection revision with one pointer swap; no partially updated head or bracket/pool mix. Exact retry uses the same operation/source, never publishes a new guess after response loss.

Publication visibility and projection freshness are separate concepts: opening a public event view is a Director-reviewed visibility decision. Once enabled, authorized source changes may generate a NEW immutable data revision automatically through the reviewed publisher; the user should not need to click Publish after each pool contribution. Existing reader supplies expected publication/revision and obtains current head/source/head; changed currentness fails closed. This checkpoint only defines a strict pinned snapshot, not that automatic updater. Old or withdrawn heads must not remain current through a cache. A future atomic read can replace the current double-read limitation; do not label present preparation atomic.

Actual server must derive head/source from authoritative permitted records, never accept client JSON as a grant. Recheck visibility/current role as appropriate at the transport boundary. Do not expose existing private Q/playoff RPCs or grant table SELECT. Use minimal whitelisted SQL/API projection with scope-bound parameters, safe search_path/ACL, no arbitrary actor override, strict no-store/error boundary and revision-aware cache/withdrawal behavior. No hidden draft existence leaks. Client route receives only prepared public DTO after independent server authorization; this pure preparation function is not a substitute.

## Provider/runtime acceptance needed

Tests must cover separate anonymous/participant/official actors and event boundaries, published-only policy, role/visibility revocation, concurrent source/withdrawal/pointer updates, corrected bracket parent invalidation, stale/voided receipts, withdrawn/duplicate entries, real zero vs unknown, response loss/exact replay, cache invalidation and denied private RPC/table access. Genuine provider -> API -> actual database proof and browser navigation/readability are still required. The current no-fixture instruction prevents new runtime fixtures; earlier denial is not retried. No DB/provider acceptance is inferred from pure objects.

## Local evidence

Nine focused tests exercise strict heads/revisions/audience/scope, section isolation, stale and unsupported rejection, immutable own output, minimal public identifiers, digest binding and zero/unknown handling. Full suite and independent review results are recorded in docs/quality/2026-11-04-event-published-projection-local.md after completion. No payout method, admission rule, role permission or historical data changed.
