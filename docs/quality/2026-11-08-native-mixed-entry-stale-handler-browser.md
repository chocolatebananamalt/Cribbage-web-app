# Digital and Paper rehearsal entry: stale local intent

The actual Digital/Paper entry hosts and `NativeMixedGamePendingControllerV1` run in offline Chrome `about:blank`, using fictional binding/state examples, a memory CAS port and a counting unknown-outcome transport. No provider, database, real scoring record or browser persistence is used.

## Baseline

`NATIVE_ENTRY_STALE_REPRO=1 node --conditions=react-server --experimental-strip-types tests/native-mixed-entry-stale-offline-browser.mjs`

Run 99988 reproduced both defects at 390px. Digital: capture an enabled Submit callback, Clear Result, then invoke the old callback. Paper: capture Record Independent Review, uncheck its acknowledgement, then invoke the old callback. Each allocated one operation ID, performed two retained transitions and dispatched one transport write. The baseline source hashes and exact counts are in `test-results/native-mixed-entry-stale-offline/baseline-reproduction.json`.

## Fixed acceptance contract

`node --conditions=react-server --experimental-strip-types tests/native-mixed-entry-stale-offline-browser.mjs`

The regression covers local clear/edit/acknowledgement revocation, online/enablement changes, runtime/target replacement, refreshed source revision/digest and a changed current pending-controller snapshot before dispatch. A revoked callback must not allocate an ID, retain or send a request. Fresh submissions must still create the exact pending request; unknown recovery must retain it. Pending Check/Resolve/Send callbacks for A must not act on replacement B, while fresh B callbacks work. New Digital offline authoring remains permitted and retains without sending.

The current-snapshot diagnostic wraps the real controller's `getSnapshot` to expose a changed cloned message without forcing a React render; it does not replace the controller's save/recovery logic. Pending replacement uses fictional memory records followed by the actual controller's `initialize`. Next Link/Image have inert fixture presentation adapters to prevent asset/network requests; links are not navigated.

Final run 26301 exited 0 with 96 checks passed at all four widths and both text scales. Revoked callbacks performed zero ID allocation, retained transitions and writes. Existing pending bytes survived unknown recovery; fresh callbacks for replacement B worked, while A's old Check/Resolve/Send did not act on B. Digital repeated-winner selection and a full three-digit keypad no-op still allowed fresh submission. Stable source hashes: Digital `8668b73953deff465b946c5583b733c1181444a6a104a8292602caefb9d0112d`, Paper `8de384b0a8134981555258ae38053f75e6f029ab15deaeb2eb727c7f104599da`. Result SHA-256: `eac3d70a0596debba93785531dccc165fc65d6f1c6e087850e2105419894288b`.

Every run must keep all pages on `about:blank` with offline contexts, service workers blocked, request aborts, network-forbidding CSP and zero requests/navigation/page errors. Widths are 320/390/768/1440 at 100%/200% text. The machine result's source-hash stability and success are required before claiming fixed acceptance. These tests do not establish real provider identity/roles, backend consent, real storage, full reload or live readiness.
