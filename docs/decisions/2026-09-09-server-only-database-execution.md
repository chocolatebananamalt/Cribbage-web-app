# Server-only database execution for sensitive identity operations — 2026-09-09

## Finding

The current application is deliberately configured with only the public
Supabase URL and publishable key. Its server route client carries the current
user's browser session, which is appropriate for existing authenticated RPCs
but cannot make a new identity-link activation function unreachable from an
authenticated browser.

## Decision

Do not add an activation function executable by `authenticated`. The activation
feature requires a dedicated server-only database execution identity. The
credential must be stored only in Vercel's encrypted server environment and
must never be named with `NEXT_PUBLIC_`, included in `.env.example`, logged, or
passed to a client component.

The protected Next.js route verifies the current session and same-origin
request first. It then invokes the private activation transaction through that
server-only identity, passing a verified subject and a narrow operation
envelope. The transaction verifies the trusted execution identity and the
supplied verified subject before any read or mutation. Browser-facing Supabase
clients retain no direct execute grant for activation functions.

## Implementation gate

Before implementation, provision a server-only credential in the pilot and
Vercel preview environments, demonstrate that it is not present in a browser
bundle, and prove that an authenticated browser's direct RPC attempt is denied
while the protected server route succeeds. This is an application security
gate, not a request for any player or director to share credentials.
