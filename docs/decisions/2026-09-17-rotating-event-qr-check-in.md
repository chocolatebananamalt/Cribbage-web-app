# Rotating Event QR Check-In

Date: 2026-09-17

Each event owns its own director/co-director-controlled check-in window. A
short-lived QR fragment credential is generated only while that window is
open, rotates every sixty seconds, is bound to one tournament/event, and never
contains identity, payment, seating, schedule, score, or result information.

The public scanner receives only a check-in outcome or a neutral desk message.
An automatic check-in requires an exact roster identity, an event enrollment,
and an explicit current payment obligation that has been received in full.
The desk action separately rechecks those facts and is not a payment or
enrollment shortcut. Consolation check-in is held until Main qualification has
been finalized.

Email app-access delivery is intentionally fail-closed pending an
ACC-controlled verified Resend SMTP configuration, callback/linking design,
and the required 600-in-45-minute delivery/retry evidence. The new QR feature
does not pretend that this external configuration already exists.
