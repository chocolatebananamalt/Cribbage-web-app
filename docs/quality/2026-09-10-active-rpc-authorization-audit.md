# Active RPC authorization audit — 2026-09-10

## Purpose

Supabase's security advisor reports each authenticated `SECURITY DEFINER` RPC
as a warning because it can bypass private-table RLS. That is expected only
when the function itself establishes authentication, authorization, scope, and
safe search-path boundaries. This audit verifies that the remaining active
public RPC surface is intentional after the incomplete Rule 12 correction
surface was suspended.

## Acceptance criteria

1. No anonymous caller can execute an active application RPC.
2. Every active authenticated `SECURITY DEFINER` RPC has an empty
   `search_path` and an explicit signed-in actor check.
3. Director/workspace/money/roster/setup/seating operations independently
   check the caller's tournament role.
4. Player score readers and score mutations independently restrict access to
   the caller's own assigned participant/game context.
5. The suspended correction RPCs remain absent from the authenticated surface.

## Evidence

On 2026-09-10, a read-only PostgreSQL catalog inspection ran against the
separate synthetic validation project. It found 22 active authenticated public
`SECURITY DEFINER` functions and no anonymous execute grant. Each of the 22
has `SET search_path TO ''` and an `auth.uid()` check.

The functions separate into these authorization families:

| Family | Functions | Required server check |
| --- | --- | --- |
| Assigned-player score flow | `get_assigned_game_context`, `submit_game_score`, `confirm_game_score`, `get_player_scorecard` | Current authenticated player must be a checked-in participant in the scoped assigned game/event; score mutation also locks the game and uses an operation receipt. |
| Director/co-director operations | Registration review and roster promotion, roster check-in, event enrollment, initial seating publication, tournament setup, payment record/void, and their reconciliation/workspace readers | Current authenticated actor must hold `director` or `co_director` for the requested tournament. |
| Personal role lookup | `get_tournament_role` | Returns only the signed-in caller's own role for the requested tournament. |

The three player-scope readers were inspected directly. `get_assigned_game_context`
joins the caller's checked-in participant and linked roster entry before
returning either side's context; `get_player_scorecard` likewise joins the
caller as the event participant; `get_tournament_role` filters on
`profile_id = auth.uid()`. The score writers separately require the assigned
player/side (or own submitted score for confirmation) and use receipts/audit
events for accepted and rejected operations.

The catalog also confirmed that the five legacy correction functions revoked
by migrations `0096`–`0098` do not have authenticated execute access. The two
new independent-card correction tables are private, RLS-forced, immutable, and
have no reader or writer grant.

## Result and remaining work

**Pass for the present static/catalog boundary.** The advisor's active-RPC
warnings are an inventory to maintain, not an authorization failure by
themselves. No grant was widened and no shared-pilot project was changed.

This is not a replacement for the remaining release evidence: independent
real-user sessions, cross-tournament rejection exercises, and the full
Rule 12 replacement lifecycle still must pass before an official event can use
the relevant workflows.
