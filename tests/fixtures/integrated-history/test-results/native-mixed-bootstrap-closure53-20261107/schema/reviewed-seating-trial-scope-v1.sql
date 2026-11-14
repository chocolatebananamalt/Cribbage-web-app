-- LOCAL UNEXECUTED amendment; not a migration or permission to enroll anything.
-- Apply only AFTER the unchanged random/native/authenticated proposals.
-- Restricts these NEW workflows, not the existing general manual seating API.
begin;
create table app.reviewed_seating_trial_deployments_v1(
 project_ref text primary key check(project_ref='nnhcnvksxgxnpvdqjgpg'),
 authorization_reference text not null check(length(trim(authorization_reference))between 1 and 500),
 recorded_by_db_user text not null default session_user,recorded_at timestamptz not null default clock_timestamp());
create table app.reviewed_seating_trial_scope_versions_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id),
 event_id uuid not null,version integer not null check(version>0),official_ids uuid[] not null,
 writes_enabled boolean not null,expires_at timestamptz not null,
 reviewed_by uuid not null references app.profiles(id),authorization_reference text not null,
 operation_id uuid not null,request jsonb not null,recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 unique(tournament_id,version),unique(reviewed_by,operation_id),
 check(cardinality(official_ids)between 0 and 6),check(length(trim(authorization_reference))between 1 and 500));
do $$declare t text;begin
 foreach t in array array['reviewed_seating_trial_deployments_v1','reviewed_seating_trial_scope_versions_v1']loop
 execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',t);
 end loop;end$$;

-- OWNER ONLY. No automatic marker/fixture/config is inserted by installation.
-- Owner must separately verify the real provider target; the marker is explicit
-- authorization, not a claim SQL can discover a Supabase project from its name.
create function app.authorize_reviewed_seating_trial_deployment_v1(p_project_ref text,p_authorization_reference text)
returns void language plpgsql security definer set search_path=''as $$
declare prior text;begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'trial_scope_requires_read_committed';end if;
 if p_project_ref is distinct from'nnhcnvksxgxnpvdqjgpg'or p_authorization_reference is null
 or length(trim(p_authorization_reference))not between 1 and 500 then raise exception'invalid_trial_deployment';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reviewed-seating-trial-deployment',0));
 select authorization_reference into prior from app.reviewed_seating_trial_deployments_v1 where project_ref=p_project_ref;
 if found then if prior is distinct from p_authorization_reference then raise exception'trial_deployment_conflict';end if;return;end if;
 insert into app.reviewed_seating_trial_deployments_v1(project_ref,authorization_reference)values(p_project_ref,p_authorization_reference);
end$$;

