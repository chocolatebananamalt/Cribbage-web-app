# Private Finance proposal save and recovery, 2026-11-08

Acceptance: same authenticated actor/event; current source and complete history
pinned at authoring; retain exact request before any send; duplicate actions
cannot create a new operation; full bound receipt plus exact fresh head required
before pending archive. Unknown, changed, malformed or rejected records remain
retained. Account/role changes, stale sources and late callbacks fail closed.
Ordinary Finance and historical awards remain unchanged; no payout authority.

## Implementation

- Browser-safe projected workspace/head and exact request/receipt codecs are
  separate from server-only native qualification and ledger validation.
- Existing candidate handler composition projects only after full server decode
  and pre/post cookie identity/role checks. Flags remain false; API response is
  still private/no-store. No service/admin client, grants or new database schema.
- `PlayoffPrizeFinanceOperationV2` reads authenticated workspace before device
  storage, uses one actor/event-scoped pending key, retains before sending, and
  uses exact CAS plus immutable receipt archive for verified saved-head cleanup.
  External pending replacement or stale lifecycle generation blocks I/O.
- Candidate Finance screen has required save reason, Check Save Outcome, Retry
  Exact Save, Verify Saved Proposal, truthful server save timestamp and explicit
  changed-source review. Existing group editor remains controlled. Unsubmitted
  raw fields are memory-only and remain visible/locked across same-scope provider
  replacement; explicit review/load actions reset the view. Scope changes isolate
  accounts. This does not claim unsent edits survive a browser reload.
- Actual Finance route includes the component with enabled=false, behind its
  existing default-off route gate. No production or test-preview change occurred.

## Verification evidence

See `test-results/prize-finance-browser-v2-operation.log` for controller/transport
cases and `test-results/prize-finance-browser-v2-handler.log` for browser-projected
handler coverage. Browser codec/projector tests cover exact bytes, WebCrypto SHA
parity with existing server SHA, full receipt bindings and a browser-safe import
closure. See the separate browser QA for actual React offline evidence.

The disposable PostgreSQL store run now proves forced overlapping writer locks,
rollback, exact retry and changed-head rejection; its cleanup is verified. This
is separate from mocked browser/provider tests and is not a genuine Supabase
session, shared device or mixed-mode rehearsal claim.

## Explicit remaining gates

A subsequent narrow patch adds explicit reasoned resolution for full immutable
rejections, preserving the exact request and receipt in an atomic local archive.
See [rejection-resolution acceptance](2026-11-08-prize-rejection-resolution-v2.md).
Unknown or attempt-only responses remain locked and cannot use that resolution.

Genuine signed-in provider acceptance, real-origin IndexedDB/full reload,
page/flag enablement and release review remain unperformed. Existing native
coverage flags still report fee coverage/fund review unverified; additional
income and optional pools remain blocked in this source path. Regular final
awards, recipient assignments and payments remain disabled.

No payout policy was changed. No-refund optional-pool redistribution and V3
regular automatic target/allocator principles remain approved. The narrower
new-method/increment and discounted-fee reference questions remain in the
existing decision note. Registry audit remains incomplete after the prior
automatic-review denial; it was not retried or bypassed.

## Final current-source check results

Application suite 2,508/2,508; production build including TypeScript exit 0;
provider readiness exit 0 with existing disabled-provider fallbacks;
workspace/handoff 14/14. Full lint zero errors / 201 warnings. Fourteen focused
controller/HTTP cases pass. Actual React browser run11903 passed four widths
(320/390/768/1440), 100%/200% text, keyboard, lost-response remount, late-account
callbacks, raw-field preservation, held consent/save handlers, no-head source
review and repeated changed-source review. No requests/navigation/page errors.
Current UI SHA 244032f2c16491e5809d301778cd6bbb69ce711fbec7b04b2f78f2af4912a022;
controller SHA ae442a815ce7affd60bef83fafc03cd2840412c41efa3e6f1b658fd59970f5ee.
Offline result JSON SHA
b01efdd1a87696c0fe57207f981f7dc8e8a83f2308b637d370cc57764b8ba87e.
Independent review: limited-scope GO, no remaining definite P1/P2 for this
disabled candidate. That finding does not waive the explicit remaining gates.

Subsequent local archive browsing is implemented and tested in [archive browser acceptance](2026-11-08-prize-archive-browser-v2.md). It exposes readonly historical device copies, including rejection reasons, without applying them. Actual provider/IndexedDB acceptance remains separate.
