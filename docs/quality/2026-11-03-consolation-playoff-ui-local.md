# Local synthetic Consolation playoff UI — 2026-11-03

This local-only slice connects the 0278 source-bound workspace, writer and
reconciliation to a director/co-director screen for four synthetic Consolation
qualifiers. It displays only an existing, exact event/source/version/series
artifact, including its text and SHA-256 reference. A missing artifact or
non-enrolled event blocks recording; no owner-only preparation function is
exposed. The request explicitly states `physicalPlayAttested: false` and the UI
does not claim physical play or independent human verification. No physical
event entry, accounting dispatch, payout, publication, or hosted write is
implemented by this UI.

The server derives the actor from the verified session, checks same origin for
mutations, validates exact request and artifact scope, and calls the private
service boundary. Retained work uses the registered `payment-obligation:`
recovery prefix and is scoped to actor, tournament, and event. Reconciliation
precedes retry; retry reloads the current source and validates source, version,
artifact and the exact retained request. The client verifies storage readback
after creation and removal; a failed or ineffective write blocks a POST, and a
failed or ineffective removal preserves and blocks confirmed work.

Executed locally:

- `node --experimental-strip-types --test tests/consolation-playoff-api.test.mjs tests/five-playoff-api.test.mjs tests/synthetic-event-evidence.test.mjs tests/recovery-writer-inventory.test.mjs` — 17 passed.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` — passed.
- Targeted ESLint on the changed TypeScript and TSX files — passed using the
  ESLint API with literal file paths (CLI globbing interpreted bracketed route
  directories as patterns).
- `node --experimental-strip-types tests/consolation-playoff-browser.mjs` —
  passed using a local loopback server and mocked API. Phone 390px and desktop
  1440px checked; screenshot files are under `test-results/`. Tests cover
  visible evidence and hash, single-flight saving, missing artifact and
  non-synthetic blocking, lost-response reconciliation, stale-source retry,
  no-op storage set, and no-op storage removal.
- The separate 0278 isolated full-schema database suite passed with migrations
  0237–0277 followed by 0278. Its qualifying score rows are explicitly
  unstructured synthetic fixture data, not structured paper-card proof.

Independent focused review found no outstanding P1/P2 for this synthetic-only
UI/API slice after the storage readback fixes. The browser test uses mock API
responses; it is not a deployed two-device or independent-human rehearsal.
Normal Results navigation was integrated separately by the lead. Full workspace
verification, the separate source/accounting integration, and publication remain
lead-owned gates; this report does not mark the feature production-ready.
