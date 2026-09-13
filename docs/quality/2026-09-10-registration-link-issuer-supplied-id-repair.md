# Registration link issuer-supplied ID repair — 2026-09-10

## Critical finding

The v2 credential format is `link-id.secret`. Its digest therefore depends on
the link ID before the database write. Migration 0071 instead generated the
link ID inside the database after accepting a salt and digest, so a future
server could not create a credential whose ID matched the stored digest.

No v2 header or public route existed, so the defect affected no issued link.

## Repair

Migration `0073_registration_link_issuer_supplied_id.sql` replaces only the
private writer and its service-only issue/rotate wrappers. The application
server must now generate the opaque UUID first, construct the fragment-only
credential, and derive the salt/digest from that exact credential. The
database:

- accepts the supplied UUID as `p_link_id`;
- includes it in the immutable idempotency fingerprint;
- inserts it as the header ID and returns the same ID in the receipt;
- rejects an improbable pre-existing UUID after the receipt replay check; and
- preserves the existing role recheck, lock, active-head, expiry, rotate, and
  service-role-only constraints.

The prior overloaded issue/rotate wrappers were dropped before the corrected
signatures were installed, avoiding an accidental fallback to the incompatible
interface. No raw credential is a database parameter or column.

## Evidence

- The corrected migration applied first to the disposable synthetic project.
  Catalog inspection found exactly the new nine-argument issue and rotate
  signatures; both deny `anon` and `authenticated` and allow only
  `service_role`.
- It then applied to the pilot project. No v2 link was opened or existing
  claim changed.
- A static regression test verifies that supplied ID, digest fingerprint,
  insert, receipt response, and absence of a database-generated issuer ID
  remain coupled.

## Remaining proof

The server-only secret, route/UI implementation, service-role transaction,
real issue/rotate/close/redeem race test, and browser fragment/network canary
remain mandatory. This repairs a critical prerequisite; it does not enable
public registration.
