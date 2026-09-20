# Structured venue and Director name preview evidence

## Acceptance criteria

- Desktop Setup uses the owner-specified row order and separate venue/name fields.
- Venue name, street, city, State/Territory, ZIP, and both Director name parts are required before the details save can unlock events.
- Phone layout stacks safely; desktop venue address fields remain on one row.
- Director first name, last name, optional phone, and optional email share one compact desktop row inside a single outlined player-facing information area.
- Optional contact values never fall back to private profile data and do not block activation or QR-link issuance.
- New values are versioned without rewriting historical setup records.
- No merge or Production deployment occurs before owner layout approval.

## Executed checks

- TypeScript: `tsc --noEmit` — passed.
- Focused Node tests: setup workspace, sanctioning-fee clarity, setup official management, and structured tournament contact — 23 passed, 0 failed before the final added rejection assertions.
- Revised desktop layout preview rendered in headless Chrome at 1200 pixels with an 860-pixel compact form area.
- A true 390-pixel Chromium viewport preview was rendered to inspect the one-column field order and horizontal fit; authenticated browser verification remains required after approval and before merge.

## Current limitation

The database migration has not been applied to a hosted Supabase project, the full repository verification has not yet run, and this branch has not been pushed, merged, or deployed. Those steps intentionally wait for owner approval of the proposed layout.