-- Append-only CAS, exact owned retry. Empty official_ids explicitly revokes all
-- NEW-work/read authority in this workflow; disabling writes alone preserves
-- current-role/allowlisted recovery. Never changes actual tournament roles.
create function app.record_reviewed_seating_trial_scope_v1(p_tournament_id uuid,p_event_id uuid,p_reviewed_by uuid,
 p_official_ids uuid[],p_expected_version integer,p_writes_enabled boolean,p_expires_at timestamptz,
 p_authorization_reference text,p_operation_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare previous app.reviewed_seating_trial_scope_versions_v1%rowtype;latest app.reviewed_seating_trial_scope_versions_v1%rowtype;req jsonb;v integer;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'trial_scope_requires_read_committed';end if;
 if p_tournament_id is null or p_event_id is null or p_reviewed_by is null or p_operation_id is null then raise exception'invalid_trial_scope';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('reviewed-seating-trial:'||p_tournament_id::text,0))then raise exception'trial_scope_busy_retry_same_request';end if;
 begin
  perform 1 from app.tournaments where id=p_tournament_id for update nowait;
  if not found then raise exception'invalid_trial_scope';end if;
 exception when lock_not_available then raise exception'trial_scope_busy_retry_same_request';end;
 req:=jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'reviewedBy',p_reviewed_by,'officialIds',p_official_ids,
 'expectedVersion',p_expected_version,'writesEnabled',p_writes_enabled,'expiresAt',p_expires_at,'authorizationReference',p_authorization_reference);
 select *into previous from app.reviewed_seating_trial_scope_versions_v1 where reviewed_by=p_reviewed_by and operation_id=p_operation_id;
 if found then if previous.request is distinct from req then raise exception'trial_scope_operation_conflict';end if;
 return jsonb_build_object('status','trial_scope_recorded','version',previous.version,'scopeVersionId',previous.id);end if;
 if not exists(select 1 from app.reviewed_seating_trial_deployments_v1 where project_ref='nnhcnvksxgxnpvdqjgpg')
 or p_expected_version is null or p_expected_version<0 or p_writes_enabled is null or p_expires_at is null
 or p_official_ids is null or coalesce(array_ndims(p_official_ids),1)<>1 or cardinality(p_official_ids)>6
 or exists(select 1 from unnest(p_official_ids)x where x is null)
 or(select count(distinct x)from unnest(p_official_ids)x)<>cardinality(p_official_ids)
 or exists(select 1 from unnest(p_official_ids)x where not exists(select 1 from app.profiles p where p.id=x))
 or p_authorization_reference is null or length(trim(p_authorization_reference))not between 1 and 500
 or p_writes_enabled and(p_expires_at<=clock_timestamp()or cardinality(p_official_ids)=0)
 or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_reviewed_by and role in('director','co_director'))
 then raise exception'invalid_trial_scope';end if;
 perform 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_reviewed_by and r.role in('director','co_director')order by r.role for key share;
 if not found then raise exception'invalid_trial_scope';end if;
 select *into latest from app.reviewed_seating_trial_scope_versions_v1 where tournament_id=p_tournament_id order by version desc limit 1;
 v:=coalesce(latest.version,0);
 if p_expected_version<>v then raise exception'trial_scope_version_changed';end if;
 if v>0 and latest.event_id<>p_event_id then raise exception'trial_scope_event_immutable';end if;
 -- Disabling/revocation must remain possible after completion/source changes.
 if p_writes_enabled and(not exists(select 1 from app.tournaments where id=p_tournament_id and name like'TEST ONLY%'and status='open')
 or(select count(*)from app.events where tournament_id=p_tournament_id)<>1
 or not exists(select 1 from app.events e join app.tournament_setup_activations a on a.event_id=e.id and a.tournament_id=e.tournament_id
 join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id
 where e.tournament_id=p_tournament_id and e.id=p_event_id and e.event_type='main'and e.operational_state='active'
 and e.format='standard_singles'and s.event_kind='main'and s.style_code='Standard'and s.game_count=12))then raise exception'trial_scope_event_not_supported';end if;
 insert into app.reviewed_seating_trial_scope_versions_v1(tournament_id,event_id,version,official_ids,writes_enabled,expires_at,
 reviewed_by,authorization_reference,operation_id,request)values(p_tournament_id,p_event_id,v+1,p_official_ids,p_writes_enabled,p_expires_at,
 p_reviewed_by,p_authorization_reference,p_operation_id,req)returning *into previous;
 return jsonb_build_object('status','trial_scope_recorded','version',previous.version,'scopeVersionId',previous.id);
end$$;

-- Called only AFTER the SAME scope advisory lock was acquired by each wrapper.
-- This function is volatile intentionally: current role/clock are rechecked.
create function app.reviewed_seating_trial_permitted_v1(p_actor_id uuid,p_tournament_id uuid,p_write boolean)
returns boolean language plpgsql volatile security definer set search_path=''as $$
declare s app.reviewed_seating_trial_scope_versions_v1%rowtype;begin
 if current_setting('transaction_isolation')<>'read committed'then return false;end if;
 if p_actor_id is null or p_tournament_id is null or not exists(select 1 from app.reviewed_seating_trial_deployments_v1 where project_ref='nnhcnvksxgxnpvdqjgpg')then return false;end if;
 select *into s from app.reviewed_seating_trial_scope_versions_v1 where tournament_id=p_tournament_id order by version desc limit 1;
 if not found or not(p_actor_id=any(s.official_ids))then return false;end if;
 perform 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id
 and r.role in('director','co_director')order by r.role for key share;
 if not found then return false;end if;
 if not p_write then return true;end if;
 return s.writes_enabled and s.expires_at>clock_timestamp()
 and exists(select 1 from app.tournaments where id=p_tournament_id and name like'TEST ONLY%'and status='open')
 and(select count(*)from app.events where tournament_id=p_tournament_id)=1
 and exists(select 1 from app.events e join app.tournament_setup_activations a on a.event_id=e.id and a.tournament_id=e.tournament_id
 join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id where e.id=s.event_id and e.tournament_id=p_tournament_id
 and e.event_type='main'and e.operational_state='active'and e.format='standard_singles'and v.event_kind='main'and v.style_code='Standard'and v.game_count=12);
