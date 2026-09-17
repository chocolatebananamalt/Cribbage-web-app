# Registration identity and public Director contact

**Date:** 2026-09-17

## Decision

New participant intake stores required `firstName` and `lastName` separately.
The familiar display name is a derived compatibility projection, not an input
that is parsed after the fact. Existing display-name-only roster history is
left unchanged.

CSV imports must use `First Name` and `Last Name`. They may additionally use
`Email`, `ACC #`, and `Scorecard Type`. A nonblank ACC number is uppercase
two-letter state prefix followed immediately by digits (for example `HI296`);
a blank scorecard type means Digital. Old `Player Name` files are rejected
with a conversion instruction because guessing name boundaries can corrupt a
scorecard, seating, or result identity.

The public Tournament Director name belongs to the tournament’s selected
public-contact history. It is never read from a private account profile at
public-registration time. Setup requires the value and rejects placeholders.
After finalization, only the primary director can create an audited correction
version. That operation neither reopens events nor changes registrations,
payments, seats, or the active QR credential.

## Consequences

- Every visible choice is labelled **Scorecard Type**, with exactly Digital
  and Paper values.
- A rehearsal CSV must use synthetic format-valid numbers such as
  `HI9001`–`HI9006`, not `RH-01`–`RH-06`.
- Genesis Rehearsal keeps its active QR unchanged. Its primary director may
  enter the selected public director name through the protected correction
  control after deployment.
