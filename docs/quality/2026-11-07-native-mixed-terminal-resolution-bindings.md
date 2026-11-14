# Private mixed terminal resolution and own-player integration

## Implemented and reviewed

Explicit resolution uses the SAME actor/operation and event/game advisory locks as the scoring writer. A generic immutable operation receipt (native_mixed_game_closed_v1) and audit consume the exact original nonce/request hash. Existing accepted evidence always recovers instead of closing. Delayed exact writes and owned recovery return the closure; changed requests fail. No evidence removed. Helper independently rechecks exact request/hash/response/audit and absence of own evidence. Historical receipt proves nonce fencing/no original write, but does not retain an independent terminal-condition witness. Reason was computed at insertion under source locks.

History closure recomputes bound immutable journal. Null source alone never permits closure: currently supported source case is own Digital latest revoked consent, exact participant/profile in the Start's attendance seal scope, operation-bound, with no superseding version and prerequisite gates on. Start must contain the published game. Generic unavailable/disabled sources and unproven Paper/other source failures stay blocked. These limitations are intentional; do not claim all source failures can be closed.

Authenticated transport checks identity/project/session before and after resolve/recovery. Pending CAS archives only an exact server closure, never null/unknown/foreign data or newer pending. Accepted receipts still require fresh state. Both screens use neutral Resolve Saved Entry and explanatory text. No automatic new operation or rebase.

Own-player SQL reader calls own-subject/current-Start checks, requires one Digital linked roster identity and returns only own12 published game metadata: names, fixed initial Tournament IDs, current snapshot seats/modes. No Director-wide sources/evidence, contacts, ACC numbers or money. Strict decoder validates actor/session/event/Start and unique12 games/rounds/opponents. Entry/card loaders now use authenticated metadata then own states. Default-off/unmounted wrapper suppresses stale account/session/page/target/runtime/enabled epochs. Stable opponent profile UUID is returned for actor matching: privacy decision/minimization remains before enablement. Twelve reads are not atomic.

All SQL wrappers remain revoked from public/anon/authenticated/service_role and feature gates default off. Test grants existed only inside removed disposable fixtures. No app route or live access enabled.

## Actual local SQL acceptance and cleanup

Resolution fixture CID9bb55217c6dd18628ac1c0b0fea46558f7707460fffe3a263fefea88e7c16046: current113-file install, random18/108, private Start, history closure/delayed writer fence/owned recovery/changed payload rejection/no original evidence. Unchanged source did not close; racing accepted writer won and recovered; disabled prerequisite did not close; latest bound own revocation closed. Removed and absence verified.

Bindings fixture CIDdc379050f2ad09b02f1cd35736e4f9656c36358f793b75bdf41bc5cc9466cad7: same113 plus new own-reader executed bytes captured in own-bindings-installed.sql. Own12 metadata passed; nonparticipant checker received null. Actual TypeScript transport and card loader over local SQL adapter showed0complete, then an actual private DD game with2submits+2confirmations yielded1complete/2GP/+1spread, no official authority. Repeated closure cases passed. All gates restored; removed and absence verified. Independent reviewer verified manifests/installed reader bytes,12 distinct game/round/opponent IDs, card totals, resolution summaries and cleanup state/logs.

Evidence: test-results/native-mixed-resolution-20261107 and test-results/native-mixed-bindings-20261107. Both state.json show cleaned/cleanupVerified. First resolution runner loaded its script before later own-reader additions; own-reader proof is exclusively the second fixture. Tests use fictional auth/session rows and SQL roles, not provider-signed JWT/browser proof. No hosted reads/writes, app deployment, credentials, invitations, real payments or user-draft changes.

## Checks

48 focused and2,270 complete application tests pass. TypeScript noEmit, production Next build, provider readiness and14 workspace/handoff pass. Lint0 errors137 pre-existing warnings. One initial broad regex incorrectly forbade the valid audit_events.action column; scoped it to the intended game-state getter regression, then full suite passed. Independent source review fixed old-consent, published-game and misleading wording issues before SQL execution; final source GO and independent evidence consistency PASS. Previously denied browser access and audit were not retried.

## Remaining gates

Human18-person rehearsal NO-GO: actual provider/JWT sessions, supported phone/desktop/200% signed-in browser and IndexedDB recovery/role separation, route/navigation integration and reviewed grant/release scope, privacy decision for opponent profile UUID, other safely proven source-resolution cases, authoritative private qualification/Finance closure and physical movement/anchor validation. Current local proof is not a playable hosted release or official result. Preserve no-refund, consent, nonself independent review and normal scoring safeguards.
