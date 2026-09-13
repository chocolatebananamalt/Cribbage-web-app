# Score mutation bounded-JSON repair — 2026-09-10

## Acceptance criteria

- The authenticated score-submission and confirmation routes reject a
  non-JSON, malformed, declared-oversize, or actual-oversize request before
  calling their scoring RPC.
- A small valid JSON request remains available for each route's existing
  exact-shape and authorization checks.
- The pure input boundary is executable in the plain Node test runner rather
  than only indirectly through Next.js.

## Change

`src/lib/api/bounded-json.ts` provides one streaming 2 KiB request reader. It
stops and cancels the stream as soon as it crosses the boundary; it does not
buffer an oversized request before rejecting it. The two live scoring mutation
routes use it before body-shape validation. The reader makes no authorization
decision and never changes a score; the existing server-side RPC remains
authoritative.

## Evidence

Executed locally on 2026-09-10:

```text
pnpm test              PASS — 118 tests
pnpm lint              PASS
pnpm build             PASS
pnpm verify            PASS — 6 workspace checks
pnpm verify:handoff    PASS — 6 private-handoff checks
git diff --check       PASS
```

The new regression test exercises non-JSON, malformed, supplied
`content-length` over 2 KiB, actual body over 2 KiB, and a valid small JSON
body. A controlled streaming test proves that the reader cancels after the
first oversized chunk and does not consume the remaining chunk. It also
asserts both score mutation route modules call the bounded reader instead of
`request.json()`.

## Limitations

This is request-size hardening, not a substitute for WAF/rate limiting,
real independent-session scoring tests, or phone/desktop browser evidence.
