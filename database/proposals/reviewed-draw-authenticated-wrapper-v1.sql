-- LOCAL SOURCE ONLY; UNEXECUTED. Not a migration or an access-change approval.
-- Private core was tested separately; these authenticated PostgREST wrappers
-- still need actual role/provider/transaction acceptance before any application.
begin;
create function public.publish_reviewed_initial_seating_v1(p_tournament_id uuid,p_request jsonb)returns jsonb
 language plpgsql security definer set search_path=''as $$
begin
 if auth.uid()is null or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'authenticated'
  or not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=auth.uid()and r.role in('director','co_director'))then return null;end if;
 return app.publish_reviewed_initial_seating_unverified_v1(p_tournament_id,p_request);
end$$;
create function public.get_reviewed_initial_seating_operation_v1(p_tournament_id uuid,p_operation_id uuid)returns jsonb
 language sql stable security definer set search_path=''as $$
 select case when auth.uid()is not null
  and coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')='authenticated'
  and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=auth.uid()and r.role in('director','co_director'))
 then app.get_reviewed_initial_seating_operation_unverified_v1(p_tournament_id,p_operation_id)else null end
$$;
revoke all on function public.publish_reviewed_initial_seating_v1(uuid,jsonb)from public,anon,authenticated,service_role;
revoke all on function public.get_reviewed_initial_seating_operation_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.publish_reviewed_initial_seating_v1(uuid,jsonb)to authenticated;
grant execute on function public.get_reviewed_initial_seating_operation_v1(uuid,uuid)to authenticated;
-- No table access or direct private-core execute grant. No actor parameter.
commit;
