# Static input-label Title Case — local evidence

The requested consistency change is literal presentation only: 204 static input
captions/accessibility-label occurrences across 65 TSX files. The manifest records
each before/after caption and per-file SHA256, plus focused locator/assertion
updates. No runtime title-casing, user data, field IDs/names/values, API codes,
validators, money or policy logic changed.

Capitalized principal words while retaining ACC, Q-Pool, MRP, ID, USD, CSV, URL
and ZIP, and lowercase connecting words such as of/the/for/in/to/and within a
caption. MoneyInput, RateInput and UsdAmountInput label props were inspected and
are display/accessibility captions, not policy selectors. Heading/Feature/photo
label props were excluded. Full-sentence checkbox/radio attestations, questions,
instructions, placeholders/buttons and dynamic-label fragments remain unchanged.
The excluded playoff editor components/tests remain lead-owned.

## Executed checks

- Application suite: 1486 passed, zero failed (`test-results/title-case-application-tests-final2.log`).
- TypeScript noEmit passed; complete ESLint pass with zero errors and 97 warnings
  elsewhere in the combined workspace. No new application semantics were added.
- Existing isolated setup/recovery browser harness passed at 320, 390 and 1440 px,
  including 100%/200% layout, shared-save idempotency, exact retained retry,
  pool editing/reindex behavior and amendment gates. Local fictional intercepted
  APIs only. Phone/desktop screenshot pixels were inspected.
- The first local readiness request returned EACCES. One supported per-command
  escalated run completed; its server 6456 exited and followup exact-PID lookup
  found no process. No hosted browser/session was used.

Browser receipt: `test-results/setup-layout-save-browser/result.json`.
Log: `test-results/title-case-setup-browser-escalated.log`.
Inventory/hash manifest: `2026-11-04-input-label-title-case-manifest.json`.

Other routes have static review, type/lint and application regression coverage,
not individual browser acceptance in this pass. Full integrated build/release
verification remains with the lead. Nothing was published or applied to a DB.
