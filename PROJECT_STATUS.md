# Project Status

## 2026-09-08 live score-entry pilot hardening

- Added the protected, server-backed Standard Singles score-entry route. It loads only a signed-in, checked-in assigned player's active game context through a narrow authenticated RPC; it uses the existing server-authoritative submission/confirmation routes and does not expose direct private-table access.
- Applied pilot migrations `assigned_game_context`, `assigned_game_context_hardening`, `confirmation_eligibility_hardening`, and `assigned_game_context_confirmation_recovery`. The corrections align the read model with canonical `pending`/`verified` state, make the saved score and confirmation state refresh-safe, remove unnecessary internal IDs from the client payload, preserve IDs across ambiguous network retries, and enforce event/ruleset eligibility at the confirmation data boundary.
- Added concise score-entry help for a paper-card/digital-card game and recorded `R-GUIDE-01`, including the fuller director guide requirement. The instruction does not weaken the two entries/two confirmations verification rule.
- `pnpm lint`, `pnpm test` (26 tests), `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` passed. Pilot SQL verified an assigned caller receives its constrained context, an unassigned caller receives none, and a verified game refreshes to its authoritative state. Preview deployment `dpl_DVrpjbWYsXYHuwNk1Uokdq3EpUi3` is Ready from commit `414ccd5` with no current runtime error clusters. Independent browser sessions, a seeded real role, and phone/desktop live-route verification remain required before this vertical slice can be called complete.

## 2026-09-07 canonical setup and Events/Flyer foundation

- Confirmed **Events and Flyer** is an event-management/reference area with flyer creation inside it, not a flyer-only operation. It now lists Main Event, Consolation Event, and configured Satellite Events without incorrectly treating Topaz (a location) as an event.
- Made **Set Up Tournament** the prototype’s planned canonical data-entry source. It contains prototype options based on observed sanctioning-request tournament/director/venue fields, Main/Consolation/Satellite configuration menus, two co-director entries, and a disabled flyer-import format preview. Future production reuse is explicitly specified for flyer, seating, results, finance, and a director-assisted draft worksheet; no automatic portal submission is claimed without a documented ACC API/import contract.
- Refined the review surfaces: larger permanent scorecard ID, inline tournament context on seating print, searchable/cached/online Rulebook labels, and category-first results. Regenerated the synthetic qualifier PDF so the winners lead the qualifier order.
- `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, `pnpm verify`, and `pnpm verify:handoff` passed. Hosted desktop review deployment `dpl_68JMBS9YFzgGtP7aZmWyrx1USHUK` rendered the Score Entry panel without an error overlay. Phone and physical-print verification remain pending.

## 2026-09-07 score-entry and scorecard format review

- Updated the review shell to use the approved player-facing Score Entry/Game Result language and to preview both players’ game and reciprocal spread entries.
- Reworked the scorecard into the requested 12-game, paper-card-inspired grouped header format, with the player ACC number, Table/Seat, current game, opponent, Verification ID #, and Games Won. Removed prototype explanations, initials, loss count, and Checked by from the visible card.
- Recorded the future paper-player seating-list requirement and the consent/provider gate for optional SMS notifications. `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed. Hosted Preview deployment `dpl_8Res9v9BjVDAz9P5G4ksqSEs7C7m` rendered the revised desktop review shell; a real phone browser pass remains required.

## 2026-09-07 scorecard totals, seating print, and rulebook cache review

- Moved the pending-opponent notice into the unused right side of the fixed scorecard total row and changed it to `Updated Total Calculations Pending Opponent Entry`; enlarged the stacked Opponent/Verification headers and made the Plus/Minus header symbols match.
- Changed the top context badge to `GAME 3`; production must advance this only after the current game is server verified.
- Renamed seating columns to `Assigned Table - Seat`; both printed columns now repeat Player, Scorecard, and Assigned Table - Seat headers, use compact `A-5` values, preserve left-column-first pagination, and use one-half-inch print margins.
- The user recorded permission to cache the full ACC Rulebook. Verified and cached the dated official 64-page 2025 PDF from the ACC rules URL; the Rulebook tab now opens that local copy. This is a prototype asset integration, not an assertion that every rule implementation is complete or current.

