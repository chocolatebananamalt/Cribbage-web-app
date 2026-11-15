# Local anonymous random seating planner — verified bounded checkpoint

## Acceptance and boundary
The owner's overnight authorization covers local development, not operational records. This slice is an explicitly anonymous, loopback-only, default-off planning tool. It does not load a tournament, create a fixture, assign actual Tournament IDs, change players/family records, write a database, export publication CSV, or publish seating. The existing native seating writer is unchanged. Logical candidate schedules must never be presented as verified physical rightward walking directions.

Observable acceptance: per-table chair counts and odd/even facing diagrams; explicit unused/unpaired chairs and exactly nine selected facing pairs; registration-closed assumption; a separately approved stationary slot, blind draw across all18 by default or explicit selected-person exception; unresolved requested stationary preferences block; only explicit anonymous pair/round avoidance; secure server randomness;108 unique matches,12 distinct opponents each, one game/person/round, stable proposed starting IDs and stationary occupant; exact operation replay, no automatic redraw on refresh, unknown outcomes preserved, reasoned distinct comparisons; phone/desktop/enlarged text without clipping except intentional table scrolling.

## Safeguards
Server route `/api/v1/local-seating-plans` requires flag `CRIBBAGE_LOCAL_SEATING_PLANNER=1`, development/test environment and loopback URL/HTTP Host. Production and hosted previews stay off. Uses Node `crypto.randomInt` Fisher–Yates, not client seeds or roster-order fill. It reserves an operation Promise before drawing; equal concurrent requests share one result. Altered operation content is rejected, lost receipts are read with GET without entropy, and restart/cache loss remains unknown. Cache is bounded, never silently evicts/resamples a retained operation.

A separate strict anonymous session record contains only entry-01 through entry-18, geometry, enumerated assumptions, source hashes and local receipts. Names, ACC numbers, real roster IDs and free-text notes are not accepted. Compare-and-write preserves malformed or changed records. This namespace is explicitly inventoried, not an authenticated recovery record. History is editable device history, not immutable official audit. Input hashes bind local assumptions and are explicitly not independently verified roster hashes.

## Evidence and limitations
Engine and protocol checks are executed independently of browser tests. Browser uses a fresh headless Chrome profile and isolated Next layout with the actual API route/Node crypto, no Auth/provider, database or tournament fixture. Existing global app authentication remains unchanged; the isolated layout is not evidence of deployed auth behavior. No user tabs or unsaved forms are touched.

The physical room direction/cross-end mapping, general multiple-anchor movement, durable roster/constraint snapshots, official audit/publication and delivery to players still require a separately reviewed native integration. Existing family data is preserved by not loading/changing it; the anonymous exact pair/round avoidance is not a replacement family policy. No claim of full18-person trial readiness follows from this tool.

## Verification results
Final `pnpm verify` exited0:1304 application tests,6 provider checks, audit (no known production vulnerabilities), ESLint, production build and8workspace checks passed. `pnpm verify:handoff` exited0,6checks passed. Logs: `test-results/local-seating-planner-verify-final.log`, `test-results/local-seating-planner-handoff.log`.

Independent engine/API/storage/UI review is clear with no remaining P1/P2; independently executed21engine/protocol/inventory tests passed. Review found and fixed decimal-entry recovery lock and duplicate-table restored-state crash; explicit stationary-decision accessible name added. HTTP Host check prevents Next normalized loopback URL hiding remote Host.

Eight final browser groups passed (`tests/local-seating-planner-browser.mjs`; receipt `test-results/local-seating-planner-browser/result.json`):
-320,390,1440px actual server-crypto candidate generation,108matches, refresh retains exact outcome/no redraw, reasoned history, odd chairs/stale selected pairs block, doubled computed text no document overflow.
-Lost POST response/reload recovers the same operation through GET only, one POST.
-Unknown epoch/cache loss keeps exact bytes and no repeated POST.
-Stationary request blocks until explicit person/decision/approval; decimal round normalized; exact forbidden pair does not meet in the specified round.
-Late accepted response cannot overwrite a newer retained operation or claim success.
-Duplicate-table anonymous retained draft blocks without rendering crash, overwrite or POST.

Visual inspection of390px form and explicit-anchor viewport found readable labels/controls and no clipping. This is development UI, not approved final player/director navigation. No accessibility certification claimed. No publication or hosted operation performed.

Existing frozen mixed checkpoint SHA256 remains `d7e0be17e0ce6568e340eb535fce1dad48940fccaa717c0844496bad0f345316` (867729bytes). The shared stylesheet now has a separately scoped local-planner append; the previous ZIP remains unchanged. New local-planner source/evidence backup and per-entry SHA manifest are recorded in `test-results/local-seating-planner-backup.json` and `test-results/local-seating-planner-source-manifest.json`. These are local-disk recovery artifacts, not off-device durability.
