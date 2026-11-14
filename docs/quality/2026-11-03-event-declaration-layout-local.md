# Event-prize declaration layout repair — local only

## Observed failure and scope

On 2026-11-03 the actual user-owned Chrome tab 336434491 was inspected read-only, without navigation, refresh, typing, clicking or scrolling. Its unsaved Main/Consolation/pool edits remained intact. The Main declaration section measured 654px wide, but inherited `.setup-subsection`'s four-column pool-row grid: columns approximately 94.8/58.3/94.8/340.1px. Explanatory text occupied only 58.3px and the formula fieldset only 94.8px, producing vertically stacked words. This was directly observed, not inferred from a screenshot alone.

Only `event-prize-declaration.css` changes product behavior. Its declaration-specific outer grid now has one full-width track and stretched children; direct children remain shrinkable and bounded. The existing inner two-column formula fieldset and phone single-column rule remain. No formula, fee, API, recovery, activation, permission or database logic changed.

## Regression and executed checks

The real setup-component browser test gained meaningful width checks for headings, paragraphs and fieldsets in both event declarations, plus no-overflow checks and screenshots. Before the fix it failed at 768px: heading 125.2px inside a 654px section. After the fix all six existing scenario groups passed, including normal/enlarged text at 390/768/1440px, stale/unsupported/offline/race/dirty declaration checks, exact unresolved finalization retry and legacy/V2/unknown amendment guards. Endpoints are fictional local mocks; no hosted write was performed. Phone and laptop screenshots were visually inspected and independently reviewed.

Full `pnpm verify` completed: audit no known vulnerabilities; ESLint 0 errors/64 existing warnings; 1,227 application tests passed; provider checks, TypeScript and optimized production build passed; workspace 8/8. Local handoff checks passed 6/6. An initial launch did not run the nested command because pnpm was absent from subprocess PATH; the successful run supplied only the existing pnpm/Node directories to that process, without system-setting changes.

Evidence: `test-results/declaration-layout-verify.log`, `test-results/declaration-layout-handoff.log`, `test-results/setup-declaration-readiness-browser/result.json` and its six declaration screenshots. Independent Sol review found no outstanding P1/P2 findings. No checks were weakened or restarted by the reviewer.

## Fee and official-control diagnosis (read-only, unchanged)

The rate editor can be opened/cancelled without saving. A successful adjusted-rate save immediately persists an audited override and calls `load()`, which replaces the setup payload from its saved server version. Save All Events Draft before testing a rate save. A changed amount and written reason are required; ACC approval guidance and before-start guards remain. No override was performed.

Officials Add/Remove links navigate away and discard unsaved setup edits. Save All Events Draft first. Official-role Save immediately creates a nomination/invitation; default email delivery uses sign-in OTP with account creation enabled and can create an Auth account for an unknown address. Copy-link delivery returns before that path, sends no email and creates no Auth account; exact-email personal acceptance is still required. Self-assignment is rejected. Use only authorized existing test identities and Share link without email for the bounded rehearsal. No invitations, accounts or roles were created or altered.

## Publication boundary

The proposed publication is exactly two files: declaration CSS and its browser regression, on existing PR122 from base commit `1120773bcfcbb49247096dbaab7f7eb948c6e0ea`. No migration, hosted data action, role assignment or feature expansion is needed. This report and status notes are local evidence, not silently included in that two-file scope. Publication requires separate approval. Save the user's draft successfully before any later refresh to load new CSS; the agent has not refreshed or modified the user's page.
