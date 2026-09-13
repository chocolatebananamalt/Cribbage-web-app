# October payments, paper storage, and future providers

**Date:** 2026-09-12
**Status:** Accepted for the October pilot

## Decision

The October pilot accepts only cash, check, or both, as configured by a
director or co-director for each tournament. Registration records the player's
intended method. Private finance records amount owed, current cumulative amount
received, remaining balance, derived status, actor, timestamp, and immutable
correction history. A check number may be kept in the optional bounded receipt
note; bank-account and routing numbers must never be entered.

A mistaken receipt, full refund, or partial refund is represented by voiding
the current cumulative receipt with a required reason and, when a non-zero
amount remains received, recording a replacement cumulative total. This keeps
the original evidence and correction history without creating a mutable paid
flag. Payment state never grants check-in, seating, enrollment, scoring, or
results authority.

Cash App Pay, Apple Pay, Google Pay, Venmo, and Venmo Tap to Pay are catalogued
as future optional methods. They remain default-off until merchant ownership,
provider credentials, webhooks, refund/chargeback behavior, settlement, and
live tests pass. Their absence cannot block the cash/check pilot.

Paper scorecard originals may be retained in the private Supabase bucket
`paper-scorecards-private` under restricted hold with no automatic purge.
Browser roles have no direct storage policy. Upload authorization and receipt
recording are service-only, paths contain opaque identifiers, and saved bytes
are checked against the declared size and SHA-256 digest.

OpenAI-assisted OCR produces only an editable, versioned transcription draft.
It uses a server-only key, disables provider-side response storage, rejects
impossible or ambiguous cells, and can never verify a game or update standings.
OCR remains default-off until a real provider probe and false-read review pass;
human paper-card transcription remains the pilot fallback. `store: false`
prevents application response storage but is not represented as eliminating
provider abuse-monitoring or image-safety retention; that disclosure must be
reviewed before live activation.

The review prototype's table plan derives every displayed table from the
director's configured table and seat counts instead of a fixed three-table
fixture.

## Consequences

- New incoming registration claims and payment receipts reject any method
  other than the tournament's currently enabled cash/check choices.
- Historical `other` payment evidence remains readable but cannot be newly
  recorded.
- At least one of cash or check must remain enabled.
- OCR and all digital payment providers fail closed and are not October launch
  dependencies.
- Physical multi-user, reconnect, photo, and director rehearsal evidence is
  still required before declaring the complete pilot operationally accepted.
