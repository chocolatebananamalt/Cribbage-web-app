# Local proposed prize adjustment review UI

Bounded implementation: `src/components/playoff-prize-proposal-review-v2.tsx`
and component-local CSS, one offline fixture and one browser harness. No normal
Finance route is wired. No storage, network, SQL, provider, hosted action,
payment or refund is implemented.

The controlled component accepts `retained`, `expectedCurrent` and
`onChange(next, previous)`. The host must compare `previous` before accepting
the proposed local replacement. The actual source-bound V2 proposal module
validates every append and complete history prefix. The UI supplies local UUIDs,
amounts and reasons only; it explicitly disclaims saved author/time audit.

Acceptance: retain invalid text and distinguish blank from explicit zero;
append whole-band correction/void/reopen history with reasons; show original
calculated versus manual totals and module balance/method/equality/first-round
warnings; block changed or unknown sources without rebasing or losing edits.
Original editor source/input stays pinned until the host explicitly opens a
new review. Thus a changed paid cutoff cannot unmount and discard dirty groups.
Malformed controlled data retains the last valid view with appending blocked;
descriptor validation runs before field/history access. Amount text is bounded
before BigInt parsing. Held handlers compare the latest local edit and latest
controlled props before appending or replacing raw fields. An unacknowledged
callback preserves its exact text and waits for the exact local record in props.

Executed 2026-11-08 on Windows with bundled Node 24 and local headless Chrome:

```text
node tests/playoff-prize-proposal-review-offline-browser.mjs
exit 0, all 15 behavioral cases at widths 320 / 390 / 768 / 1440.
Responsive screenshots and document-width assertions at 100% and 200% text.

node node_modules/typescript/bin/tsc --noEmit --incremental false
exit 0.

node node_modules/eslint/bin/eslint.js src/components/playoff-prize-proposal-review-v2.tsx tests/playoff-prize-proposal-review-offline-browser.mjs
exit 0, no diagnostics.
```

Final runs include the existing Title Case input label requirement. Source
hashes are captured and checked unchanged by the browser harness; evidence is
`test-results/playoff-prize-proposal-review-offline/result.json`, with eight
screenshots and request/error/navigation observations in that directory.
The 320px screenshot was also visually inspected before the label-only rerun.

Cases: initial source comparison; blank/invalid/zero; append correction and
void/reopen lineage; explicit $490 champion and $140 entire 5–8 group balancing
the fictional $1,800 fund; changed source while editing; unavailable current
source; cutoff removal preserving raw group text; held local-edit/source
handlers; malformed null/accessor history; oversized numeric text; controlled
callback without acknowledgment; adjusted first-round intention; Equal warning;
Winner Multiplier warning; keyboard-only amount/reason/append. Balance never
grants method consistency, save or payment authority.

Offline proof uses only an existing `about:blank` page with inline `setContent`
and bundle injection: no navigation/goto, server or bypass of the earlier browser
navigation denial. Context is offline; all requests abort, service workers are
blocked and CSP has `connect-src 'none'`. All final observations show zero
requests, navigation and page errors. No local/session storage is used.

Limits: the fixture supplies deterministic fictional UUIDs because initial
`about:blank` lacks secure-context `crypto.randomUUID`; production fails closed
if ID creation is unavailable. The actual component, proposal calculator,
history and controlled React state are exercised. The production React bundle
is used: an earlier development-runtime attempt showed React's own diagnostic
prop-diff profiler invoking a deliberately hostile accessor after component
validation. The final production-runtime accessor test does not invoke it.
Earlier failed harness attempts are not counted as passes.

This is a reusable local component, not persisted financial history, a real
provider session or deployed Finance acceptance. Full repository verification
and independent financial review remain lead-owned; the previously denied
network audit was not retried. Shared project status/memory updates are left
to the lead to avoid concurrent edits.
