# Ordinary Manual Playoff UI and Results — 2026-11-12

## Connected local slice

The actual own-player/independent-official directory and selected-game page now use normal cookie-authenticated RPC routes against the new ordinary `modern_manual_playoff_*` journals. The existing My Games page has a gated entry link. The directory only lists currently admitted own digital games or physically independent paper-official games; each selected game rechecks current source/mode/role/session and actual generation/game/version. All new gates are false and SQL EXECUTE remains revoked.

Player flow: select winner -> retain original submission -> explicitly send/check -> archive outcome -> refresh current game -> separately retain/record own confirmation -> hand the device to the paper opponent for Yes/No. Yes remains Awaiting Paper Review and permits tentative later games under the real server progression checks; No is an unresolved disagreement. Neither response authenticates a paper player or verifies their scorecard.

Official flow: Cross-checker manually enters original paper winner/reference for every paper participant, including paper/paper. Another independent admitted official sees blank re-entry fields and no first-reading values. They manually re-enter original card(s). Conflicting originals can be retained independently rather than forced to agree; null common winner is an explicit disagreement. The separately admitted independent adjudication view shows preserved conflicting evidence only after an actual dispute, retains resolution with reason/reference, and still requires fresh capture plus distinct review. The underlying per-game journal retains original entries/responses and downstream-change holds. No photos/OCR involved.

Append-only digital-amend now supports an own unconfirmed entry before handoff/paper evidence or later play; own confirmation and handoff must target the actual latest own submit/amend. Original entries remain stored. After confirmed/dependent disagreement, the new branch still holds for a separate correction protocol; no late cascade policy was invented.

Both workflows use coordinated account/event/generation/game/purpose-owned IndexedDB retention, explicit send/check/exact retry, immutable outcome archive before pending removal and live identity concealment. Unknown bytes/uncertain outcomes remain retained. Authoring readings/checkbox/winner/reason/reference clear on identity or source/version/target change. An unsent conflicting winner cannot confirm or hand off the old saved entry; amendment or explicit clear is required. Retained exact retry is separate from fresh intent.

## Results integration

`modern-manual-playoff-results-v1.sql` revalidates the latest actual qualification and each new journal's actual current verified series proof. Missing/incomplete games remain pending without tentative answers. Only verified series winner/loser display names and fixed Tournament IDs reach the Director/Co-director summary. The ordinary Results page mounts this distinct summary under its own default-off flag and exact finalized qualification ID. It carries `financeAuthorized:false` and `moneyMoved:false`; it is not passed off as native digital confirmation proof.

## Evidence

- Twelve focused checks passed: six contract/controller/route/Results tests and six SQL source-anchor/guard/quote checks. The SQL checks are structural, not a PostgreSQL parse or transaction proof.
- Offline actual-component Chrome checks at 390/1440 passed: retain-before-send, no auto-send, lost reply recovery, independent own confirmation, tentative handoff, distinct blank paper review, changed-choice confirmation hold, identity concealment and enlarged-text no-overflow. Zero network requests, synthetic injected ports/identities. `test-results/modern-manual-playoff-browser-v1/result.json` and screenshots. Not independent human/provider acceptance.
- TypeScript no-emit and changed-path ESLint passed. Independent source re-review GO after fixes to amended handoff targeting, fresh authoring consent and unsent-choice confirmation. No SQL execution.
- An initial browser assertion used a hyphen where the actual label has an em dash; inspected actual UI text and corrected the harness selector. App behavior did not fail at that step.

## Specific remaining gaps

1. Director authoring UI/normal-to-service transport for these new generations is not built. The genuine private generation constructor exists, but the new directory currently starts from already-authored generations. This is a source implementation gap, not a request for actual participant information.
2. V3 Finance still requires the detailed original sporting frame/recipient proof adapter for this new journal domain. A redacted Results summary cannot satisfy that contract; the existing native parser deliberately requires two real digital confirmations and must not be fed fabricated paper confirmations. The prior reciprocal finalization guards remain. No manual-series unpaid award has been enabled or claimed operational.
3. Post-confirmation digital disagreement/late dependent correction in the new protocol remains held. Pre-confirmation amendment is implemented; old digital behavior is unchanged.
4. SQL install/parse, actual role/privacy/transaction/retry/rollback/concurrency and signed-in provider/device/IndexedDB full-reload acceptance remain unverified. Scope is four/five qualifiers; no new seed-placement or movement rules.

No hosted actions, database/container/resources, real participants/awards/payments/submissions, denied retries, photo transmission or frozen216 release changes.
