# Registration-link lifecycle acceptance criteria — 2026-09-09

## Observable successful behavior

1. A current director/co-director can issue one bounded, high-entropy public
   registration URL for an eligible tournament. Its raw token is fragment-only
   on a fixed registration route. Its header uses a fresh random per-link salt
   plus SHA-256, with no shared digest key exposed to a public function. The UI
   offers the raw URL/QR exactly once and then shows only lifecycle state,
   never the token.
2. The active URL's anonymous context and claim endpoints expose only the
   existing permitted tournament name and generic receipt outcome.
3. Rotation or close atomically moves the locked active head, retires the
   preceding URL, and appends immutable lifecycle, receipt, and audit evidence
   without changing a prior registration claim.
4. The private workspace shows a current open/closed state and issuer/time,
   not the raw token/digest, roster, payment, or claim data.

## Required rejection behavior

- no client can provide a token, digest, issuer, role, raw URL, claim, payment,
  seat, or lifecycle state as authority;
- an anonymous user, player, cross-tournament official, revoked official,
  stale operation, malformed request, unavailable tournament, and direct
  table/RPC caller cannot issue, rotate, close, or read private lifecycle data;
  privileged lifecycle functions deny all browser roles and accept only the
  separately authenticated server-only identity;
- a second concurrent issue produces no second open link; a changed reuse of
  an operation ID does not return a token or overwrite a receipt;
- closed, retired, expired, invalid, or capacity-limited public URLs remain
  generic-unavailable/non-enumerating; close/rotate races cannot insert a
  claim after the state change; and
- all legacy path-token links are atomically closed and their former page/API
  routes are removed or revoked before v2 opens; old paths return only generic
  unavailable/404 without reflecting or logging a canary; and
- raw values are absent from database rows, audit/receipt payloads, logs,
  telemetry, browser storage, referrers, redirect targets, QR-provider
  requests, and recoverable client retry data; malformed fragment handling
  fails closed before hydration or any token-bearing request.

## Required proof before pilot application

- migration/schema tests covering exact historical composite claim linkage,
  active-head state transitions, one-open-link concurrency, close/rotation
  atomicity, grants, RLS, trigger behavior, legacy mismatch/orphan preflight,
  ID-preserving backfill, legacy-v1 atomic close, per-link salt/digest
  verification, forward-disable rollback, and rejected outcomes;
- route/UI tests for strict request/response validation, one-time raw URL
  display, safe-only exact retry, no-store responses, stale state refresh,
  no-token retry data, and issue-page raw-value cleanup/BFCache exclusion;
- disposable-database transactions with two director accounts and one player,
  proving issue/rotate/close/replay/revocation, claim-vs-close,
  claim-vs-rotate, and public old/new URL outcomes; and
- real browser network and storage inspection plus canary-token scans through
  application, Vercel/platform, telemetry, and error-reporting paths, proving
  the initial HTTP request has no raw token and no external request occurs
  during its in-memory lifetime, and proving the retired token-in-path routes
  do not reflect or log a legacy canary.
