# Deferred scoring-control readability change

Owner requested current-player Won/Lost controls on each device, with the player's own name, green Won and red Lost styling, and text labels that do not rely on color. Correctly map the local win/loss to canonical side A/B and retain a positive spread. Source: Sentinel_051eb600ace48191a37e8375f88e0daf, 2026-11-02 05:07:49 UTC.

Explicit timing: after this rehearsal tournament, not now. Preserve the current winner-selector UI during the rehearsal. This is separate from the local sync/confirmation refresh fix; no implementation is authorized for immediate rollout.

## Deferred return-to-play navigation

Owner message Sentinel_ca82bd1622a481919c8667625eaf0e69, 2026-11-02 05:10:12 UTC, identifies an overly indirect return-to-play flow. Current scorecard offers Back to tournament, whose Start here section has My Games; Game Complete offers only View Scorecard. The normal fallback is Scorecard -> Back to tournament -> My Games -> Open Game. A direct Back to My Games action on scorecard/completed-game screens, and Open Next Game when supported/current, is deferred until after the run. Do not bundle navigation changes into the sync repair or change live controls during this rehearsal. This is a normal product navigation issue, not trial-only behavior.

## Deferred recovery of the original scorecard flow

Daron says the original scorecard flow worked ideally before later integration and requests that we recover and inspect that saved implementation. Source: Sentinel_c69014e118748191be85990a278c296c, 2026-11-02 05:11:39 UTC. After the current functional tournament, locate saved prototypes/specifications/history, compare actual original navigation with the current app, and present concrete differences plus a restoration plan preserving integrated scoring, authorization, audit and recovery rules. Do not make him reconstruct the old design from memory. Explicitly not an immediate redesign, publication or broad history-recovery task; finish this functional run first. The local stuck-confirmation defect is separate.

### Owner refinement: latest scorecard-only prototype and screenshots

Source Sentinel_04599ed6953c81919f9854ea1bedb939, 2026-11-02 05:13:21 UTC. Locate the MOST RECENT functional scorecard-only prototype and screenshot versions, not automatically the earliest prototype or the current app. It may not have been a complete running application. Show that prototype and the current version side by side for Daron to verify and choose before significant changes. No final version has been selected. Keep this deferred until after the current functional run; no broad recovery research or redesign now.

## Additional owner walkthrough requirements, deferred

Parent-forwarded 2026-11-02 requirements: personally walk the whole app on laptop and phone; player-first role-aware Home/Player and assigned Director/Co-director/Cross-checker/Judge navigation with fast return to play; compare the latest Director prototype/screenshots as well as latest scorecard-only prototype before major navigation changes. Walk player registration/dues/verification/check-in/first-game and director signup/setup/role assignment, personal recipient acceptance and each role's functions. Explain terms plainly and label game points versus spread points. Goal is a short informal four-human mock, perhaps six/eight only if supported qualification/pool needs require it. No current redesign, new human fixture, accounts, role grant or payment is authorized. Complete or explicitly unblock current simulation first.

## Selection update — November 2, 2026

Daron has now confirmed the September dashboard at https://cribbage-web-app.vercel.app/demo: “This is it” (Sentinel_dff44d53fddc81918752560105d14615). Earlier pending-selection wording above is historical. The on-screen numeric keypad is the chosen baseline; a physical-keyboard-editable input is not an additional requirement. Focused comparison and proposed restoration scope: docs/product/2026-11-02-selected-scorecard-restoration-plan.md. Planning only; no implementation or deployment authorized by this selection.
