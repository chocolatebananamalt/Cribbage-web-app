-- UNEXECUTED, DEFAULT OFF. Signed-in tournament aggregate visibility only.
-- Private source models never receive player grants. No anonymous audience.
begin;
create function app.player_pool_totals_enabled_v1()returns boolean language sql stable set search_path=''as $gate$select false$gate$;
create table app.player_pool_visibility_versions_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,version integer not null check(version>0),
 prior_revision_id uuid,actor_id uuid not null references app.profiles(id),operation_id uuid not null,enabled boolean not null,
 request jsonb not null,request_hash text not null,reason text not null,created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,version),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(prior_revision_id,tournament_id,event_id)references app.player_pool_visibility_versions_v1(id,tournament_id,event_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('player-pool-visibility-v1',actor_id,tournament_id,event_id,operation_id,request)::text,'utf8'),'sha256'),'hex'))
);
alter table app.player_pool_visibility_versions_v1 owner to postgres;
alter table app.player_pool_visibility_versions_v1 enable row level security;
alter table app.player_pool_visibility_versions_v1 force row level security;
revoke all on app.player_pool_visibility_versions_v1 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.player_pool_visibility_versions_v1 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.player_pool_visibility_versions_v1 for each statement execute function app.reject_immutable_history();
create table app.player_pool_visibility_closures_v1(
 id uuid primary key default extensions.gen_random_uuid(),actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 request jsonb not null,request_hash text not null,observed_version integer not null check(observed_version>=0),created_at timestamptz not null default clock_timestamp(),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('player-pool-visibility-v1',actor_id,tournament_id,event_id,operation_id,request)::text,'utf8'),'sha256'),'hex'))
);
alter table app.player_pool_visibility_closures_v1 owner to postgres;
alter table app.player_pool_visibility_closures_v1 enable row level security;alter table app.player_pool_visibility_closures_v1 force row level security;
revoke all on app.player_pool_visibility_closures_v1 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.player_pool_visibility_closures_v1 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.player_pool_visibility_closures_v1 for each statement execute function app.reject_immutable_history();
create function app.player_pool_visibility_closure_v1(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql stable security definer set search_path=''as $closure$
declare c app.player_pool_visibility_closures_v1%rowtype;begin select*into c from app.player_pool_visibility_closures_v1 where actor_id=actor and operation_id=op;if not found then return null;end if;
 if c.tournament_id<>tid or c.event_id<>eid or c.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 return jsonb_build_object('status','visibility_request_closed','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'closureId',c.id,'observedVersion',c.observed_version,'code','stale_version','historicalReceipt',true,'currentVisibilityVerified',false);
end$closure$;
create function app.guard_player_pool_visibility_nonce_v1()returns trigger language plpgsql security definer set search_path=''as $nonce$
begin if not pg_try_advisory_xact_lock(hashtextextended('player-pool-visibility:'||new.actor_id::text||':'||new.operation_id::text,0))then raise lock_not_available;end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if tg_table_name='player_pool_visibility_versions_v1'then
  if exists(select 1 from app.player_pool_visibility_closures_v1 where actor_id=new.actor_id and operation_id=new.operation_id)then raise exception'visibility_operation_closed';end if;
 elsif exists(select 1 from app.player_pool_visibility_versions_v1 where actor_id=new.actor_id and operation_id=new.operation_id)then raise exception'visibility_operation_already_recorded';end if;return new;end$nonce$;
create trigger visibility_nonce before insert on app.player_pool_visibility_versions_v1 for each row execute function app.guard_player_pool_visibility_nonce_v1();
create trigger visibility_nonce before insert on app.player_pool_visibility_closures_v1 for each row execute function app.guard_player_pool_visibility_nonce_v1();
create function public.set_player_pool_visibility_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $write$
declare actor uuid:=auth.uid();head app.player_pool_visibility_versions_v1%rowtype;prior app.player_pool_visibility_versions_v1%rowtype;h text;rid uuid;ver integer;closed jsonb;begin
 if app.player_pool_totals_enabled_v1()is distinct from true then return null;end if;
 if actor is null or tid is null or eid is null or op is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(request)is distinct from'object'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if(select count(*)from jsonb_object_keys(request))<>4 or not(request?&array['expectedVersion','enabled','reason','disclosureReviewed'])or jsonb_typeof(request->'enabled')is distinct from'boolean'or request->'disclosureReviewed'is distinct from'true'::jsonb
  or jsonb_typeof(request->'expectedVersion')is distinct from'number'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,9})$'or jsonb_typeof(request->'reason')is distinct from'string'
  or request->>'reason'is distinct from trim(request->>'reason')or length(request->>'reason')not between 1 and 2000 or(request->>'reason')~'[[:cntrl:]]'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if(request->>'expectedVersion')::numeric>=2147483647 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('player-pool-visibility:'||actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('player-pool-visibility-v1',actor,tid,eid,op,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.player_pool_visibility_versions_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  return jsonb_build_object('status','visibility_recorded','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'revisionId',prior.id,'version',prior.version,'enabled',prior.enabled,'historicalReceipt',true,'currentVisibilityVerified',false);end if;
 closed:=app.player_pool_visibility_closure_v1(actor,tid,eid,op,request);if closed is not null then return closed;end if;
 if not exists(select 1 from app.events e join app.tournament_setup_activations a on a.event_id=e.id and a.tournament_id=e.tournament_id where e.id=eid and e.tournament_id=tid and e.operational_state='active')then return jsonb_build_object('status','rejected','code','active_event_required');end if;
 select*into head from app.player_pool_visibility_versions_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(head.version,0)<>(request->>'expectedVersion')::integer then return jsonb_build_object('status','rejected','code','stale_version');end if;
 rid:=extensions.gen_random_uuid();ver:=coalesce(head.version,0)+1;
 insert into app.player_pool_visibility_versions_v1(id,tournament_id,event_id,version,prior_revision_id,actor_id,operation_id,enabled,request,request_hash,reason)values(rid,tid,eid,ver,head.id,actor,op,(request->>'enabled')::boolean,request,h,request->>'reason');
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'player_pool_visibility_v1',rid,case when(request->>'enabled')::boolean then'enabled'else'withdrawn'end,jsonb_build_object('eventId',eid,'version',ver,'enabled',request->'enabled'));
 return jsonb_build_object('status','visibility_recorded','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'revisionId',rid,'version',ver,'enabled',request->'enabled','historicalReceipt',true,'currentVisibilityVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$write$;
create function public.get_player_pool_visibility_v1(tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $settings$
declare actor uuid:=auth.uid();h app.player_pool_visibility_versions_v1%rowtype;begin
 if app.player_pool_totals_enabled_v1()is distinct from true or actor is null or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director')then return null;end if;
 if not exists(select 1 from app.events where id=eid and tournament_id=tid and operational_state='active')then return null;end if;
 select*into h from app.player_pool_visibility_versions_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 return jsonb_build_object('kind','player-pool-visibility-settings-v1','tournamentId',tid,'eventId',eid,'version',coalesce(h.version,0),'enabled',coalesce(h.enabled,false));end$settings$;
-- Explicit, revocable aggregate-processing delegation from the actual Director
create function public.get_player_pool_visibility_operation_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $operation$
declare actor uuid:=auth.uid();r app.player_pool_visibility_versions_v1%rowtype;begin
 if app.player_pool_totals_enabled_v1()is distinct from true or actor is null or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director')then return null;end if;
 select*into r from app.player_pool_visibility_versions_v1 where actor_id=actor and operation_id=op;
 if not found then return coalesce(app.player_pool_visibility_closure_v1(actor,tid,eid,op,request),jsonb_build_object('status','unknown'));end if;
 if r.tournament_id<>tid or r.event_id<>eid or r.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 return jsonb_build_object('status','visibility_recorded','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'revisionId',r.id,'version',r.version,'enabled',r.enabled,'historicalReceipt',true,'currentVisibilityVerified',false);
end$operation$;
create function public.close_stale_player_pool_visibility_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $close$
declare actor uuid:=auth.uid();head app.player_pool_visibility_versions_v1%rowtype;r jsonb;h text;begin
 if app.player_pool_totals_enabled_v1()is distinct from true or actor is null or op is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(request)is distinct from'object'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if(select count(*)from jsonb_object_keys(request))<>4 or not(request?&array['expectedVersion','enabled','reason','disclosureReviewed'])or jsonb_typeof(request->'expectedVersion')is distinct from'number'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,9})$'or request->'disclosureReviewed'is distinct from'true'::jsonb or jsonb_typeof(request->'enabled')is distinct from'boolean'or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'is distinct from trim(request->>'reason')or length(request->>'reason')not between 1 and 2000 or(request->>'reason')~'[[:cntrl:]]'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if(request->>'expectedVersion')::numeric>=2147483647 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('player-pool-visibility:'||actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 r:=public.get_player_pool_visibility_operation_v1(tid,eid,op,request);if r->>'status'is distinct from'unknown'then return r;end if;
 select*into head from app.player_pool_visibility_versions_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(head.version,0)=(request->>'expectedVersion')::integer then return jsonb_build_object('status','retry_exact','code','request_not_superseded');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('player-pool-visibility-v1',actor,tid,eid,op,request)::text,'utf8'),'sha256'),'hex');
 insert into app.player_pool_visibility_closures_v1(actor_id,operation_id,tournament_id,event_id,request,request_hash,observed_version)values(actor,op,tid,eid,request,h,coalesce(head.version,0));
 r:=app.player_pool_visibility_closure_v1(actor,tid,eid,op,request);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'player_pool_visibility_v1',(r->>'closureId')::uuid,'stale_request_closed',r);return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$close$;
