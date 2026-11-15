# Event finalization readiness is a blocked-only evidence report

Date: 2026-09-10
Status: accepted implementation boundary; release remains default-disabled

## Context

The application has authoritative score, correction, roster-payment, ruleset,
and publication records, but it does not yet have event-lifecycle,
schedule-completeness, seating/eligibility, unresolved-dispute, full financial
reconciliation, classified-attachment, result-version, or director-approval
evidence. The manual payment ledger records events; it does not prove that all
tournament finances and reporting are reconciled.

## Options considered

- Reuse the client-side finalization checklist. Rejected because it is not a
  server authority and cannot protect private tournament evidence.
- Infer missing evidence as complete or calculate final results. Rejected
  because absence is not proof and the sourced qualifier, MRP, Q-pool, payout,
  eligibility, and export rules are not implemented.
- Add a server-authoritative, blocked-only evidence report. Selected because it
  exposes the evidence that exists without granting any finalization authority.

## Decision

Migration 0110 adds one stable, service-role-only read function. It independently
reauthorizes the supplied actor as the tournament director or co-director and
returns exact tournament/event-scoped counts for canonical game states,
verified/corrected scoreline completeness, pending legacy and independent
corrections, roster payment-event state, historical payment operation conflicts, and
configured ruleset/publication evidence.

The response is always `blocked`, `readyForFinalization: false`, and
`finalizationAuthorized: false`. Missing event lifecycle, schedule completeness,
seating/eligibility, dispute, finance/reporting reconciliation, attachment
classification, result version, and director approval are always explicit
blockers. Historical payment-operation conflicts remain diagnostic evidence and
do not permanently block an event without a separately defined resolution model.

The protected GET route uses a verified session, checks the current
director/co-director role, then invokes the server-only reader. The route is
default-disabled behind one exact environment value. That allows controlled
staging proof without granting finalization authority. Production remains off
until migration ordering and real independent-session proof are complete.

## Consequences

- This slice performs no writes and does not calculate or publish standings,
  qualifiers, MRPs, Q-pools, payouts, eligibility, or ACC exports.
- A consumer must reject malformed, extra, cross-scoped, internally inconsistent,
  or positive-readiness claims from the database.
- Finalization remains impossible until the eight missing evidence authorities
  exist and are separately specified, implemented, and verified.
