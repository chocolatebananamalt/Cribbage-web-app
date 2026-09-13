# Private settlement working copy

**Date:** 2026-09-11
**Status:** Implemented locally; hosted verification pending

## Decision

A director or co-director may download a CSV working copy only after an
immutable post-event settlement draft exists. The server obtains both the
settlement workspace and locked qualification result through their existing
role-scoped, service-only readers. The generator rejects a missing draft or a
qualification-version mismatch.

The artifact labels itself **provisional**, **not reconciled**, and **not an
ACC submission**. It presents playoff placement claims separately from the
locked qualifying-round ranks; the High Non-Qualifier follows the qualifier
list. Director-entered award claims, tournament-wide server cash snapshots,
and every unresolved blocker remain visible. Spreadsheet-formula prefixes in
text fields are neutralized on export.

This is not the planned `acc-results-v1` director-assisted ACC export. It adds
no publication, approval, reconciliation, MRP calculation, Q-pool payout
calculation, ACC schema mapping, or portal submission path.
