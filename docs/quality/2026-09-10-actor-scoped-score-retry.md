# Actor-scoped score retry — 2026-09-10

## Finding

The online score-entry retry envelope was held in `sessionStorage` under a
game and card side, but not the signed-in actor. The score RPC would reject an
unauthorized replay, yet a shared device could render a previous player’s
unsent result before that rejection. This violates the authenticated-scope
boundary required for any pending operation.

## Repair

Migration `0103_assigned_game_context_actor_scoped_retry.sql` returns only the
current caller's profile UUID as `actorId` in the already assignment-scoped
game context. It does not return roster IDs or the opponent's profile ID.
Pending score submissions and confirmation operation keys now include that
actor ID. A stored envelope must also contain the same actor ID; a malformed
or mismatched envelope is removed rather than displayed or retried.

The server remains the final authority: this client isolation never grants a
role, changes a score, or makes offline state verified.

## Acceptance evidence

1. A pending envelope for actor A is readable only through actor A's key.
2. An actor-A envelope deliberately placed under actor B's key is removed and
   cannot be recovered by actor B.
3. The isolated synthetic database returned `actorId` equal to the simulated
   assigned player’s `auth.uid()` from `get_assigned_game_context`.
4. The RPC remains `SECURITY DEFINER`, has an empty search path, revokes
   public/anonymous execution, and grants only `authenticated` execute.

## Limits

This repairs the selected online retry surface. It is not the required
offline queue: no operation may be claimed as offline-safe or server-verified
until the authenticated queue, replay, conflict, reconnect, and session-switch
requirements in `R-OFFLINE-01` are implemented and tested.
