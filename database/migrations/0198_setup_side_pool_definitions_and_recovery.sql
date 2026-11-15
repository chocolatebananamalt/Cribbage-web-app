-- Versioned setup Side Pools. Q Pools remain a separate two-pool Main/Consolation
-- construct; these definitions become the existing operational Side Pools only
-- after their event is activated.

create table app.tournament_setup_side_pool_versions(
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  setup_revision_id uuid not null,
  setup_event_version_id uuid not null,
  slot smallint not null check(slot between 1 and 6),
  pool_type_code text not null check(length(trim(pool_type_code)) between 1 and 160),
  entry_fee_cents integer not null check(entry_fee_cents between 0 and 100000000),
  note text not null default '' check(length(note)<=1000),
  source_status text not null default 'director_configured_unverified' check(source_status='director_configured_unverified'),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(setup_event_version_id,slot),
  unique(id,tournament_id),
  unique(id,tournament_id,setup_revision_id,setup_event_version_id),
  foreign key(setup_revision_id,tournament_id) references app.tournament_setup_revisions(id,tournament_id) on delete restrict,
  foreign key(setup_event_version_id,tournament_id,setup_revision_id) references app.tournament_setup_event_versions(id,tournament_id,setup_revision_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict
);
alter table app.tournament_setup_side_pool_versions enable row level security;
alter table app.tournament_setup_side_pool_versions force row level security;
revoke all on table app.tournament_setup_side_pool_versions from public,anon,authenticated;
create trigger tournament_setup_side_pool_versions_immutable before update or delete on app.tournament_setup_side_pool_versions for each row execute function app.reject_immutable_history();
create unique index tournament_setup_side_pool_normalized_name_idx on app.tournament_setup_side_pool_versions(setup_event_version_id,lower(trim(pool_type_code)));

create table app.tournament_setup_side_pool_materializations(
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  setup_side_pool_version_id uuid not null,
  event_id uuid not null,
  pool_id uuid not null,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(setup_side_pool_version_id),unique(pool_id),
  foreign key(setup_side_pool_version_id,tournament_id) references app.tournament_setup_side_pool_versions(id,tournament_id) on delete restrict,
  foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
  foreign key(pool_id,tournament_id,event_id) references app.event_side_pools(id,tournament_id,event_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict
);
alter table app.tournament_setup_side_pool_materializations enable row level security;
alter table app.tournament_setup_side_pool_materializations force row level security;
revoke all on table app.tournament_setup_side_pool_materializations from public,anon,authenticated;
create trigger tournament_setup_side_pool_materializations_immutable before update or delete on app.tournament_setup_side_pool_materializations for each row execute function app.reject_immutable_history();

create or replace function app.validate_setup_side_pools_v1(p_events jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_event jsonb;v_pool jsonb;v_kind text;v_ids uuid[]:='{}';v_names text[]:='{}';v_count integer;
begin
  if coalesce(jsonb_typeof(p_events),'')<>'array' then raise exception using errcode='P0001',message='invalid side pools';end if;
  for v_event in select value from jsonb_array_elements(p_events) loop
    if coalesce(jsonb_typeof(v_event),'')<>'object' or not(v_event ?& array['clientRowId','eventKind','sidePools']) or jsonb_typeof(v_event->'clientRowId')<>'string' or jsonb_typeof(v_event->'eventKind')<>'string' or jsonb_typeof(v_event->'sidePools')<>'array' then raise exception using errcode='P0001',message='invalid side pools';end if;
    v_kind:=v_event->>'eventKind';
    if v_kind not in('main','consolation','satellite','custom') then raise exception using errcode='P0001',message='invalid side pools';end if;
    v_ids:=array_append(v_ids,app.parse_setup_uuid(v_event->>'clientRowId'));
    v_count:=jsonb_array_length(v_event->'sidePools');
    if v_count>6 or (v_kind='custom' and v_count<>0) then raise exception using errcode='P0001',message='invalid side pools';end if;
    v_names:='{}';
    for v_pool in select value from jsonb_array_elements(v_event->'sidePools') loop
      perform app.assert_setup_object_keys(v_pool,array['poolTypeCode','entryFeeCents','note']);
      if not(v_pool ?& array['poolTypeCode','entryFeeCents','note']) or jsonb_typeof(v_pool->'poolTypeCode')<>'string' or jsonb_typeof(v_pool->'entryFeeCents')<>'number' or jsonb_typeof(v_pool->'note')<>'string' or length(trim(v_pool->>'poolTypeCode')) not between 1 and 160 or (v_pool->>'entryFeeCents') !~ '^(0|[1-9][0-9]*)$' or (v_pool->>'entryFeeCents')::numeric>100000000 or length(v_pool->>'note')>1000 then raise exception using errcode='P0001',message='invalid side pools';end if;
      if lower(trim(v_pool->>'poolTypeCode'))=any(v_names) then raise exception using errcode='P0001',message='duplicate side pool';end if;
      v_names:=array_append(v_names,lower(trim(v_pool->>'poolTypeCode')));
    end loop;
  end loop;
  if cardinality(v_ids)<>(select count(*) from (select distinct value from unnest(v_ids) value) distinct_ids) then raise exception using errcode='P0001',message='invalid side pools';end if;
end $$;
revoke all on function app.validate_setup_side_pools_v1(jsonb) from public,anon,authenticated;

create function public.configure_tournament_setup_side_pools_v1(p_actor_id uuid,p_tournament_id uuid,p_setup_revision_id uuid,p_events jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_revision app.tournament_setup_revisions%rowtype;v_receipt uuid;v_event jsonb;v_pool jsonb;v_setup_event app.tournament_setup_event_versions%rowtype;v_previous_setup_event_id uuid;v_slot integer;v_expected integer;v_existing integer;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_tournament_id is null or p_setup_revision_id is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  begin perform app.validate_setup_side_pools_v1(p_events);exception when sqlstate 'P0001' then return jsonb_build_object('status','rejected','code',case when sqlerrm='duplicate side pool' then 'duplicate_side_pool_name' else 'invalid_side_pool' end);end;
  select * into v_revision from app.tournament_setup_revisions where id=p_setup_revision_id and tournament_id=p_tournament_id for update;if not found then return jsonb_build_object('status','rejected','code','stale_setup_revision');end if;
  if exists(select 1 from app.tournament_setup_activations where tournament_id=p_tournament_id and setup_revision_id=p_setup_revision_id) then return jsonb_build_object('status','rejected','code','setup_lifecycle_closed');end if;
  select count(*) into v_existing from app.tournament_setup_side_pool_versions where tournament_id=p_tournament_id and setup_revision_id=p_setup_revision_id;
  if v_existing>0 then
    -- A setup revision is immutable. A retry can only return its already-bound
    -- configuration; a different configuration requires a fresh setup revision.
    return jsonb_build_object('status','setup_side_pools_configured','setupRevisionId',p_setup_revision_id,'poolCount',v_existing);
  end if;
  v_receipt:=v_revision.operation_receipt_id;
  -- Appended setup revisions carry forward the prior configuration for every
  -- unchanged event. The caller supplies only the newly appended event cards.
  for v_setup_event in select * from app.tournament_setup_event_versions current_event where current_event.tournament_id=p_tournament_id and current_event.setup_revision_id=p_setup_revision_id and not exists(select 1 from jsonb_array_elements(p_events) supplied where supplied->>'clientRowId'=current_event.client_row_id::text) loop
    select prior_event.id into v_previous_setup_event_id from app.tournament_setup_event_versions prior_event join app.tournament_setup_revisions prior_revision on prior_revision.id=prior_event.setup_revision_id where prior_event.tournament_id=p_tournament_id and prior_event.client_row_id=v_setup_event.client_row_id and prior_revision.version<v_revision.version order by prior_revision.version desc limit 1;
    if found then
      insert into app.tournament_setup_side_pool_versions(tournament_id,setup_revision_id,setup_event_version_id,slot,pool_type_code,entry_fee_cents,note,actor_profile_id,operation_receipt_id)
      select p_tournament_id,p_setup_revision_id,v_setup_event.id,pool.slot,pool.pool_type_code,pool.entry_fee_cents,pool.note,p_actor_id,v_receipt from app.tournament_setup_side_pool_versions pool where pool.setup_event_version_id=v_previous_setup_event_id;
    end if;
  end loop;
  for v_event in select value from jsonb_array_elements(p_events) loop
    select * into v_setup_event from app.tournament_setup_event_versions where tournament_id=p_tournament_id and setup_revision_id=p_setup_revision_id and client_row_id=app.parse_setup_uuid(v_event->>'clientRowId');if not found or v_setup_event.event_kind<>v_event->>'eventKind' then return jsonb_build_object('status','rejected','code','invalid_side_pool');end if;
    v_slot:=0;
    for v_pool in select value from jsonb_array_elements(v_event->'sidePools') loop
      v_slot:=v_slot+1;
      insert into app.tournament_setup_side_pool_versions(tournament_id,setup_revision_id,setup_event_version_id,slot,pool_type_code,entry_fee_cents,note,actor_profile_id,operation_receipt_id) values(p_tournament_id,p_setup_revision_id,v_setup_event.id,v_slot,trim(v_pool->>'poolTypeCode'),(v_pool->>'entryFeeCents')::integer,v_pool->>'note',p_actor_id,v_receipt);
    end loop;
  end loop;
  select count(*) into v_expected from app.tournament_setup_side_pool_versions where tournament_id=p_tournament_id and setup_revision_id=p_setup_revision_id;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'tournament_setup_side_pools',p_setup_revision_id,'tournament_setup_side_pools_configured',jsonb_build_object('poolCount',v_expected));
  return jsonb_build_object('status','setup_side_pools_configured','setupRevisionId',p_setup_revision_id,'poolCount',v_expected);
end $$;
revoke all on function public.configure_tournament_setup_side_pools_v1(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.configure_tournament_setup_side_pools_v1(uuid,uuid,uuid,jsonb) to service_role;

create function public.materialize_tournament_setup_side_pools_v1(p_actor_id uuid,p_tournament_id uuid,p_setup_revision_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row record;v_pool_id uuid;v_receipt uuid;v_created integer:=0;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_tournament_id is null or p_setup_revision_id is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  select operation_receipt_id into v_receipt from app.tournament_setup_revisions where id=p_setup_revision_id and tournament_id=p_tournament_id;if not found then return jsonb_build_object('status','rejected','code','stale_setup_revision');end if;
  for v_row in select configuration.*,activation.event_id from app.tournament_setup_side_pool_versions configuration join app.tournament_setup_activations activation on activation.setup_event_version_id=configuration.setup_event_version_id and activation.tournament_id=configuration.tournament_id and activation.setup_revision_id=p_setup_revision_id left join app.tournament_setup_side_pool_materializations done on done.setup_side_pool_version_id=configuration.id where configuration.tournament_id=p_tournament_id and configuration.setup_revision_id=p_setup_revision_id and done.id is null order by configuration.setup_event_version_id,configuration.slot loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('side-pools:'||v_row.event_id::text,0));
    if exists(select 1 from app.event_side_pool_definition_versions definition where definition.event_id=v_row.event_id and definition.active and lower(trim(definition.display_name))=lower(trim(v_row.pool_type_code))) then return jsonb_build_object('status','rejected','code','duplicate_pool_name');end if;
    if (select count(*) from (select distinct on(definition.pool_id) definition.* from app.event_side_pool_definition_versions definition where definition.event_id=v_row.event_id order by definition.pool_id,definition.version desc) current where current.active)>=6 then return jsonb_build_object('status','rejected','code','side_pool_limit');end if;
    v_pool_id:=extensions.gen_random_uuid();
    insert into app.event_side_pools(id,tournament_id,event_id) values(v_pool_id,p_tournament_id,v_row.event_id);
    insert into app.event_side_pool_definition_versions(pool_id,tournament_id,event_id,version,category_code,display_name,entry_fee_minor,active,actor_profile_id,operation_receipt_id) values(v_pool_id,p_tournament_id,v_row.event_id,1,v_row.pool_type_code,v_row.pool_type_code,v_row.entry_fee_cents,true,p_actor_id,v_receipt);
    insert into app.tournament_setup_side_pool_materializations(tournament_id,setup_side_pool_version_id,event_id,pool_id,operation_receipt_id) values(p_tournament_id,v_row.id,v_row.event_id,v_pool_id,v_receipt);
    v_created:=v_created+1;
  end loop;
  if v_created>0 then insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'tournament_setup_side_pools',p_setup_revision_id,'tournament_setup_side_pools_materialized',jsonb_build_object('poolCount',v_created));end if;
  return jsonb_build_object('status','setup_side_pools_materialized','setupRevisionId',p_setup_revision_id,'poolCount',v_created);
end $$;
revoke all on function public.materialize_tournament_setup_side_pools_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.materialize_tournament_setup_side_pools_v1(uuid,uuid,uuid) to service_role;

alter function public.get_tournament_setup_workspace(uuid) rename to get_tournament_setup_workspace_sanctioning_rates;
create function public.get_tournament_setup_workspace(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb;v_current jsonb;v_event jsonb;v_events jsonb:='[]'::jsonb;v_pools jsonb;v_setup_event_id uuid;
begin
  v_base:=public.get_tournament_setup_workspace_sanctioning_rates(p_tournament_id);if v_base is null or v_base->'current'='null'::jsonb then return v_base;end if;
  v_current:=v_base->'current';
  for v_event in select value from jsonb_array_elements(v_current->'events') loop
    select id into v_setup_event_id from app.tournament_setup_event_versions where tournament_id=p_tournament_id and setup_revision_id=(v_current->>'revisionId')::uuid and client_row_id=(v_event->>'clientRowId')::uuid;
    select coalesce(jsonb_agg(jsonb_build_object('slot',pool.slot,'poolTypeCode',pool.pool_type_code,'entryFeeCents',pool.entry_fee_cents,'note',pool.note,'sourceStatus',pool.source_status) order by pool.slot),'[]'::jsonb) into v_pools from app.tournament_setup_side_pool_versions pool where pool.setup_event_version_id=v_setup_event_id;
    v_events:=v_events||jsonb_build_array(v_event||jsonb_build_object('sidePools',v_pools));
  end loop;
  return jsonb_set(v_base,'{current,events}',v_events,false);
end $$;
revoke all on function public.get_tournament_setup_workspace_sanctioning_rates(uuid) from public,anon,authenticated;
revoke all on function public.get_tournament_setup_workspace(uuid) from public,anon;
grant execute on function public.get_tournament_setup_workspace(uuid) to authenticated;

notify pgrst,'reload schema';
