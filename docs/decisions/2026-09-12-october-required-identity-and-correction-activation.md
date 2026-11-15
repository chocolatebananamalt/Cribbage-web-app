# October required identity and correction activation

**Date:** 2026-09-12
**Status:** Accepted for the October pilot

## Decision

The witnessed roster-account activation workflow and migration 0140's
independent-card Rule 12 correction workflow are required October operations.
They are available in every application deployment and no longer depend on
Vercel environment toggles. A stale or missing hosting value must not hide the
only supported player-linking or official scorecard-correction path.

This changes availability, not authority. Account linking still requires a
current director or co-director to issue a one-time credential, the intended
signed-in player to redeem it, and an authorized witnessed decision. Rule 12
corrections still require a current eligible non-self cross checker, exact
original card evidence, the configured reason/review policy, immutable
receipts, and lifecycle-safe application. Browser roles retain no direct table
or writer access; server-only RPCs remain the mutation boundary.

## Evidence required

- Migrations through 0140 and subsequent repairs must be present in the pilot.
- Hosted rollback fixtures and the repository verification gate must pass.
- An anonymous live request must reach authentication and return `401`, not a
  feature-hidden `404`.
- Independent player/director/cross-checker browser rehearsal remains required
  before operational acceptance. The workflow being available is what makes
  that rehearsal possible; availability alone is not acceptance evidence.

The older default-off decision and verification records remain historical
evidence and are explicitly superseded only for release gating.