## 2026-09-07 continued prototype-format review

- The review flow now shows the pending-opponent notices only after a submitted entry; the fixed total-row notice uses the same 16px red status treatment as the scorecard header and is announced accessibly.
- Reduced printable seating capacity to 28 entries per column (56 per Letter page) to fit 12-point print with half-inch margins. The prototype keeps the requested left-column-first order and repeats the three compact headers in both columns.
- Made configured events data-driven in the review layout, including Main, Consy, Canadian Doubles, and a custom satellite sample. Canadian Doubles is now represented as a future team-scorecard workflow, not a manual-only result; actual standings use remains gated on team verification and dated ACC fixtures.
- Check-in now explicitly holds Table/Seat and permanent ID generation until registration closes. Added a viewable flyer sample and an interactive two-format Rulebook view: Quick Reference, cached 2025 full PDF, and the external official ACC source.

## 2026-09-07 scorecard ID and Seating review

- Distinguished a permanent player `ID #` (used for scorecard verification throughout the tournament) from each game’s changing Table/Seat assignment. The Score Entry and Review Result screens now display both concepts separately.
- Tightened the Scorecard columns, made the header and two total/summary rows fixed outside the touch-scrolling game rows, retained the requested grouped Game/Spread divider lines only, added signed spread totals, and surfaced red `Verification Pending Entry` beside the card heading.
- Renamed the Operations option to Seating and added prototype controls for table/seats-per-table capacity, name search, sorting by first/last/card type/current table-seat, and printing the seating list. `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed. Hosted preview `dpl_57LReyrNzTQS13uEWPx5ijZ7Jx75` rendered the revised Score Entry screen without an error overlay; local browser remains intentionally blocked without public Supabase variables.

## 2026-09-07 score-entry keypad refinement

- Reordered the keypad status band to put the entered number on the left, `Spread Points` centered over the keypad, and any Skunk aid on the right. The keypad now ignores a fourth digit while existing 1–121 validation still rejects impossible three-digit entries. `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed.

## 2026-09-07 operations and results layout review

