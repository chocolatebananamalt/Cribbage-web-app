# Account activation foundation — 2026-09-10

## Scope

This increment creates the local, un-applied private persistence contract and
the server-only 256-bit activation-token primitive for the witnessed
roster-account linking ceremony. It also adds the server-only issuer adapter,
which returns a credential only when an exact future database receipt binds it
to the freshly generated activation ID. It does **not** open a browser route,
issue a QR/link, redeem a credential, expose a director workspace, or apply a
database migration to the pilot.

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

## Verification

- `pnpm test` — pass, 131 tests.
- `git diff --check` — pass.

## Deliberate limits

The migration is not yet applied. The remaining work must implement and test
the service-only issue/redeem/cancel/approve transactions, stable receipts,
the nested link rollback, exact route envelopes, fragment-clearing no-third-
party page, and real independent-session/browser evidence before this feature
can be enabled. This increment neither changes player access nor weakens the
existing disabled browser roster-link boundary.
