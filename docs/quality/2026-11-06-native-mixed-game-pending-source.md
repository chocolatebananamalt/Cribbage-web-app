# Native mixed Digital pending recovery, 2026-11-06

## Verified source outcome
Added a private/default-off Digital pending controller over the existing transactional retained-storage port. No UI, route, backend, SQL, database fixture, browser navigation, hosted data, credentials, grants, deployment or money action was performed. Ordinary scoring remains unchanged.

Acceptance criteria: exact request is durable before any send; only a transactional CAS winner can dispatch; uncertain attempts never resend after reload; account/session/game changes cannot overwrite or hide prior pending work; unknown/corrupt storage blocks new work; receipt alone cannot clear work; fresh exact state proof precedes atomic archive-and-clear.

The controller saves a strict Digital-only payload with project/actor/event/Start/game/source bindings. Storage key deliberately excludes current game/Start/session so later navigation discovers older work. A new login for the same actor can recover the original target/request with its new session. Other accounts and origins cannot adopt it. The host must dispose on account change: disposal aborts local continuations and redacts pending/receipt/raw/message in memory, preserving retained data.

Every explicit send CAS-transitions staged to attempted before network dispatch and verifies readback. Only the winner dispatches. Attempted entries allow read-only outcome checks, not resubmission. Null/failed lookup is not proof of no write. Crash between attempted marker and HTTP dispatch conservatively requires a future reviewed no-write/cancellation protocol; there is no discard or rebase control.

Accepted receipt is validated against original exact bytes, then a separate authenticated current-state read must contain the exact entry. Transactional archive uses expected raw bytes, preserving newer cross-tab work. Changed or revoked source and unavailable state retain pending data. Stored state/receipt never authorizes ordinary verified scoring.

## Tests and review
11 new controller tests plus 8 adjacent transport tests pass (19 focused). Full suite2241/2241, production build, provider readiness and14 workspace/handoff pass. Lint0errors137 existing warnings. First workspace check ran concurrently with build and failed because build artifact was not present; rerun after completed build passed14/14. Initial strip-only TS parameter-property failure was corrected to a normal field. Test fixture transport override was corrected so partial mocks no longer omitted write/state methods. These failures are retained in work history; final logs accompany checkpoint.

Independent reviewer found and closed unknown-send/CAS and in-memory disposal issues; final source GO with no remaining P1/P2. Reviewed logic SHA a8be7c43e9ba4ba2d01d578d9cae7ab319aa16004e7e3fa7aaba10140ab661a5; final source7333d12726601553379107ed463d5b86036cc2f831ed4a5d4c3fe9b4552f32f7 differs only by clarifying that initialization reads injected storage and host must dispose on account change.

## Exact limits and next step
Tests use an injected in-memory transactional port and injected transport. Controller recreation models full reload, not an actual browser reload. Existing IndexedDB adapter is reused by contract but this controller has no browser/IndexedDB/provider runtime acceptance. No denied browser/audit access was retried. Aggregate verify was not run because its audit stage was previously denied; safe components ran separately.

Pending external approval: fresh disposable local mixed rehearsal database for private Start/evidence SQL, real session/role checks, concurrency/replay and108-game proof. Implementation/verification afterward: actual player/official screen and offline page cache/ownership integration, storage quota/abort/browser cross-tab tests, no-write resolution for never-committed attempted records, and consumption by standings/playoffs/simulated Finance. Full18-player trial remains NO-GO; source checkpoint is useful but not an app feature ready for Daron to click.
