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
- Focused Node tests: final setup/contact/registration group — 70 passed, 0 failed; layered Setup adapter contract — 4 passed, 0 failed.
- Clean-checkout `pnpm verify` — passed: dependency audit, lint with two existing warnings and zero errors, 736/736 application tests, provider readiness, optimized Production build, and workspace checks.
- `pnpm verify:handoff` — unavailable because the ignored private handoff package is not present in either checkout; the standard verification confirms this is intentionally excluded from Git.
- Revised desktop layout preview rendered in headless Chrome at 1200 pixels with an 860-pixel compact form area.
- A true 390-pixel Chromium viewport preview was rendered to inspect the one-column field order and horizontal fit.
- Migrations 0233–0235 were applied first to the synthetic Supabase project and then to the pilot project. A pilot rollback-only fixture returned `setup_draft_saved` and `public_contact_configured`, preserved all five structured values, stored omitted phone/email as null in both immutable records, and left the selected tournament at zero setup revisions after rollback.
- Direct privilege checks on both hosted projects returned `authenticated_can_execute=false` and `service_can_execute=true` for Setup activation.
- Post-DDL Supabase advisors show the established RPC-mediated RLS and performance baseline; the new migrations add no tables or foreign keys. Reference: [Supabase database linter](https://supabase.com/docs/guides/database/database-linter).

## Remaining release checks

Push the reviewed branch, pass GitHub checks, merge it, confirm the connected Vercel Production deployment is READY, inspect the signed-in Setup screen at desktop and phone widths, smoke-test stable public routes, and scan runtime errors.
