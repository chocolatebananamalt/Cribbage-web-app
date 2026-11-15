# Local score confirmation refresh repair

Status: locally verified, unpublished. No migration or hosted score mutation.

## Observed defect and acceptance

An accepted offline transport receipt can refresh the server route while React preserves client state. The old component reconciled only canConfirm and had no periodic refresh while waiting for the other player. This left either the accepted-entry banner or first-confirmer waiting banner stale. The local Next.js use-router documentation explicitly describes preservation of client state during router.refresh.

The fix projects the protected server state, own accepted submission and own confirmation into a stable state key. It reconciles only when no local operation, offline record or exact retry is pending. A visible, online waiting screen refreshes read-only server props every ten seconds and on focus, online, storage and visibility events. No polling submission, confirmation or queue deletion is added. Verification still requires the normal two independent account submissions and confirmations; transport acceptance never means verified.

## Executed verification

- pnpm verify: passed, including clean production dependency audit, lint (52 existing warnings, no errors), 1,160 app tests, provider checks, production build and eight workspace checks.
- pnpm verify:handoff: six passed.
- Focused state tests: eight passed.
- Actual component/IndexedDB/RSC regression: baseline reproduced at 390px; fixed 390px and 1440px passed. The actor explicitly confirms first; later server verification automatically appears while the tab remains focused, without manual reload or a second confirmation. Exactly one offline replay and one explicit confirmation POST. No horizontal overflow.
- Existing connectivity browser suite: PASS, eleven groups, including offline save/reload, rejected/inexact/expired responses, lost successful response, exact replay and no fabricated offline verification.
- Independent Sol review: no P1/P2 findings. Generated browser TSX fixture inclusion was noted; the final full production typecheck passed with those fixture files present. The baseline is now read reproducibly from pinned commit 2abf66823a6d135041edb5e093e05ca29d5e75df, rather than a loose generated TSX artifact accidentally included in root compilation.

Local logs: test-results/score-sync-final-verify.log, score-sync-final-handoff.log, score-sync-refresh-result.json and score-sync-connectivity-regression.log. These generated files are excluded from source publication and backup. Tests use local fictional transports; they are not physical offline or independent-human acceptance.

## Read-only hosted observations

Replacement fd0589d0-31e7-4921-b793-1beec2431337 remained on the published release. User personally completed game 1 (Director won by 20) and game 2 (B won by 15). Each persisted verified version 4, exactly two submissions and two confirmations. Each account has two score lines: Director 2 points / +5 spread, B 2 points / -5 spread. No agent entered or confirmed either score. Game 2 first-confirmer laptop stale waiting copy is consistent with the same absent remote refresh. User phone pixels were not inspected for that observation.

Both roster scorecard preferences were read back as digital. PaperDigitalGuide in score-entry.tsx unconditionally renders its generic Playing with one paper card and one digital card summary. This does not switch effective card mode, but is misleading. Record contextual help improvement after this run; no copy change bundled here.

## Scope and release gate

Implementation: score-entry.tsx and new src/lib/games/score-entry-server-state.ts. Tests: score-entry-confirm-state.test.mjs, new score-entry-server-state.test.mjs and score-entry-sync-refresh-browser.mjs. Documentation records this milestone and the explicitly deferred requests. No SQL, role, identity, fee, schedule or scoring-authority change. Branch publication requires separate approval. Existing user screens and hosted records were not changed during repair.

Deferred: current-player Won/Lost controls, direct return-to-play navigation, contextual paper/digital help and recovery of the MOST RECENT scorecard-only prototype/screenshots for owner comparison before significant changes. Do not start that recovery or redesign until after the functional run.
