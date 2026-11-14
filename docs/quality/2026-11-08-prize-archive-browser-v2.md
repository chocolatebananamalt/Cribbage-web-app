# Private read-only proposal archive, 2026-11-08

The candidate Finance screen can browse saved receipt copies and reasoned
rejection-resolution copies for the current account and event on this device.
No endpoint, grant, schema migration, current-head replacement, payment, payout
policy or hosted record is changed. The Finance page and endpoints stay disabled.

## Data and access boundaries

The existing retained port has an optional readPrizeArchives method. It reads
only exact receipt/rejection actor/tournament/event key ranges in the history
store, with readonly data transactions. Shared first-ever database initialization
still creates its empty existing stores; no existing draft/history row is changed.
Lookahead reads keys only; values are fetched sequentially for selected page
entries. Limit is 1..10, the Finance view uses five, and total key/raw UTF8 bytes
are capped at 32 MiB. No broad getAll, unrelated prefix or draft access.

Malformed owned suffixes (0..100 UTF16 units, including empty/control/Unicode)
remain pageable. A prefix-successor exclusive upper range includes U+FFFF tails.
Nonstring values are represented as null, without exposing their object contents.
The browser marks these entries unverified. Keys over the bound or pages over
32 MiB fail closed as unavailable; data is preserved and such corruption can
block that page. This availability limit is not described as empty history.

Reader access checks a fresh account-bound provider workspace before and after
local reads, validates exact owned scope/order/cursor/size and ignores inactive
owner callbacks. Copies are separately parsed under a 16 MiB record cap. A valid
copy requires exact family/scope/operation key, retained request bytes/hash and
complete receipt bindings. Resolved rejection copies additionally require their
original retained string, resolution reason and observed scoped workspace.

These are consistency checks of DEVICE COPIES, not signatures, encryption or
current server approval. The UI states that distinction and does not invent a
rejection timestamp. Saved time is labeled receipt-reported. Historical amounts,
original reasons, resolution reasons and adjustment/void history are readonly;
there is no import, reapply, deletion or payout control. Lists sort by archive ID,
not date; Refresh finds immutable inserts that precede an earlier cursor. Missing
archive support is unavailable, never proof of no history. Current proposal and
pending text are unaffected by browsing.

## Verification and limits

Nine archive codec/reader groups plus ten adapter groups pass (19 focused).
The adapter also passes 16 existing draft-session groups (26 for that command),
including constructor compatibility. Tests cover bounded readonly ranges,
selected-only reads, key ordering, malformed keys, nullable values, byte budgets,
access revocation, inactive readers and no mutation. Adapter tests use a queued
fake IndexedDB transaction model; no actual-origin durability claim is made.

Actual React offline run10369 passed four widths at 100%/200% text: saved and
rejected details, original reasons/history, paging/refresh, malformed entries,
unavailable storage, unchanged editor/pending work and late account switches.
Zero network, navigation or page errors. Mock storage and a Node hash port were
used; real provider sessions, real-origin IndexedDB/full reload and enabled-page
acceptance remain required. No fresh database fixture was needed for this patch.

Offline result SHA256:
d22d2346eb88f5b4e6d70b594eb4146847d5404ff8cd5d65d9bcff18e82bd059.
Reader SHA256:
32635063add531283965219d82105e60f9148cb2da0dbe20d4375d9acae541ea.
Independent source/privacy review: GO, no remaining definite P1/P2 in the bounded
supported slice. Oversize limits remain explicit. Prior denied registry audit
was not retried; no aggregate pnpm verify claim is made.

Unresolved payout questions remain in the existing decision note: extension of
approved regular target rounding to new methods/increments, advertised versus
agreed-fee comparison, and unmet comparison warning versus block. Existing
no-refund pool redistribution and regular V3 rules are unchanged.

Final local gates: application 2,537/2,537; production build including TypeScript exit 0; provider readiness exit 0 with existing disabled-provider fallbacks; workspace/handoff 14/14; full lint zero errors / 201 warnings.
