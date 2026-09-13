# Tournament setup activation release

Date: 2026-09-13  
Status: approved October release boundary

## Decision

Tournament setup activation and append-only event amendments are required
October operations and no longer depend on
`ACC_TOURNAMENT_SETUP_ACTIVATION_ENABLED`. This supersedes only the deployment-
toggle portion of the 2026-09-10 activation decision and the 2026-09-11
amendment decision.

The authorization model is unchanged. The routes require a verified session;
mutations require same origin and exact bounded request bodies; database access
uses the server-only client; and the database functions independently require a
current director or co-director, serialize the tournament, preserve exact
idempotent replay, and create immutable receipts/audit records. Unsupported,
stale, already-active, cross-tournament, and unauthorized requests continue to
fail closed.

## Reason

The activation migration and hosted rollback proof are approved and installed,
and Production already exposes the operation. Retaining an environment toggle
adds no authority boundary but creates a configuration-only failure mode: a
valid deployment can hide the setup controls and route after an environment
variable is lost or recreated incorrectly. Required pilot work must depend on
the application and database authorization layers, not on a stale release flag.

## Unchanged boundaries

- Saving a setup remains draft-only.
- Activation does not create participants, seating, games, scores, financial
  records, results, payouts, qualifiers, or ACC submissions.
- Team/doubles events remain paper-scored for the October pilot.
- Optional online payments, SMS, and OCR remain default-off provider features.
