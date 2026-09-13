-- LOCAL FIRST DRAFT ONLY: do not apply to Supabase or any shared database yet.
-- Public Data API callable boundary; underlying app tables remain ungranted.

create or replace function public.get_tournament_role(p_tournament_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select tr.role
  from app.tournament_roles as tr
  where tr.tournament_id = p_tournament_id
    and tr.profile_id = auth.uid()
    and tr.role in ('director', 'co_director', 'player', 'cross_checker', 'judge', 'viewer')
  limit 1
$$;

revoke all on function public.get_tournament_role(uuid) from public, anon;
grant execute on function public.get_tournament_role(uuid) to authenticated;
