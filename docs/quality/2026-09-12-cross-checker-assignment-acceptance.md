# Cross-checker assignment acceptance criteria

Scope: close the October pilot gap between witnessed player-account activation
and the existing cross-check workflows. This release assigns an already-linked
tournament account as a cross-checker. Revocation and general-purpose role
administration are intentionally outside this pilot slice.

The change is accepted only when all of the following are observable:

- A current director or co-director can open a private assignment workspace for
  one draft/open tournament.
- The workspace exposes only display labels and IDs needed for assignment; it
  does not expose email, phone, activation credentials, or ACC contact data.
- Only accounts already linked to a roster entry in that same tournament are
  candidates.
- The actor cannot assign themself, a director/co-director/judge, an unlinked account,
  an account from another tournament, or an already-assigned account.
- Assignment is enforced atomically by a server-only database function and
  writes an operation receipt, immutable assignment event, and audit event.
- Exact retries return the original receipt; reuse of an operation ID for a
  different target is preserved as an immutable conflict and rejected without
  changing roles. Current-authority, in-scope business rejections are also
  receipt-bound so later state changes cannot rewrite the same retry's outcome.
- Browser mutation requires same-origin, bounded exact JSON, a verified session,
  and an exact validated database response.
- The new screen is discoverable only to directors/co-directors and clearly says
  that pilot assignments are additive and cannot be removed from the screen.
- Duplicate display names remain distinguishable through a masked/ACC roster
  identity hint plus a unique non-secret roster reference.
- SQL rollback tests cover authorization, tournament isolation, self/official
  rejection, exact replay, conflicting replay, durable evidence, and grants.
- `pnpm verify`, `pnpm verify:handoff`, disposable hosted SQL, pilot hosted SQL,
  responsive browser checks, deployment checks, and runtime checks pass before
  the release is called complete.
