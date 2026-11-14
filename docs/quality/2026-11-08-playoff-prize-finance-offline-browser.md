# Regular prize Finance UI: offline React acceptance

Command: `node --conditions=react-server --experimental-strip-types tests/playoff-prize-finance-offline-browser.mjs`.

The actual `PlayoffPrizeFinanceSectionV2`, operation controller, browser codecs, proposal review and pure calculation modules were tested in production-mode React with fictional protocol ports. Node generated the workspace and journal replies through the real server projector and existing store fixtures; no server-only module was bundled into the browser.

Passed at widths 320, 390, 768 and 1440, with 100% and 200% text sizing and no horizontal page overflow:

- Blank/whitespace saving reason blocks Save; keyboard Save works.
- Save retains the complete request first. A full saved journal receipt enables verification but does not clear pending by itself. Fresh exact saved-head readback plus successful archive CAS clears pending and preserves a receipt archive.
- Lost save response survives React remount. Unknown recovery retains the exact request. Later full recovery and verification produce one save, not a duplicate operation.
- An account/role switch during a deferred save ignores the late reply and preserves the old account's pending request. Restoring the Director allows exact recovery.
- A mismatched saved head and a failed archive CAS each preserve pending and block another save.
- Disabled composition makes no new workspace call and leaves records unchanged.
- Changed native source blocks editing of the historical proposal. Starting a current-source review requires explicit confirmation, clears the new view's saving reason, retains the old saved head and sends no automatic save.
- A captured adoption handler cannot run after its checkbox is unchecked; existing raw band amount/reason remain visible. A captured Save handler cannot run after its saving reason becomes blank.
- Replacing the port and retained-storage prop objects within the same actor/event preserves unappended band amount/reason throughout deferred reload. A changed full context/source and saved head keep that input locked until explicit Load Saved Proposal; loading then resets the view intentionally.
- With no saved head, a changed current source still exposes explicit consent/review, unlocks a new append proposal and makes no automatic save. A second source change after an adoption again requires review and preserves raw input until that action.

Confirmed-rejection coverage additionally runs at all four widths and both text sizes. A full immutable rejection, fresh matching recovery, current scoped workspace and archive CAS are required. Thin attempts and unknown replies never expose resolution. Required reason/checkbox and captured-handler revocation are exercised. Altered rejection readback, unavailable workspace, role/account change during verification and failed archive each preserve the pending request. Successful archive retains the exact original raw request, complete rejected history, full receipt and resolution reason. Rejected local adjustments stay locked through same-scope port/storage replacement until explicit review. The no-head path starts empty; the accepted-head path loads its actual saved history prefix instead of dropping it. A committed archive with lost acknowledgement is tested separately: the immutable audit survives and replacement cannot silently unlock the rejected proposal.

## Read-only device archive

The actual archive section and reader run within the same offline component harness. Archive reads are never automatic. The tests open saved receipt copies (original reason, reported time/version and historical fund/proposal summary) and resolved rejected copies (original save reason, local resolution reason and original adjustment history). Reading an empty archive while a save is pending preserves the exact pending request. Viewing saved copies preserves the current editor's unappended amount/reason and all pending/audit bytes, and makes no save call. Scoped five-entry paging and refresh are exercised; malformed own-scope rows are explicitly unverified and foreign-scope rows are excluded. A missing optional storage port reports unavailable rather than empty. A local archive read held across an account change cannot publish the old account's results. Reader/component source hashes are pinned with the main UI sources.

Malformed-key regression includes an empty own-scope suffix, NUL, spaces, punctuation and Unicode. The page cursor passes malformed entries and still reaches later rows; refreshing recovers the valid saved copy. Nonstring stored values are projected to `raw: null` and shown only as unverified; the original object's private marker is never exposed or rendered. This harness does not exercise the real IndexedDB adapter or storage-worker bridge. Oversized keys and the reader's 32 MiB page bound remain explicit unavailable conditions, not proof that no history exists.

Evidence: `test-results/playoff-prize-finance-offline/result.json`, source SHA-256 pins, and width/text-scale screenshots. All browser requests, page errors and frame navigations are asserted empty.

## Limits

Every page stays `about:blank`, offline with service workers blocked, all requests aborted and a CSP forbidding network connections. There is no server, hosted record, provider session, database, real IndexedDB, full navigation/reload, or money movement. Retained storage is an in-memory compare-and-swap port. Blank-origin SHA-256 uses Node's actual hash implementation through a local Playwright binding; this is not secure-origin WebCrypto acceptance. Protocol fixtures are not independent proof of ledger data, qualifying results or monetary policy. Database/runtime, real role/provider sessions and application-page enablement remain separate gates. No application source or feature flag was changed for this test.
