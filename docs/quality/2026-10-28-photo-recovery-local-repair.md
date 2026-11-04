# Private photo recovery repair — local only

Date: 2026-10-28. Implements the specifically approved repair of the two defects reproduced in `2026-10-28-photo-offline-local-acceptance.md`. No push, deployment, hosted action, migration change, provider call, role/credential operation or prize-policy change occurred.

## Result and contract

Before any capture POST, the actual photo component retains a versioned exact request through the existing recovery coordinator. It retains actor/tournament/game/side/verification scope, operation ID and necessary original request metadata (filename, type, byte count and digest). **It does not retain image bytes, a data URL, upload token, credential or additional participant information.** The selected file/preview remains in memory only.

Reload never automatically sends work. The user reselects the original image; size, media type and SHA256 must match. A renamed identical image may be used, but the original request metadata/ID remain unchanged. A different image is refused without replacing the pending request. Immediate repeated clicks are single-flight. Network failure now explains the unconfirmed outcome and same-image retry/reselection steps.

The counted session-storage key is `paper-game-completion:photo:<actor>:<tournament>:<game>:<side>`. Older deployed cleanup counters already recognize its outer prefix, while ordinary game completion reconcilers do not mistake it for their actor-prefixed request. It uses the existing owner marker/document lease, no new coordinator protocol or auth policy. Missing, unreadable, corrupt or changed-scope retained work is not overwritten or silently discarded. Closing a tab/browser is not a supported durable photo-recovery guarantee; session storage provides reload continuity, not a new cross-device archive.

Confirmed storage completion clears only the matching retained request. Clearing the preview removes only the selected file/preview. Untyped failures, role loss, unavailable tournament, invalid request and idempotency conflict retain the work. Only known post-authorization receipted terminal capture rejections release it. A lost successful completion can cause upload authorization to refuse a new signed PUT; the client now still reaches the existing integrity-checked `/complete` route and reconciles that receipt instead of remaining blocked forever. No server guard changed.

A new pending-photo panel appears on paper and hybrid workspaces independently of current candidate/review rows, so a game completed elsewhere does not make its retained upload unreachable after reload. The recovery-only component cannot create a new operation once its key is resolved; clearing its preview does not re-enable fresh capture. No request is submitted from the panel without the user's file selection and retry click.

## Changed files

- `src/lib/paper-games/photo-retry-envelope.ts`: exact scoped envelope validation/storage, same-file check, terminal rejection classification and pending inventory.
- `src/components/private-paper-card-photo.tsx`: actor scope, coordinated persist-before-send, reload/reselection, single-flight and completion reconciliation, clear guidance.
- `src/components/pending-paper-card-photos.tsx`: reachable recovery-only panel without current game candidates.
- Paper and hybrid game clients: pass verified actor and mount the panel; hybrid shared claim fields forward actor scope.
- `tests/photo-retry-envelope.test.mjs`, updated `tests/photo-offline-acceptance-browser.mjs`, recovery-writer inventory and this status/evidence documentation.

## Evidence

Full `pnpm verify`: **948/948 application tests**, dependency audit clean, lint zero errors/two unchanged warnings, provider checks, production build/TypeScript and workspace seven pass/one unavailable private-handoff skip. Used installed Node 24.19.0 and available pnpm 11.25.0; repository package-manager declaration remains 11.19.0, with no dependency install/lockfile change. Log: `test-results/photo-recovery-full-verify.log`.

Focused envelope/writer/upload run: **14/14 pass**. It checks exact scope, no extra image field, matching/renamed versus different file, prefix/account-switch recognition, recovery inventory without a candidate, corrupt data preservation and terminal-versus-auth rejection classification. App-wide inventory verifies coordinator coverage of the new writer.

Final actual-component browser harness: **13 bounded groups pass** at 390/1440 and real local IndexedDB/worker contexts. Photo groups cover simulated server-success/lost-completion response, denied duplicate upload authorization with receipt reconciliation, reload into a page with no current candidate, same-file reselect, changed-file refusal, pending-work clear/switch blocking, resolved recovery panel refusing new uploads, interrupted capture, immediate double click, lost-role retention and known terminal rejection. Five retained offline groups still pass. Results: `test-results/photo-offline-acceptance-results.json`; server log and `photo-stored-390.png`/`photo-stored-1440.png`. Phone pixels inspected: image and recovery wording fit. Browser transport is synthetic and external origins are aborted.

Existing real rollback SQL photo-storage/independent-review and two-official fixtures passed in the preceding acceptance pass, after the same database migrations; their server functions are unchanged by this repair. This repair's browser tests model the relevant response contracts; it does not claim a new integrated hosted photo upload or OCR test. Earlier fictional auth/recovery browser run passed and its production auth/coordinator implementation is unchanged; pending photo keys additionally block the actual clear-and-switch UI in this pass. No sign-out was executed against a hosted session.

Independent plan/code/evidence review: main orphaned-row, lost-success and permission-rejection risks were found and fixed; final review found no remaining P1/P2 in the narrow implementation. React checklist applied: stable scope dependencies, cleanup for timers/object URLs, event-driven mutations, no render-time browser access or new public data endpoint. `git diff --check` passes; existing CRLF warnings only.

## Limits and next decision

The recovery panel intentionally holds the historical verification ID, not a fresh seating snapshot. A new capture must pass the existing server's current identity checks; an exact previously accepted capture uses its immutable prior receipt. The panel does not claim to independently validate a changed current seating assignment. Revoked authorization can keep recovery blocked until legitimate access/recovery is restored; no bypass or discard button was added.

Actual camera/handwriting, external OCR, physical two-device connectivity, full offline score controller→server confirmation and browser process-crash cases remain separate gates. No image-retention or new privacy/security decision was required for this metadata-only repair. A future decision to retain image bytes or activate external extraction requires a separately reviewed scope.

Local result is ready for a separately approved Preview rollout together with the reviewed Q Pool patch if desired. No new migration is needed for the photo repair. Q migration remains `0243_q_pool_membership_v1.sql`, **26,580 bytes**, SHA256 **50B9C35E38EF56BE0540896D3AC3BD621FAA9D4C72081AB0CDDD131035E003FF**. Existing finalized funded/negative fixtures, current director session and published head remain untouched. Preserve all pending recovery data during any future deployment/account switch.
