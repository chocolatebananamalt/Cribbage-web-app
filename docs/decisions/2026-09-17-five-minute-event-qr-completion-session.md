# Five-minute Event QR Completion Session

**Date:** 2026-09-17
**Status:** Accepted and implemented pending release verification

## Decision

Keep the live, event-specific QR code as a 60-second physical-presence check.
When a phone opens a currently valid code, exchange it immediately at the
server for a separate opaque completion session lasting five minutes. Remove
the original QR credential from the browser address/history, show the player a
countdown, and require First name, Last name, Email, and an uppercase ACC
number before event check-in can be requested.

## Rationale

A short-lived display code helps reduce remote sharing, but it must not rush a
player who scans at the end of its minute. The one-time exchange keeps the
presence check short while allowing a reasonable, visible form-completion
window. The server, rather than browser time, remains authoritative for expiry
and event-window state.

## Boundaries

- A completion session is opaque, scoped to one tournament and event, and
  stored as a salted digest with timestamps only.
- Bootstrap and submit reveal no roster, payment, seating, score, or result
  data.
- Closing the event window invalidates an otherwise unexpired session.
- Paid/enrolled exact matches check in once; all other requests retain the
  private desk-routing workflow.
- At five minutes, the player must scan the current live display again.

## Consequences

The player sees warnings at one minute and thirty seconds, can reload during
the five-minute window, and never needs the original QR code after a successful
bootstrap. Physical device/venue testing remains a release gate.
