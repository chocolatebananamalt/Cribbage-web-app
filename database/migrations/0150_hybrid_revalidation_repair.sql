-- Extend the canonical-game invariant checker for the approved hybrid path:
-- one immutable digital submission, one paper-card claim, and one independent
-- review. This remains distinct from two-player digital verification.

create or replace function app.revalidate_game(game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g app.canonical_games%rowtype;
declare submission_count integer;
declare confirmation_count integer;
declare matching_winner text;
declare matching_margin integer;
declare paper_completion app.paper_game_completions%rowtype;
declare paper_completed boolean := false;
declare hybrid_case app.hybrid_game_cases%rowtype;
declare hybrid_completed boolean := false;
begin
  select * into g from app.canonical_games where id=game_id;
  select * into paper_completion from app.paper_game_completions
    where canonical_game_id=game_id and app.paper_game_completion_is_approved(id);
  paper_completed := found;
  select * into hybrid_case from app.hybrid_game_cases
    where canonical_game_id=game_id and app.hybrid_game_latest_state(id)='approved';
  hybrid_completed := found;
  if paper_completed and hybrid_completed then raise exception 'game cannot have two manual authority paths'; end if;
  if g.state='pending' and exists(select 1 from app.card_scorelines where canonical_game_id=game_id) then raise exception 'pending game cannot have canonical scorelines'; end if;
  if g.state not in ('pending','verified','corrected') and exists(select 1 from app.card_scorelines where canonical_game_id=game_id) then raise exception 'only verified or corrected games can have canonical scorelines'; end if;
  select count(*) into submission_count from app.score_submissions where canonical_game_id=game_id;
  select count(*) into confirmation_count from app.score_confirmations where canonical_game_id=game_id;
  if confirmation_count>0 and (g.state not in ('confirmation_pending','verified','corrected') or submission_count<>2) then raise exception 'confirmations require two submissions and an eligible game state'; end if;
  if confirmation_count>0 and (select count(distinct (winner_side,margin)) from app.score_submissions where canonical_game_id=game_id)<>1 then raise exception 'confirmations require matching submission winner and margin'; end if;
  if g.state='submitted' and submission_count<>1 then raise exception 'submitted game requires exactly one submission'; end if;
  if g.state in ('mismatch','confirmation_pending') and submission_count<>2 then raise exception 'game requires exactly two submissions'; end if;
  if g.state='confirmation_pending' and confirmation_count not in (0,1) then raise exception 'confirmation-pending game allows zero or one confirmation'; end if;
  if g.state in ('verified','corrected') then
    if paper_completed then
      if submission_count<>0 or confirmation_count<>0 then raise exception 'paper completion cannot fabricate player submissions or confirmations'; end if;
      if (select count(*) from app.paper_game_completion_evidence where completion_id=paper_completion.id)<>2 then raise exception 'paper completion requires both original card claims'; end if;
      matching_winner:=paper_completion.winner_side; matching_margin:=paper_completion.margin;
    elsif hybrid_completed then
      if submission_count<>1 or confirmation_count<>0 then raise exception 'hybrid completion requires exactly one digital submission and no digital confirmations'; end if;
      if (select count(*) from app.score_submissions where id=hybrid_case.digital_submission_id and canonical_game_id=game_id and submitter_participant_id=hybrid_case.digital_participant_id and winner_side=hybrid_case.winner_side and margin=hybrid_case.margin and source_method='digital')<>1 then raise exception 'hybrid completion digital evidence is invalid'; end if;
      if (select count(*) from app.hybrid_game_reviews where hybrid_case_id=hybrid_case.id and decision='approve')<>1 then raise exception 'hybrid completion requires one approving independent review'; end if;
      matching_winner:=hybrid_case.winner_side; matching_margin:=hybrid_case.margin;
    else
      if submission_count<>2 or confirmation_count<>2 then raise exception 'verified game requires two submissions and two confirmations'; end if;
      if (select count(distinct submission_id) from app.score_confirmations where canonical_game_id=game_id)<>2 then raise exception 'confirmations must bind two distinct submissions'; end if;
      select winner_side,margin into matching_winner,matching_margin from app.score_submissions where canonical_game_id=game_id group by winner_side,margin having count(*)=2;
    end if;
    if (select count(*) from app.card_scorelines where canonical_game_id=game_id)<>2 then raise exception 'verified game requires exactly two scorelines'; end if;
    if (select count(*) from app.card_scorelines where canonical_game_id=game_id and side='a' and participant_id=g.side_a_participant_id and opponent_participant_id=g.side_b_participant_id)<>1
      or (select count(*) from app.card_scorelines where canonical_game_id=game_id and side='b' and participant_id=g.side_b_participant_id and opponent_participant_id=g.side_a_participant_id)<>1 then raise exception 'scorelines must map exactly to game sides'; end if;
    if not paper_completed and not hybrid_completed and (select count(*) from app.score_submissions s join app.event_participants p on p.id=s.submitter_participant_id where s.canonical_game_id=game_id and ((s.submission_slot=1 and p.id<>g.side_a_participant_id) or (s.submission_slot=2 and p.id<>g.side_b_participant_id)))<>0 then raise exception 'submission slots must map to assigned game sides'; end if;
    if matching_winner is null or g.winner_side<>matching_winner or g.margin<>matching_margin then raise exception 'canonical winner and margin must equal verified evidence'; end if;
    if (select count(*) from app.card_scorelines where canonical_game_id=game_id and margin<>g.margin)<>0
      or (select count(*) from app.card_scorelines where canonical_game_id=game_id and table_seat_snapshot not in (g.side_a_table_seat_snapshot,g.side_b_table_seat_snapshot))<>0
      or (select count(*) from app.card_scorelines where canonical_game_id=game_id and is_winner)<>1 then raise exception 'scorelines must share margin, seats, and one winner'; end if;
    if (select count(*) from app.card_scorelines where canonical_game_id=game_id and ((side='a' and table_seat_snapshot<>g.side_a_table_seat_snapshot) or (side='b' and table_seat_snapshot<>g.side_b_table_seat_snapshot) or (is_winner and side<>g.winner_side) or ((not is_winner) and side=g.winner_side) or (is_winner and plus_points<>g.margin) or (is_winner and minus_points<>0) or (not is_winner and plus_points<>0) or (not is_winner and minus_points<>g.margin) or (is_winner and game_points<>case when g.margin>=31 then 3 else 2 end) or (not is_winner and game_points<>0)))<>0 then raise exception 'reciprocal plus-minus and game points are invalid'; end if;
  end if;
end; $$;

revoke all on function app.revalidate_game(uuid) from public,anon,authenticated;
