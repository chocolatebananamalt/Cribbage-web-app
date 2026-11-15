-- Bootstrap data for a first private setup draft. The values are current
-- tournament-role references, not a role-granting mechanism.

create or replace function public.get_tournament_setup_official_choices(
  p_tournament_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles caller
    where caller.tournament_id=p_tournament_id and caller.profile_id=auth.uid()
      and caller.role in ('director','co_director')
  ) then (
    select jsonb_build_object(
      'directorProfileId', t.director_profile_id,
      'coDirectorProfileIds', coalesce((
        select jsonb_agg(r.profile_id order by r.profile_id)
        from app.tournament_roles r
        where r.tournament_id=t.id and r.role='co_director'
      ), '[]'::jsonb)
    ) from app.tournaments t where t.id=p_tournament_id
  ) else null end
$$;

revoke all on function public.get_tournament_setup_official_choices(uuid) from public, anon;
grant execute on function public.get_tournament_setup_official_choices(uuid) to authenticated;
