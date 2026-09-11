# Public synthetic demonstration — 2026-09-10

## Decision

The existing `/demo` interface is available through a direct public URL
without email sign-in so the owner can share the current design with friends.
It remains a sample-data demonstration and is not a public tournament
workspace.

## Boundary

- The route renders only the in-memory synthetic `TournamentDashboard`.
- The request proxy passes `/demo` through before Supabase session refresh, so
  the public interface does not depend on authentication infrastructure.
- The two same-origin PDF resources linked from the demonstration use the same
  pre-session pass-through. The qualification PDF contains only fictional
  fixtures; the cached ACC Rulebook is public with the owner's confirmed
  permission.
- Every displayed person, identifier, tournament, place, date, and score row
  uses a clearly fictional demonstration fixture rather than source material.
- The demonstration contains no Supabase client, fetch request, application
  mutation route, server action, tournament identifier, private roster, or
  operational record.
- Its controls change browser-memory sample state only and are discarded when
  the page is closed or refreshed.
- A persistent banner says `Public Demonstration · Sample Data Only`, explains
  that nothing is saved and no real tournament information is available or
  changed, and links separately to tournament sign-in.
- Real registration, tournament, scoring, finance, correction, and official
  result routes retain their existing authentication and tournament-role
  requirements.
- Site-wide no-index headers remain in force so the demonstration is shared by
  direct URL rather than presented as public search content.

## Acceptance

An anonymous production request to `/demo` must return the sample interface
without a sign-in redirect. Source and runtime evidence must show no
demonstration request to `/api/v1`, Supabase, or another mutation boundary.
The protected tournament routes must continue rejecting visitors without the
required signed-in tournament role.
