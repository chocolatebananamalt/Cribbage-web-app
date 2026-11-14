# Setup Playoff replacement: offline React acceptance

The actual `SetupClient` and its actual Playoff and rule-review components were mounted using installed React, webpack, and Chrome. The feature prop was enabled only in this fictional harness. No application feature flag, hosted database, or deployment was changed.

Command: `node tests/setup-prize-root-offline-browser.mjs`.

At widths 320, 390, 768, and 1440, the harness verifies:

- Explicit adoption of new Playoff settings for existing Main/Consolation, with the unwanted declarations absent in the private replacement branch.
- Director-selected Top 8, winner multiplier 2.5, and regular-prize rounding $10 survive normal Save All Events Draft, exact operation/readback verification, and React remount. Existing Equal Q selection remains unchanged.
- 100% and 200% text sizing causes no horizontal page overflow in the actual Setup page shell.
- Full snapshot-bound registration confirmation, including current saved rule-context reviews, exact operation recovery, native event list readback, and local pending cleanup.
- At 390px, a committed save with a lost response survives React remount and is reconciled without another save. A lost finalization response is similarly recovered without a second finalization.
- At 320px, a changed co-director review between displayed context and confirmation blocks all registration writes and local operation creation; reopening reviews the current context.
- At 768px, keyboard save works. Editing a context review while the source GET is deferred blocks all registration writes and operation creation.
- At 1440px, a recovery-coordinator block before cleanup retains the exact pending request; unblocking permits read-only reconciliation and cleanup without another save.

Evidence: `test-results/setup-prize-root-offline/result.json`, plus full-page screenshots for all widths and text scales. Requests and page errors must both be empty in every context.

## Limits

This is an offline component/protocol test, not a signed-in provider, multi-session backend, or real-origin browser-storage test. Every page remains `about:blank`; contexts are offline, service workers blocked, requests aborted, and CSP forbids network connections. No URL navigation or server is used. Fetch replies and storage are in-memory fictional ports. The recovery-owner and coordinator ports are test aliases; their real worker/cookie behavior is separately gated. Blank-origin secure crypto is unavailable, so the harness supplies Node's actual random UUID generation and SHA-256 through a local Playwright binding. React remount is not a complete browser navigation/reload. The fixture replies are protocol examples, not an independent database or monetary oracle.

Registration finalization here does not establish new-policy playoff execution, payout calculation, Finance finalization, or money movement. Those remain unavailable in this replacement path. The source and local database acceptance are separate evidence owned by the integration lead.
