# Paper-card capture foundation evidence

Date: 2026-09-10
Commit inspected before the change: `98deb422feee601d65db4fafd96eb64dd3af3581`
Environment: Windows, Node `v24.19.0`, pnpm `11.19.0`, Next.js `16.3.4`

## Observable acceptance criteria

- A verified current cross-checker who is not assigned
  to either side of the target game can create one immutable capture record and
  one restricted provider-pending upload reference for card side A or B.
- The database derives and locks the exact tournament/game/event/round,
  participant/opponent, role, and permanent verification ID. The caller must
  supply the matching verification ID but cannot supply player or event IDs.
- The restricted record preserves the declared original filename, media type,
  byte size, SHA-256, camera/file source, and optional client capture timestamp.
- Exact accepted or rejected idempotent retry returns the original response
  without another capture, receipt, or audit event. A changed retry creates
  immutable conflict evidence without another receipt.
- The private response explicitly says that the provider is not configured,
  upload is not authorized, no image/public URL/OCR/transcription exists, the
  capture requires future human review, retention is restricted hold, and no
  score or game-verification state changed.
- The route remains hidden unless `ACC_PAPER_CARD_CAPTURE_ENABLED=enabled`,
  verifies same origin and a server-verified session, and calls only the
  service-role-only database function through the server secret boundary.

## Observable rejection criteria

- Reject malformed/extra fields, unsafe filename paths/control characters,
  invalid metadata/digests/timestamps, wrong tournament/game/side or permanent
  verification ID, unsupported event/lifecycle, a non-official role, or an
  actor assigned to either side of the target game.
- Cross-tournament targeting and self-game capture create no capture or upload
  intent. No rejection may expose a storage URL or mutate game/score/result
  data.

## Implemented files

- `database/migrations/0109_paper_card_capture_foundation.sql`
- `src/lib/api/paper-card-capture.ts`
- `src/app/api/v1/tournaments/[id]/paper-card-captures/route.ts`
- `tests/paper-card-capture.test.mjs`
- `tests/paper-card-capture.sql`
- `.env.example`, `package.json`, `PROJECT_STATUS.md`
- `docs/decisions/2026-09-10-paper-card-capture-foundation-boundary.md`

## Checks and results

| Check | Result | Evidence |
| --- | --- | --- |
| Focused lint and contracts | PASS | `pnpm exec eslint src/lib/api/paper-card-capture.ts 'src/app/api/v1/tournaments/[id]/paper-card-captures/route.ts' tests/paper-card-capture.test.mjs`; focused Node suite 6/6 passed. |
| Rollback-only database integration | PASS | The corrected 0109 function plus `tests/paper-card-capture.sql` executed inside one transaction on the isolated synthetic project. Independent cross-checker creation and exact accepted/rejected replay passed; director, co-director, changed retry, self-game, verification mismatch, cross-tournament, and viewer paths rejected. Exactly one capture, upload intent, accepted receipt, and linked audit event existed inside the transaction with the cross-checker role snapshot and exact original metadata. Forbidden update/delete probes proved all three evidence tables immutable. The game remained `pending` with zero submissions, confirmations, or scorelines, and grants were service-only. |
| Rollback cleanup | PASS | Transaction rollback left zero retained fixture user IDs or tournament/card records; the foundation schema remains on the isolated synthetic database for ordered integration testing. |
| Database advisors | PASS | An independent post-apply advisor run exposed two composite foreign-key index-order gaps. Matching canonical-capture and upload-intent capture indexes were added; the rerun reports no unindexed paper-card foreign keys. Newly created indexes correctly appear as unused on the empty synthetic database. |
| Metadata-regex database probe | PASS | PostgreSQL rejected slash and backslash filename-path forms and accepted the syntactic `image/jpeg` media declaration. This is syntax validation only, not provider format approval. |
| Full repository verification | PASS | `pnpm verify`: production audit reported no known vulnerabilities; lint passed; 214/214 application tests passed; production build passed and listed `/api/v1/tournaments/[id]/paper-card-captures`; workspace checks passed. |
| Private handoff verification | PASS | `pnpm verify:handoff`; 6/6 passed. |
| Patch whitespace check | PASS | `git diff --check`; no errors (Git emitted only line-ending notices for existing tracked files). |

## Data and release impact

- Migration 0109 is present on the shared pilot, but no deployment, storage
  bucket/object, user-visible route, or feature-switch change was made.
- Its fixture data was fully rolled back in the isolated synthetic project and
  used only invented `@test.invalid` accounts and synthetic identifiers.
- No private handoff image, real player/card data, OCR service, or external
  storage service was used.

## Remaining work and owners

- **Camera UI:** build the dedicated capture screen, request camera permission
  only while that route is open, add upload fallback, accessibility/phone and
  desktop checks, and verify shared-device cleanup. No UI was added here.
- **Storage provider:** approve the provider and restricted bucket design,
  supported media types and byte limit; implement short-lived upload/download
  authorization, actual-byte digest/type verification, malware handling,
  explicit view/download audit, backup/restore, and prove no public access.
- **OCR and human review:** select and approve a local/provider OCR boundary,
  supported card layouts and false-read fixtures; add versioned editable OCR
  drafts, explicit human approval/correction, comparison, sampling, and the
  exception queue. OCR must remain non-authoritative.
- **Retention:** ACC/owner must approve a duration and designated data-steward
  workflow. Until then the only state is restricted hold with no automatic
  purge; audited deletion/legal-hold/restore behavior is not implemented.
- **Real-paper validation:** test varied real cards, handwriting, lighting,
  camera/file flows, two independent sessions, self/cross-tournament denial,
  upload interruption/replay, and retained audit evidence on the intended test
  backend before enabling the switch.
