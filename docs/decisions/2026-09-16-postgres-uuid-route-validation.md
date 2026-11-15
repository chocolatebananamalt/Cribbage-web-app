# PostgreSQL UUID route validation

## Decision

Use one shared canonical PostgreSQL UUID validator for tournament identifiers
in the signed-in chooser, protected pages, and protected API routes.

## Context

PostgreSQL accepts canonical hexadecimal UUID values in `8-4-4-4-12` form
without requiring RFC version or variant bits. The chooser already accepted
that database-valid form, while protected Setup validation required RFC bits.
An authorized tournament could therefore appear in **Your tournaments** and
open its workspace but return a false 404 at Setup.

## Consequences

The shared validator accepts only canonical hexadecimal UUID formatting. It
does not grant access: each protected route still validates the authenticated
actor through its server-side role/RPC boundary. No historic tournament or
role data is rewritten as part of this compatibility repair.
