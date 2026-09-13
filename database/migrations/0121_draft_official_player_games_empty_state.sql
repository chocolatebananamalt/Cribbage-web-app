-- Let assigned officials inspect My Games while setup is still a draft. This
-- returns an explicit empty workspace; draft games can never become visible.

create or replace function public.get_my_assigned_games_v1(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with raw as (
    select app.get_my_assigned_games_unfiltered_core_v1(p_tournament_id) as payload
  ), draft_official as (
    select jsonb_build_object(
      'tournamentId', t.id,
      'tournamentName', t.name,
      'tournamentDate', coalesce(to_char(latest.starts_at, 'MM-DD-YYYY'), ''),
      'games', '[]'::jsonb
    ) as payload
    from app.tournaments t
    left join lateral (
      select revision.starts_at
      from app.tournament_setup_revisions revision
      where revision.tournament_id = t.id
      order by revision.version desc
      limit 1
    ) latest on true
    where t.id = p_tournament_id
      and t.status = 'draft'
      and (select auth.uid()) is not null
      and exists (
        select 1 from app.tournament_roles role_assignment
        where role_assignment.tournament_id = t.id
          and role_assignment.profile_id = (select auth.uid())
          and role_assignment.role in ('director','co_director','cross_checker','judge','viewer')
      )
  ), effective as (
    select coalesce(raw.payload, draft_official.payload) as payload
    from raw left join draft_official on true
  )
  select case
    when payload is null then null
    else jsonb_set(
      payload,
      '{games}',
      coalesce((
        select jsonb_agg(item.game order by item.ordinality)
        from jsonb_array_elements(payload->'games') with ordinality as item(game, ordinality)
        where exists (
          select 1
          from app.event_schedule_games scheduled
          where scheduled.tournament_id = p_tournament_id
            and scheduled.event_id = (item.game->>'eventId')::uuid
            and scheduled.canonical_game_id = (item.game->>'gameId')::uuid
        )
      ), '[]'::jsonb),
      false
    )
  end
  from effective
$$;
revoke all on function public.get_my_assigned_games_v1(uuid) from public, anon;
grant execute on function public.get_my_assigned_games_v1(uuid) to authenticated;