-- Explicit, revocable aggregate-processing delegation from the actual Director
-- who enabled this event. No caller-supplied publisher and no identity/JWT change.
create function app.player_pool_read_context_v1(viewer uuid,tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $context$
declare h app.player_pool_visibility_versions_v1%rowtype;begin
 if app.player_pool_totals_enabled_v1()is distinct from true or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles_effective where tournament_id=tid and profile_id=viewer and role in('viewer','player','cross_checker','director','co_director'))then return null;end if;
 if not exists(select 1 from app.events e join app.tournament_setup_activations a on a.event_id=e.id and a.tournament_id=e.tournament_id where e.id=eid and e.tournament_id=tid and e.operational_state='active'and e.format='standard_singles')then return null;end if;
 select*into h from app.player_pool_visibility_versions_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if h.id is null or not h.enabled or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=h.actor_id and role='director')then return null;end if;
 return jsonb_build_object('kind','player-pool-read-context-v1','projectionVersion','player-pool-totals-v1','viewerActorId',viewer,'tournamentId',tid,'eventId',eid,'visibilityRevisionId',h.id,'visibilityVersion',h.version,'publisherActorId',h.actor_id);
end$context$;
create function public.get_player_pool_models_provider_v1(viewer uuid,tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $models$
declare c jsonb;publisher uuid;q jsonb;side_data jsonb;side_pools jsonb;begin
 c:=app.player_pool_read_context_v1(viewer,tid,eid);if c is null then return null;end if;
 publisher:=(c->>'publisherActorId')::uuid;
 q:=public.get_q_operating_workspace_v2(publisher,tid);
 if q#>>'{membership,eventId}'is distinct from eid::text then q:=null;end if;
 side_data:=public.get_side_pool_graduated_workspace_v2(publisher,tid);
 if exists(select 1 from jsonb_array_elements(side_data->'pools')p where p->>'eventId'=eid::text and not exists(
  select 1 from app.event_side_pool_definition_versions d where d.id=(p->>'definitionId')::uuid and d.pool_id=(p->>'poolId')::uuid and d.tournament_id=tid and d.event_id=eid
   and not exists(select 1 from app.event_side_pool_definition_versions newer where newer.pool_id=d.pool_id and newer.tournament_id=tid and newer.event_id=eid and newer.version>d.version)))then side_data:=null;
 else
  select coalesce(jsonb_agg(p),'[]'::jsonb)into side_pools from jsonb_array_elements(side_data->'pools')p where p->>'eventId'=eid::text and exists(
   select 1 from app.event_side_pool_definition_versions d where d.id=(p->>'definitionId')::uuid and d.tournament_id=tid and d.event_id=eid and d.active);
  side_data:=jsonb_set(side_data,'{pools}',side_pools);
 end if;
 return jsonb_build_object('context',c,'qOperating',q,'side',side_data);
end$models$;
do $security$declare f text;begin foreach f in array array['app.player_pool_totals_enabled_v1()','app.player_pool_visibility_closure_v1(uuid,uuid,uuid,uuid,jsonb)','app.guard_player_pool_visibility_nonce_v1()','public.close_stale_player_pool_visibility_v1(uuid,uuid,uuid,jsonb)','public.set_player_pool_visibility_v1(uuid,uuid,uuid,jsonb)','public.get_player_pool_visibility_v1(uuid,uuid)','public.get_player_pool_visibility_operation_v1(uuid,uuid,uuid,jsonb)','app.player_pool_read_context_v1(uuid,uuid,uuid)','public.get_player_pool_models_provider_v1(uuid,uuid,uuid)']loop
 execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;end$security$;
commit;
