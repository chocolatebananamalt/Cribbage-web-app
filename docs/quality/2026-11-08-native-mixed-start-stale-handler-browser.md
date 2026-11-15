# Rehearsal Start panel: stale-handler browser acceptance

The actual `NativeMixedStartPanelV1` and View are bundled with installed webpack/React and mounted in offline Chrome `about:blank`. The controller is a fictional counting port. No provider, native session, database, attendance, game or payment record is used.

## Baseline evidence

`NATIVE_START_STALE_REPRO=1 node --conditions=react-server --experimental-strip-types tests/native-mixed-start-stale-offline-browser.mjs`

The original Start panel reproduced the defect at 390px: capture the enabled Start callback, uncheck the acknowledgement, invoke the old callback, and the controller receives `submit(true)` once. Stable original source SHA-256: `081eafe9f2a658a6a4181cbd0bb0b9a7d31000754164adcf792c216c402f198a`. Evidence: `test-results/native-mixed-start-stale-offline/baseline-reproduction.json`.

## Regression contract

`node --conditions=react-server --experimental-strip-types tests/native-mixed-start-stale-offline-browser.mjs`

The harness checks Prepare, Submit, Retry and Check at widths 320, 390, 768 and 1440 with 100%/200% text. A retained callback must not dispatch after relevant acknowledgement, online/permission/enablement, context, controller, request or stage changes. Current controller snapshots are cloned and can change without a React render. Fresh actions must still work; two synchronous callbacks must produce one action; a late old completion must not clear a new controller's busy flight.

Fixed acceptance run 98674 exited 0 with 184 checks passed. The panel source hash was stable at `e911a17ff5ab3fd2022fdb78eb57971aac124e6de90f4eacefcd6bc810895ff3`. The result is `test-results/native-mixed-start-stale-offline/result.json`; SHA-256 `c22712a252adc26dc423328083a564de9b5c8a0c19b0bcd28e7525a54a8c3364`. Initial disabled composition performs zero activation, snapshot reads or actions. Exact retry remains available with `allowPrepare=false`. Same-operation-ID request-body changes invalidate old confirmation. All four live phases retain fresh happy actions and pass duplicate/old-completion isolation checks. This is UI-only proof against the stated source bytes, not backend or release readiness.

Every context must stay on `about:blank` with zero requests, frame navigations and page errors, and no horizontal page overflow. Contexts are offline, service workers blocked, requests aborted, and CSP forbids network access. No localhost server/navigation or denied transport is used. Mock-controller acceptance does not replace real session/backend, independent consent, or real-device verification.

Final render-ref lint-fix rerun 61900 also exited 0 with all 184 checks passed. Current stable panel SHA-256 is `b2649b7a5fdc65faeebe631b8c6de53a5045617568368eaa39d0c1dd00e144ac`; current result SHA-256 is `0fce72e249db7689401df9c0e2a1ef37ee44b86712430f861f83da667e7927ae`. The earlier result is preserved as `result-before-render-ref-lint-fix.json`.
