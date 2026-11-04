# Initial-seat consistency and identity/location repair — local only

Base: `255ffc8334af9c6eb9dd7a2787cb42fde430ae88`, draft PR122 branch. No commit, push, hosted migration, fixture edit, score or outage in this task.

## Recovered decision and sources

`docs/decisions/2026-09-14-event-play-and-operations-boundary.md` (September 14), lines 22–28, records the existing project decision: absence, withdrawal, substitution and reinstatement are audited and event-scoped; mixed-up rotations are director-chosen, with complete before/after versions; unaffected Verification IDs and schedules are preserved. This is stronger evidence of the adopted app boundary than inferring policy from current code. The exact older conversation referenced by the owner was not recovered. The v1.0/v1.1 extracted specifications retain general rule-driven absence/forfeit and permitted-director-discretion requirements, not a more specific replacement algorithm.

ACC Director Manual 2019 section12.C–D, printed17–18, supports late arrivals/substitutes, separate substitute cards and director changes to rotation after departure. Policy Manual chapter6 I.E.12, printed6-2/PDF34, separates original/substitute cards and returning-player missed-game treatment. These provisions do not authorize changing immutable player IDs or inventing automatic replacements.

Owner clarification November2: active game1 players start in the table/seat encoded by their permanent ID; an odd-field first-game sit-out is exempt. Do not require that sit-out's first later played game to use the original seat.

## Implementation boundary

New `validateInitialGameSeats` runs only in fresh standard/17-player initial-publication previews. New additive migration0271 checks the two existing service-only publishers after authorization/locking and historical receipt replay. It adds no table, RPC signature or grant. Historical derivation/currentness and audited amendment functions remain unchanged. Malformed odd regularMatches object/scalar/null return an audited rejection rather than raising on JSON expansion.

Shared `GamePlayerLocation` displays permanent `Player ID` separately from `This game: Table / Seat`, in My Games, score entry, pre-submit review and the published schedule. Event headings explicitly say `Event:`; no player or event is renamed.

## Verification

- Focused tests:10/10, including even/odd starting seats, first-game sit-out/later return and unchanged historical derivation.
- Actual React/local intercepted-API browser checks:10 scenarios,390/1440px, no overflow. Includes fresh standard mismatch blocking/aligned acceptance,17-player makeup workflow, historical reseated display, actual digital pre-submit review, paper/hybrid card-line display and lost-response/reload/conflict handling. These are local browser checks, not a physical two-device or independent-person pass.
- Actual PostgreSQL in reviewed image, no networking/ports/mounts/privilege: fresh odd rejection/valid102 games, auth/scope, malformed inputs, historical odd exact replay/currentness/fingerprints, and standard fresh cases. Final standard historical-mismatch replay rerun pending when this note was drafted.
- Independent Sol review found two SQL defects (ambiguous alias and prevalidation JSON expansion); both corrected. No remaining source P1/P2 reported. Final full-suite/build and standard historical replay evidence still pending until recorded below.

Task-owned local resources are removed and cleanup verified by the runners; no hosted test data was used.

## Existing rehearsal correction boundary

The current rehearsal remains started once with zero submissions at the last verified hosted checkpoint. Director permanentID A-2 and B permanentID E-1 were wrongly paired at physical A-1/A-2 in game1. The setup deliberately reused a schedule that did not preserve initial-seat identity; this was our fixture error plus missing app validation, not an ACC rotation rule.

Permanent IDs/initial seating are immutable. Ordinary pending-game amendment supports audited later physical reseating, but `mixed_rotation_repair` rejects repeated opponents throughout a proposal; the current deliberate game1/game2 repeat cannot simply be passed through that path unchanged. Do not mislabel it `early_departure_substitute`, rewrite history through SQL or pretend that changing later seats repairs the original starting assignment.

A clean replacement rehearsal with the two linked accounts assigned adjacent starting IDs is the recommended correction. It requires an exact approved fixture/enrollment/link plan before hosted mutation; simulation enrollment is restricted to the current fixture, so replacement is not silently authorized by this patch. Another reviewed technical correction path would require its own explicit design/approval. Neither has been executed. Keep both sessions and completed finals unchanged. User-operated scoring/offline rehearsal remains paused.

## Final revised layout and compatibility

Owner supplied the final layout: bold Event/Game heading; actual player name followed by fixed ID#; bold current Table/Seat. Shared layout now follows that request, with consistent hyphenated IDs and responsive wrapping. Own playerName is added only to the existing auth.uid-bound participant in get_my_assigned_games_v1, from its tournament-scoped roster entry with profile fallback. TypeScript accepts the optional validated name and legacy responses. No new data scope, RPC signature or grant.

Important rollout order: publish the compatible app/parser FIRST, verify its exact test Preview, then apply0271 to staging during a quiet window. The older deployed parser rejects the extra playerName key, so do not use generic schema-first ordering for this patch. Source review found no remaining P1/P2. This task does not authorize either action.

Final isolated SQL gate PASS: standard fresh validation and historical mismatched-seat exact receipt replay/fingerprints; odd fresh validation, game1sitout/later return,102games, malformed inputs, auth/scope, accepted/rejected replay, historical currentness/fingerprints; own-name mapping; no human grant. Container ba580f1b989cd92fada497577f3bd57a01e7cd82c5d46b0fad3d537f41b1c466 removed, verified2026-11-02T01:15:58.111Z. Ten390/1440px browser scenarios PASS after the revised layout, including pre-submit review. No hosted write or physical test was performed. Audited amendment functions are unchanged by inspection; this focused run did not simulate a real departure or perform a new audited amendment.

Full verify/build final result is recorded in the completion section when available. Earlier harness failures were corrected; one build was rerun sequentially after a temporary headless fixture removal raced TypeScript discovery. No product guard was weakened to make a fixture pass.

## Verified completion

Final `pnpm verify` PASS:1,155 application tests; dependency audit no known vulnerabilities; lint zero errors (existing warnings retained); provider check; production build and TypeScript;6 build tests and8 workspace tests. `pnpm verify:handoff`6/6 PASS. Focused10/10, isolated SQL gate PASS,10 local phone/desktop scenarios PASS, final independent Sol source review no P1/P2. No new physical multi-user rehearsal or real departure/reseat enactment is claimed.

Publication scope is the20-file curated manifest, including this report/manifest, one additive migration0271 and no new tables/grants/signatures. The local patch does not fix or mutate the already-started hosted fixture. Approval is needed for branch publication/staging application, with compatible parser first, and separately for the exact replacement or audited technical-correction plan. There is no denied or uncertain hosted write in this task.
