-- Extend the existing preliminary Standard Singles standings reader with
-- roster-backed paper participants and schedule/completion evidence. This is
-- still a read-only preview: it does not decide eligibility, final results,
-- MRPs, Q-pools, payouts, or publication.

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
      e.id as event_id, e.name as event_name,
      coalesce(sev.game_count, publication.game_count)::integer as configured_game_count,
      publication.id is not null as schedule_published,
      coalesce(publication.match_count, 0)::integer as scheduled_match_count
    from app.tournaments t
    join app.events e on e.tournament_id = t.id and e.id = p_event_id
    join app.ruleset_versions rv on rv.id = e.ruleset_version_id
      and rv.tournament_id = e.tournament_id
      and rv.format = 'standard_singles' and rv.approved_at is not null
    left join app.tournament_setup_activations activation
      on activation.tournament_id = e.tournament_id and activation.event_id = e.id
    left join app.tournament_setup_event_versions sev
      on sev.id = activation.setup_event_version_id
      and sev.tournament_id = activation.tournament_id
    left join app.event_schedule_publications publication
      on publication.tournament_id = e.tournament_id and publication.event_id = e.id
    where t.id = p_tournament_id
      and e.format = 'standard_singles' and e.scoring_method = 'digital'
      and (select auth.uid()) is not null
      and exists (
        select 1 from app.tournament_roles tr
        where tr.tournament_id = t.id and tr.profile_id = (select auth.uid())
          and tr.role in ('director','co_director','player','cross_checker','judge','viewer')
      )
  ), match_evidence as (
    select ae.tournament_id, ae.event_id,
      count(game.id)::integer as persisted_match_count,
      count(game.id) filter (
        where game.state in ('verified', 'corrected')
          and (select count(*) from app.card_scorelines line
            where line.tournament_id = game.tournament_id
              and line.event_id = game.event_id
              and line.canonical_game_id = game.id) = 2
      )::integer as resolved_match_count
    from authorized_event ae
    left join app.canonical_games game
      on game.tournament_id = ae.tournament_id and game.event_id = ae.event_id
    group by ae.tournament_id, ae.event_id
  ), totals as (
    select ep.id as participant_id, ep.status as participant_status,
      coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), '')) as display_name,
      coalesce(sum(coalesce(projection.adjudicated_game_points, scoreline.game_points)), 0)::integer as game_points,
      count(*) filter (where coalesce(projection.adjudicated_is_winner, scoreline.is_winner))::integer as games_won,
      coalesce(sum(coalesce(projection.adjudicated_plus_points, scoreline.plus_points)), 0)::integer as plus_points,
      coalesce(sum(coalesce(projection.adjudicated_minus_points, scoreline.minus_points)), 0)::integer as minus_points,
      count(scoreline.id)::integer as verified_games
    from authorized_event ae
    join app.event_participants ep on ep.tournament_id = ae.tournament_id
      and ep.event_id = ae.event_id
    left join app.tournament_roster_entries roster
      on roster.id = ep.roster_entry_id and roster.tournament_id = ep.tournament_id
    left join app.profiles profile on profile.id = ep.profile_id
    left join app.card_scorelines scoreline on scoreline.tournament_id = ep.tournament_id
      and scoreline.event_id = ep.event_id and scoreline.participant_id = ep.id
      and exists (
        select 1 from app.canonical_games game
        where game.id = scoreline.canonical_game_id
          and game.tournament_id = scoreline.tournament_id
          and game.event_id = scoreline.event_id
          and game.state in ('verified','corrected')
      )
    left join lateral (
      select candidate.adjudicated_is_winner,
        candidate.adjudicated_game_points,
        candidate.adjudicated_plus_points,
        candidate.adjudicated_minus_points
      from app.independent_card_correction_projections candidate
      join app.independent_card_corrections correction
        on correction.id = candidate.correction_id
        and correction.canonical_game_id = scoreline.canonical_game_id
        and correction.tournament_id = scoreline.tournament_id
        and correction.event_id = scoreline.event_id
      where candidate.canonical_scoreline_id = scoreline.id
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
    ) projection on true
    where coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), '')) is not null
    group by ep.id, ep.status,
      coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), ''))
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
    'configuredGameCount', ae.configured_game_count,
    'schedulePublished', ae.schedule_published,
    'scheduledMatchCount', ae.scheduled_match_count,
    'persistedMatchCount', evidence.persisted_match_count,
    'resolvedMatchCount', evidence.resolved_match_count,
    'scheduledScorecardsComplete', ae.schedule_published
      and ae.configured_game_count is not null
      and ae.scheduled_match_count > 0
      and evidence.persisted_match_count = ae.scheduled_match_count
      and evidence.resolved_match_count = ae.scheduled_match_count
      and exists (select 1 from totals)
      and not exists (
        select 1 from totals item
        where item.verified_games <> ae.configured_game_count
      ),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'participantId', row_data.participant_id,
        'displayName', row_data.display_name,
        'participantStatus', row_data.participant_status,
        'verifiedGames', row_data.verified_games,
        'gamePoints', row_data.game_points,
        'gamesWon', row_data.games_won,
        'plusPoints', row_data.plus_points,
        'minusPoints', row_data.minus_points,
        'netSpreadPoints', row_data.plus_points - row_data.minus_points,
        'numericRank', row_data.numeric_rank,
        'tied', row_data.tied_count > 1
      ) order by row_data.numeric_rank, row_data.display_name, row_data.participant_id)
      from ranked row_data
    ), '[]'::jsonb)
  )
  from authorized_event ae
  join match_evidence evidence
    on evidence.tournament_id = ae.tournament_id and evidence.event_id = ae.event_id
$$;

revoke all on function public.get_preliminary_event_standings(uuid, uuid)
  from public, anon;
grant execute on function public.get_preliminary_event_standings(uuid, uuid)
  to authenticated;
