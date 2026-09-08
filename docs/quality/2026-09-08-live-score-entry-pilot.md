# Live score-entry pilot — 2026-09-08

## Scope and acceptance criteria

This bounded pilot connects the signed-in, assigned player's Standard Singles score-entry route to the existing authoritative game RPCs. It must:

1. reveal only the caller's assigned, checked-in, digitally scored, approved Standard Singles game context;
2. preserve a caller's saved submission and whether that caller may confirm after refresh;
3. submit and confirm only through the server-authoritative API routes, with safe idempotent retry after a network failure;
4. refuse unassigned callers and exclude already verified games from the active entry route; and
5. provide concise in-app guidance for the paper/digital path without implying that a paper card or one person's entry can verify a game.

The scope does not certify the full tournament suite, offline queue, director guide, corrections, standings, finance, results, or release readiness.

## Changes and review

- Added the protected dynamic route `/tournament/[tournamentId]/game/[gameId]`, assignment-scoped DAL, and live player score-entry client.
- Applied the initial pilot context migration, then immediately applied `assigned_game_context_hardening` and `assigned_game_context_confirmation_recovery` after focused review found an initial-state mismatch and refresh-state gap. The hardened function accepts canonical `pending`, `submitted`, `confirmation_pending`, `mismatch`, and `verified` states; exposes no profile or participant identifiers; exposes only the caller's own saved score, confirmation state, and a server-derived `canConfirm` flag.
- The client persists a UUID for both submission ID and idempotency key in session storage for an ambiguous retry. It removes them only after a recognized accepted response or a definitive client rejection, and retains them for network, 5xx, or malformed-success responses.
- A confirmation eligibility guard rechecks open tournament, digital Standard Singles event, and approved matching ruleset at the database boundary, so a stale direct confirmation cannot finalize after event eligibility changes.
- Added the `R-GUIDE-01` requirement and the visible score-entry “Playing with one paper card and one digital card” guidance.

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
| Higher-risk Sol review | Pass after remediation — four findings on stale confirmation, refresh-time confirmation context, malformed 2xx retry, and verified recovery were fixed; follow-up found and corrected one fresh-schema confirmation eligibility placement issue |
| Hosted Preview | Pass — deployment `dpl_DVrpjbWYsXYHuwNk1Uokdq3EpUi3` is Ready for commit `414ccd5`; its root prototype renders without a runtime error and Vercel reports no runtime error clusters in the one-hour scan |

## Security/advisor interpretation

The pilot still reports private `app` tables with RLS enabled and no policies. This is intentional: direct client table access is revoked and the narrowly granted authenticated SECURITY DEFINER RPCs are the only public boundary. Supabase also warns that those authenticated RPCs are SECURITY DEFINER; this is expected for this authorization design and is covered by the source and actor-scoping checks above.

The pre-existing leaked-password advisory remains unresolved because the user declined a paid Supabase upgrade. The app's supported sign-in flow is passwordless magic link; password login must remain disabled/unsupported before a release can be considered.

## Remaining limitations

- No real authenticated browser role is seeded in the pilot, so independent two-session submit/confirm and browser phone/desktop checks of the live score route are not yet evidence.
- This is not a production deployment. The Preview is current, but independent live-route browser sessions are required before any promotion.
- The brief player hybrid instruction is implemented; the fuller director Start Here guide is specified but not yet implemented.
- No claim is made that the broader production release is ready.
