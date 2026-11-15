# Adopt new prize settings without erasing legacy declarations

Use the existing event-prize envelope, atomic writer and guarded activation
architecture. Do not translate the latest policy into fabricated V1 payout
fields or hide a declaration still required by finalization.

The new workspace reader is authoritative about historical absence, current
settings/prize pins and exact event coverage. A legacy setup with no settings
history is adoptable; a missing head with history is unavailable. Client defaults
do not establish absence. Current Director/Co-director authorization and source
locks apply before reading any head; owned recovery remains available separately
from writes.

The shared editor may show latest controls while preserving dormant V1 raw
fields. Actual Setup adoption and finalization must move together before release.
Saving a proposed method does not approve a fund, calculate awards or disburse
money. Existing historical snapshots and financial outcomes remain unchanged.

Local PostgreSQL proved storage/retry/recovery/rollback and competing-writer
behavior; real provider sessions, browser recovery, new-policy finalization and
accounting remain unproven. See the 2026-11-08 quality checkpoint.
