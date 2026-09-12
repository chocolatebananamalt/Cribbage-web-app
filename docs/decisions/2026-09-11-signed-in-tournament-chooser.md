# Signed-in tournament chooser

## Decision

The production root page is the signed-in user’s tournament chooser. It calls
one server-only database function with the already verified Auth subject and
shows only non-archived tournaments for which that profile has an explicit
live tournament-role row.

When a profile holds multiple roles in one tournament, the displayed effective
role is deterministic: Director, Co-director, Judge, Cross-checker, Player,
then Viewer. A tournament appears once. The projection contains only tournament
ID, name, latest configured date, lifecycle status, and effective role; it
contains no roster, contact, or other member data.

The browser cannot execute the chooser function. The server-only adapter uses
the scoped Supabase secret only after the page has verified the current signed-
in subject, validates an exact bounded response, and fails closed. Archived
tournaments do not appear. The demonstration remains available separately and
never grants tournament access.

Identifier validation follows PostgreSQL's accepted 8-4-4-4-12 hexadecimal
UUID representation. It does not impose RFC version or variant bits because
existing imported tournament records can legitimately omit those bits.

## Why

Users should not need an opaque tournament UUID or an old direct link after
sign-in. Reusing explicit tournament roles preserves the existing authorization
model without inventing a global directory or widening any tournament reader.
