# Supported scoring connectivity rehearsal — local only

## Acceptance and observed defects

Exercise actual digital score-entry and manual capture/re-entry components,
browser offline state, reload/navigation and exact retry, without hosted data,
real credentials, real original-card attestations or an external OCR provider.
Local transport models cannot prove real server authorization or physical
independence. New recovery work must never become a locally verified score.

The fuller digital rehearsal found a real preparation integration defect:
the protected score page's old literal binding div is hidden by the initial
recovery-boundary screen. Captured same-origin HTML contains only escaped Flight
data for that div; the capability and service worker are ready but no page is
cached. The new route metadata uses the same React request-cached protected
assignment as the page, including actor===verified session subject. Only current
assigned games emit a non-secret actor/game marker. Cache preparation parses a
unique exact real metadata element from the complete inert response, including
streamed body metadata; escaped text, duplicate/conflicting markers and wrong
actor/game are rejected. The recovery boundary and response URL/status/redirect,
expiry and same-origin asset guards remain. No generic URL ownership inference,
new auth endpoint, credentials or security policy was added.

Manual recovery exposed stale descriptive sign-out counts: after accepted exact
review cleared its retry key, the warning persisted until focus. Visible-only
1.5-second single-flight count refresh now updates it; polling pauses while busy.
The destructive switch still independently rechecks pending work under its
exclusive recovery barrier. No cleanup/deletion/sign-out authority was relaxed.
An already-started count read may finish after busy/unmount; its handle closes
and its descriptive result cannot authorize deletion.

## Executed browser evidence

- `photo-offline-acceptance-results.json`:13 current groups, actual photo aid
  at390/1440 and real IndexedDB queue. Interrupted upload/capture, exact same-file
  reselection after reload, lost response, duplicate, auth uncertainty, terminal
  rejection, simultaneous local queue conflict, duplicate, reload after reconnect,
  pending-switch blocking and503 retention pass. No external image transfer/OCR.
- `manual-score-connectivity-browser-result.json`:20 groups at390/1440 using
  actual capture and independent re-entry forms. Nonreciprocal cards block;
  interruption, actual browser-offline request failure, reload, repeated clicks,
  wrong completion receipt, permission/stale rejection and lost accepted capture/
  review reconcile with exact requests. Pending keys block clearing; accepted
  review removes only its key and clear UI restores without focus/reload within
  five seconds. Count polling makes zero auth requests. Synthetic response-model
  success remains distinct from actual backend canonical verification.
- `live-score-connectivity-result.json`:11 production-built local groups at
  390/1440. Actual score controller prepares a page, queues one signed15-point
  result offline and reloads that page through the real service worker while
  still offline. Exact queue bytes survive.503, wrong receipt and401 preserve
  the entry; lost successful response and repeated retry use the same operation,
  one simulated application, and only an exact terminal receipt clears it.
  Synchronization never itself claims verification. Offline confirmation blocks
  explicitly rather than inventing a server matching challenge.
- `safe-sign-out-count-poll-regression.log`:13 existing actual-component groups
  still pass, including blocked tabs, repeated actions, partial failures,
  uncertain outcome reconciliation and same-account recovery preservation.
- Independent review found no confirmed P1/P2 after the two narrow fixes.
  Four metadata/safe-device tests independently reran; root focused14 tests pass.

Digital production acceptance is `node --experimental-strip-types
tests/live-score-connectivity-browser.mjs` (production build is the default).
Development-mode HMR asset reload did not hydrate offline; a production-built
fixture succeeds, so this is an environment limitation, not a claimed production
failure. Early production fixture setup failures were test-only Windows tsconfig
path/include/excess-property errors and were corrected without skipping types.
One old source-string test expected the marker inside the cache module; it now
asserts the delegated fail-closed parser call, with native browser negative tests
covering its behavior. No safety guard was replaced with an unconditional pass.

## Supported-mode boundaries and remaining proof

| Mode | Proven local behavior / explicit limit |
| --- | --- |
| Standard digital assigned current game | Must prepare online first; queued submission survives local production offline reload; explicit reconnect/reload/Sync triggers, not continuous background retry. Confirmation requires current server matching evidence and connectivity. |
| Digital player against paper | Uses the same digital controller; original paper and separate authorized cross-check remain required. This rehearsal does not fabricate those physical actions. |
| Manual paper capture/re-entry | Interrupted requests retain exact session recovery and reconcile after online navigation. Manual workspace offline caching is not implemented; original cards remain the fallback. No page-cache/whole-browser-crash durability claim. |
| Photo aid | Metadata/operation identity survives reload, not image bytes. Reselect the same original image. Stored photo does not change score or verify a game; OCR is disabled. |
| Sessions/devices | Pending work blocks unsafe account switch; expired auth retains work for the same player. No physical second device, alternate engine, process-crash, disk corruption or venue outage is proven. |

All browser APIs use fictional local transports. Real session/capability signature
verification, authoritative multi-user database state, whole-venue outage,
camera/handwriting and independent physical-human verification remain separate
release gates. Existing isolated SQL integrity evidence remains applicable;
these fixes do not change SQL or any0247–0255 migration checksum.

No hosted read, write, migration, commit, push, publication, payment/refund or
production change occurred. The previously denied hosted read was not retried.
The old150-file publication manifest must be refreshed after these changes.
Final full checks, cleanup and source-backup receipt follow in the completion
addendum; later receipts are not retroactively part of an earlier archive.

## Final verified checkpoint

Full `pnpm verify` passes1,048 application tests, zero-known-vulnerability audit, lint zero errors/one pre-existing warning, production build/types/providers and8 workspace checks. `pnpm verify:handoff` passes6. Logs: `connectivity-full-verify-run2.log` and `connectivity-handoff-run2.log`. Production digital run8 passes11groups; manual run5 passes20; fresh photo run passes13; safe-sign-out suite passes13. Independent review found no remaining confirmedP1/P2. Cleanup confirms digitalPID10792/port3258 and manualPID21364/port3259 are absent/clear; photoport3241 and safesignoutport3235 also clear.
