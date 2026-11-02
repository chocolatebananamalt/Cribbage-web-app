# Selected September scorecard: focused restoration plan

## Decision and boundary

Daron confirmed the existing September review dashboard at https://cribbage-web-app.vercel.app/demo as the desired baseline: “This is it.” Source: parent-forwarded user message Sentinel_dff44d53fddc81918752560105d14615, November 2, 2026. This supersedes the earlier recovery notes' pending-selection status. The keypad distinction means tapping the on-screen number keys rather than typing into a physical-keyboard-editable text field. It is not a missing requirement or a reason to choose another prototype.

This is a read-only comparison and implementation proposal. No app code, migration, deployment, access assignment, score or prototype was changed. The separate Director prototype comparison remains a prerequisite before any major Director dashboard redesign; this proposal only adds navigation to existing authorized functions.

## What remains and what needs restoration

| Area | Selected demo versus current authenticated app | Focused proposal |
| --- | --- | --- |
| Player-first navigation | Demo has adjacent Score Entry and Scorecard tabs. Current route chain often requires Scorecard → Back to tournament → My Games → Open Game. | Keep Play / My Games and Scorecard directly reachable; add Back to My Games on scorecard and completed-game screens. |
| Next game | Current My Games already derives the current playable assignment on the server. Completed-game page only offers View Scorecard. | Offer Open Next Game only when that existing authoritative progression permits it; otherwise return to My Games. Never infer the next game by adding one to a number. |
| Card presentation | Both retain separate game points, plus/minus spread-point columns, opponent names, Verification ID#, totals and fixed player ID. Demo shows a full 12-row card; current card renders resolved lines and separately lists pending games. | Restore the selected card's readable frame and scheduled-row continuity using real event configuration, leaving blank/pending rows visibly unverified. Preserve corrections and odd-field makeup/card-line mapping. Do not hard-code every event to 12 games. |
| Spread entry | Both already have digit keypad, Clear and delete, positive spread entry and review. | Retain the selected keypad. No new physical-keyboard entry mode is required by the selection. |
| Result choice | Both demo and current app offer the two players' names as winner choices. | Apply the separately requested own-name Won / Lost controls: green Won, red Lost, explicit text and accessible selected state. This is an approved requested improvement, not a lost feature of the selected demo. Map self outcome to the existing canonical winner; keep spread positive. |
| Identity and location | Current app has the owner's newer explicit name, fixed ID and current Table/Seat presentation. | Preserve that clarification rather than reverting to ambiguous prototype labels. |
| Official tasks and playing | Current access reader already returns all assigned tournament roles; tournament page filters authorized functions. Demo Operations is sample navigation, not an authorization model. | Show existing assigned Director, Co-director, Cross-checker and Judge destinations alongside Home and Player navigation, with fast return to playing. Navigation changes no role, account or permission. A non-playing official must not be presented as a bound player. |

## Preserve the working system

Use current authenticated readers, server actions and score authority, not the demo's sample state. Retain independent submissions and confirmations, exactly-once authoritative scoring, pending/mismatch states, audit history and corrections. Keep authentication, per-tournament permission checks and account/participant binding intact.

Navigation must not silently discard an unsubmitted entry or pending offline work, automatically submit or confirm anything, clear storage, or switch accounts. Retain owner-bound durable queues, replay/idempotency protection, worker protocol/path checks and recovery locks. Offline readiness remains a statement about the prepared page, not a promise that every staff destination is available without a connection.

## Proposed implementation and acceptance boundary

1. Reuse the existing tournament role reader and My Games progression for a compact shared navigation and direct return actions. Preserve event context and multiple-event selection.
2. Align the real scorecard with the selected presentation while keeping authoritative line values, pending status, corrections and configured schedule length.
3. Implement the already requested own-player Won/Lost controls without changing scoring semantics.
4. Verify phone and desktop, assigned/unassigned roles, non-playing officials, in-progress drafts, pending/verified/corrected games, odd-field makeup rows and multiple events. Recheck genuine offline reload, durable save/manual sync and both clients' verified-state refresh; prove no duplicate authority or historical changes. Run applicable full checks and independent review.

No new database migration is presently indicated: existing role and game readers support this navigation. Confirm that during implementation rather than inventing a new access layer. Implementation requires approval of this focused scope; publication remains a separate reviewed gate. No further baseline or keypad decision is needed. No major Director redesign is included.

## Source anchors

- Selected demo: src/app/tournament-dashboard.tsx and src/app/demo/page.tsx. Latest tracked dashboard change 19bfec71d69b38a0aaf5d8d0f3886e52ff03dd4f, September 18, 2026 09:53:42 UTC.
- Format provenance: docs/quality/2026-09-07-scorecard-format-review.md; docs/product/production-requirements.md.
- Current card: src/app/tournament/[tournamentId]/scorecard/page.tsx.
- Current game progression: src/app/tournament/[tournamentId]/games/page.tsx.
- Current entry and completion: src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx and page.tsx.
- Existing role reader: src/lib/auth/require-tournament-access.ts; role resolution: src/lib/auth/tournament-roles.ts.
- Own-result and navigation requests: docs/product/2026-11-02-deferred-own-player-win-loss.md.

