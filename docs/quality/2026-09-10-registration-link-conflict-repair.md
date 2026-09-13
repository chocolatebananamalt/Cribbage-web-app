# Registration-link conflict and retry repair — 2026-09-10

## Acceptance criteria

1. The protected director issue route remains unavailable until the exact
   public-registration release switch is enabled.
2. A normal issue returns a generated bearer credential once; a prior accepted
   receipt must never cause the server to recreate, recover, or return that
   credential.
3. Expected `active_link_exists` and idempotency conflicts are durable,
   narrow database outcomes rather than thrown exceptions that roll back their
   audit evidence.
4. A conflict can reference a prior operation receipt only in its own
   tournament scope. Browser roles remain unable to execute lifecycle RPCs.

## Repair

- The issue API now uses the same exact `ACC_PUBLIC_REGISTRATION_V2` release
  switch as redemption. It returns `404` while the feature is disabled.
- The issuer distinguishes an exact new issuance from a narrow expected
  conflict and from a previously accepted receipt. The latter returns only
  `credential_unavailable`; it never reconstructs or returns raw link
  material.
- Migration `0074_registration_link_conflict_receipts` makes the two expected
  lifecycle conflicts JSON results, so their immutable conflict rows commit.
  It adds tournament-scoped prior-receipt integrity and leaves cross-tournament
  prior receipts unlinked.

## Evidence

- Migration applied to disposable synthetic project `donfxulkliuyteiannir`
  before the pilot, then to pilot `fnjkwymxpnsqvxtpronk`.
- Disposable catalog proof confirms the composite prior-receipt constraint;
  the writer contains the non-throwing active-conflict return; and `anon` and
  `authenticated` cannot execute issue, rotate, or close while `service_role`
  can.
- `pnpm lint` — pass.
- `pnpm test` — **95** passing tests, including no-recovery and durable
  conflict regression cases.
- `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check`
  — pass.

## Remaining limits

This fixes the identified conflict/retry defects but does not enable public
registration. Real service-role transaction and concurrent issue/rotate/close
proof, a private director state/read/rotate/close interface, hosted-secret
configuration, and independent browser sessions remain release gates.