end$$;

-- Existing general manual publish_initial_seating APIs are NOT revoked here.
-- These are replacement boundaries for the NEW reviewed publication only.
create or replace function public.publish_reviewed_initial_seating_v1(p_tournament_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();begin
 if actor is null or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'authenticated'then return null;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('reviewed-seating-trial:'||p_tournament_id::text,0))then return null;end if;
 if not app.reviewed_seating_trial_permitted_v1(actor,p_tournament_id,false)then return null;end if;
 if not app.reviewed_seating_trial_permitted_v1(actor,p_tournament_id,true)and not exists(select 1 from app.reviewed_initial_seating_publications_v1
 where actor_id=actor and tournament_id=p_tournament_id and operation_id=(p_request->>'idempotencyKey')::uuid and request=p_request)then return null;end if;
 return app.publish_reviewed_initial_seating_unverified_v1(p_tournament_id,p_request);
end$$;
create or replace function public.get_reviewed_initial_seating_operation_v1(p_tournament_id uuid,p_operation_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();begin
 if actor is null or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'authenticated'then return null;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('reviewed-seating-trial:'||p_tournament_id::text,0))then return null;end if;
 if not app.reviewed_seating_trial_permitted_v1(actor,p_tournament_id,false)then return null;end if;
 return app.get_reviewed_initial_seating_operation_unverified_v1(p_tournament_id,p_operation_id);
end$$;

create function public.get_trial_random_seating_workspace_v1(p_actor_id uuid,p_tournament_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('reviewed-seating-trial:'||p_tournament_id::text,0))then return null;end if;
 if not app.reviewed_seating_trial_permitted_v1(p_actor_id,p_tournament_id,false)then return null;end if;
 return public.get_random_seating_workspace_v1(p_actor_id,p_tournament_id);
end$$;

create function public.get_trial_random_seating_operation_v1(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('reviewed-seating-trial:'||p_tournament_id::text,0))then return null;end if;
 if not app.reviewed_seating_trial_permitted_v1(p_actor_id,p_tournament_id,false)then return null;end if;
 return public.get_random_seating_operation_v1(p_actor_id,p_tournament_id,p_operation_id);
end$$;

create function public.get_trial_random_seating_plan_v1(p_actor_id uuid,p_tournament_id uuid,p_plan_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('reviewed-seating-trial:'||p_tournament_id::text,0))then return null;end if;
 if not app.reviewed_seating_trial_permitted_v1(p_actor_id,p_tournament_id,false)then return null;end if;
 return public.get_random_seating_plan_v1(p_actor_id,p_tournament_id,p_plan_id);
end$$;

create function public.save_trial_random_seating_plan_v1(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('reviewed-seating-trial:'||p_tournament_id::text,0))then return null;end if;
 -- Reentrant old operation key FIRST, then tournament NOWAIT. Never wait
 -- on an old nonce while holding its tournament in the opposite order.
 if p_actor_id is null or p_operation_id is null then return null;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('random-seating-operation:'||p_actor_id::text||':'||p_operation_id::text,0))then return null;end if;
 begin
  perform 1 from app.tournaments where id=p_tournament_id for update nowait;
  if not found then return null;end if;
 exception when lock_not_available then return null;end;
 if not app.reviewed_seating_trial_permitted_v1(p_actor_id,p_tournament_id,false)then return null;end if;
 if not app.reviewed_seating_trial_permitted_v1(p_actor_id,p_tournament_id,true)and not exists(select 1 from app.random_seating_operations_v1 o
 join app.random_seating_outcomes_v1 r on r.actor_id=o.actor_id and r.operation_id=o.operation_id
 where o.actor_id=p_actor_id and o.tournament_id=p_tournament_id and o.operation_id=p_operation_id and o.operation_kind='plan'
 and o.request_hash=app.random_seating_hash_v1(jsonb_build_array('plan',p_tournament_id,p_request)))then return null;end if;
 return public.save_random_seating_plan_v1(p_actor_id,p_tournament_id,p_request,p_operation_id);
