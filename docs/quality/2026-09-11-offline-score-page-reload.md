# Offline score page reload verification — 2026-09-11

## Outcome

The assigned game page can now prepare an expiring, exact-game offline copy
after its device-bound score capability is issued. A disconnected reload or a
transient 5xx response can reopen that prepared page; authentication failures,
redirects, other routes, mutations, expired copies, and unprepared games fail
closed. Ordinary connected scoring never waits for cache preparation.

## Safety boundaries

- The service worker intercepts only same-origin `GET` navigation to the exact
  UUID game route and immutable Next.js assets. It never intercepts APIs or
  score mutations.
- Each game uses a separate expiring cache. The server-rendered page must carry
  the exact actor/game binding before it is stored.
- A non-sensitive actor marker is refreshed before every durable queue write
  and after every successful page preparation. A magic-link callback may
  refresh the same player’s session but cannot replace that actor while a
  private offline page or score queue remains. A different player must first
  use **Sign out and clear this device**.
- Shared-device clearing removes IndexedDB queues, private signing keys,
  capabilities, all offline score page caches, and the marker.
- Offline content remains local-only and never means Submitted, Confirmed, or
  Verified. Server replay remains the sole path into the authoritative score
  workflow.

## Checks

- Focused offline/auth checks pass, including executable service-worker cases
  for network failure, 5xx fallback, 401 fail-closed behavior, expiration, and
  non-interception of score mutations, plus same-player versus different-player
  magic-link decisions and same-actor replay-session binding.
- TypeScript production build, lint, JavaScript syntax, and diff checks pass.
- `pnpm verify` passes the dependency audit, lint, 254/254 application tests,
  production build, and 6/6 workspace checks. `pnpm verify:handoff` passes 6/6.
- Independent Sol review found no remaining P0/P1 issue after the cache,
  transient-failure, marker, and same-player reauthentication repairs.
- External Chrome loaded the local demonstration with meaningful content and
  no framework overlay or console error. The service-worker JavaScript returned
  HTTP 200 with the required JavaScript MIME type, no-cache policy, and root
  scope header.
- A final reconnect edge case was repaired before release: restored queued data
  now revalidates the actual cached page before showing **Offline Ready**, and
  reconnect retries preparation when no queue exists. The complete release gate
  then passed again: 254/254 application tests and 6/6 handoff tests.
- Commit `58b5d05` was promoted to Vercel Production as deployment
  `dpl_8CqBBnpR3C2nMxhHxEkivdk44Cug`. The stable production `/demo` and worker
  returned HTTP 200, and the worker returned `application/javascript`, root
  service-worker scope, and `no-store`/`no-cache` headers. External Chrome
  rendered the stable live demonstration.

## Remaining release evidence

This closes implementation for offline full-page reload, not the entire pilot
offline gate. A published synthetic game with two independent real browser
sessions must still prove hard reload/restart, saved-entry replay, shared-device
clearing, and account-switch blocking against the real backend. Offline
confirmation and failed-device reconstruction remain separate work.
