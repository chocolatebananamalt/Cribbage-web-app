# Offline score queue contract foundation — 2026-09-10

## Acceptance criteria

- A queue intent is exact, versioned, immutable, scope-bound, and contains no
  names, emails, ACC identifiers, tokens, opponent entry, or verified flag.
- A confirmation intent must carry a server-issued matched-result challenge
  fingerprint and a current capability.
- Local state can never be `Verified`.
- An adapter may delete a queue record only after a strict terminal receipt
  binds every operation identifier, score target, and canonical payload digest.

## Implemented boundary

`src/lib/offline-score-queue-contract.ts` supplies strict type guards and
decision helpers only. It does not activate IndexedDB, service workers,
background replay, WebCrypto keys, a replay API, or any offline score entry.
The existing session retry envelope remains separate and is not treated as an
offline queue.

## Verification

`tests/offline-score-queue-contract.test.mjs` rejects extra sensitive fields,
impossible margins, fake verified state, expired capabilities, missing/fake
confirmation challenges, altered receipts, and mixed terminal receipts.

## Remaining gate

The required server-issued capability, non-exportable device/session key,
IndexedDB adapter, server replay transaction/audit wrapper, and real two-user
offline/reconnect proof are all still absent. Offline scoring remains disabled
until those items are implemented and verified against an isolated real
backend.
