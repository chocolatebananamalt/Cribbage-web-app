# Registration credential lifetime repair — 2026-09-10

## Finding

The fragment bootstrap removed a registration credential from the address bar
and browser global, but the client form could retain it in React state after a
rejected request or while a page was being placed into the browser back/forward
cache. This did not create storage, database, URL, or telemetry exposure, but
it did not meet the lifecycle contract's stricter requirement to drop
application references on rejection, abort, unmount, and `pagehide`.

## Repair

- The first independent review caught that a raw credential in React state
  could survive a `pagehide` snapshot. The form now keeps the credential only
  in a private ref solely for the current submission; React state holds only a
  boolean controlling whether the form may be displayed.
- It clears that ref after every accepted or rejected response, and on browser
  navigation/unmount. The form-visibility boolean also resets on `pagehide`.
- A `pagehide` handler aborts an in-flight submission before clearing the
  credential. The component cleanup also aborts an in-flight request and
  removes the global handoff reference.
- No token is written to browser storage. The request still sends it only in a
  same-origin no-store POST body, and the release gate remains disabled.

## Evidence and limitation

- `pnpm lint` — pass.
- `pnpm test` — pass, 92 tests, including regression assertions that React
  does not hold a string credential, and that credential clearing, pagehide
  cleanup, request abort, and abort signalling remain present.
- `pnpm build` — pass; `/register` remains a dynamic route.
- `git diff --check` — pass.

This is local/static evidence only. A real-browser history/BFCache/network
canary remains required before public registration can be enabled.
