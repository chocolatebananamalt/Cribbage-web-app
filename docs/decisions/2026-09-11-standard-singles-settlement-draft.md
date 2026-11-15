# Bounded Standard Singles settlement draft

**Date:** 2026-09-11
**Status:** Database implementation ready for hosted review

## Decision

Post-event placement and award entry begins as a private, immutable, versioned
draft tied to one exact finalized qualification version. Each replacement is a
new version with an expected-version check and supersession link. Only a
director or co-director may save or read it through server-held credentials.

Placements must begin at 1, remain sequential and unique, include at least a
winner and runner-up, and name only qualifiers from the bound result. Awards
also name only qualifiers. A Q-pool award must reference slot 1 or 2 on the
same setup event and revision that activated the operational event. Other
awards cannot claim a Q-pool slot. All amounts are bounded integer USD cents.

The draft snapshots the exact active manual-payment receipt events and active
expense events visible at save time. Those receipts are tournament-wide and
are not allocated to a specific event, so the output remains `reconciled:
false`. It always reports the missing official MRP and Q-pool payout fixtures,
unsupported event payment allocation and reconciliation, and unsupported
official export. MRP input is not accepted.

This migration creates no publication, approval, payout calculation, MRP
calculation, or export function.
