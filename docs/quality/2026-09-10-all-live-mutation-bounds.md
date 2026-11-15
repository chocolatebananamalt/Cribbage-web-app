# All live mutation request bounds — 2026-09-10

## Acceptance criteria

- No implemented API POST route uses `request.json()` or `request.text()` to
  buffer an unbounded request before validating it.
- Small operational mutations use a 2 KiB streaming limit; initial seating
  uses 64 KiB for its bounded assignment list; setup drafts use 512 KiB for
  their explicitly bounded maximum of 32 event records and related notes.
- Malformed, non-JSON, declared-oversize, and actual-oversize requests do not
  reach authentication or an RPC. Existing exact-shape validation remains the
  second boundary.
- A regression test fails if any current API POST route reintroduces the
  framework JSON/text buffering helper.

## Change

The shared bounded reader now exposes deliberate small, medium, and large
limits. Every implemented POST route uses one of those readers (or the
registration-link wrapper around the same reader). This includes corrections,
correction policy, roster promotion, registration claim, event enrollment,
manual payments, seating/check-in, and setup/reconciliation workflows.

The limits are transport ceilings, not a relaxation of the business shape:
the existing validators still constrain fields, event count, table/seat
assignments, IDs, money, and free-text lengths. No database schema, role,
score, payment, registration, or seating decision changed.

## Evidence

Executed locally on 2026-09-10:

```text
pnpm test              PASS — 123 tests
pnpm lint              PASS
pnpm build             PASS
pnpm verify            PASS — 6 workspace checks
pnpm verify:handoff    PASS — 6 private-handoff checks
git diff --check       PASS
```

The first production-build attempt exposed six TypeScript object-narrowing
errors at the newly explicit JSON boundary. Those were repaired before the
passing run above; this is recorded because the failed build was not treated
as evidence of completion.

## Limitations

Request bounds do not prove complete multi-user behavior. Independent browser
sessions, actual database execution for every operation, rate limiting/WAF,
and the larger operational rule, finance, reporting, rotation, offline, and
release gates remain separate requirements.
