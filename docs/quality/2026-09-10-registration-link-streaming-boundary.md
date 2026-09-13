# Registration-link streaming request boundary — 2026-09-10

## Acceptance criteria

- Every director registration-link issue, rotation, closure, and
  registration-close mutation rejects a non-JSON, malformed, declared-oversize,
  or actual-oversize body before its authorization and service-only operation.
- An actual oversized stream is cancelled immediately after it crosses 2 KiB;
  later chunks are not read.
- A valid bounded JSON request preserves the existing exact-shape,
  authorization, and idempotency checks.

## Change

The registration-link reader now uses the shared streaming bounded-JSON reader
instead of first buffering the whole request with `request.text()`. The reader
continues to use the existing 2 KiB registration-link contract and does not
change any database function, role decision, credential, link state, or
business rule.

## Evidence

Executed locally on 2026-09-10:

```text
pnpm test              PASS — 122 tests
pnpm lint              PASS
pnpm build             PASS
pnpm verify            PASS — 6 workspace checks
pnpm verify:handoff    PASS — 6 private-handoff checks
git diff --check       PASS
```

Regression coverage exercises valid, non-JSON, malformed, declared-oversize,
and actual-oversize registration-link requests. A controlled stream proves
that the reader cancels at the second oversized chunk and never reads a later
chunk. The route-contract suite verifies the registration boundary no longer
uses `request.text()`.

## Limitations

This closes a request-buffering defect in the implemented director mutation
boundary. It does not replace rate limiting, real authenticated browser tests,
independent-session lifecycle races, or the remaining public-registration
release decisions.