- Restored left-aligned `Spread Points:` to match `Game Winner:`, centered only the entered value above the keypad, and updated Review Result seating punctuation.
- Expanded the review prototype with Tournament Setup, Players & Check-In, Table Plan, Judge Desk, Flyer Editor, a print-specific two-column Seating Assignments layout, and a clickable Qualification Preview. The Table Plan visibly identifies an under-filled final table for director review; authoritative rotation/play-through instructions remain gated on an approved ACC fixture.
- Flyer & Events now presents event editing and flyer generation rather than treating `ACC Sanctioning Fee` or `Ready to Publish` as event states. The qualification preview presents configuration, qualifying-place, MRP, and Q Pool areas before results are final. `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed; hosted preview `dpl_2c7f3rE7zRtVzZkGh4ubkzrE1rLz` rendered the revised Score Entry without an error overlay.

## 2026-09-07 navigable format-review prototype

- Replaced the static anchor review shell with a navigable local review flow: Score Entry, Review Current Game Result, Scorecard, Operations, Seating & Paper Cards, Cross Check, Flyer & Events, Financials, and Results.
- Updated Current Game Results language, the invalid spread-point message, event game-count context, paper-card headers, vertically stacked Net Points/Games Won values, and touch-scrolling scorecard container. The Review Result step is visual/prototype state only and does not bypass server-side independent verification.
- `pnpm test` (25 tests), `pnpm lint`, and `pnpm build` passed. Hosted Preview deployment `dpl_6pYkkG1QrRAjcTH2AMSFWJCzsBR3` rendered the Current Game Results screen and top-level navigation without a development error; a real phone browser pass remains required.

## 2026-09-07 release-readiness audit

- Recorded a current-state, evidence-based release audit in `docs/quality/2026-09-07-release-readiness-audit.md`. The Preview and bounded pilot score API have evidence, but production deployment, real score-entry integration, role views, corrections/disputes, offline/hybrid operation, event/finance/results/export, rule fixtures, and operational exercises remain critical release blockers.

## 2026-09-07 skunk-language requirements reconciliation

- Reconciled the normative requirements with the approved prototype review: player-facing Skunk/Double Skunk/Triple Skunk labels and icons require no disclaimer, while remaining presentation-only and excluded from official calculations, standings, and exports.

## 2026-09-07 spread-points score-entry label

- Renamed the player-facing `Winning margin` field to `Spread Points`, removed the visible `1–121` range cue, and retained the existing internal 1–121 score validation. The keypad and invalid-entry feedback use the same plain-language wording.

## 2026-09-07 score-entry language cleanup

- Removed prototype workflow jargon from the score-entry panel: `FAST ENTRY`, `1 of 3`, and `Derived result`. The panel is now headed simply `Record game result`; after a valid entry it states the plain-language win result with the existing game-points, Plus/Minus, and skunk aid.
- Added a regression test that rejects those labels and requires the player-facing result wording. `pnpm verify:local` passed (23 application/security tests plus build and local handoff checks), and a signed-in hosted browser rendered the updated score-entry panel from preview deployment `dpl_HYexTAhfWuGrjGtAurEZkutRgJAP`.

## 2026-09-07 Vercel framework configuration fallback

- Added a repository-owned `vercel.json` declaring the `nextjs` framework. This is the durable equivalent of selecting the Next.js framework preset in the Vercel dashboard and will accompany every Git deployment.
- `pnpm verify:local` passed: lint, 22 application/security tests, production build, workspace verification, and 6/6 private-handoff checks.
- Vercel deployed commit `f1c57c1` as `dpl_GHHrC2nF2zMuwiKLsDewQhoETKLg` and now routes requests to the app instead of returning its edge-level 404. Preview environment values were then configured and commit `dedcc78` deployed as `dpl_E8EYFwyjaSBrujHKQfFznA3R7TFq`; a signed-in browser independently rendered the full ACC Tournament Desk prototype from that URL. Production remains intentionally separate: it still points at `main`, has no production environment values, and must not be promoted until release gates are complete.

## 2026-09-06 preview deployment diagnosis

- Pushed commit `9978f67` to `codex/production-readiness-baseline`. Vercel cloned it, installed the locked dependencies, ran `next build`, and marked preview deployment `dpl_mwbNt8UbRcQF7x6RLZUwadpiNjue` Ready.
- The generated preview URL and its branch alias both return Vercel `404 NOT_FOUND` before any application runtime logs are created, including with a temporary protected-deployment share URL. This is a hosted Vercel routing/deployment configuration issue, not a failed application build; it remains a release blocker.
- Pilot advisors now report only expected unused-index information plus intentional private-schema/RPC warnings, and one unresolved Supabase Auth warning: leaked-password protection is disabled. The UI is OTP-only, but service-side password behavior has not been verified; production must enable leaked-password protection or enforce passwordless Auth.

## 2026-09-06 pilot advisor remediation

- Applied `0005_pilot_index_and_advisor_baseline` to the isolated synthetic-data pilot only after focused review. It adds non-unique covering indexes for the advisory foreign keys and does not broaden table, policy, or RPC privileges.
- Corrected the fresh-schema index names in `0001` to match `0005`, preventing duplicate equivalent indexes on a clean migration replay.
- The Supabase password-protection advisory remains a release blocker: the current UI is magic-link only, but the hosted Auth password setting has not been independently verified or configured. Production must enforce passwordless Auth or enable leaked-password protection before launch.

## 2026-09-06 Supabase auth scaffolding

- Added pinned `@supabase/supabase-js@2.115.0` and `@supabase/ssr@0.12.6`, fail-closed public environment validation, browser/server cookie-aware client utilities, a minimal email-link sign-in page, and a same-origin-safe `/auth/callback` route.
- Added `.env.example` with blank public variables only. No secrets, service keys, policies, RPCs, direct public database access, or environment values were added. The existing prototype dashboard route remains available.

## 2026-09-06 Supabase auth review hardening

- Browser/server utilities now pass direct `process.env.NEXT_PUBLIC_*` references for Next bundling while retaining the testable validator. Added Next 16 `src/proxy.ts` claim refresh with cookie propagation and no swallowed errors.
- Sign-in is invite-only (`shouldCreateUser: false`). Added a server-side tournament DAL membership/role gate and protected dynamic tournament route; unknown or unassigned users receive no tournament data. `.env.example` is explicitly unignored and contains only blank public variables.

## 2026-09-06 Supabase auth blocker remediation

- Added response-aware route-handler cookie propagation for the callback and retained claim-refresh cookie propagation in the Next 16 proxy. Protected membership now uses a narrowly scoped, unapplied `app.get_tournament_role` security-definer function with empty search path, `auth.uid()` membership check, revoked defaults, and an explicit authenticated execute grant only.
- Safe `next` paths are preserved through sign-in and callback. `.env.example` remains tracked, blank, and credential-free (`a35a1da` latest template correction).

## 2026-09-06 final auth boundary correction

- SSR proxy and callback now preserve refreshed request headers and response cookies. The unapplied membership migration exposes only a public `get_tournament_role` security-definer wrapper with empty search path, fully qualified private-table access, revoked public/anonymous execution, and authenticated execute only; the DAL uses that RPC and never reads `app` tables directly.

## 2026-09-06 Standard Singles game API vertical slice

- Added an unapplied `0003` migration with authenticated SECURITY DEFINER `submit_game_score` and `confirm_game_score` RPCs. They enforce actor assignment/role scope, idempotency replay/conflict detection, matching submissions, two confirmations, and atomic canonical scoreline/game-point derivation without client table grants.
- Added validated POST handlers at `/api/v1/games/[id]/submissions` and `/api/v1/games/[id]/confirmations`, using `getClaims` and RPCs only. No environment, Supabase project, migration, or deployment was changed.

## 2026-09-06 game API review remediation

- Restricted confirmations to the assigned player confirming their own submission; staff confirmation is not enabled. The second submission now atomically persists `confirmation_pending` for an exact pair or `mismatch` otherwise, with digital/approved/open/checked-in gates.
- RPCs compute request digests internally, lock the game before idempotency lookup, record accepted receipts and linked audit events, and return structured rejection responses. Routes no longer accept caller-supplied hashes or source methods.

## 2026-09-06 final game API review correction

- Both RPCs now require an open tournament; submission requires an approved digital Standard Singles event and checked-in assigned player, while confirmation rechecks current checked-in assignment and own-submission ownership.
- Rejection logging is now internal to the authoritative RPC subtransaction: partial mutations roll back, then controlled rejected receipts/audit events are appended without any client-callable logging RPC or false acceptance. `pgcrypto` qualification is recorded from the pilot read-only verification below.
- Pilot read-only verification confirmed the extension schema is `extensions`; 0001 defaults and 0003 digest/generator calls now use `extensions.gen_random_uuid()` and `extensions.digest()`.

## 2026-09-06 rejection-integrity hardening

- Added an immutable, private `app.operation_conflicts` record for same- or cross-tournament idempotency conflicts and unscoped/unknown-game rejection attempts. It retains the attempted key/hash and any prior receipt ID without an invalid composite reference.
- Domain validation is now ordered after game lookup where possible; expected domain rejects return stable codes, while unexpected database/audit failures rethrow and are surfaced by routes as generic 503 responses without raw database messages.
- Added static coverage for conflict retention, immutable audit behavior, structured non-2xx route mapping, and the audit-write failure boundary. Migration 0003 remains unapplied.

## 2026-09-06 idempotency/null-boundary hardening

- Both RPCs now reject required null arguments explicitly, serialize the actor/idempotency-key pair with a transaction advisory lock, and resolve exact replays before mutable tournament/event/assignment eligibility checks after safe game lookup.
- Stable idempotency conflicts remain separate immutable conflict records; accepted replay responses never receive rejection audit events or mutate state.

## 2026-09-06 PL/pgSQL exception-structure correction

- Corrected the unapplied 0003 RPC draft after the pilot rejected it atomically on PostgreSQL syntax near `exception`: each function now uses one valid `EXCEPTION` clause with `P0001` and `OTHERS` branches. No pilot mutation occurred.
- Static tests now assert two exception blocks total and both fallback rethrows. No local `psql` parser/client is available, so database parse/apply validation remains pending a controlled integration environment.

## 2026-09-06 pilot trigger security correction

- The pilot's first real 0003 mutation test exposed authenticated execution failure in the deferred submission revalidation trigger (`permission denied for schema app`). Updated the 0001 base trigger/revalidation functions to use `SECURITY DEFINER`, empty `search_path`, fully qualified private-table references, and revoked client execution.
- Added unapplied `database/migrations/0004_trigger_security_hardening.sql` to correct the already-created pilot schema. No pilot changes were made during this pass.

## 2026-09-06 pilot advisor index baseline

- Added unapplied `database/migrations/0005_pilot_index_and_advisor_baseline.sql` with covering indexes for the advisor-listed private-schema foreign keys, including audit scope, participant/event scope, conflict receipt, confirmation actor, submission ownership, and tournament director references.
- Mirrored the index coverage in 0001 for fresh database creation. The pilot remains intentionally policy-free/private with revoked direct table DML; only authenticated, auth-checked security-definer RPCs are intended to execute. Authentication is magic-link/OTP only, so leaked-password lint is not applicable.

## 2026-09-06 local schema contract scaffolding

- Added an unapplied local first-draft migration for private Standard Singles core tables, UUID/FK/scope checks, 1–121 margins, 0/2/3 game points, normalized two-side game pairs, forced RLS, and revoked direct `anon`/`authenticated` DML.
- Added static schema rejection-boundary tests and wired them into `pnpm test`. No Supabase service, auth, routes, policies, RPCs, or production database was changed. Applying the migration remains gated on server authorization policies, integration fixtures, and recovery review.

## 2026-09-06 local schema security redesign

- Reworked the unapplied migration into private `app` schema with `profiles.id` linked to `auth.users`, restrictive non-cascading history/core FKs, composite tournament/event/ruleset/round/game scope, assigned two-sided games, exact two submission slots, immutable winner/margin submissions, submission-bound distinct confirmations, pending-state score guards, game versioning, and actor/operation/target/request-hash idempotency.
- Updated static schema tests to cover these security and rejection invariants. No Supabase migration, policies, RPCs, auth routes, or services were touched.

## 2026-09-06 second schema review correction

- Expanded the local state model to pending/submitted/mismatch/confirmation_pending/verified/corrected; confirmations now support exactly two distinct actors and allow a player to confirm their own submission. Verified/corrected games require two matching submissions, exactly two reciprocal scorelines, one winner, and two confirmations.
- Added immutable confirmation/audit protection, audit foreign-key linkage, assigned-side submission linkage, game/scoreline Table/Seat snapshots, approved matching ruleset enforcement for digital events, and corrected idempotency semantics so request-hash comparison remains future RPC logic.

## 2026-09-06 third schema remediation

- Added deferred revalidation after scoreline, submission, and confirmation mutations. Verified/corrected games now require matching submissions, exactly two reciprocal side-mapped scorelines with matching seats/margins and reciprocal Plus/Minus/game points, exactly two distinct submission-bound confirmations, and valid assigned slot/player linkage.
- Added immutable receipt/ruleset protections, stored replay response payloads, tournament-scoped audit receipt linkage, and retained the migration as local-only/static-test scaffolding.

## 2026-09-06 final score-entry readiness pass

- Added and tested `isScoreEntryReady`: no winner or invalid margin cannot start entry; a valid margin plus selected winner can. Dashboard initial controls remain unpressed and review-disabled.
- Improved decorative VS contrast/accessibility and corrected direct handoff evidence to 6/6 (outer workspace verification remains 6/6).

## 2026-09-06 final prototype accessibility/CI correction

- Added defensive runtime winner validation; the dashboard starts with no winner selected, keeps both controls unpressed, and disables score review until a winner and valid margin are entered.
- CI now uses `pnpm verify` only for clean-clone checks; `verify:handoff` remains a mandatory local-only command via `verify:local`. `verify:all` uses pnpm and excludes private handoff verification.
- Raised essential UI information to 16px minimum, retained 56px keypad targets, strengthened muted/status colors for normal-text contrast, and recorded browser checks at 320/375/1280px plus the unrun 200% zoom limitation.

## 2026-09-06 prototype accessibility and source-boundary pass

- Corrected the demo scorecard so live entry remains visibly `Pending preview · not certified` and is excluded from settled rows, totals, and net calculations. Removed static “saved” behavior.
- Added signed-net formatting tests, 16px essential labels/table/status targets, 56px keypad targets, `aria-pressed` winner controls, offline-safe system font stack, and the user-authorized `public/branding/acc-logo.jpg` via `next/image`.
- Added ESLint flat config and lint CI gate. Existing CI score/build/recovery gates remain intact; this pass added lint and did not replace them.

## 2026-09-06 prototype corrective pass

- Corrected score derivation so either selected winner receives 2 game points for a normal win or 3 for an informal skunk-band win; reciprocal Plus/Minus fields remain correct.
- Added opponent-winner normal/skunk regression coverage, pinned `pnpm@11.19.0`, meaningful `test`/`verify:all` scripts, and CI installation/build/score/recovery gates on Node 24.
- Recorded dependency/lockfile validation: the lead-added dependency set and `pnpm-lock.yaml` pass frozen install; initial ignored `unrs-resolver` build was narrowly approved via `pnpm-workspace.yaml`; `pnpm audit --audit-level=high` reports no known vulnerabilities.

## 2026-09-07 prototype operations and results review

- Refined the review prototype with a prominent `Verification Pending Opponent Entry` state and a matching total-row notice that verified totals exclude the pending game.
- Corrected seating print pagination to fill the left column before beginning the right column; the synthetic roster has four entries and is not an actual tournament count.
- Added a public Rulebook tab with an app-owned quick-reference placeholder and an official dated-link placeholder; it intentionally does not reproduce or cache the ACC rulebook without permission.
- Added event and repeatable co-director setup cues, a Table C exception-review screen, more precise cross-check language, event-selectable tournament results, and an explicitly synthetic, non-official Main qualifier-report PDF sample.
- A focused Sol review confirmed that rotation/play-through instructions, MRP/payout calculations, and portal-role parity remain production gates pending dated ACC fixtures and verified portal requirements.

## 2026-09-06 fresh prototype shell

- Added a bounded Next.js App Router TypeScript prototype under `src/app`: ACC-branded responsive tournament dashboard, large 1–121 score keypad, derived scoring/skunk aid, paper-style scorecard, and static operations/verification/correction/results cards.
- Added pure score derivation utility and rejection/boundary tests. This shell uses synthetic data only and intentionally has no Supabase, auth, persistence, or production claims.
- Verified production build, score tests, workspace/handoff checks, and browser behavior at desktop plus a 375px phone viewport. Fixed the phone page-level horizontal overflow found during browser review.

## 2026-09-06 final source-accuracy corrections

- Corrected cross-check staffing to apply per individual table, including the ACC related-couple/significant-other/relative third-checker safeguard only where a qualifying table is affected.
- Expanded `TR-06` with ACC 2025 Judge Protocols, Rule 10.1(b), Appendix A items 1–3, and existing rules 12.1–12.2, 13.2, and Cross-Checking Guidelines item 20.
- Removed Muggins disclosure from unresolved gates; retained only event configuration as data to record. Architecture now requires all affected scorelines to update atomically and defines normalized side-pair uniqueness plus explicit rematch/version and replay handling.

## 2026-09-06 second normative requirements hardening

- Tightened hybrid/paper verification to require each assigned player to independently enter and confirm their own paper result using context-only PIN; unavailable players leave the card `PendingCrossCheck`, with no staff substitution absent a future approved exception.
- Encoded the cited ACC 2025 judge/cross-check baseline, immediate correction semantics, paid-placement amounts, Muggins disclosure, high-non-qualifier fixture, finance gates, non-singles manual/imported boundary, and event-finalization gates.
- Replaced the architecture summary with a canonical `tournament → event → round → canonical_game → card_scoreline → ...` model, explicit offline security boundary, result versions, finance/attachments, and internal export artifact.
- Added direct requirement mappings for roles, offline queue security, finalization, flyers, attachments, and financial classification. No production code, imports, credentials, or external services were changed.

## 2026-09-06 normative requirements hardening

- Hardened `docs/product/production-requirements.md` after independent review: added stable requirement IDs and positive/rejection traceability, self-contained registration/check-in/shared-device/seating/dispute/Consolation/template/attachment workflows, exact digital and hybrid actor rules, canonical per-card/match linkage and Rule 12.2 fixture coverage, explicit Pending/Applied correction semantics, judge capacity/self-dispute safeguards, Standard Singles boundary, restricted-hold retention, deletion/backup/restore controls, internal director-assisted export wording, finance/reporting gates, signed-in results default, informal skunk bands, measurable accessibility targets, and rulebook-cache permission gate.
- Updated `docs/product/requirements.md` so the summary IDs, audience, correction state, canonical score linkage, and export boundary agree with the normative baseline.
- No production code, imports, credentials, or external services were changed. Remaining requirements are intentionally implementation gates where ACC policy, payout fixtures, retention, copyright, or export schema approval is still absent.

## 2026-09-06 normative production requirements baseline

- Added `docs/product/production-requirements.md` as the self-contained normative baseline for scoring, digital/digital and hybrid/paper state machines, post-verification corrections, authentication, staged full-product delivery, public results, private finance, ACC-ready export, retention uncertainty, and traceability/acceptance gates.
- Updated `docs/product/requirements.md` to point to the normative baseline while retaining the recovered summary and source map.
- No production code, imports, credentials, or external services were changed.

## 2026-09-06 requirements reconciliation and production-readiness audit

- Reconciled user-approved scorecard, correction, flyer, results, Q-pool, branding, and ACC-export decisions into `docs/product/requirements.md`; recorded current ACC 2025 scoring, tie-break, and qualification sources.
- Updated launch planning to reflect the connected GitHub/Vercel project and healthy Supabase project. The only Vercel deployment is a placeholder that returns 404; Supabase has no migrations or public tables.
- Production implementation has not begun. The next milestone is a fresh accessible branded prototype, followed by an authenticated two-player, dual-confirmed, server-audited vertical slice.

## 2026-09-06 handoff restoration

- Restored the 33-entry ACC handoff ZIP into `imports/acc-handoff-2026-09-05` without overwriting any source material.
- Ran `scripts/organize-handoff.ps1`; all 32 manifest artifacts and their organized copies match size and SHA-256, with three exact duplicate pairs mapped to shared copies.
- Verified with the bundled Node 24.19.0 runtime: `tests/workspace.test.mjs` (6/6 passing) and `tests/handoff.test.mjs` (3/3 passing).

## 2026-09-05 model routing

- Added project-specific builder/reviewer routing in `docs/operations/MODEL_ROUTING.md`; Astra is explicitly prohibited.
- Terra is the default lead, Sol performs focused plan/high-risk review, and bounded mechanical and routine work may use Luna or Mini.
- Routing never replaces the mandatory verification gates.

## Recovery update: 2026-09-05

ACC_Digital_Tournament_System_CODEX_MAXIMAL_HANDOFF_2026-09-05.zip found in C:/Users/choco/New folder/. All 32 listed artifacts match SHA-256 and size. There are 33 archive entries including the manifest and 29 unique listed artifact contents. Original files are preserved; inventory.json maps organized copies.

Specification v1.1 is the baseline; v1.3 is the latest review prototype. No production backend, database or multi-user engine was recovered. The missing original August transcript is helpful but no longer blocks implementation planning.

Read docs/recovery/REVIEW.md, docs/quality/VERIFICATION.md and docs/operations/LAUNCH_PLAN.md. Next milestone: validate rules and build one tested, authenticated two-player game with atomic verification and audit.

The earlier scaffold notes below are historical and superseded by this recovery update.

## Current state

- Repository scaffold created.
- GitHub CLI connected.
- Previous ChatGPT system conversation still needs to be recovered.
- No earlier application source code has been found locally.

## Next task

Recover and import the ChatGPT conversation export, then reconstruct the product requirements and identify any embedded code or downloadable artifacts.

## Open questions

- Which ChatGPT account or workspace contains the original system conversation?
- Did the original conversation generate downloadable ZIP, HTML, JavaScript, or repository files?
