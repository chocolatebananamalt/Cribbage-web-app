# Registration-Link V2 Database Boundary — 2026-09-10

## Scope

Migration `0071_secure_registration_link_lifecycle_v2` creates the private
database foundation for the approved fragment-only QR registration lifecycle.
It does not create an application route, issue a live URL, configure a server
secret, or enable public registration.

## Acceptance criteria

1. A v2 header stores only an opaque ID, 32-byte salt, and 32-byte digest; it
   has no raw bearer-token column.
2. The legacy one-link-per-tournament constraint is replaced by an
   ID/tournament composite relationship, immutable lifecycle event history,
   and one locked mutable active-head record per tournament.
3. Issue, rotate, close, redemption-material, and claim functions are denied
   to `anon` and `authenticated`; only `service_role` can invoke them, and
   each lifecycle writer independently rechecks the supplied official's
   current tournament role.
4. Legacy header/claim history stays linked and retired; no migration creates
   an enabled v2 link.

## Disposable-first evidence

Migration `0071` was applied first to the separate empty synthetic project
`donfxulkliuyteiannir`. Its catalog returned all of the following:

- the three new `app` tables have RLS enabled and forced;
- all five v2 public functions deny `anon` and `authenticated` execution and
  permit `service_role` only;
- the composite registration-claim foreign key exists;
- zero legacy links and zero enabled links remain.

The fresh security advisor introduced no anonymous-executable-function finding
for the v2 functions. Its private-table RLS/no-policy notices and existing
authenticated role-checked RPC notices remain the intentional private-RPC
model; the synthetic database's unused-index notices are not a basis to drop
integrity indexes before representative-load testing.

## Pilot application evidence

Before pilot application, an aggregate-only preflight on
`fnjkwymxpnsqvxtpronk` returned zero links, zero enabled links, zero claims,
and zero incoherent claim/link relationships. The exact reviewed migration
then applied successfully. The same pilot catalog checks confirmed forced RLS,
the composite foreign key, five service-role-only functions, and zero v2 or
enabled link rows.

No raw token, player, tournament, claim, or payment detail was read.

## Remaining proof

The actual application-server routes need a separately configured server-only
Supabase secret key. Before any v2 link may open, the project still requires
route/UI validation, service-role transaction tests with synthetic director and
player accounts, issue/rotate/close/claim race tests, direct browser denial,
fragment/network/storage canary evidence, and independent browser sessions.
