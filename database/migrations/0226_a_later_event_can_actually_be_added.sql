-- Add New Tournament Events could never succeed. Every attempt left the
-- director wedged: the events WERE created, the HTTP call returned 503, and the
-- client showed that the event addition is unresolved and should be retried
-- when the connection is available. Retrying was permanently 503, because the
-- append returns its cached receipt and the next step rejects again.
--
-- append_tournament_setup_events_v1 creates the amended revision AND inserts an
-- app.tournament_setup_activations row per new event against that NEW revision,
-- because an amended event is live immediately. The amendments route then calls
-- configure_tournament_setup_side_pools_v1 on the same revision, whose first
-- guard is:
--
--   if exists(select 1 from app.tournament_setup_activations
--             where tournament_id=... and setup_revision_id=p_setup_revision_id)
--     -> rejected, setup_lifecycle_closed
--
-- so the guard fires on every amendment, by construction, and the route turns
-- anything but setup_side_pools_configured into a 503.
--
-- That guard exists to stop side pools being re-cut on a revision that was
-- FINALIZED by activate_tournament_setup_v2. It was never meant to catch the
-- amendment path: this same function already carries an explicit branch for it,
-- commented that appended setup revisions carry forward the prior configuration
-- for every unchanged event. The guard above made that branch unreachable.
--
-- The discriminator is exact and needs no new state: an amended revision is the
-- one recorded in app.tournament_setup_amendments.setup_revision_id, written by
-- append_tournament_setup_events_v1 itself. A finalized revision has activations
-- and NO amendment row, so it stays closed exactly as before.
--
-- Only that one condition changes. The body below is otherwise the deployed
-- definition, verbatim.
create or replace function public.configure_tournament_setup_side_pools_v1(p_actor_id uuid, p_tournament_id uuid, p_setup_revision_id uuid, p_events jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_revision app.tournament_setup_revisions%rowtype;v_receipt uuid;v_event jsonb;v_pool jsonb;v_setup_event app.tournament_setup_event_versions%rowtype;v_previous_setup_event_id uuid;v_slot integer;v_expected integer;v_existing integer;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_tournament_id is null or p_setup_revision_id is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  begin perform app.validate_setup_side_pools_v1(p_events);exception when sqlstate 'P0001' then return jsonb_build_object('status','rejected','code',case when sqlerrm='duplicate side pool' then 'duplicate_side_pool_name' else 'invalid_side_pool' end);end;
  select * into v_revision from app.tournament_setup_revisions where id=p_setup_revision_id and tournament_id=p_tournament_id for update;if not found then return jsonb_build_object('status','rejected','code','stale_setup_revision');end if;
  -- Closed means FINALIZED, not merely activated. An amendment revision has
  -- activations of its own and must still be allowed to bind its side pools.
  if exists(select 1 from app.tournament_setup_activations where tournament_id=p_tournament_id and setup_revision_id=p_setup_revision_id)
     and not exists(select 1 from app.tournament_setup_amendments where tournament_id=p_tournament_id and setup_revision_id=p_setup_revision_id) then
    return jsonb_build_object('status','rejected','code','setup_lifecycle_closed');
  end if;
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
end $function$;
