-- Authenticated, actor-scoped navigation for a player's published games.
-- The caller cannot supply an actor id; auth.uid() is the identity boundary.

create or replace function public.get_my_assigned_games_v1(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select (select auth.uid()) as profile_id
  ), authorized_tournament as (
    select t.id, t.name,
      coalesce(to_char(sr.starts_at, 'MM-DD-YYYY'), '') as tournament_date
    from app.tournaments t
    cross join actor a
    left join lateral (
      select r.starts_at
      from app.tournament_setup_activations activation
      join app.tournament_setup_revisions r
        on r.id = activation.setup_revision_id
       and r.tournament_id = activation.tournament_id
      where activation.tournament_id = t.id
      order by r.version desc
      limit 1
    ) sr on true
    where t.id = p_tournament_id
      and t.status in ('open', 'pending_finalization', 'finalized')
      and a.profile_id is not null
      and exists (
        select 1 from app.tournament_roles tr
        where tr.tournament_id = t.id
          and tr.profile_id = a.profile_id
          and tr.role in ('director','co_director','player','cross_checker','judge','viewer')
      )
  ), assigned as (
    select cg.id as game_id, cg.event_id, e.name as event_name,
      r.round_number, cg.match_instance, cg.state,
      player.id as player_participant_id,
      case when cg.side_a_participant_id = player.id then 'a' else 'b' end as player_side,
      case when cg.side_a_participant_id = player.id
        then cg.side_a_table_seat_snapshot else cg.side_b_table_seat_snapshot end as player_table_seat,
      coalesce(player_seating.verification_id, player.table_seat) as player_verification_id,
      coalesce(opponent_roster.claimed_display_name, opponent_profile.display_name) as opponent_name,
      case when cg.side_a_participant_id = opponent.id
        then cg.side_a_table_seat_snapshot else cg.side_b_table_seat_snapshot end as opponent_table_seat,
      coalesce(opponent_seating.verification_id, opponent.table_seat) as opponent_verification_id
    from authorized_tournament t
    cross join actor a
    join app.canonical_games cg on cg.tournament_id = t.id
    join app.events e on e.id = cg.event_id and e.tournament_id = cg.tournament_id
      and e.format = 'standard_singles' and e.scoring_method = 'digital'
    join app.rounds r on r.id = cg.round_id and r.event_id = cg.event_id
      and r.tournament_id = cg.tournament_id
    join app.event_participants player
      on player.id in (cg.side_a_participant_id, cg.side_b_participant_id)
      and player.profile_id = a.profile_id and player.status = 'checked_in'
    left join app.initial_seating_assignments player_seating
      on player_seating.tournament_id = player.tournament_id
      and player_seating.roster_entry_id = player.roster_entry_id
    join app.event_participants opponent
      on opponent.id in (cg.side_a_participant_id, cg.side_b_participant_id)
      and opponent.id <> player.id
    left join app.tournament_roster_entries opponent_roster
      on opponent_roster.id = opponent.roster_entry_id
      and opponent_roster.tournament_id = opponent.tournament_id
    left join app.profiles opponent_profile on opponent_profile.id = opponent.profile_id
    left join app.initial_seating_assignments opponent_seating
      on opponent_seating.tournament_id = opponent.tournament_id
      and opponent_seating.roster_entry_id = opponent.roster_entry_id
    where cg.state in ('pending','submitted','confirmation_pending','mismatch','verified','corrected')
      and coalesce(player_seating.verification_id, player.table_seat) is not null
      and coalesce(opponent_seating.verification_id, opponent.table_seat) is not null
      and coalesce(opponent_roster.claimed_display_name, opponent_profile.display_name) is not null
  )
  select jsonb_build_object(
    'tournamentId', t.id,
    'tournamentName', t.name,
    'tournamentDate', t.tournament_date,
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'gameId', g.game_id,
        'eventId', g.event_id,
        'eventName', g.event_name,
        'gameNumber', g.round_number,
        'matchInstance', g.match_instance,
        'state', g.state,
        'playerSide', g.player_side,
        'playerTableSeat', g.player_table_seat,
        'playerVerificationId', g.player_verification_id,
        'opponentName', g.opponent_name,
        'opponentTableSeat', g.opponent_table_seat,
        'opponentVerificationId', g.opponent_verification_id
      ) order by
        case when g.state in ('verified','corrected') then 1 else 0 end,
        g.round_number, g.match_instance, g.event_name, g.game_id
      ) from assigned g
    ), '[]'::jsonb)
  )
  from authorized_tournament t
$$;

revoke all on function public.get_my_assigned_games_v1(uuid) from public, anon;
grant execute on function public.get_my_assigned_games_v1(uuid) to authenticated;
