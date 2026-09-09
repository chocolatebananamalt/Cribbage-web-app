# Live score-entry pilot — 2026-09-08

## Scope and acceptance criteria

This bounded pilot connects the signed-in, assigned player's Standard Singles score-entry route to the existing authoritative game RPCs. It must:

1. reveal only the caller's assigned, checked-in, digitally scored, approved Standard Singles game context;
2. preserve a caller's saved submission and whether that caller may confirm after refresh;
3. submit and confirm only through the server-authoritative API routes, with safe idempotent retry after a network failure;
4. refuse unassigned callers and exclude already verified games from the active entry route; and
5. provide concise in-app guidance for the paper/digital path without implying that a paper card or one person's entry can verify a game.

The scope does not certify the full tournament suite, offline queue, director guide, standings, finance, results, or release readiness. The bounded correction foundation below is a server-side pilot capability only; it has no director/cross-checker user interface yet.

## Changes and review

- Added the protected dynamic route `/tournament/[tournamentId]/game/[gameId]`, assignment-scoped DAL, and live player score-entry client.
- Applied the initial pilot context migration, then immediately applied `assigned_game_context_hardening` and `assigned_game_context_confirmation_recovery` after focused review found an initial-state mismatch and refresh-state gap. The hardened function accepts canonical `pending`, `submitted`, `confirmation_pending`, `mismatch`, and `verified` states; exposes no profile or participant identifiers; exposes only the caller's own saved score, confirmation state, and a server-derived `canConfirm` flag.
- The client persists a UUID for both submission ID and idempotency key in session storage for an ambiguous retry. It removes them only after a recognized accepted response or a definitive client rejection, and retains them for network, 5xx, or malformed-success responses.
- A confirmation eligibility guard rechecks open tournament, digital Standard Singles event, and approved matching ruleset at the database boundary, so a stale direct confirmation cannot finalize after event eligibility changes.
- Added the `R-GUIDE-01` requirement and the visible score-entry “Playing with one paper card and one digital card” guidance.
- Added a protected tournament-scoped `Start Here / How To` page for players and directors. It covers hybrid paper/digital entry, check-in, seating and permanent verification-ID publication, and the instruction to leave exceptions pending for authorized review.
- Corrected the deferred game-state invariant so exactly one accepted submission is valid while a game is `submitted`; two submissions remain mandatory for mismatch, confirmation-pending, verified, and corrected states.
- Added a server-authoritative correction foundation for verified Standard Singles games. It preserves an immutable correction and state-event history, prohibits a cross-checker from correcting their own game, applies the default immediate-authority/optional-reason policy atomically to both card scorelines and canonical result, and retains a separate immutable record if an idempotency key is reused with different content.

## Executed evidence

