-- Existing co-directors predate the invitation workflow. Give each one a
-- lifecycle record so the primary director can revoke/restore them without
-- deleting un-audited role history.
insert into app.tournament_co_director_invitations(
  tournament_id, invited_email_normalized, invited_by_profile_id, secret_hash,
  status, expires_at, accepted_by_profile_id, accepted_at
)
select r.tournament_id, lower(u.email), t.director_profile_id,
  encode(extensions.digest(convert_to('legacy:'||r.tournament_id::text||':'||r.profile_id::text,'utf8'),'sha256'),'hex'),
  'accepted', now(), r.profile_id, now()
from app.tournament_roles r
join app.tournaments t on t.id=r.tournament_id
join auth.users u on u.id=r.profile_id
where r.role='co_director'
  and not exists(select 1 from app.tournament_co_director_invitations i where i.tournament_id=r.tournament_id and i.accepted_by_profile_id=r.profile_id);

create or replace function public.get_tournament_officials_workspace_v1(p_actor_id uuid, p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with permitted as (select t.*, (t.director_profile_id=p_actor_id) is_primary, exists(select 1 from app.platform_administrators a where a.profile_id=p_actor_id) is_platform_admin from app.tournaments t where t.id=p_tournament_id)
  select case when coalesce(auth.role(),'')='service_role' and p_actor_id is not null and (is_primary or is_platform_admin) then jsonb_build_object(
    'tournamentName',name,'isPrimaryDirector',is_primary,'canEmergencyOverride',is_platform_admin,'coDirectorCapacity',4,
    'activeCoDirectors',coalesce((select jsonb_agg(jsonb_build_object('profileId',p.id,'displayName',p.display_name,'invitationId',i.id) order by lower(p.display_name),p.id) from app.tournament_roles r join app.profiles p on p.id=r.profile_id left join lateral(select id from app.tournament_co_director_invitations i where i.tournament_id=r.tournament_id and i.accepted_by_profile_id=r.profile_id order by accepted_at desc nulls last limit 1)i on true where r.tournament_id=permitted.id and r.role='co_director'),'[]'::jsonb),
    'pendingInvitations',coalesce((select jsonb_agg(jsonb_build_object('invitationId',i.id,'emailHint',left(i.invited_email_normalized,1)||'***@'||split_part(i.invited_email_normalized,'@',2),'expiresAt',i.expires_at) order by i.expires_at) from app.tournament_co_director_invitations i where i.tournament_id=permitted.id and i.status='pending'),'[]'::jsonb)
  ) else null end from permitted
$$;
revoke all on function public.get_tournament_officials_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_tournament_officials_workspace_v1(uuid,uuid) to service_role;
notify pgrst,'reload schema';
