-- LOCAL ONLY. Add explicit, versioned Side Pool setup intent while preserving
-- historical definitions. Intent is not an election, frozen policy or receipt.
begin;

create table app.side_pool_setup_type_rollout_v1(installed_at timestamptz not null);
insert into app.side_pool_setup_type_rollout_v1 values (clock_timestamp());
alter table app.side_pool_setup_type_rollout_v1 enable row level security;
alter table app.side_pool_setup_type_rollout_v1 force row level security;
revoke all on app.side_pool_setup_type_rollout_v1 from public, anon, authenticated, service_role;
create function public.get_side_pool_setup_type_capability_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when coalesce(auth.role(),'')='service_role' and exists(
  select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in ('director','co_director'))
  then jsonb_build_object('status','available','version',1) else null end;
$$;
revoke all on function public.get_side_pool_setup_type_capability_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_side_pool_setup_type_capability_v1(uuid,uuid) to service_role;

-- Reserve the complete request BEFORE the core setup transaction strips Side
-- definitions. Only its digests are stored; the browser retains the request.
create table app.side_pool_setup_request_bindings_v1(
 actor_id uuid not null references app.profiles(id), tournament_id uuid not null references app.tournaments(id),
 operation_id uuid not null, operation_kind text not null check(operation_kind in ('setup','amendment')),
 request_hash text not null, events_hash text not null, created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id)
);
alter table app.side_pool_setup_request_bindings_v1 enable row level security;
alter table app.side_pool_setup_request_bindings_v1 force row level security;
revoke all on app.side_pool_setup_request_bindings_v1 from public,anon,authenticated,service_role;
create trigger side_pool_setup_request_bindings_immutable before update or delete on app.side_pool_setup_request_bindings_v1
 for each row execute function app.reject_immutable_history();
create function public.bind_side_pool_setup_request_v1(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid,p_kind text,p_request jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare events jsonb; h text; eh text; prior app.side_pool_setup_request_bindings_v1%rowtype; receipt app.operation_receipts%rowtype; revision_created timestamptz;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_tournament_id is null or p_operation_id is null or coalesce(p_kind,'') not in ('setup','amendment') or jsonb_typeof(p_request) is distinct from 'object' then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
 events:=case when p_kind='setup' then p_request->'payload'->'events' else p_request->'events' end;
 if jsonb_typeof(events) is distinct from 'array' or (case when p_kind='setup' then p_request->>'idempotencyKey' else p_request->>'operationId' end) is distinct from p_operation_id::text then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform 1 from app.tournaments where id=p_tournament_id for update;
 if not found or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in ('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director'); end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(p_kind,p_tournament_id,p_request)::text,'utf8'),'sha256'),'hex');
 eh:=encode(extensions.digest(convert_to(events::text,'utf8'),'sha256'),'hex');
 select * into prior from app.side_pool_setup_request_bindings_v1 where actor_id=p_actor_id and operation_id=p_operation_id;
 if found then
  if prior.tournament_id=p_tournament_id and prior.operation_kind=p_kind and prior.request_hash=h and prior.events_hash=eh then return jsonb_build_object('status','bound'); end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 select * into receipt from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if receipt.tournament_id is distinct from p_tournament_id or receipt.outcome is distinct from 'accepted' or receipt.operation_type is distinct from (case when p_kind='setup' then 'save_tournament_setup_version' else 'append_tournament_setup_events_v1' end) then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
  select created_at into revision_created from app.tournament_setup_revisions where tournament_id=p_tournament_id and id::text=(case when p_kind='setup' then receipt.response_payload->>'revisionId' else receipt.response_payload->>'setupRevisionId' end);
  if revision_created is not null and revision_created<(select installed_at from app.side_pool_setup_type_rollout_v1 limit 1) then return jsonb_build_object('status','legacy_unbound'); end if;
  return jsonb_build_object('status','rejected','code','unbound_prior_operation');
 end if;
 insert into app.side_pool_setup_request_bindings_v1(actor_id,tournament_id,operation_id,operation_kind,request_hash,events_hash)
 values(p_actor_id,p_tournament_id,p_operation_id,p_kind,h,eh);
 return jsonb_build_object('status','bound');
