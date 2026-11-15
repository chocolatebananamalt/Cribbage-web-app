# Registration-link rotation compare-and-swap — 2026-09-10

## Finding

The older rotation function did not require the precise active link and version
that an official had read. A delayed screen could therefore replace a newer
registration link.

## Repair

Migration `0080_registration_link_rotate_compare_and_swap.sql` replaces that
function with a service-only, locked compare-and-swap transaction. A request
must include the expected link ID and positive version. The transaction:

1. locks the tournament lifecycle and verifies the current director/co-director;
2. returns an exact prior immutable receipt before later lifecycle checks;
3. rejects missing, closed, expired, changed, or stale head/link state with a
   durable rejection receipt;
4. retires precisely the expected link, creates exactly one replacement, and
   advances the head version once; and
5. records receipt, lifecycle, and audit evidence.

The server-only adapter creates the opaque credential and stores only its
salted digest. A raw replacement credential is returned only after an exact
new success response. A replayed receipt cannot recreate it.

## Evidence

- The migration was applied first to disposable synthetic project
  `donfxulkliuyteiannir`.
- Its catalog reports anon execute `false`, authenticated execute `false`,
  service-role execute `true`, and confirms expected-link/version and absent
  head/link rejection predicates.
- The same migration was then applied to pilot `fnjkwymxpnsqvxtpronk`.
- Local lint, 108 tests, and the Next production build pass.
- Independent high-risk review found and this implementation repaired two
  defects before commit: retry identity now excludes fresh private credential
  material, and the adapter releases a credential only when the receipt
  advances the expected version by exactly one. The post-repair suite has 110
  tests passing, plus lint, production build, workspace verification, and
  private-handoff verification.
- Post-repair catalogs in both databases confirm browser execution remains
  denied, service-role execution remains allowed, stable retry intent is in
  the function hash, and new credential material is excluded from that hash.

## Remaining gate

The public-registration release switch remains disabled. A seeded real
concurrency matrix, browser lifecycle evidence, and independent high-risk
review are still required before this is release evidence.
