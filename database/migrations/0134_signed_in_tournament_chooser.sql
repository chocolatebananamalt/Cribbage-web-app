-- Give the production landing page a private, actor-scoped list of tournament
-- workspaces. The server supplies the already verified Auth subject; browser
-- roles cannot execute this function directly.

create or replace function public.list_actor_tournament_workspaces_v1(p_actor_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with authorized as (
    select
      tournament.id as tournament_id,
      coalesce(latest_setup.tournament_name, tournament.name) as tournament_name,
      tournament.status as tournament_status,
      effective_role.role as effective_role,
      coalesce(to_char(latest_setup.starts_at, 'MM-DD-YYYY'), '') as tournament_date,
      latest_setup.starts_at as tournament_starts_at
    from app.tournaments tournament
    join lateral (
      select candidate.role from (
        select role_assignment.role, case role_assignment.role
          when 'director' then 1 when 'co_director' then 2 when 'judge' then 3
          when 'cross_checker' then 4 when 'player' then 5 when 'viewer' then 6 else 8 end as priority
        from app.tournament_roles role_assignment
        where role_assignment.tournament_id = tournament.id
          and role_assignment.profile_id = p_actor_id
          and role_assignment.role in ('director','co_director','cross_checker','judge','player','viewer')
        union all
        select 'player', 7
        where exists (
          select 1 from app.event_participants participant
          where participant.tournament_id = tournament.id
            and participant.profile_id = p_actor_id
            and participant.status = 'checked_in'
        )
      ) candidate
      order by candidate.priority
      limit 1
    ) effective_role on true
    left join lateral (
      select revision.tournament_name, revision.starts_at
      from app.tournament_setup_revisions revision
      where revision.tournament_id = tournament.id
      order by revision.version desc
      limit 1
    ) latest_setup on true
    where (select auth.role()) = 'service_role'
      and p_actor_id is not null
      and tournament.status in ('draft','open','pending_finalization','finalized')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'tournamentId', authorized.tournament_id,
    'tournamentName', authorized.tournament_name,
    'tournamentDate', authorized.tournament_date,
    'tournamentStatus', authorized.tournament_status,
    'effectiveRole', authorized.effective_role
  ) order by
    case authorized.tournament_status
      when 'open' then 1
      when 'pending_finalization' then 2
      when 'draft' then 3
      when 'finalized' then 4
      else 5
    end,
    authorized.tournament_starts_at desc nulls last,
    lower(authorized.tournament_name),
    authorized.tournament_id
  ), '[]'::jsonb)
  from authorized
$$;

revoke all on function public.list_actor_tournament_workspaces_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.list_actor_tournament_workspaces_v1(uuid)
  to service_role;
