-- Read-only, signed-in preliminary standings for an approved digital Standard
-- Singles event. This deliberately does not decide qualification, eligibility,
-- payouts, MRPs, or finalization. Only verified/corrected scorelines contribute.

create or replace function public.get_preliminary_event_standings(
  p_tournament_id uuid,
  p_event_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with authorized_event as (
    select t.id as tournament_id, t.name as tournament_name,
      e.id as event_id, e.name as event_name
    from app.tournaments t
    join app.events e on e.tournament_id = t.id and e.id = p_event_id
    join app.ruleset_versions rv on rv.id = e.ruleset_version_id
      and rv.tournament_id = e.tournament_id
      and rv.format = 'standard_singles' and rv.approved_at is not null
    where t.id = p_tournament_id
      and e.format = 'standard_singles' and e.scoring_method = 'digital'
      and (select auth.uid()) is not null
      and exists (
        select 1 from app.tournament_roles tr
        where tr.tournament_id = t.id and tr.profile_id = (select auth.uid())
          and tr.role in ('director','co_director','player','cross_checker','judge','viewer')
      )
  ), totals as (
    select ep.id as participant_id, ep.status as participant_status,
      p.display_name,
      coalesce(sum(coalesce(ap.adjudicated_game_points, cs.game_points)), 0)::integer as game_points,
      count(*) filter (where coalesce(ap.adjudicated_is_winner, cs.is_winner))::integer as games_won,
      coalesce(sum(coalesce(ap.adjudicated_plus_points, cs.plus_points)), 0)::integer as plus_points,
      coalesce(sum(coalesce(ap.adjudicated_minus_points, cs.minus_points)), 0)::integer as minus_points,
      count(cs.id)::integer as verified_games
    from authorized_event ae
    join app.event_participants ep on ep.tournament_id = ae.tournament_id
      and ep.event_id = ae.event_id
    join app.profiles p on p.id = ep.profile_id
    left join app.card_scorelines cs on cs.tournament_id = ep.tournament_id
      and cs.event_id = ep.event_id and cs.participant_id = ep.id
      and exists (
        select 1 from app.canonical_games cg
        where cg.id = cs.canonical_game_id and cg.tournament_id = cs.tournament_id
          and cg.event_id = cs.event_id and cg.state in ('verified','corrected')
      )
    left join lateral (
      select projection.adjudicated_is_winner,
        projection.adjudicated_game_points,
        projection.adjudicated_plus_points,
        projection.adjudicated_minus_points
      from app.independent_card_correction_projections projection
      join app.independent_card_corrections correction
        on correction.id = projection.correction_id
        and correction.canonical_game_id = cs.canonical_game_id
        and correction.tournament_id = cs.tournament_id
        and correction.event_id = cs.event_id
      where projection.canonical_scoreline_id = cs.id
        and exists (
          select 1 from app.independent_card_correction_state_events state_event
          where state_event.correction_id = correction.id
            and state_event.canonical_game_id = correction.canonical_game_id
            and state_event.tournament_id = correction.tournament_id
            and state_event.event_id = correction.event_id
            and state_event.state = 'applied'
        )
      order by correction.correction_sequence desc
      limit 1
    ) ap on true
    group by ep.id, ep.status, p.display_name
  ), ranked as (
    select totals.*,
      rank() over (
        order by game_points desc, games_won desc,
          (plus_points - minus_points) desc, plus_points desc
      )::integer as numeric_rank,
      count(*) over (
        partition by game_points, games_won,
          (plus_points - minus_points), plus_points
      )::integer as tied_count
    from totals
  )
  select jsonb_build_object(
    'tournamentId', ae.tournament_id,
    'eventId', ae.event_id,
    'tournamentName', ae.tournament_name,
    'eventName', ae.event_name,
    'status', 'preliminary',
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'participantId', r.participant_id,
        'displayName', r.display_name,
        'participantStatus', r.participant_status,
        'verifiedGames', r.verified_games,
        'gamePoints', r.game_points,
        'gamesWon', r.games_won,
        'plusPoints', r.plus_points,
        'minusPoints', r.minus_points,
        'netSpreadPoints', r.plus_points - r.minus_points,
        'numericRank', r.numeric_rank,
        'tied', r.tied_count > 1
      ) order by r.numeric_rank, r.display_name, r.participant_id)
      from ranked r
    ),
      '[]'::jsonb
    )
  )
  from authorized_event ae
$$;

revoke all on function public.get_preliminary_event_standings(uuid, uuid)
  from public, anon;
grant execute on function public.get_preliminary_event_standings(uuid, uuid)
  to authenticated;
