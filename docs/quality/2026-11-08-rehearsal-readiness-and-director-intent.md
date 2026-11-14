> Subsequent local update: the separate Start and Digital/Paper entry held-intent checks were reproduced and fixed. See [current-intent acceptance](2026-11-08-start-and-entry-current-intent.md). Earlier Start-check-pending text below is historical; real-device/release gates remain.

# Rehearsal readiness and Director intent fix, 2026-11-08

Scope: local source/evidence only. No hosted inspection/change, publication,
cohort, access grant, identity, database fixture or payment was performed.
The last verified preparation preview commit is 3c3d653. It must be rechecked
before any later authorized acceptance; this note is not a fresh live-site audit.

## Bounded completed step

Actual offline React reproduced three stale-held handlers in the original
Director seating panel: Review, Publish and Close Uncertain Request each
executed once after its confirmation had been unchecked. This was a UI-intent
defect; controller/backend authorization remains a separate boundary.

Only `src/components/native-mixed-director-panel-v1.tsx` changed in production
source. Dispatch now checks current rendered intent, live write permission,
activation generation, prepared/material context and canonical current controller
snapshot (the controller returns cloned snapshots). Synchronous checkbox/reason
edits invalidate old handlers before the next React commit. Every action has an
explicit stage guard, including historical check/archive actions.

A controller/generation flight token owns asynchronous completion. Old failures
cannot clear a replacement flight, show its notice or steal focus. Separate
controller ownership permits legitimate cleanup even while an edit invalidates
the intent reference. Existing requests, IDs, source/read/write guards and
immutable recovery/cancellation protocols are unchanged. No redraw, Start,
scoring, qualification or financial rule was introduced or enabled.

Actual browser proof: 112 checks / 20 contexts, widths320/390/768/1440 at
100%/200% text; original three bugs, revoked permission, changed prepared data,
controller replacement, cancellation reason, changed pending/resolved snapshots
without a React render, fresh happy actions and old-completion isolation.
Zero network, navigation or page errors. Fictional controller only; not real
provider/storage/backend acceptance. Baseline and prior receipts were preserved.
See the separate stale-handler browser QA and local result directory.

Current panel SHA256:
f627e06154ccc720bc321ed9403f3914da490f7591825d25cd8b5099669ff283.
Browser result SHA256:
2c84f8f858ee161b1cca94170f088274c08cdc8027df9be35eaf77532d1ae0d9.
Independent source review GO; no remaining definite P1/P2 for this narrow fix.

## Current proof versus remaining acceptance

| Area | Existing evidence | Remaining gate |
| --- | --- | --- |
| Setup / participation | Preparation preview and local Director preparation, own consents and independent Paper-roster review | Named event/accounts/roles/expiry authorization and genuine rehearsal-specific sessions; newer V2 Setup remains private/unpublished |
| Random seating / movement | Local random publication, fixed IDs, unique 108-match graph, A-1 fixed seat and 11 movement previews | Actual opposed A-1…A-18 layout/end routes and device distribution; general reserved anchors/family constraints are not supplied by this narrow test screen |
| Start | Both private simulated and separate ordinary native Start have local proof | Preview excludes Start; simulated readiness must never imply real physical attendance/check-in |
| Player entry / card | Mixed progression, own confirmations and current-game card/recovery locally proved | Real JWT/session/account switching, device/IndexedDB and offline full reload; player page currently supplies no offline cache |
| Independent Paper review | Mixed DP/PP capture/review and exact response recovery locally proved | Real independent sessions and physical evidence workflow; no self-check waiver |
| Qualification | Ordinary all-Digital fixture completed108 games and durable qualification; mixed reader independently previews five qualifiers | Private mixed reader is not durable mixed close and is not mounted in a Director intake |
| Simulation Finance | Mixed review binds18 simulated receipts/$540 gross; native proposal save/recovery/archive has separate local proof | Mixed review view/intake, cost/net evidence, final award integration and explicit payout policies; no payment authority |

References: native-mixed-bootstrap-workflow, native-mixed-progression,
native-mixed-paper-provider, native-mixed-qualification-review,
2026-11-04-one-table-movement-local, 2026-11-08-prize-native-history-v2-integration,
and the latest Finance/archive QA in this directory. Ordinary native proof is
not substituted for mixed simulation evidence.

## Shortest safe path to Daron's devices

1. Use the already published participation/bootstrap preparation only, after
   separately authorizing the exact test event, existing named actors/roles and
   time-limited cohort. No further app publication is needed for that narrow
   stage. The current task does not authorize its grants or records. Each of six
   Digital subjects supplies own consent; Paper declaration/review stays nonself.
   The local proof used two nonplaying officials and does not establish that
   Daron needs eight humans: any six-human role overlap needs explicit acceptance.
2. Freeze/review a minimal playable overlay and exact dependencies/grants for
   draw/publication, private Start, own entry, Paper review and cards. The installed
   preparation51 package excludes Director lease/preparation/draw-reservation/
   status sources and the private mixed qualification reader. Full play is not a
   flag-only promotion. Obtain fresh recovery/drift preflight and specific hosted
   release authorization before changing it.
3. Perform real session/hydration, device recovery, independent-role and physical
   movement acceptance. Close registration through its existing explicit gate.
   Preserve actual random seating; do not force all six humans to face one another.
   Label fictional games and simulated funds honestly. Do not use ordinary fake
   attendance/payment records to bridge missing simulation behavior.

This patch covers the Director seating panel only. The separate Start panel
passes a captured confirmation to submit; analogous held-action revocation
needs targeted reproduction/acceptance before play is enabled. This source
observation is not runtime proof of a Start defect in this slice.

The full 18-player trial remains NO-GO until the playable release and acceptance
are complete. Payout decisions do not block preparation-only acceptance. No
new rule or owner policy was assumed. Existing payout questions remain in the
separate decision note; membership/MRP and large playoff fields are not certified.

Final local gates: 2,537/2,537 application tests; production build/TypeScript
exit0; provider readiness exit0 with existing disabled-provider fallbacks;
workspace/handoff14/14; lint zero errors /201 warnings. Three existing focused
panel tests also pass. The separate actual-browser regression is the meaningful
new proof, not a string-only assertion. Prior denied registry audit was not
retried, and aggregate pnpm verify is not claimed.
