-- Generated with official CLI migration new official_invitation_context;
-- adapted to the repository's sequential migration numbering. Local only.
-- Narrow read boundary: no role/lifecycle mutation, no email, no credential.
begin;
create or replace function public.get_setup_official_invitation_context_v1(p_actor_id uuid,p_nomination_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $context$
declare v_result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_nomination_id is null then return null; end if;
  select pg_catalog.jsonb_build_object('status',case when n.status='active' then 'accepted' else 'pending' end,'nominationId',n.id,'tournamentName',t.name,'role',n.role,'expiresAt',n.invitation_expires_at)
    into v_result
    from app.tournament_setup_official_nominations n
    join app.tournaments t on t.id=n.tournament_id
    join auth.users u on u.id=p_actor_id and pg_catalog.lower(u.email)=n.email_normalized
    where n.id=p_nomination_id
      and ((n.status in('pending','delivery_failed') and n.invitation_expires_at>pg_catalog.clock_timestamp())
        or (n.status='active' and n.accepted_profile_id=p_actor_id));
  return v_result;
end $context$;
revoke all on function public.get_setup_official_invitation_context_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_setup_official_invitation_context_v1(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