| Check | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm test` | Pass — 26 tests, including the live-context/static security contract |
| `pnpm build` | Pass — dynamic game route and both game API routes compiled |
| `pnpm verify` | Pass — 6 workspace integrity checks |
| `pnpm verify:handoff` | Pass — 6 private-handoff checks |
| `git diff --check` | Pass |
| Pilot migration | Pass — `20260908094323 assigned_game_context_hardening` applied to isolated synthetic-data pilot `fnjkwymxpnsqvxtpronk` |
| Pilot RPC positive read | Pass — a synthetic checked-in assigned actor received only its mismatch-game context, including own submission ID and `canConfirm: false` |
| Pilot RPC rejection read | Pass — an unassigned synthetic actor received `null` |
| Pilot function configuration | Pass — SECURITY DEFINER, empty search path, authenticated execute only; no profile/participant identifiers in function source |
| Pilot forced-deferred first submission | Pass — an authenticated assigned player’s first accepted submission ended as `submitted`, version 2, with exactly one submission after deferred integrity checks were forced; transaction rolled back |
| Pilot forced-deferred two-player happy path | Pass — two independently submitted matching 31-point results and two own-entry confirmations ended as `verified`, with two scorelines, 3 total game points, +31 and −31; transaction rolled back |
| Pilot correction positive path | Pass — an authorized non-player cross-checker changed a verified synthetic game from A/+31 to B/+30; forced deferred checks accepted state `corrected`, version 2, two reciprocal scorelines, 2 total game points, +30 and −30; transaction rolled back |
| Pilot correction self-check rejection | Pass — a participant granted the cross-checker role received `rejected:self_correction_denied`; the game remained `verified`, A/+31, version 1; transaction rolled back |
| Pilot correction idempotency conflict | Pass — an accepted correction followed by a different request using its operation key returned `rejected:idempotency_conflict`; exactly one correction and one immutable conflict record existed before rollback |
| Correction fingerprint compatibility repair | Pass — pilot migration `correction_legacy_replay_compatibility` replaced delimiter-based correction fingerprints with canonical JSON while accepting an exact legacy receipt only for replay compatibility. A synthetic old-format receipt returned its saved response on an exact retry; a changed reason containing `|` returned `rejected:idempotency_conflict`. Both transactions rolled back. |
| Pilot correction-history indexes | Pass — `correction_history_indexes` applied; the database advisor no longer reports unindexed foreign keys for correction history. Remaining unused-index notices are expected on the fresh, synthetic pilot and must be revisited after representative workload testing. |
| Correction-policy configuration lifecycle | Pass — a synthetic director configured version 1 (reason required/one approval), then received the identical stored response after the tournament was finalized. A new configuration attempt after finalization returned `tournament_not_configurable` and left one rejected immutable receipt; the entire transaction rolled back. |
| Correction-policy lock repair | Pass — migrations `0026_correction_policy_tournament_lock_repair` and `0027_correction_policy_history_indexes` applied to pilot `fnjkwymxpnsqvxtpronk`. The installed proposal function was queried to confirm that it locks and reads tournament status with `FOR UPDATE` before the policy/mutation path. The database performance advisor then returned no unindexed-foreign-key finding. |
| Correction-policy focused Sol review | Pass — after remediation, the reviewer found no P0/P1 issue in policy configuration/proposal replay order, clean-chain repair guards, RLS/grants, immutable audit/conflict records, or pending-no-projection behavior. |
| Approval-required correction review | Pass — a rolled-back synthetic four-actor test configured a one-approval policy, proposed a pending correction, confirmed both original +31 scorelines were unchanged, rejected a null review decision with no new state event or review receipt, and then let a distinct cross checker approve it. Approval produced the sequenced `pending → approved → applied` history, updated the canonical game from A/+31 to B/+30 at version 2, and updated both reciprocal scorelines. |
| Publication guard | Pass/limited — migration `correction_review_lifecycle` created a private immutable Draft publication guard for existing and future events; both proposal and review functions lock and require it before a non-replay mutation. The pilot connection was denied permission to disable the immutable trigger while attempting to synthesize a Published state, so published/superseded behavior and a two-session publish-versus-correction race remain unverified until authorized result-versioning exists. |
| Correction-review index scan | Pass — migration `event_publication_state_indexes` applied and the performance advisor returned no unindexed-foreign-key finding. |
| Higher-risk Sol review | Pass after remediation — four findings on stale confirmation, refresh-time confirmation context, malformed 2xx retry, and verified recovery were fixed; follow-up found and corrected one fresh-schema confirmation eligibility placement issue. Final focused review of the one-submission `submitted` state and deferred invariant found no P0/P1 issue. |
| Higher-risk Sol correction review | Pass after remediation — focused review found and then verified fixes for original-submission preservation, confirmation safeguards, conflict retention, replay order, self-correction denial, and Standard Singles authorization. Final review reported no P0/P1 findings for controlled pilot application. |
| Higher-risk Sol correction fingerprint review | Pass after remediation — initial review caught legacy immutable-receipt replay incompatibility. Follow-up verified canonical new receipts, exact legacy-receipt compatibility, changed-reason conflict behavior, unchanged authorization/mutation gates, and no P0/P1 findings. |
| Hosted Preview | Pass — deployment `dpl_DVrpjbWYsXYHuwNk1Uokdq3EpUi3` is Ready for commit `414ccd5`; its root prototype renders without a runtime error and Vercel reports no runtime error clusters in the one-hour scan |

## Security/advisor interpretation

The pilot still reports private `app` tables with RLS enabled and no policies. This is intentional: direct client table access is revoked and the narrowly granted authenticated SECURITY DEFINER RPCs are the only public boundary. Supabase also warns that those authenticated RPCs are SECURITY DEFINER; this is expected for this authorization design and is covered by the source and actor-scoping checks above.

The pre-existing leaked-password advisory remains unresolved because the user declined a paid Supabase upgrade. The app's supported sign-in flow is passwordless magic link; password login must remain disabled/unsupported before a release can be considered.

## Correction workspace and HTTP-boundary evidence — 2026-09-09

The isolated pilot received migrations `0031_correction_workspace_read_model` and `0032_correction_reason_limit`. The workspace read RPC returns only actionable, Draft-publication Standard Singles records: proposal candidates require a tournament-scoped cross-checker role and exclude the caller's own games; pending reviews require an independent eligible cross checker/director/co-director and exclude both players and the original editor. It returns correction reasons only in the eligible-reviewer collection. Direct authenticated table reads remain denied.

The new proposal/review HTTP handlers validate UUIDs, margin/version/decision inputs, authenticate with verified claims, call only their respective RPC, and treat an accepted `reject` review decision as success rather than an operation failure. Their response contracts bind returned IDs, game ID, expected version, and requested review decision to the submitted request; malformed or mismatched 2xx responses are converted to retryable 503 responses. They do not retire an idempotency key client-side; the future protected client must retain it through network, 5xx, and malformed-response failures.

| Pilot check | Result |
| --- | --- |
| Workspace unauthenticated/no-scope call | Pass — returns `{ proposalCandidates: [], pendingReviews: [] }` |
| Workspace execute/table privilege check | Pass — `anon` cannot execute; `authenticated` can execute; authenticated has no `SELECT` on `game_corrections`, `correction_state_events`, or `event_publication_states` |
| Reason-limit trigger harness | Pass — 501-character input raised `correction reason too long`; 500-character input inserted; temporary transaction rolled back |
| Repository checks after API contract repair | Pass — `pnpm test` (35), `pnpm lint`, `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` |
| Focused Sol review | Pass after three P1 repairs — scoped correction read model, authoritative reason limit, and exact accepted-response/request binding were reviewed with no remaining P0/P1 finding |

This remains a backend/API foundation, not a completed correction workspace. It still needs a protected browser screen using the read model, real independently authenticated role sessions, direct-RPC role-visibility tests, concurrent terminal-review tests, and result-version/supersession implementation before release.

## Remaining limitations

- No real authenticated browser role is seeded in the pilot, so independent two-session submit/confirm and browser phone/desktop checks of the live score route are not yet evidence.
- This is not a production deployment. The Preview is current, but independent live-route browser sessions are required before any promotion.
- The brief player hybrid instruction is implemented; the fuller director Start Here guide is specified but not yet implemented.
- Correction authority exists at the database boundary only. A protected correction workflow, role-management UI, correction list/history UI, and real independent-session correction test remain required.
- `R-CORR-01` now has an independent database approval/rejection RPC and private deferred lifecycle invariant. It still needs protected UI, independent browser sessions, two-connection proposal/review and publish/review race tests, an authorized result-versioning transition (rather than the current Draft-only guard), and a clean disposable migration-chain test before release.
- No claim is made that the broader production release is ready.
