# ACC integration-first, replacement-ready strategy

**Decision date:** 2026-09-10  
**Status:** Accepted production strategy  
**Scope of portal observation:** Read-only Tournament Director access only; no ACC records were changed. Commissioner, statistician, and administrator behavior remains unverified.

## Decision

The first pilot will use the ACC Tournament App for live tournament operations: registration, check-in, seating, independent scoring and confirmation, standings, recovery, and director operations. The existing ACC system remains authoritative for sanctioning, the official schedule, membership and Master Rating Points, approvals, and historical records.

The product is therefore **integration-first and replacement-ready**. It must maintain clean tournament boundaries, durable identities, idempotent writes, versioned rules and results, append-only history, and an explicit external-system boundary. Those foundations support a later ACC-authorized integration without expanding the first pilot into a premature nationwide replacement.

The first supported handoff will be a versioned, director-reviewed ACC submission package followed by manual portal entry. The app must never label that package as submitted, accepted, or official merely because it was generated.

Credential-based browser automation and automatic ACC submission are prohibited. Automated synchronization remains disabled until ACC provides or approves all of the following:

1. a supported API or import format;
2. a sandbox or service identity;
3. documented idempotency, reconciliation, error, and retry behavior; and
4. written operational approval.

## Read-only portal findings

The observed Tournament Director workflow included recurring/shared templates, active/inactive and per-user hidden templates, sanction requests routed to Regional Commissioners, approve/disapprove/revise states, date-based editing restrictions, cancel/reinstate, Tournament Trail publication, flyer upload/approval/publication, Main/Consolation/Satellite result entry, Standard/Double Elimination and Standard/Consy Lite styles, participant and game counts, automatic qualifier counts, Q pools, fees and additional income, player results and prizes, 28/29 hands, printable event/Q/side-pool payouts, notes and receipt reminders, save-draft/complete controls, reviewer correction loops, completed read-only financial/award results, member lookup, and an unsaved side-pool calculator.

Observed statuses included Sanction Pending, Disapproved, Approved, Cancelled, Awaiting Review, Awaiting Commissioner Review, Awaiting Statistician Review, Results Disapproved, and Complete. These observations shape the export boundary; they are not proof of commissioner, statistician, or administrator permissions or server behavior.

## First-pilot foundation gates

Before a real first pilot, the implementation and evidence must establish:

- `tournament_id` on every tournament-owned record and a complete schema audit;
- server/database tenant and role enforcement, including cross-tournament and self-action rejection;
- globally unique internal identifiers with separate external-system provenance;
- idempotency for registration, check-in, scoring, confirmation, correction, and finalization;
- atomic two-submission/two-confirmation verification;
- append-only audit and correction history;
- dated tournament rule-version references;
- separation of configuration from operational results, and of test/pilot/production data;
- tournament-scoped indexes and archived-event query isolation;
- bounded Realtime/subscription and connection behavior;
- explicit online, pending-sync, retry, conflict, and reconnect semantics;
- an ACC export boundary whose generated artifacts cannot be mistaken for official submission; and
- a director-reviewed ACC package with validation, provenance, checksum, and reconciliation.

## Later automation or replacement gates

A broader ACC replacement is not authorized by this decision. It additionally requires formal ACC sponsorship, access to and validation of all portal roles, official rule and data specifications, historical migration, security/privacy governance, support and disaster recovery, nationwide parallel validation, and approved cutover and rollback plans.

## Acceptance evidence

Each gate must be tracked as Implemented, Partial, Missing, Unverified, or Not authorized. Documentation-only or inferred controls cannot be labeled implemented. Evidence must include exact migrations/files/tests, positive and rejection behavior, applicable `pnpm verify` and `pnpm verify:handoff` results, browser or integration proof where required, limitations, and a diff review against the normative requirements.
