-- Six operational Side Pools per event. Existing definitions and money history
-- remain append-only; this migration only widens the definition boundary.
alter table app.event_side_pool_definition_versions
  drop constraint if exists event_side_pool_definition_versions_category_code_check;
alter table app.event_side_pool_definition_versions
  drop constraint if exists event_side_pool_category_fee_check;
alter table app.event_side_pool_definition_versions
  add constraint event_side_pool_definition_versions_category_code_check
  check (length(trim(category_code)) between 1 and 100);

create unique index if not exists event_side_pool_active_name_unique_idx
  on app.event_side_pool_definition_versions (event_id, lower(trim(display_name)))
  where active;

create or replace function public.add_event_side_pool_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,
  p_category_code text,p_display_name text,p_entry_fee_minor integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_hash text; v_prior app.operation_receipts%rowtype;
  v_receipt uuid:=extensions.gen_random_uuid(); v_response jsonb;
begin
  if p_actor_id is null or p_pool_id is null or p_idempotency_key is null
     or length(trim(coalesce(p_category_code,''))) not between 1 and 100
     or length(trim(coalesce(p_display_name,''))) not between 1 and 100
     or p_entry_fee_minor not between 0 and 100000000 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array(
    'add_event_side_pool_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,
    p_pool_id::text,trim(p_category_code),trim(p_display_name),p_entry_fee_minor
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('side-pools:'||p_event_id::text,0));
  perform 1 from app.tournament_roles role_row
    where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id
      and role_row.role in('director','co_director') for update;
  if not found then return jsonb_build_object('status','rejected','code','not_director'); end if;
  select * into v_prior from app.operation_receipts
    where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then
    if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
    return v_prior.response_payload;
  end if;
  if not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id) then
    return jsonb_build_object('status','rejected','code','event_unavailable');
  end if;
  if exists(select 1 from (
    select distinct on(d.pool_id) d.* from app.event_side_pool_definition_versions d
    where d.event_id=p_event_id order by d.pool_id,d.version desc
  ) current where current.active and lower(trim(current.display_name))=lower(trim(p_display_name))) then
    return jsonb_build_object('status','rejected','code','duplicate_pool_name');
  end if;
  if (select count(*) from (
    select distinct on(d.pool_id) d.* from app.event_side_pool_definition_versions d
    where d.event_id=p_event_id order by d.pool_id,d.version desc
  ) current where current.active)>=6 then
    return jsonb_build_object('status','rejected','code','side_pool_limit');
  end if;
  v_response:=jsonb_build_object('status','side_pool_added','eventId',p_event_id,'poolId',p_pool_id,'version',1);
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(v_receipt,p_actor_id,p_tournament_id,'add_event_side_pool_v1',p_pool_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
  insert into app.event_side_pools(id,tournament_id,event_id) values(p_pool_id,p_tournament_id,p_event_id);
  insert into app.event_side_pool_definition_versions(pool_id,tournament_id,event_id,version,category_code,display_name,entry_fee_minor,active,actor_profile_id,operation_receipt_id)
    values(p_pool_id,p_tournament_id,p_event_id,1,trim(p_category_code),trim(p_display_name),p_entry_fee_minor,true,p_actor_id,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,v_receipt,'event_side_pool',p_pool_id,'side_pool_added',v_response);
  return v_response;
exception when unique_violation then
  return jsonb_build_object('status','rejected','code','duplicate_pool_name');
end $$;
revoke all on function public.add_event_side_pool_v1(uuid,uuid,uuid,uuid,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.add_event_side_pool_v1(uuid,uuid,uuid,uuid,text,text,integer,uuid) to service_role;
notify pgrst,'reload schema';
