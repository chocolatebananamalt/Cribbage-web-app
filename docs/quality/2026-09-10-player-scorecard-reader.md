# Player scorecard reader — 2026-09-10

## Acceptance criteria

- A signed-in player can read only their own approved Standard Singles card for
  a supplied tournament and event.
- Only verified or corrected lines contribute to line display and totals.
- Pending, submitted, confirmation-pending, and mismatch games are returned
  separately, so the UI can disclose pending verification without changing a
  total.
- The reader returns only display fields needed by the card: names, permanent
  verification IDs, rounds, card values, and derived totals. It does not
  return roster, profile, submission, confirmation, or correction identifiers.
- Anonymous callers cannot execute the reader.

## Change

Migration `0088_player_scorecard_reader.sql` adds
`public.get_player_scorecard(tournament_id, event_id)`. It is a narrowly
bound `SECURITY DEFINER` reader with an empty search path. Its player join is
bound to `auth.uid()` and it requires the published immutable seating record
used for permanent verification IDs. The server-only DAL validates the exact
response shape before a protected, server-rendered scorecard page receives it.

The score-entry screen now links to that page for its event. The card follows
the approved grouped Game/Spread Points layout, shows separate plus and minus
values, uses the leading-zero convention for individual one-digit spreads,
keeps verified totals separate, and shows `Verification Pending Opponent Entry`
plus `Updated Total Calculations Pending Opponent Entry` when applicable.

## Executed evidence

- Migration applied first to disposable synthetic project
  `donfxulkliuyteiannir`, then pilot project `fnjkwymxpnsqvxtpronk`.
- Catalog checks on both projects confirm `SECURITY DEFINER`, empty
  `search_path`, no anonymous execute grant, authenticated-only execution,
  the exact `auth.uid()` player binding, and the verified/corrected-line
  filter.
- A no-auth disposable execution returned no card.
- A complete disposable synthetic fixture now creates the otherwise required
  registration claim, roster approval, account link, and immutable initial
  seating chain for both existing synthetic players. As authenticated Player
  A, the reader returned precisely two verified lines, permanent IDs `A-7`
  and `A-8`, 5 game points, +43 spread points, zero pending games, and no
  internal identifiers. An authenticated but unlinked Player D received no
  card. The catalog also proves that neither `anon` nor `authenticated` can
  select `app.card_scorelines` directly, while only `authenticated` can
  execute the narrow reader.
- Static regression coverage proves the database filter, private DAL, route
  access check, display of pending-total warnings, and absence of client table
  reads or service credentials.
- Local `pnpm test`, lint, production build, workspace/handoff verification,
  dependency audit, and diff check are recorded with this change.
- Vercel preview deployment `dpl_CMjUWJohzUr73C2uwmk55tftoNMM` built commit
  `5f97bf4` successfully. A direct HTTPS fetch of its preview URL returned
  `200 OK` and the expected ACC Tournament Desk landing markup. This is a
  hosted availability check only, not a signed-in scorecard interaction test.

## Remaining limitation

The database boundary is now exercised with a complete synthetic player chain.
Two independent signed-in browser sessions and phone/desktop visual evidence
remain release gates; the database-console authenticated context is not a
substitute for real browser sessions or a production pilot.
