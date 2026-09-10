-- Read only the authenticated player's own approved Standard Singles card.
-- Verified/corrected scorelines are distinct from pending games so a pending
-- submission cannot affect display totals.

create or replace function public.get_player_scorecard(
  p_tournament_id uuid,
  p_event_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tournamentId', t.id,
    'eventId', e.id,
    'tournamentName', t.name,
    'eventName', e.name,
    'player', jsonb_build_object(
      'displayName', player_profile.display_name,
      'verificationId', player_seating.verification_id
    ),
    'lines', scorecard.lines,
    'totals', jsonb_build_object(
      'gamePoints', scorecard.game_points,
      'plusPoints', scorecard.plus_points,
      'minusPoints', scorecard.minus_points,
      'gamesWon', scorecard.games_won,
      'netSpreadPoints', scorecard.plus_points - scorecard.minus_points
    ),
    'pendingGames', pending.pending_games
  )
  from app.tournaments t
  join app.events e on e.id = p_event_id and e.tournament_id = t.id
  join app.ruleset_versions rv on rv.id = e.ruleset_version_id
    and rv.tournament_id = e.tournament_id and rv.format = 'standard_singles'
    and rv.approved_at is not null
  join app.event_participants player_participant on player_participant.event_id = e.id
    and player_participant.tournament_id = t.id and player_participant.profile_id = auth.uid()
  join app.profiles player_profile on player_profile.id = player_participant.profile_id
  join app.roster_account_links player_link on player_link.tournament_id = t.id
    and player_link.profile_id = player_participant.profile_id
  join app.initial_seating_assignments player_seating on player_seating.tournament_id = t.id
    and player_seating.roster_entry_id = player_link.roster_entry_id
  join lateral (
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'roundNumber', r.round_number,
        'matchInstance', cg.match_instance,
        'gamePoints', cs.game_points,
        'plusPoints', cs.plus_points,
        'minusPoints', cs.minus_points,
        'opponentName', opponent_profile.display_name,
        'opponentVerificationId', opponent_seating.verification_id
      ) order by r.round_number, cg.match_instance), '[]'::jsonb) as lines,
      coalesce(sum(cs.game_points), 0)::integer as game_points,
      coalesce(sum(cs.plus_points), 0)::integer as plus_points,
      coalesce(sum(cs.minus_points), 0)::integer as minus_points,
      count(*) filter (where cs.is_winner)::integer as games_won
    from app.card_scorelines cs
    join app.canonical_games cg on cg.id = cs.canonical_game_id
      and cg.tournament_id = cs.tournament_id and cg.event_id = cs.event_id
    join app.rounds r on r.id = cg.round_id and r.tournament_id = cg.tournament_id
      and r.event_id = cg.event_id
    join app.event_participants opponent_participant on opponent_participant.id = cs.opponent_participant_id
      and opponent_participant.tournament_id = cs.tournament_id and opponent_participant.event_id = cs.event_id
    join app.profiles opponent_profile on opponent_profile.id = opponent_participant.profile_id
    join app.roster_account_links opponent_link on opponent_link.tournament_id = cs.tournament_id
      and opponent_link.profile_id = opponent_participant.profile_id
    join app.initial_seating_assignments opponent_seating on opponent_seating.tournament_id = cs.tournament_id
      and opponent_seating.roster_entry_id = opponent_link.roster_entry_id
    where cs.tournament_id = t.id and cs.event_id = e.id
      and cs.participant_id = player_participant.id and cg.state in ('verified', 'corrected')
  ) scorecard on true
  join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'roundNumber', r.round_number,
      'matchInstance', cg.match_instance,
      'state', cg.state
    ) order by r.round_number, cg.match_instance), '[]'::jsonb) as pending_games
    from app.canonical_games cg
    join app.rounds r on r.id = cg.round_id and r.tournament_id = cg.tournament_id
      and r.event_id = cg.event_id
    where cg.tournament_id = t.id and cg.event_id = e.id
      and player_participant.id in (cg.side_a_participant_id, cg.side_b_participant_id)
      and cg.state in ('pending', 'submitted', 'confirmation_pending', 'mismatch')
  ) pending on true
  where t.id = p_tournament_id and auth.uid() is not null
    and e.format = 'standard_singles' and e.scoring_method = 'digital'
  limit 1
$$;

revoke all on function public.get_player_scorecard(uuid, uuid) from public, anon;
grant execute on function public.get_player_scorecard(uuid, uuid) to authenticated;
