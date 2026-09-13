# Paper-card capture foundation boundary

Date: 2026-09-10
Status: superseded for release gating by the owner-approved 2026-09-12 private-storage decision

## Decision

Implement the first paper-scorecard capture increment as a private immutable
evidence record and a provider-neutral upload intent. A current independent
cross-checker may create it only for a canonical Standard
Singles game after selecting one card side and confirming that side's permanent
verification ID. An actor assigned to either side of the game cannot capture
the evidence, even if that actor also has an official role.

The database derives the tournament, event, round, assigned participant,
opponent, and permanent verification ID from existing operational records. It
stores the cross-checker's current role as a snapshot and binds the capture to an
immutable receipt and audit event. The original declared filename, media type,
byte size, SHA-256, camera/file source, and optional client capture timestamp
are preserved exactly in the restricted upload-intent record. Repeated captures
use new immutable records rather than overwriting earlier evidence.

## Provider and authority boundary

The server returns opaque capture, upload-intent, and object-reference UUIDs.
The reference is not a storage path, public URL, signed URL, or upload
credential. Its state remains `provider_pending` with restricted access until a
storage provider and policy are approved. Because no bytes can be uploaded by
this increment, the broad syntactic media-type and transport-number validation
does not assert supported image formats or a provider size limit.

The capture state remains `upload_provider_pending`; human review remains
`not_started`; OCR remains `not_requested`; retention remains
`restricted_hold`. There is no automatic purge timestamp. The response
explicitly states that upload is not authorized and that no image, public URL,
OCR draft, transcription, score change, or game verification exists.

This original increment hid the browser-facing route unless
`ACC_PAPER_CARD_CAPTURE_ENABLED=enabled`. The owner later approved live private
storage, and the 2026-09-12 decision makes capture available without that
deployment toggle. Same-origin, verified-session, current-role, non-self,
lifecycle, and service-only database boundaries remain required. Direct `anon`
and `authenticated` function/table access remains revoked.

## Deferred work

The dedicated camera UI and permission experience, restricted storage bucket
and upload/download policies, actual-byte digest verification, supported
formats and size limits, OCR provider or local OCR implementation, editable
human-reviewed transcription, comparisons/exception queue, access-event log,
retention/deletion/restore implementation, and real-paper/device validation are
separate increments. No feature switch is enabled and migration 0109 is not
applied to the shared pilot by this decision.
