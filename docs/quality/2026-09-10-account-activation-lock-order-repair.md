# Account-activation lock-order repair — 2026-09-10

## Finding

The private, un-applied activation migrations used one common advisory lock
per tournament/roster identity. Issuance acquired that advisory lock before it
read the mutable activation row. Redemption, approval, and cancellation first
locked the activation row and then tried to acquire the advisory lock.

That inverted ordering permits a deadlock: an issuer can hold the advisory
lock while waiting for an activation row held by a concurrent redeemer or
canceller, while that transaction waits for the advisory lock. A transaction
abort would fail safely, but it is unacceptable for a witnessed identity
ceremony and could produce confusing retry behavior.

## Repair and acceptance criteria

- Every activation state mutation must use the same order: discover immutable
  tournament/roster scope without a row lock, acquire the scoped advisory
  lock, then re-read and lock mutable request/activation rows and revalidate
  all state.
- A missing pre-read must return the existing generic rejection without
  obtaining a lock or revealing whether a credential ever existed.
- The lock-order guard must fail if any of redemption, approval, or
  cancellation moves a request/activation `FOR UPDATE` read before the shared
  advisory lock.

## Implemented evidence

- Updated local, unapplied migrations `0092`, `0094`, and `0095` to follow
  that order. The first reads establish an immutable advisory key; the second
  reads under the key retain the existing `FOR UPDATE` and all current role,
  expiry, state, receipt, and phrase checks.
- Added a schema-contract regression that checks all three mutable paths for
  that ordering and for the post-lock activation row lock.

## Verification

Run locally in the production-readiness workspace on 2026-09-10:

```text
node --conditions=react-server --experimental-strip-types --test tests/schema-contract.test.mjs
PASS — 14 tests
pnpm lint
PASS
git diff --check
PASS
```

## Remaining evidence

Migrations `0090`–`0095` are not applied to the shared pilot. No local Docker,
Postgres, Supabase CLI, or `psql` runtime is installed in this workspace, so a
two-connection deadlock/race test could not be executed here. Before any
activation release, apply the reviewed chain only in an isolated controlled
pilot and prove concurrent issue/redeem, issue/cancel, decision/cancel, role
revocation, exact retry, and direct-browser-RPC denial with real database
connections. This source repair does not enable the feature.
