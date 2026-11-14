# Paper-game navigation — local candidate

2026-11-10. Fictional local rehearsal data only. No hosted operation, publication retry, access activation, photo transmission or real payment.

## Observable result

An event/Start-level page at `/tournament/[tournamentId]/rehearsal-paper/[eventId]/[startId]` groups eligible matchups into Games 1–12. It shows names, fixed Tournament IDs, current chairs and paper/digital mode, with links to the existing individual paper-game screen. No submitted scores, artifacts, answers, review decisions or completion status are listed. Empty results explicitly do not mean paper work is complete.

The Start panel offers the directory only behind its false feature gate, online, and with a currently verified saved Start. This is an eligibility directory, not a pending-work queue or assignment of responsibility. Completed games can remain listed. Both directory and existing game routes remain default off. Opening an individual game still calls its existing authenticated binding reader and provider; the directory grants no write/review authority.

## Implementation

- `database/proposals/native-mixed-paper-directory-v1.sql`: three new proposed functions, no tables, replacements or application grants. Dedicated false gate; public wrapper also requires the existing transport gate. Private reader validates current authenticated subject/session, official role and identity, current native Start/source, exactly 108 scheduled games, and each game's existing independent/nonself predicate. It projects matchup metadata in one query, without calling the full evidence reader repeatedly. All functions are revoked from public/anon/authenticated/service_role.
- `src/lib/seating/native-mixed-paper-directory-v1.ts`: exact DTO, own actor/session/event/Start scope, bounded rounds/games, unique game IDs and per-round player/chair checks. Additional fields (including answers/profile IDs) reject the whole DTO.
- `src/lib/seating/native-mixed-paper-directory-route-v1.ts`: false gate before cookie/client work, exact designated test project, ordinary authenticated user/claims and session/expiry checks before and after the RPC. No service client.
- `src/components/native-mixed-paper-directory-v1.tsx`, new server page and `native-mixed-start-panel-v1.tsx`: grouped accessible links, fixed-ID/current-chair explanation, explicit simulation and load-time freshness disclosures. Dynamic page, no ordinary offline cache marker or automatic link prefetch.

## Evidence

Successful DB run: `test-results/paper-directory-2026-11-10T09-14-33-259Z/` (`trace.json`, `directory.json`, `fixture-scope.json`, `cleanup.json`). Restored the hash-pinned completed fictional mixed checkpoint, SHA-256 `ed064b5d0c37389228a8a42d40ce33b896555173776b1eefe2af4bab7385813c`. All emails checked fictional. No hosted backup was used.

The actual authenticated SQL wrapper returned 99 eligible paper-containing games for both independent fictional officials, matching the canonical participant/mode/nonself set. Dedicated gate initially held; application execute privilege initially absent. Invalid session, foreign Start and transactional role removal held. Canonical games, game evidence and saved Starts remained byte-equivalent by ordered row-JSON hashes. Temporary permissions and gates existed only in the disposable container. Database and container removed, verified absent by ID/name, runner exit 0.

Earlier harness attempts stopped on PostgreSQL boolean JSON parsing, a missing existing latest-prize fixture gate, and a test DO-block delimiter. Each disposable resource was verified removed before the corrected run. No application guard was weakened to obtain a pass.

Offline actual-React browser evidence: `test-results/paper-directory-browser-20261110/`. Phone 390px and desktop 1440px, 16px and 32px root text; 12 groups, scoped links, empty/not-complete disclosure, invalid DTO redaction, disabled render, no horizontal overflow, zero network requests. Screenshots included. Fictional stress layout has 108 rows; it is not an authoritative schedule or sporting fixture.

Checks: five new directory tests plus existing paper-view/provider/Start-session tests (27 focused tests total); TypeScript `--noEmit`; targeted ESLint; four offline browser scenarios. Independent source review GO on the application/SQL candidate. Runtime/browser were subsequently completed by the lead.

## Limits and next gate

Not installed or publicly uploaded. Normal signed-in provider sessions, real-device navigation, live consent/role changes and actual Next routing acceptance remain unverified. Directory is deliberately restricted to the existing 18-player/12-game native rehearsal source; it is not a generic ordinary tournament or playoff-game directory. Actual game entry/review remains the authority for current roles, consent, source and nonself checks. No new scoring, qualification, payout or movement policy was introduced.

Full `pnpm verify`/handoff was not run: pnpm is unavailable in this shell, and the previously denied dependency audit/browser-origin access was not retried. No full build or provider acceptance is claimed. A future reviewed release must include this SQL and both directory/per-game route gates deliberately, with scoped access and the existing release/backup approvals. No new user policy decision is needed for this bounded feature.
