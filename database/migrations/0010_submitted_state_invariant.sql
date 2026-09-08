-- Match the deferred integrity invariant to the one-submission `submitted`
-- state used by the live RPC. This replaces the existing pilot function.

create or replace function app.revalidate_game(game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g app.canonical_games%rowtype;
declare submission_count integer;
declare confirmation_count integer;
declare matching_winner text;
declare matching_margin integer;
begin
  select * into g from app.canonical_games where id = game_id;
  if g.state = 'pending' and exists (select 1 from app.card_scorelines where canonical_game_id = game_id) then raise exception 'pending game cannot have canonical scorelines'; end if;
  if g.state not in ('pending', 'verified', 'corrected') and exists (select 1 from app.card_scorelines where canonical_game_id = game_id) then raise exception 'only verified or corrected games can have canonical scorelines'; end if;
  select count(*) into submission_count from app.score_submissions where canonical_game_id = game_id;
  select count(*) into confirmation_count from app.score_confirmations where canonical_game_id = game_id;
  if confirmation_count > 0 and (g.state not in ('confirmation_pending', 'verified', 'corrected') or submission_count <> 2) then raise exception 'confirmations require two submissions and an eligible game state'; end if;
  if confirmation_count > 0 and (select count(distinct (winner_side, margin)) from app.score_submissions where canonical_game_id = game_id) <> 1 then raise exception 'confirmations require matching submission winner and margin'; end if;
  if g.state = 'submitted' and submission_count <> 1 then raise exception 'submitted game requires exactly one submission'; end if;
  if g.state in ('mismatch', 'confirmation_pending', 'verified', 'corrected') and submission_count <> 2 then raise exception 'game requires exactly two submissions'; end if;
  if g.state = 'confirmation_pending' and confirmation_count not in (0, 1) then raise exception 'confirmation-pending game allows zero or one confirmation'; end if;
  if g.state in ('verified', 'corrected') then
    if confirmation_count <> 2 then raise exception 'verified game requires two confirmations'; end if;
    if (select count(distinct submission_id) from app.score_confirmations where canonical_game_id = game_id) <> 2 then raise exception 'confirmations must bind two distinct submissions'; end if;
    if (select count(*) from app.card_scorelines where canonical_game_id = game_id) <> 2 then raise exception 'verified game requires exactly two scorelines'; end if;
    if (select count(*) from app.card_scorelines where canonical_game_id = game_id and side = 'a' and participant_id = g.side_a_participant_id and opponent_participant_id = g.side_b_participant_id) <> 1 or (select count(*) from app.card_scorelines where canonical_game_id = game_id and side = 'b' and participant_id = g.side_b_participant_id and opponent_participant_id = g.side_a_participant_id) <> 1 then raise exception 'scorelines must map exactly to game sides'; end if;
    if (select count(*) from app.score_submissions s join app.event_participants p on p.id = s.submitter_participant_id where s.canonical_game_id = game_id and ((s.submission_slot = 1 and p.id <> g.side_a_participant_id) or (s.submission_slot = 2 and p.id <> g.side_b_participant_id))) <> 0 then raise exception 'submission slots must map to assigned game sides'; end if;
    select winner_side, margin into matching_winner, matching_margin from app.score_submissions where canonical_game_id = game_id group by winner_side, margin having count(*) = 2;
    if matching_winner is null or g.winner_side <> matching_winner or g.margin <> matching_margin then raise exception 'canonical winner and margin must equal matching submissions'; end if;
    if (select count(*) from app.card_scorelines where canonical_game_id = game_id and margin <> g.margin) <> 0 or (select count(*) from app.card_scorelines where canonical_game_id = game_id and table_seat_snapshot not in (g.side_a_table_seat_snapshot, g.side_b_table_seat_snapshot)) <> 0 or (select count(*) from app.card_scorelines where canonical_game_id = game_id and is_winner) <> 1 then raise exception 'scorelines must share margin, seats, and one winner'; end if;
    if (select count(*) from app.card_scorelines where canonical_game_id = game_id and ((side = 'a' and table_seat_snapshot <> g.side_a_table_seat_snapshot) or (side = 'b' and table_seat_snapshot <> g.side_b_table_seat_snapshot) or (is_winner and side <> g.winner_side) or ((not is_winner) and side = g.winner_side) or (is_winner and plus_points <> g.margin) or (is_winner and minus_points <> 0) or (not is_winner and plus_points <> 0) or (not is_winner and minus_points <> g.margin) or (is_winner and game_points <> case when g.margin >= 31 then 3 else 2 end) or (not is_winner and game_points <> 0))) <> 0 then raise exception 'reciprocal plus-minus and game points are invalid'; end if;
  end if;
end; $$;

revoke all on function app.revalidate_game(uuid) from public, anon, authenticated;
