# Identity and enrollment pilot evidence — 2026-09-09

## Applied boundaries

Pilot migrations `0048_roster_account_link_boundary` and
`0049_event_enrollment_boundary` were applied successfully to the isolated
Supabase pilot.

- A current director/co-director may immutably link one existing authenticated
  profile to one roster identity per tournament. Self-linking is rejected; no
  role, event participant, payment, check-in, seating, game, or score action
  is created by the link.
- A current director/co-director may enroll only a linked, currently
  checked-in identity into an approved digital Standard Singles event before
  initial seating is published. It creates no assignment or game.

## Evidence and limits

The account-link function is security-definer with empty search path, has
anonymous execution revoked, and is callable by signed-in users only; its
server role check is authoritative. The enrollment migration compiled and was
accepted by the pilot database. Static regression coverage passed with 51
tests, including rejection paths for unlinked, unchecked-in, duplicate,
post-seating, non-approved-event, and no-score/no-seat side effects.

Vercel built commit `36e1e14` as a Ready Preview. The hosted root returned a
normal authentication redirect and Vercel reported no grouped runtime errors
in the one-hour scan.

No independent disposable director/player sessions were created. Before any
release, real persisted-data tests must prove role revocation, exact/changed
replay, collision, cross-tournament denial, and all enrollment/link
prerequisites. Dynamic round scheduling, player-facing assignment delivery,
offline sync, results, finance reconciliation, and finalization remain open.
