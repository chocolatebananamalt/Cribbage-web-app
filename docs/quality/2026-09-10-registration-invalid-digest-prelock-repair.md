# Registration invalid-digest pre-lock repair — 2026-09-10

## Finding

The v2 registration claim function correctly required a 32-byte digest and
rechecked it while holding the tournament claim lock. However, its first
lookup used only the public link ID to discover the tournament, then acquired
the per-tournament advisory lock before rejecting an incorrect digest. A link
ID is deliberately present in a QR fragment, so a caller who knew that ID
could make invalid requests contend with a legitimate claim.

## Repair

Migration `0072_registration_claim_invalid_digest_prelock_rejection.sql`
adds a preliminary fixed-length digest comparison against the private link
header. An unknown ID and a wrong digest both return the same generic
`unavailable` result before the advisory lock. The locked section still loads
the active head and link with row locks, checks open/issued/unexpired/tournament
state, and compares the digest again; it is not relying on the preliminary
read for authorization or race safety.

No raw registration credential is stored, returned, logged, or sent to the
database. The new behavior reduces avoidable contention; it is not a
replacement for platform request-rate controls once a public route exists.

## Evidence

- The migration applied first to the disposable synthetic project and then to
  the pilot project.
- A post-application catalog read in the disposable project confirmed the
  preliminary `fixed_32_byte_equal` check precedes the advisory lock, the
  locked recheck remains, and only `service_role` may execute the function;
  `anon` and `authenticated` remain denied.
- Fresh security/performance advisor reads found no new browser-executable
  function or storage/RLS surface. The existing forced-RLS/no-policy notices,
  reviewed authenticated RPC notices, and empty/synthetic index-use notices
  are unchanged intentional baselines, not a release clearance.
- Local checks passed: `pnpm lint`, `pnpm test` (**86** tests), `pnpm build`,
  `pnpm verify`, `pnpm verify:handoff`, and `git diff --check`.

## Limits

There is still no configured server-only key, public registration route, or
issued v2 link. Therefore a real service-role claim transaction and two-client
contention test remain required before public registration can open. This
repair does not clear the registration lifecycle release blocker.
