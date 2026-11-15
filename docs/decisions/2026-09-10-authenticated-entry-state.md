# Authenticated entry-state decision

Date: 2026-09-10 (Pacific/Honolulu)

## Decision

The Production root page must distinguish an authenticated Supabase session
from an anonymous visitor. An authenticated visitor receives a generic
“You’re signed in” acknowledgement, a direction to use the director-provided
registration or tournament link, and the shared-device sign-out control.

The acknowledgement does not display identity, infer a tournament, list
private memberships, or grant a role. Tournament pages continue to authorize
the requested tournament independently through the server-side membership
boundary. An authenticated request for `/sign-in` redirects to `/` so it
cannot accidentally request repeated one-time emails.

## Reason

The prior root and sign-in pages ignored a valid authenticated session. A
successful magic-link exchange therefore looked identical to a failed sign-in
and encouraged repeated requests until Supabase's email rate limit intervened.

## Boundary

This decision improves authentication feedback only. It does not create a
profile, role, roster link, tournament membership, or operational access.