The previously prepared August comparison PDF/HTML are historical recovery artifacts, not the final comparison against this newly selected September baseline. No new attachment upload or backup replacement is claimed by this note.

## Owner readability refinement — proposed, not implemented

Source: Sentinel_4361de3881008191855744c3617d8981. Exact result controls are “[own player name] WON” (green) and “[own player name] LOST” (red), never the opponent's name on those controls. Opponent identity remains visible separately in the matchup. Request is suggestions and scope review, not implementation/publication approval.

Priority recommendations:

1. Scorecard game points, plus/minus spread points, totals and verification IDs: 19–20 CSS px (approximately 14–15 pt), tabular numerals, clear weight. Opponent names may be 16 px and wrap; never truncate an identifying ID. Use relative font sizing so browser enlargement works. Current base card is 16 px, grouped headers 14 px; these are CSS pixels, not points.
2. Spread-entry value 36–40 px, keypad digits 24 px, result choices 20 px. Keep the existing keypad arrangement; retain at least 56 px button height and about 8 px gaps. Current keypad already has 56 px height but only 18 px digits. Long own names wrap, both result buttons retain equal visual priority, and selected state uses a border/check plus text rather than green/red alone. Review remains required.
3. Scorecard rows around 48–52 px minimum, growing with wrapped text. Dark text on a light background, subtle alternate rows, distinct plus/minus column boundaries and explicit headers. Target at least 4.5:1 text contrast throughout, including the green/red choices and explanatory states. No assumption that current colors pass a contrast audit.
4. iPad/desktop: keep the familiar full-width grouped table. Phone: keep numeric columns and ID at the recommended size; put the smaller opponent name on a second line within the same game's row, retaining it in accessible reading order. Keep grouped column meanings explicit. Do not shrink everything to force six columns into portrait width. At extreme enlargement allow a contained table scroll if needed rather than clipping values; surrounding controls reflow normally. Confirm this compact phone treatment in a review mockup before coding.
5. Use readable navigation text (at least 16 px), with Play / My Games and Scorecard prominent, assigned official destinations secondary. Current demo's narrow-screen five-item navigation can shrink labels to 11 px. Wrap or regroup navigation instead of shrinking it. Sticky controls/header/totals must not hide rows, focused controls or the entry review on small or zoomed screens; relax sticky positioning where required.

Tradeoff: fewer scorecard rows fit on screen, particularly on phones, in exchange for readable figures and reliable taps. Do not preserve the current 382 px inner-scroll cap as a fixed requirement; avoid nested scrolling on phone where possible. All rows, opponent names, verification IDs and totals remain available. The score-entry page does not gain extra explanatory clutter.

Acceptance before any rollout: review proposed phone/iPad/desktop renders with long names, three-digit positive/negative spread totals, pending/corrected rows and actual IDs; test 200% text enlargement, 320 CSS px reflow, keyboard focus and screen-reader headers/labels. Browser zoom stays enabled. These are proposed acceptance criteria, not completed accessibility certification or a claim that one font size meets every user's needs.

References: W3C Resize Text https://www.w3.org/WAI/WCAG21/Understanding/resize-text ; Contrast https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html ; Target Size Enhanced https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html (44 CSS px enhanced target guideline; proposed 56 px is our larger product target); Reflow https://www.w3.org/WAI/WCAG22/Understanding/reflow.html .

Recommended next decision: approve the focused restoration with this readable-size direction and a phone review mockup. No need to ask the owner to choose individual CSS measurements or revisit the already specified button labels. No app code, demo, security, scoring, offline storage or roles changed for this review.

## Owner-approved visual refinement and navigation correction

Source: Sentinel_c9c44ee48cb08191ad39308b18ea4ab5, November2. Owner explicitly loves the current entry and exact enlarged logo size on both pages. Preserve that shared black header/authentic logo treatment for future Home and Profile as well as Entry and Scorecard; extend elsewhere only when needed task space is not sacrificed. This records design intent, not implementation or deployment authorization. Existing CSS mockup at390px displays visible artwork approximately148x53px, cropping only excess black margin with full artwork/aspect ratio preserved.

Entry screen: top Score Entry active; bottom Home, Scorecard and Profile ALL unselected. Previous interpretation of Scorecard as parent-section active on entry is superseded. Scorecard page itself keeps bottom Scorecard active. No false profile/home state. Corrected entry comparison saved sameLibraryidentity atversion7. Cardcomparisonversion6 remains unchanged. Original September left comparison images unchanged. Phone/iPad/enlargedtext renders remain review artifacts only; no live app code or data changed.
