-- LOCAL AND PILOT ONLY: authenticated, assignment-scoped read model for the
-- Standard Singles score-entry route. Private app tables remain ungranted.

create or replace function public.get_assigned_game_context(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'gameId', cg.id,
    'tournamentId', cg.tournament_id,
    'eventId', cg.event_id,
    'roundNumber', r.round_number,
    'matchInstance', cg.match_instance,
    'state', cg.state,
    'eventName', e.name,
    'ownSubmission', case when own_submission.id is null then null else jsonb_build_object('id', own_submission.id, 'winnerSide', own_submission.winner_side, 'margin', own_submission.margin) end,
    'ownConfirmed', own_confirmation.id is not null,
    'canConfirm', cg.state = 'confirmation_pending' and own_submission.id is not null and own_confirmation.id is null,
    'player', jsonb_build_object(
      'displayName', player_profile.display_name,
      'side', case when cg.side_a_participant_id = player_participant.id then 'a' else 'b' end,
      'tableSeat', case when cg.side_a_participant_id = player_participant.id then cg.side_a_table_seat_snapshot else cg.side_b_table_seat_snapshot end
    ),
    'opponent', jsonb_build_object(
      'displayName', opponent_profile.display_name,
      'side', case when cg.side_a_participant_id = opponent_participant.id then 'a' else 'b' end,
      'tableSeat', case when cg.side_a_participant_id = opponent_participant.id then cg.side_a_table_seat_snapshot else cg.side_b_table_seat_snapshot end
    )
  )
  from app.canonical_games cg
  join app.tournaments t on t.id = cg.tournament_id and t.status = 'open'
  join app.events e on e.id = cg.event_id and e.tournament_id = cg.tournament_id
  join app.ruleset_versions rv on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id
    and rv.format = 'standard_singles' and rv.approved_at is not null
  join app.rounds r on r.id = cg.round_id and r.event_id = cg.event_id and r.tournament_id = cg.tournament_id
  join app.event_participants player_participant on player_participant.id in (cg.side_a_participant_id, cg.side_b_participant_id)
    and player_participant.profile_id = auth.uid()
    and player_participant.status = 'checked_in'
  join app.profiles player_profile on player_profile.id = player_participant.profile_id
  join app.event_participants opponent_participant on opponent_participant.id in (cg.side_a_participant_id, cg.side_b_participant_id)
    and opponent_participant.id <> player_participant.id
  join app.profiles opponent_profile on opponent_profile.id = opponent_participant.profile_id
  left join app.score_submissions own_submission on own_submission.canonical_game_id = cg.id
    and own_submission.submitter_profile_id = auth.uid()
  left join app.score_confirmations own_confirmation on own_confirmation.canonical_game_id = cg.id
    and own_confirmation.confirmation_actor_id = auth.uid()
  where cg.id = p_game_id
    and cg.state in ('pending', 'submitted', 'confirmation_pending', 'mismatch', 'verified')
    and e.format = 'standard_singles'
    and e.scoring_method = 'digital'
  limit 1
$$;

revoke all on function public.get_assigned_game_context(uuid) from public, anon;
grant execute on function public.get_assigned_game_context(uuid) to authenticated;
