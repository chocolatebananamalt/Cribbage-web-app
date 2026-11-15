# Director administration and tournament creation

Date: 2026-09-13  
Status: Accepted and implemented

## Decision

Director administration belongs in the existing ACC Tournament Desk. The app
owner and designated ACC administrators may decide whether a signed-in account
is approved to create tournaments in this app. That approval is not the same
claim as ACC-verified director status; only an ACC administrator can set the
ACC-verified flag.

An approved director receives **Create Tournament**. One server/database
operation creates a named and dated draft, records its creator, assigns the
creator as primary director, and makes it discoverable under **Your
tournaments**. Players and unapproved accounts cannot create tournaments.

Applications, decisions, suspensions/restorations, tournament creation, and
role assignment are private, role-checked, idempotent, and audit recorded.
Browser database roles cannot call the underlying mutation functions directly.

## Rehearsal bootstrap

The approved pilot database contains one distinct draft named **Full Rehearsal
— 09-16-2026**. It is separate from Pilot Tournament and October 3 Pilot
Tournament. The app owner is its creator and sole primary director. The
approved director mistakenly assigned during the original bootstrap is its
co-director; she retains independent authorization to create her own
tournaments but has no platform-administrator authority. The correction was
made against the existing unused draft with an idempotent receipt and audit
events, not by creating another rehearsal. Only fictional rehearsal identities
and payment data may be added.

## Deferred extension

Directors may later invite permitted co-directors through an equally explicit,
audited lifecycle. This decision does not grant Supabase dashboard access or
make tournament-scoped roles global.
