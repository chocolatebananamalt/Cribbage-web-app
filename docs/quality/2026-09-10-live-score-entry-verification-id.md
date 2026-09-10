# Live score-entry verification-ID review — 2026-09-10

## Acceptance criteria

- The protected live game context returns a permanent verification ID for the
  assigned player and assigned opponent only.
- The ID is sourced from immutable initial seating after registration closure,
  not from the changing Table/Seat snapshot.
- The browser receives no roster-entry or profile identifier as a substitute
  for the displayed ID.
- A missing linked initial assignment fails closed rather than producing an
  invented identifier.

## Change

Migration `0087_assigned_game_context_verification_ids.sql` updates the
existing assignment-scoped context function. It resolves each assigned
participant through the existing private roster-account link and immutable
initial-seating assignment, then returns only `verificationId` beside the
existing display name, side, and current Table/Seat. The TypeScript shape
rejects a malformed ID, and the protected live score-entry screen renders
`ID#: A-7` next to each participant name.

This is not rotation. The Table/Seat shown for the current game remains its
existing game snapshot; scheduled rotation is still a source-and-fixture-gated
future workflow.

The same protected screen now displays the approved player aid after a valid
spread: `Skunk`, `Double skunk`, or `Triple skunk`, with one, two, or three
skunk icons. It is presentation-only: the shared score derivation remains the
source of the existing 0/2/3 game-point calculation, and it does not add an
official ACC record label.

Before submission, the protected screen also previews both card entries from
that same derivation: each player's `won/lost by` result, Game Points, and
signed Spread Points. The preview is explicitly not a server record; the
existing independent-entry and confirmation workflow remains authoritative.

## Executed evidence

- Local `pnpm test` — **115 passed**, including static contracts proving the
  new RPC joins and client rendering.
- Local `pnpm lint` and `pnpm build` — passed.
- Migration applied first to disposable synthetic project
  `donfxulkliuyteiannir`, then pilot project `fnjkwymxpnsqvxtpronk`.
- Both projects' migration histories include
  `assigned_game_context_verification_ids`.
- Catalog checks on both projects confirm this function is security definer,
  has an empty search path, has no anonymous execute grant, retains its
  authenticated assignment-scoped grant, and contains both ID bindings.
- Post-change pilot security advisor contains no new unique finding from this
  change. Its pre-existing warnings are intentionally tracked: private `app`
  tables have forced RLS and no direct browser grants; narrow authenticated
  security-definer RPCs are individually guarded; leaked-password protection
  remains unavailable on the current free plan and is not required while the
  intended UI uses magic links.
- Vercel Preview deployment `dpl_3aDji61rr3RoRWwSvsxt2PB3REyF` is **READY**
  from commit `5e76b8c`; Vercel reports no runtime-error clusters in the
  subsequent one-hour project scan.

## Remaining limitation

No seeded, two-person, independently authenticated browser session currently
exists that has both initial seating and a created canonical game. Therefore a
real rendered game-context response and phone/desktop visual check remain
release gates; the catalog and static contracts do not substitute for them.
The protected Vercel Preview fetch correctly stopped at Vercel SSO, so it
cannot stand in for that signed-in player-session evidence.