end$$;

create function public.draw_trial_random_seating_candidate_v1(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('reviewed-seating-trial:'||p_tournament_id::text,0))then return null;end if;
 -- Reentrant old operation key FIRST, then tournament NOWAIT. Never wait
 -- on an old nonce while holding its tournament in the opposite order.
 if p_actor_id is null or p_operation_id is null then return null;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('random-seating-operation:'||p_actor_id::text||':'||p_operation_id::text,0))then return null;end if;
 begin
  perform 1 from app.tournaments where id=p_tournament_id for update nowait;
  if not found then return null;end if;
 exception when lock_not_available then return null;end;
 if not app.reviewed_seating_trial_permitted_v1(p_actor_id,p_tournament_id,false)then return null;end if;
 if not app.reviewed_seating_trial_permitted_v1(p_actor_id,p_tournament_id,true)and not exists(select 1 from app.random_seating_operations_v1 o
 join app.random_seating_outcomes_v1 r on r.actor_id=o.actor_id and r.operation_id=o.operation_id
 where o.actor_id=p_actor_id and o.tournament_id=p_tournament_id and o.operation_id=p_operation_id and o.operation_kind='draw'
 and o.request_hash=app.random_seating_hash_v1(jsonb_build_array('draw',p_tournament_id,p_request)))then return null;end if;
 return public.draw_random_seating_candidate_v1(p_actor_id,p_tournament_id,p_request,p_operation_id);
end$$;

revoke all on function app.authorize_reviewed_seating_trial_deployment_v1(text,text)from public,anon,authenticated,service_role;
revoke all on function app.record_reviewed_seating_trial_scope_v1(uuid,uuid,uuid,uuid[],integer,boolean,timestamptz,text,uuid)from public,anon,authenticated,service_role;
revoke all on function app.reviewed_seating_trial_permitted_v1(uuid,uuid,boolean)from public,anon,authenticated,service_role;
revoke all on function public.get_random_seating_workspace_v1(uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.get_random_seating_operation_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.get_random_seating_plan_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.save_random_seating_plan_v1(uuid,uuid,jsonb,uuid)from public,anon,authenticated,service_role;
revoke all on function public.draw_random_seating_candidate_v1(uuid,uuid,jsonb,uuid)from public,anon,authenticated,service_role;
revoke all on function public.get_trial_random_seating_workspace_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_trial_random_seating_workspace_v1(uuid,uuid)to service_role;
revoke all on function public.get_trial_random_seating_operation_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_trial_random_seating_operation_v1(uuid,uuid,uuid)to service_role;
revoke all on function public.get_trial_random_seating_plan_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_trial_random_seating_plan_v1(uuid,uuid,uuid)to service_role;
revoke all on function public.save_trial_random_seating_plan_v1(uuid,uuid,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.save_trial_random_seating_plan_v1(uuid,uuid,jsonb,uuid)to service_role;
revoke all on function public.draw_trial_random_seating_candidate_v1(uuid,uuid,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.draw_trial_random_seating_candidate_v1(uuid,uuid,jsonb,uuid)to service_role;
revoke all on function public.publish_reviewed_initial_seating_v1(uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.publish_reviewed_initial_seating_v1(uuid,jsonb)to authenticated;
revoke all on function public.get_reviewed_initial_seating_operation_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_reviewed_initial_seating_operation_v1(uuid,uuid)to authenticated;
commit;
