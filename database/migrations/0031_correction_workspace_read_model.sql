-- Private, actor-scoped correction workspace read model. The Supabase CLI is
-- unavailable on this host, so this migration filename continues the checked-in
-- sequence. It exposes only actionable Standard Singles correction records.
-- It never grants direct access to correction/history tables.

create or replace function public.get_correction_workspace(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select auth.uid() as profile_id
  ),
  scope as (
    select
      t.id as tournament_id,
      a.profile_id,
      exists (
        select 1
        from app.tournament_roles tr
        where tr.tournament_id = t.id
          and tr.profile_id = a.profile_id
          and tr.role = 'cross_checker'
      ) as may_propose,
      (
        t.director_profile_id = a.profile_id
        or exists (
          select 1
          from app.tournament_roles tr
          where tr.tournament_id = t.id
            and tr.profile_id = a.profile_id
            and tr.role in ('cross_checker', 'director', 'co_director')
        )
      ) as may_review
    from actor a
    join app.tournaments t on t.id = p_tournament_id and t.status = 'open'
    where a.profile_id is not null
  ),
  proposal_candidates as (
    select jsonb_build_object(
      'gameId', cg.id,
      'eventName', e.name,
      'roundNumber', r.round_number,
      'matchInstance', cg.match_instance,
      'gameVersion', cg.version,
      'winnerSide', cg.winner_side,
      'margin', cg.margin,
      'sideA', jsonb_build_object('displayName', side_a_profile.display_name, 'tableSeat', cg.side_a_table_seat_snapshot),
      'sideB', jsonb_build_object('displayName', side_b_profile.display_name, 'tableSeat', cg.side_b_table_seat_snapshot)
    ) as item
    from scope s
    join app.canonical_games cg on cg.tournament_id = s.tournament_id
      and cg.state in ('verified', 'corrected')
    join app.events e on e.id = cg.event_id and e.tournament_id = cg.tournament_id
      and e.format = 'standard_singles' and e.scoring_method = 'digital'
    join app.ruleset_versions rv on rv.id = e.ruleset_version_id
      and rv.tournament_id = e.tournament_id
      and rv.format = 'standard_singles' and rv.approved_at is not null
    join app.event_publication_states ps on ps.event_id = e.id
      and ps.tournament_id = e.tournament_id and ps.state = 'draft'
    join app.rounds r on r.id = cg.round_id and r.event_id = cg.event_id
      and r.tournament_id = cg.tournament_id
    join app.event_participants side_a on side_a.id = cg.side_a_participant_id
      and side_a.event_id = cg.event_id and side_a.tournament_id = cg.tournament_id
    join app.profiles side_a_profile on side_a_profile.id = side_a.profile_id
    join app.event_participants side_b on side_b.id = cg.side_b_participant_id
      and side_b.event_id = cg.event_id and side_b.tournament_id = cg.tournament_id
    join app.profiles side_b_profile on side_b_profile.id = side_b.profile_id
    where s.may_propose
      and s.profile_id not in (side_a.profile_id, side_b.profile_id)
      and not exists (
        select 1 from app.game_corrections c
        where c.canonical_game_id = cg.id
          and c.required_approvals = 1
          and exists (
            select 1 from app.correction_state_events cse
            where cse.correction_id = c.id and cse.state = 'pending'
          )
          and not exists (
            select 1 from app.correction_state_events cse
            where cse.correction_id = c.id and cse.state in ('approved', 'rejected', 'applied')
          )
      )
  ),
  pending_reviews as (
    select jsonb_build_object(
      'correctionId', c.id,
      'gameId', cg.id,
      'eventName', e.name,
      'roundNumber', r.round_number,
      'matchInstance', cg.match_instance,
      'baseGameVersion', c.base_game_version,
      'previousWinnerSide', c.previous_winner_side,
      'previousMargin', c.previous_margin,
      'correctedWinnerSide', c.corrected_winner_side,
      'correctedMargin', c.corrected_margin,
      'reason', c.reason,
      'sideA', jsonb_build_object('displayName', side_a_profile.display_name, 'tableSeat', cg.side_a_table_seat_snapshot),
      'sideB', jsonb_build_object('displayName', side_b_profile.display_name, 'tableSeat', cg.side_b_table_seat_snapshot)
    ) as item
    from scope s
    join app.game_corrections c on c.tournament_id = s.tournament_id
      and c.required_approvals = 1
    join app.canonical_games cg on cg.id = c.canonical_game_id
      and cg.tournament_id = c.tournament_id and cg.event_id = c.event_id
    join app.events e on e.id = cg.event_id and e.tournament_id = cg.tournament_id
      and e.format = 'standard_singles' and e.scoring_method = 'digital'
    join app.event_publication_states ps on ps.event_id = e.id
      and ps.tournament_id = e.tournament_id and ps.state = 'draft'
    join app.rounds r on r.id = cg.round_id and r.event_id = cg.event_id
      and r.tournament_id = cg.tournament_id
    join app.event_participants side_a on side_a.id = cg.side_a_participant_id
      and side_a.event_id = cg.event_id and side_a.tournament_id = cg.tournament_id
    join app.profiles side_a_profile on side_a_profile.id = side_a.profile_id
    join app.event_participants side_b on side_b.id = cg.side_b_participant_id
      and side_b.event_id = cg.event_id and side_b.tournament_id = cg.tournament_id
    join app.profiles side_b_profile on side_b_profile.id = side_b.profile_id
    where s.may_review
      and s.profile_id <> c.editor_profile_id
      and s.profile_id not in (side_a.profile_id, side_b.profile_id)
      and exists (
        select 1 from app.correction_state_events cse
        where cse.correction_id = c.id and cse.state = 'pending' and cse.transition_sequence = 1
      )
      and not exists (
        select 1 from app.correction_state_events cse
        where cse.correction_id = c.id and cse.state in ('approved', 'rejected', 'applied')
      )
  )
  select jsonb_build_object(
    'proposalCandidates', coalesce((select jsonb_agg(item order by item->>'eventName', (item->>'roundNumber')::integer, (item->>'matchInstance')::integer) from proposal_candidates), '[]'::jsonb),
    'pendingReviews', coalesce((select jsonb_agg(item order by item->>'eventName', (item->>'roundNumber')::integer, (item->>'matchInstance')::integer) from pending_reviews), '[]'::jsonb)
  )
$$;

revoke all on function public.get_correction_workspace(uuid) from public, anon;
grant execute on function public.get_correction_workspace(uuid) to authenticated;
