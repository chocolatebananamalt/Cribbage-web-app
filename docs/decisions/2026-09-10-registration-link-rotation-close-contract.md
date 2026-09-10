# Registration-link rotation and closure contract — 2026-09-10

## Problem

The existing v2 issue and read boundaries do not provide a safe director
operation to rotate or close an active QR registration link. The old database
operations are insufficient: they permit stale requests, do not give rejected
operations stable receipts, and can roll back conflict evidence.

## Decision

All rotation and closure requests use a compare-and-swap contract. The caller
MUST send the current `expectedLinkId` and positive `expectedVersion` that it
read from the server, as well as a new UUID `operationId`. The database locks
the tournament lifecycle, reauthorizes the actor, reconciles an existing
receipt, and only then evaluates lifecycle eligibility and compares that
expected state.

The only authorized operations are:

- `POST /api/v1/tournaments/{id}/registration-links/rotate` with exactly
  `expectedLinkId`, `expectedVersion`, `expiresAt`, `maxClaims`,
  `maxClaimsPerHour`, and `operationId`.
- `POST /api/v1/tournaments/{id}/registration-links/close` with exactly
  `expectedLinkId`, `expectedVersion`, and `operationId`.

Both routes are release-gated, same-origin, verified-session, private/no-store
server boundaries. Their bodies are JSON-only, bounded before parsing, and
strictly shaped. They use only the server-only database identity. The database
functions remain service-role-only security-definer functions with an empty
search path and independent current director/co-director authorization.

Rotation atomically retires precisely the expected issued link, creates one new
issued link, advances the active-head version once, writes immutable receipt,
lifecycle-event, and audit evidence, and returns the new raw credential only
in the first exact accepted response. A retry can never reconstruct or return
that credential.

Closure atomically disables precisely the expected issued link, closes the
active head, advances its version once, and writes immutable receipt,
lifecycle-event, and audit evidence. An exact retry returns the same safe
closed receipt. A stale, unavailable, or changed reuse returns one durable
rejected receipt and makes no lifecycle mutation.

The required order is: validate/hash; tournament advisory lock; lock
tournament row; reauthorize current role; inspect operation receipt; then, for
a new operation only, evaluate tournament/lifecycle eligibility and lock the
active head/link. This allows a safe replay response after the tournament
becomes unavailable, while preventing a new mutation.

## Non-negotiable invariants

- Delayed rotation or closure cannot alter a replacement link.
- Exactly one of concurrent rotate/rotate or rotate/close requests against the
  same head version wins; all other callers receive a durable safe rejection.
- Claims racing a rotation or close cannot survive a stale lifecycle read.
- Browser roles cannot invoke database lifecycle functions or read token
  material. Raw credentials appear in no database argument, receipt, event,
  audit record, log, telemetry record, or retry state.
- Registration closure itself must eventually be made an atomic lifecycle
  transition that closes the active link; merely masking it in the reader is
  not sufficient for release.

## Required proof before release

Use a disposable real backend with separate connections to prove stale actions,
exact accepted/rejected retry, changed operation-ID reuse, rotate/rotate,
rotate/close, claim/rotate, and claim/close races. Prove browser-role denial,
service-role success, original-token rejection after rotation, and no raw
credential leakage. Independently exercise the hosted browser lifecycle before
enabling public registration.
