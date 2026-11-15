# Rehearsal Director panel: stale-handler browser proof

The actual `NativeMixedDirectorPanelV1` is bundled with installed webpack/React and rendered in offline Chrome `about:blank`. Its controller is a fictional call-counting port; no native session, database, provider, storage, schedule or scoring record is changed.

## Baseline reproduction

`NATIVE_STALE_REPRO=1 node --conditions=react-server --experimental-strip-types tests/native-mixed-stale-handler-offline-browser.mjs`

At 390px, the original implementation reproduced three unintended dispatches: capture an enabled Review, Publish or Close Uncertain Request React callback, uncheck the associated confirmation, then invoke the retained callback. Each produced one controller execution. The exact original panel hash and results are preserved in `test-results/native-mixed-stale-handler-offline/baseline-reproduction.json`.

## Fixed acceptance

`node --conditions=react-server --experimental-strip-types tests/native-mixed-stale-handler-offline-browser.mjs`

The regression checks widths 320, 390, 768 and 1440 at 100%/200% text:

- Held Review/Publish handlers cannot execute after confirmation revocation, write-permission removal, prepared-operation replacement or controller replacement.
- Held cancellation cannot execute after checkbox/reason changes, removed write permission, changed controller or changed current pending snapshot.
- Held Check Saved Result and Close This Step handlers cannot act on a changed current controller snapshot, including a snapshot change without a React render.
- Fresh current actions remain operational in all five panel phases.
- An old in-flight failure after controller replacement cannot clear a newer controller's busy flight, display an old failure notice or move focus. The new action remains busy until its own completion.

Evidence: `test-results/native-mixed-stale-handler-offline/result.json` and phase/width/text screenshots. The panel source hash must remain unchanged during the acceptance run. Every context asserts zero network requests, frame navigations and page errors, plus no horizontal page overflow.

No localhost navigation, web server, browser storage, hosted changes, real identities or money are involved. This UI proof does not replace actual controller/backend, independent role, consent or device acceptance.
