# Setup finalization, registration contact, and device-recovery repair

Date: 2026-09-15
Status: Superseded in terminology and registration timing by
`2026-09-15-finalize-open-registration-and-event-replacement.md`

## Context

The Full Rehearsal setup was saved with four draft events, but its registration
credential returned an unhelpful public “unavailable” state. The current saved
revision predated structured tournament contact details, so it had no
player-facing phone/email. Separately, a failure of the independent
finalization-status request hid the otherwise editable saved setup form.

The combined **Sign out and clear this device** control also encouraged an
unsafe deletion of the only local recovery copy while offline work or retry
records could still be pending.

## Decisions

- **Save All Events Draft** creates a private, versioned setup revision only.
- **Finalize All Events / Open Registration** finalizes the complete saved
  event set, opens registration, and makes the saved event definitions
  available for roster enrollment, seating, schedules, finance, and later
  Start Play. It does not start play, close registration, assign seats, charge
  anyone, or publish results.
- A failed/invalid finalization-status read never hides a valid loaded draft.
  The UI shows a bounded status warning and offers a status refresh instead.
- A QR link cannot be issued or replaced unless the director’s current saved
  setup contains a valid tournament contact phone and email. The public
  registration response still uses only the director-selected contact values.
  Existing credentials become usable once a revised setup is saved with those
  values; no player data or events are rewritten.
- Ordinary **Sign out** preserves the local recovery copy for the same player.
  **Clear safe app data and sign out** appears only after the browser proves
  there are no queued offline scores and no app-owned retry records. It clears
  only this app’s browser data and is never a route to delete server records.

## Consequences

For the rehearsal, the director saves the existing draft once with the
tournament contact phone and email, refreshes the setup page if necessary,
then finalizes the four current events and uses the existing QR credential or
creates a replacement. The original four events remain intact. Event
retirement/replacement remains a separate, audited lifecycle operation; there
is no destructive delete path for operational event history.