end $$;
revoke all on function public.bind_side_pool_setup_request_v1(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.bind_side_pool_setup_request_v1(uuid,uuid,uuid,text,jsonb) to service_role;

alter table app.tournament_setup_side_pool_versions add column payout_type text
  check (payout_type is null or payout_type in ('graduated-1-in-4','graduated-1-in-6','graduated-1-in-8','graduated-1-in-10'));

-- The original writer's immutable rows remain the authority. The wrapper
-- supplies an actor-scoped request map for this transaction only; amendment
-- copy-forward inherits the prior intent without reinterpreting a legacy name.
create function app.set_side_pool_setup_type_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_id uuid; current_kind text; current_format text; current_style text; previous text; supplied jsonb; map jsonb;
begin
 select client_row_id,event_kind,format_code,style_code into row_id,current_kind,current_format,current_style from app.tournament_setup_event_versions
  where id=new.setup_event_version_id and tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 if row_id is null then raise exception 'invalid side pool event'; end if;
 map:=coalesce(nullif(current_setting('app.side_pool_setup_type_map_v1',true),'')::jsonb,'{}'::jsonb);
 supplied:=map->(row_id::text||':'||new.slot::text);
 if supplied is not null then
  if jsonb_typeof(supplied)<>'string' or supplied#>>'{}' not in ('graduated-1-in-4','graduated-1-in-6','graduated-1-in-8','graduated-1-in-10') then raise exception 'invalid side pool payout type'; end if;
  new.payout_type:=supplied#>>'{}';
 else
  select prior_pool.payout_type into previous from app.tournament_setup_side_pool_versions prior_pool
   join app.tournament_setup_event_versions prior_event on prior_event.id=prior_pool.setup_event_version_id
   join app.tournament_setup_revisions prior_revision on prior_revision.id=prior_event.setup_revision_id
   join app.tournament_setup_revisions current_revision on current_revision.id=new.setup_revision_id
   where prior_pool.tournament_id=new.tournament_id and prior_event.client_row_id=row_id and prior_event.event_kind=current_kind and prior_event.format_code=current_format and prior_event.style_code=current_style
    and prior_revision.version<current_revision.version and prior_pool.slot=new.slot
    and prior_pool.pool_type_code=new.pool_type_code and prior_pool.entry_fee_cents=new.entry_fee_cents and prior_pool.note=new.note
   order by prior_revision.version desc limit 1;
  new.payout_type:=previous;
 end if;
 return new;
end $$;
revoke all on function app.set_side_pool_setup_type_v1() from public,anon,authenticated,service_role;
create trigger side_pool_setup_type_v1 before insert on app.tournament_setup_side_pool_versions
 for each row execute function app.set_side_pool_setup_type_v1();

alter function public.configure_tournament_setup_side_pools_v1(uuid,uuid,uuid,jsonb)
 rename to configure_tournament_setup_side_pools_before_type_v1;
revoke all on function public.configure_tournament_setup_side_pools_before_type_v1(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
create function public.configure_tournament_setup_side_pools_v1(p_actor_id uuid,p_tournament_id uuid,p_setup_revision_id uuid,p_events jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=p_actor_id; tid uuid:=p_tournament_id; rid uuid:=p_setup_revision_id; events jsonb:=p_events;
 rev app.tournament_setup_revisions%rowtype; ev jsonb; p jsonb; clean_events jsonb:='[]'::jsonb;
 clean_pools jsonb; type_map jsonb:='{}'::jsonb; s integer; expected record; prior text;
 old_setting text; result jsonb; existing_count integer; pre_rollout boolean; base_revision uuid; expected_count integer; v_event_format text; v_event_kind text; v_event_style text;
 core_receipt app.operation_receipts%rowtype; reservation app.side_pool_setup_request_bindings_v1%rowtype; incoming_count integer;
begin
 if coalesce(auth.role(),'')<>'service_role' or actor is null or tid is null or rid is null or jsonb_typeof(events) is distinct from 'array' then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
 -- Match activation and setup writers: tournament before role and revision.
 perform 1 from app.tournaments where id=tid for update;
 if not found then return jsonb_build_object('status','rejected','code','not_director'); end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in ('director','co_director') for update;
 if not found then return jsonb_build_object('status','rejected','code','not_director'); end if;
 select * into rev from app.tournament_setup_revisions where id=rid and tournament_id=tid for update;
 if not found then return jsonb_build_object('status','rejected','code','stale_setup_revision'); end if;
 select base_setup_revision_id into base_revision from app.tournament_setup_amendments where tournament_id=tid and setup_revision_id=rid;
 select count(*) into expected_count from app.tournament_setup_event_versions se
  where se.tournament_id=tid and se.setup_revision_id=rid and (base_revision is null or not exists(
   select 1 from app.tournament_setup_event_versions prior where prior.tournament_id=tid and prior.setup_revision_id=base_revision and prior.client_row_id=se.client_row_id));
 if jsonb_array_length(events)<>expected_count or (select count(distinct e->>'clientRowId') from jsonb_array_elements(events)e)<>expected_count
  or exists(select 1 from jsonb_array_elements(events)e where not exists(
   select 1 from app.tournament_setup_event_versions se where se.tournament_id=tid and se.setup_revision_id=rid and se.client_row_id::text=e->>'clientRowId' and se.event_kind=e->>'eventKind'
    and (base_revision is null or not exists(select 1 from app.tournament_setup_event_versions prior where prior.tournament_id=tid and prior.setup_revision_id=base_revision and prior.client_row_id=se.client_row_id))))
 then return jsonb_build_object('status','rejected','code','invalid_side_pool'); end if;
 select rev.created_at<installed_at into pre_rollout from app.side_pool_setup_type_rollout_v1 limit 1;
 select count(*) into existing_count from app.tournament_setup_side_pool_versions where tournament_id=tid and setup_revision_id=rid;
 select * into core_receipt from app.operation_receipts where id=rev.operation_receipt_id and tournament_id=tid and actor_profile_id=actor and outcome='accepted';
 if not found then return jsonb_build_object('status','rejected','code','invalid_side_pool'); end if;
 select * into reservation from app.side_pool_setup_request_bindings_v1 where actor_id=actor and operation_id=core_receipt.client_operation_id;
 if found then
  if reservation.tournament_id<>tid or reservation.operation_kind<>(case when base_revision is null then 'setup' else 'amendment' end)
   or reservation.events_hash<>encode(extensions.digest(convert_to(events::text,'utf8'),'sha256'),'hex') then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
 elsif not coalesce(pre_rollout,false) then return jsonb_build_object('status','rejected','code','unbound_prior_operation');
 else
  select coalesce(sum(jsonb_array_length(e->'sidePools')),0) into incoming_count from jsonb_array_elements(events)e where jsonb_typeof(e->'sidePools')='array';
  if existing_count=0 and incoming_count>0 then return jsonb_build_object('status','rejected','code','unbound_prior_operation'); end if;
 end if;
 for ev in select value from jsonb_array_elements(events) loop
  if jsonb_typeof(ev)<>'object' or jsonb_typeof(ev->'sidePools')<>'array' or coalesce(ev->>'clientRowId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return jsonb_build_object('status','rejected','code','invalid_side_pool'); end if;
  select se.format_code,se.event_kind,se.style_code into v_event_format,v_event_kind,v_event_style from app.tournament_setup_event_versions se where se.tournament_id=tid and se.setup_revision_id=rid and se.client_row_id::text=ev->>'clientRowId';
  clean_pools:='[]'::jsonb; s:=0;
  for p in select value from jsonb_array_elements(ev->'sidePools') loop
   s:=s+1;
   if jsonb_typeof(p)<>'object' or (p?'payoutType' and (jsonb_typeof(p->'payoutType')<>'string' or p->>'payoutType' not in ('graduated-1-in-4','graduated-1-in-6','graduated-1-in-8','graduated-1-in-10'))) then return jsonb_build_object('status','rejected','code','invalid_side_pool'); end if;
   if p?'payoutType' then
    if v_event_format is distinct from 'standard_singles' then return jsonb_build_object('status','rejected','code','invalid_side_pool'); end if;
    type_map:=type_map||jsonb_build_object((ev->>'clientRowId')||':'||s::text,p->'payoutType');
   elsif not coalesce(pre_rollout,false) and existing_count=0 then
    -- A previously accepted historical definition may be carried forward,
    -- but a newly created definition cannot omit its payout type.
    select prior_pool.payout_type into prior from app.tournament_setup_side_pool_versions prior_pool
     join app.tournament_setup_event_versions prior_event on prior_event.id=prior_pool.setup_event_version_id
     join app.tournament_setup_revisions previous_revision on previous_revision.id=prior_event.setup_revision_id
     where prior_pool.tournament_id=tid and prior_event.client_row_id::text=ev->>'clientRowId' and prior_event.event_kind=v_event_kind and prior_event.format_code=v_event_format and prior_event.style_code=v_event_style
      and previous_revision.version<rev.version and prior_pool.slot=s
      and prior_pool.pool_type_code=trim(p->>'poolTypeCode') and prior_pool.entry_fee_cents::text=p->>'entryFeeCents' and prior_pool.note=p->>'note'
     order by previous_revision.version desc limit 1;
    if not found or prior is not null then return jsonb_build_object('status','rejected','code','invalid_side_pool'); end if;
   end if;
   clean_pools:=clean_pools||jsonb_build_array(p-'payoutType');
  end loop;
  clean_events:=clean_events||jsonb_build_array(jsonb_set(ev,'{sidePools}',clean_pools,false));
 end loop;
 -- Retry cannot relabel, rename or change a completed immutable version.
 if existing_count>0 then
  for ev in select value from jsonb_array_elements(events) loop
   s:=0;
   for p in select value from jsonb_array_elements(ev->'sidePools') loop
    s:=s+1;
    select side.pool_type_code,side.entry_fee_cents,side.note,side.payout_type into expected
     from app.tournament_setup_side_pool_versions side join app.tournament_setup_event_versions setup_event on setup_event.id=side.setup_event_version_id
     where side.tournament_id=tid and side.setup_revision_id=rid and setup_event.client_row_id::text=ev->>'clientRowId' and side.slot=s;
    if not found or expected.pool_type_code is distinct from trim(p->>'poolTypeCode') or expected.entry_fee_cents::text is distinct from p->>'entryFeeCents' or expected.note is distinct from p->>'note' or expected.payout_type is distinct from p->>'payoutType' then return jsonb_build_object('status','rejected','code','invalid_side_pool'); end if;
   end loop;
   if (select count(*) from app.tournament_setup_side_pool_versions side join app.tournament_setup_event_versions se on se.id=side.setup_event_version_id where side.tournament_id=tid and side.setup_revision_id=rid and se.client_row_id::text=ev->>'clientRowId')<>s then return jsonb_build_object('status','rejected','code','invalid_side_pool'); end if;
  end loop;
 end if;
 old_setting:=current_setting('app.side_pool_setup_type_map_v1',true);
 perform set_config('app.side_pool_setup_type_map_v1',type_map::text,true);
 result:=public.configure_tournament_setup_side_pools_before_type_v1(actor,tid,rid,clean_events);
 perform set_config('app.side_pool_setup_type_map_v1',coalesce(old_setting,''),true);
 return result;
end $$;
revoke all on function public.configure_tournament_setup_side_pools_v1(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.configure_tournament_setup_side_pools_v1(uuid,uuid,uuid,jsonb) to service_role;

alter function public.get_tournament_setup_workspace(uuid) rename to get_tournament_setup_workspace_before_side_type_v1;
revoke all on function public.get_tournament_setup_workspace_before_side_type_v1(uuid) from public,anon,authenticated;
create function public.get_tournament_setup_workspace(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tid uuid:=p_tournament_id; base jsonb; ev jsonb; p jsonb; out_events jsonb:='[]'; out_pools jsonb; intent text;
begin
 base:=public.get_tournament_setup_workspace_before_side_type_v1(tid);
 if base is null or base->'current'='null'::jsonb then return base; end if;
 for ev in select value from jsonb_array_elements(base->'current'->'events') loop
  out_pools:='[]';
  for p in select value from jsonb_array_elements(ev->'sidePools') loop
   select side.payout_type into intent from app.tournament_setup_side_pool_versions side join app.tournament_setup_event_versions se on se.id=side.setup_event_version_id
    where side.tournament_id=tid and side.setup_revision_id=(base->'current'->>'revisionId')::uuid and se.client_row_id::text=ev->>'clientRowId' and side.slot=(p->>'slot')::integer;
   out_pools:=out_pools||jsonb_build_array(case when intent is null then p else p||jsonb_build_object('payoutType',intent) end);
  end loop;
  out_events:=out_events||jsonb_build_array(jsonb_set(ev,'{sidePools}',out_pools,false));
 end loop;
 return jsonb_set(base,'{current,events}',out_events,false);
end $$;
revoke all on function public.get_tournament_setup_workspace(uuid) from public,anon;
grant execute on function public.get_tournament_setup_workspace(uuid) to authenticated;

-- A setup selection cannot later silently freeze a different ratio. Legacy
-- operational pools with no recorded setup selection retain their old behavior.
create function app.guard_side_pool_setup_type_policy_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare intent text; expected_ratio integer;
begin
 select setup.payout_type into intent from app.tournament_setup_side_pool_materializations m
  join app.tournament_setup_side_pool_versions setup on setup.id=m.setup_side_pool_version_id and setup.tournament_id=m.tournament_id
  where m.pool_id=new.pool_id and m.tournament_id=new.tournament_id and m.event_id=new.event_id;
 if intent is not null then
  expected_ratio:=substring(intent from '([0-9]+)$')::integer;
  if new.ratio is distinct from expected_ratio then raise exception 'side_pool_setup_payout_type_mismatch'; end if;
 end if;
 return new;
end $$;
revoke all on function app.guard_side_pool_setup_type_policy_v1() from public,anon,authenticated,service_role;
create trigger side_pool_setup_type_policy_v1 before insert on app.side_pool_graduated_policies_v2
 for each row execute function app.guard_side_pool_setup_type_policy_v1();

-- A typed graduated selection cannot be bypassed via the older fixed-policy
-- writer before it is frozen. Existing untyped historical pools are unchanged.
create function app.guard_side_pool_setup_type_legacy_policy_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from app.tournament_setup_side_pool_materializations m
  join app.tournament_setup_side_pool_versions setup on setup.id=m.setup_side_pool_version_id and setup.tournament_id=m.tournament_id
  where m.pool_id=new.pool_id and m.tournament_id=new.tournament_id and m.event_id=new.event_id and setup.payout_type is not null)
 then raise exception 'side_pool_setup_type_requires_graduated_policy'; end if;
 return new;
end $$;
revoke all on function app.guard_side_pool_setup_type_legacy_policy_v1() from public,anon,authenticated,service_role;
create trigger side_pool_setup_type_legacy_policy_v1 before insert on app.event_side_pool_policy_versions
 for each row execute function app.guard_side_pool_setup_type_legacy_policy_v1();

-- This augments only the authenticated director's operational view, without
-- changing source digests or treating a draft selection as a frozen policy.
alter function public.get_side_pool_graduated_workspace_v2(uuid,uuid)
 rename to get_side_pool_graduated_workspace_before_setup_type_v1;
revoke all on function public.get_side_pool_graduated_workspace_before_setup_type_v1(uuid,uuid) from public,anon,authenticated,service_role;
create function public.get_side_pool_graduated_workspace_v2(p_actor_id uuid,p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=p_actor_id; tid uuid:=p_tournament_id; base jsonb; p jsonb; items jsonb:='[]'; intent text;
begin
 base:=public.get_side_pool_graduated_workspace_before_setup_type_v1(actor,tid);
 if base is null then return null; end if;
 for p in select value from jsonb_array_elements(base->'pools') loop
  select setup.payout_type into intent from app.tournament_setup_side_pool_materializations m
   join app.tournament_setup_side_pool_versions setup on setup.id=m.setup_side_pool_version_id and setup.tournament_id=m.tournament_id
   where m.tournament_id=tid and m.pool_id::text=p->>'poolId' and m.event_id::text=p->>'eventId';
  items:=items||jsonb_build_array(case when intent is null then p else p||jsonb_build_object('setupPayoutType',intent) end);
 end loop;
 return jsonb_set(base,'{pools}',items,false);
end $$;
revoke all on function public.get_side_pool_graduated_workspace_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_side_pool_graduated_workspace_v2(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
