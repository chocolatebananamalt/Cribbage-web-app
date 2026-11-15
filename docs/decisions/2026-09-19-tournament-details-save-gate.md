# Tournament details save gate

**Date:** 2026-09-19

## Decision

Tournament Setup is a deliberate two-stage draft workflow. A director first
enters the tournament identity, location, schedule, and public contact fields,
then presses **Save Tournament Details & Continue**. The server records that
first save as the ordinary private, versioned setup revision with an empty
event list. Tournament Event add/edit/remove controls remain visibly disabled
until that save is confirmed.

The first-stage fields are Tournament name, City, Venue name/address,
State/Territory, Time Zone, local start and end date/time, player-facing
Tournament Director name, required tournament contact phone and email, and an
optional tournament mailing address. The page names every incomplete or
invalid required field before enabling the save.

After the first save, event setup uses the existing **Save All Events Draft**
and **Finalize All Events / Open Registration** lifecycle. Editing tournament
details after events exist does not create a second kind of record or discard
events; it makes the complete setup dirty and finalization remains disabled
until the entire updated draft is saved.

## Consequences

- A director cannot accidentally configure events against unsaved tournament
  identity, location, schedule, or public contact data.
- Existing setup versioning, retry recovery, authorization, audit history, and
  finalization rules remain authoritative.
- A confirmed details-only revision legitimately has zero events. It creates no
  operational event and does not open registration.
- Existing tournaments that already have a saved setup revision open with
  event editing available and are not forced through an artificial second
  bootstrap step.

## Non-goals

- No parallel tournament-details table, API, or lifecycle is introduced.
- Saving details does not finalize events, open registration, collect payment,
  assign seats, or start play.
- This change does not redesign the event cards, official-management pages, or
  post-finalization amendment workflow.
