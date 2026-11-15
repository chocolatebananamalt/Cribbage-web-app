# Rejected sign-in navigation lock — isolated candidate

Acceptance: a definite authentication rejection must release the exclusive account-switch barrier and restore the document's shared lease, without changing retained recovery or publishing candidate cookies. Unknown outcomes remain blocked for reconciliation. Post-request coordination failures must return blocked, never enter the completion component's pre-request retry handler.

Only authentication-client behavior changes. Existing cancelSafeRecoverySwitch rejects destructive cleanup state, releases exclusive ownership and reacquires shared; it does not clear storage. The server publishes Supabase candidate cookies only on accepted authentication.

## Executed checks

- Node24.19, pnpm11.19, Next16.4.2, @supabase/ssr0.12.6, supabase-js2.115.0.
- Before fix, six intended focused regressions failed; after correction, ten modeled regression cases and one real-coordinator/native Node Web Locks case pass. The two new application test files are included by the normal test runner.
- Official dependency audit: no known vulnerabilities. Full ESLint passes. Application suite:3627passed,0failed. Provider check passes with existing payments/SMS/OCR integrations explicitly disabled and manual fallbacks declared.
- Targeted final TypeScript check and independent Sol source review passed. Reviewer found and verified the post-request cancellation-error correction preventing consumed-code retry.
- Actual Chrome, actual service worker and actual coordinator/client modules with loopback-only synthetic HTTP responses: baseline401 leaves exclusive held and a second-tab worker shared request pending; second navigation times out10s before backend navigation count increases. Patched401 restores shared and second navigation loads. Fictional foreign-actor localStorage and sessionStorage bytes remain unchanged.
- Synthetic response withheld after local reply triggers one authentication request plus one reconciliation, keeps exclusive protection, and never retries the code. Injected shared-reacquisition failure after definite401 returns blocked without retry; retained bytes unchanged.
- Actual Next RecoveryDocumentBoundary, CompleteSignIn and callback POST route in a separate local fixture: rejected submission removes Complete sign-in, preserves both retained-byte checks and restores shared navigation; a new actual SignInForm loads. Post-response reacquisition failure shows coordination blocked, removes Complete sign-in, records exactly onePOST and preserves recovery. The first local rejection lacked a verifier; the later fixture supplied a fictional verifier and a synthetic Auth422 denial. Neither is genuine hosted Auth acceptance.
- Requested viewport overrides390/1440 did not change the observed browser width1905. Desktop actual-component behavior is verified; phone-sized browser acceptance is NOT claimed. Node/fixture checks do not substitute for phone or two-person provider acceptance.

## Verification limitations and environment failures

The first pnpm verify attempt stopped on environment/dependency setup, then a complete audit/lint/tests/provider run reached build and correctly rejected absent explicit fictional target bindings. Production build then passed separately with loopback-only fictional build keys, including full TypeScript and route generation; no hosted backend access or credential retrieval. Initial workspace check was premature before build output and was rerun after build. Private handoff check reports missing ignored imports in this clean isolated checkout; it is unavailable, not passed. No private files were copied or uploaded.

These verification stages ran in sequence with the build environment corrected, rather than claiming the initial pnpm verify invocation succeeded. Final workspace results are recorded in publication-support evidence. Do not infer phone/provider release acceptance from these local checks.

## Live recovery warning

Read-only live Setup observation showed zero offline score entries and one local retry record on the exact approved Preview after user-created draft navigation. Source successful creation saves a tournament-creation-seed receipt and removes the pending create request; Setup retains the seed until its first confirmed saved version. Generic counting includes that receipt. Actual browser key/state was unavailable through supported read-only metadata, so normal seed retention is a strong explanation rather than a verified live classification. No record was cleared/replayed and the user's draft/session was not modified. The cloud footer slice owns count/wording changes.

## Publication boundary

Based on published ccff9f7d7b9d7e1ed6cc27b3a9553e58d383284a, tree60d84dd79f1db22f3346b9d52bb07b327a88db5a. This is local-only; no push/deployment, Auth/security setting or database change. Retain staging-only target bindings and draw0. Parent review is required before any new Preview publication. QR/passkeys remain future-only.
