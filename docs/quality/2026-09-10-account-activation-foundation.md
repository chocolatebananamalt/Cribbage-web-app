# Account activation foundation — 2026-09-10

## Scope

This increment creates the local, un-applied private persistence contract and
the server-only 256-bit activation-token primitive for the witnessed
roster-account linking ceremony. It also adds the server-only issuer adapter
and its private, receipt-bound issue transaction, which returns a credential
only when an exact future database receipt binds it to the freshly generated
activation ID. It does **not** open a browser route, issue a QR/link, redeem a
credential, expose a director workspace, or apply a database migration to the
pilot.

## Acceptance evidence in this increment

- Each credential has an existing UUID activation ID plus a 32-byte
  base64url secret. Parsing accepts only the exact `id.secret` fragment
  grammar; it normalizes only the UUID portion and treats the secret as
  case-sensitive.
- The only database-ready credential representation is a 32-byte salted
  SHA-256 digest. Tests reject malformed, URL-shaped, whitespace-altered, and
  incorrectly sized values.
- Migration `0090` contains only private `app` tables. RLS is enabled and
  forced, and `PUBLIC`, `anon`, and `authenticated` have no table grants.
- One partial unique index prevents two live activations for the same
  tournament roster identity. One request per activation and one request per
  tournament/profile prevent replay and cross-roster profile association.
- Events are append-only. No table stores a raw token, secret, claimed email,
  ACC number, or other identity search field.
- The issuer sends only bytea salt/digest values to its intended private RPC.
  A replayed accepted receipt returns `credential_unavailable`; a malformed
  receipt cannot masquerade as a valid replay.
- Migration `0091` exposes issuance only to `service_role`, rechecks that the
  supplied actor is the current director or co-director, serializes the
  tournament/roster identity, records an immutable receipt/audit/event, and
  preserves changed-operation-ID collisions as private immutable evidence.
  It expires a stale pending request before a replacement activation can be
  issued, releasing that profile for a later witnessed ceremony. It never
  receives or records the raw activation value.
- Migration `0092` and its server-only adapter redeem only a parsed activation
  ID plus a fixed-size digest. A narrow private salt lookup lets the
  application server derive that digest without forwarding the fragment value
  to SQL. A successful redemption creates a pending witnessed request and its
  generated phrase only; it does not link an account or alter tournament,
  enrollment, score, payment, check-in, or seating state. Rejected and expired
  credentials share a generic result shape.
- The request stores a distinct, generated inner link-operation ID. Migration
  `0093` adds the service-only equivalent of the existing roster-link writer
  for the later approval transaction; it rechecks the official role and all
  collision rules and remains unavailable to browser roles. It is not yet an
  approval path by itself.

## Verification

- `pnpm test` — pass, 136 tests.
- `git diff --check` — pass.

## Deliberate limits

The migrations are not yet applied. The remaining work must implement and test
the service-only cancel/approve transaction around the inner writer, stable receipts,
the nested link rollback, exact route envelopes, fragment-clearing no-third-
party page, and real independent-session/browser evidence before this feature
can be enabled. This increment neither changes player access nor weakens the
existing disabled browser roster-link boundary.
