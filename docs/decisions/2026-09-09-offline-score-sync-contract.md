# Offline score synchronization contract — 2026-09-09

## Decision

The existing browser session retry envelope is **not** an offline queue and
must not be described or extended as one. It safely protects one foreground
submission retry, but it cannot prove the local payload was not changed, does
not survive a browser session safely, and cannot replay a confirmation without
server evidence that both submissions already match.

`R-OFFLINE-01` requires a separate, versioned offline synchronization
protocol. Until that protocol is implemented and executed against a real test
backend, offline score entry remains unavailable and the app must keep the
score Pending.

## Required protocol

### Queue record

Each IndexedDB record is immutable and names its queue ID, schema version,
creation time, client operation ID, tournament/event/game, verified
actor/session, assigned participant/side, expected game version, and canonical
payload digest. Submission records additionally contain the exact submission
ID/slot/winner/margin. A confirmation record additionally names the exact
submission and a server-issued matched-result challenge fingerprint.

The queue never stores access/refresh tokens, opponent entries, names, email,
ACC identifiers, or a server-verification flag.

### Capability and integrity

While online, the server issues a short-lived capability bound to the verified
actor session, device/session key, tournament/event/game, assigned side,
allowed operation kind, and protocol/key version. The client signs or MACs the
canonical immutable queue payload using a registered non-exportable
device/session key. A client-only digest is useful for equality but is not
anti-tamper protection.

The database rechecks current claims, session, role, assignment, check-in,
event/ruleset/publication eligibility, capability, signature, schema/age, and
scope before it invokes the existing authoritative submit/confirm core inside
the same transaction. This is a versioned replay wrapper, not a second score
writer.

### States and lifecycle

Local state is only `Queued`, `PendingSync`, `Retrying`, `Conflict`, or
`Rejected`. Neither a local signature, a service-worker response, paper
transcription, nor enqueue operation can show `Verified`.

Confirmation may queue only after a server-issued challenge proves both server
submissions match. Two locally queued submissions cannot reveal or compare one
another, and cannot unlock confirmation.

The client deletes a record only after an exact terminal response binds the
operation kind, queue ID, operation ID, game ID, submission ID, request digest,
and stored disposition. Network errors, 401, 429, 5xx, malformed responses,
and cross-operation responses retain the record. Expired or switched sessions
lock it for explicit reauthentication/rebind or audited resolution; they never
silently delete it. Sign-out and shared-device clear purge all queue records
and their device/session keys.

### Server/audit boundary

The replay endpoint is same-origin, no-store, claim-checked, rate/batch/body
bounded, and returns only exact strict DTOs. Its idempotency fingerprint covers
every immutable queue field except the signature. Each attempted replay records
immutable accepted, rejected, quarantined, or conflict metadata and an exact
receipt. Exact retries replay the stored response; changed retries create
immutable conflict evidence. An inner failure to write a receipt/audit record
rolls back the score mutation.

## Deliberate exclusions

- No offline authority for a paper card, unavailable player, staff
  transcription, or a single player confirmation.
- No background replay after sign-out or account switch.
- No automatic correction, publication, or finalization during queue replay.

## Proof before release

Use a disposable real backend plus two independent browser sessions to prove
offline → reload/restart → reconnect flows, tampering/capability/session/scope
denial, duplicate/changed replay, account/device copying, simultaneous player
races, mismatch/stale/conflict handling, rollback fault injection, storage
failure, service-worker termination, 401/429/5xx/malformed responses, cache
headers, and shared-device purge. Assert persisted records and receipts, not
local success text.
