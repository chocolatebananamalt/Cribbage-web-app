-- Keep the authenticated player reader limited to immutable, director-reviewed
-- schedule rows. The private core preserves the already-deployed action logic;
-- this public wrapper adds the publication provenance boundary.

alter function public.get_my_assigned_games_v1(uuid) set schema app;
alter function app.get_my_assigned_games_v1(uuid) rename to get_my_assigned_games_unfiltered_core_v1;
revoke all on function app.get_my_assigned_games_unfiltered_core_v1(uuid)
  from public, anon, authenticated, service_role;

create function public.get_my_assigned_games_v1(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with raw as (
    select app.get_my_assigned_games_unfiltered_core_v1(p_tournament_id) as payload
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
  from raw
$$;
revoke all on function public.get_my_assigned_games_v1(uuid) from public, anon;
grant execute on function public.get_my_assigned_games_v1(uuid) to authenticated;
