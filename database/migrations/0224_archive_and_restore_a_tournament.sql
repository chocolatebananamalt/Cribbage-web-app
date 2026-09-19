-- A tournament could be created but never put away. Rehearsals therefore pile up
-- in every director's chooser forever, next to the real event, which is exactly
-- the confusion the workspace requirements warn about.
--
-- app.tournaments.status has allowed 'archived' since 0001 and
-- list_actor_tournament_workspaces_v1 already lists only
-- ('draft','open','pending_finalization','finalized'), so an archived tournament
-- disappears from the chooser with no reader change at all. Nothing until now
-- could actually set that value.
--
-- This is deliberately ARCHIVE and not delete. Every roster entry, payment,
-- score, correction and audit row stays exactly where it is, which is the same
-- principle the roster already follows: 0205 replaced destructive removal with
-- set_roster_entry_active_status_v1 plus a guarded reinstate. A tournament that
-- ran is evidence, and ACC results are reconstructed from it. Restore puts the
-- tournament back in the precise status it held, read from the archive's own
-- audit row, rather than guessing 'draft' and silently reopening registration.
--
-- create_tournament_draft_v1 already excludes archived rows from its duplicate
-- check (0194), so archiving also frees the name and date for reuse. That is
-- what makes "archive the rehearsal, then create this year's tournament with the
-- same name" work.

create or replace function public.archive_tournament_v1(
  p_actor_id uuid, p_tournament_id uuid, p_reason text, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
  v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
  v_tournament app.tournaments%rowtype; v_response jsonb;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode='P0001', message='server-only tournament archive';
  end if;
  if p_actor_id is null or p_tournament_id is null or p_operation_id is null
     or length(v_reason) not between 1 and 1000 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'archive_tournament_v1', p_actor_id::text, p_tournament_id::text, v_reason, p_operation_id::text
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_existing from app.operation_receipts
    where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type='archive_tournament_v1' and v_existing.request_hash=v_hash then
      return v_existing.response_payload;
    end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict');
  end if;

  select * into v_tournament from app.tournaments where id=p_tournament_id for update;
  if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable'); end if;

  -- Only the tournament's own primary director, or a platform administrator,
  -- may put a tournament away. A co-director cannot: they can be added and
  -- removed by the primary director, so granting them this would let an invited
  -- official remove the whole event from its owner's list.
  if v_tournament.director_profile_id <> p_actor_id
     and not exists(select 1 from app.platform_administrators where profile_id=p_actor_id) then
    return jsonb_build_object('status','rejected','code','primary_director_required');
  end if;

  if v_tournament.status = 'archived' then
    return jsonb_build_object('status','already_archived','tournamentId',p_tournament_id);
  end if;

  update app.tournaments set status='archived' where id=p_tournament_id;

  v_response := jsonb_build_object(
    'status','tournament_archived','tournamentId',p_tournament_id,
    'tournamentName',v_tournament.name,'previousStatus',v_tournament.status);

  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,
    request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament_id,p_actor_id,'archive_tournament_v1',p_tournament_id,
    v_hash,p_operation_id,'accepted',v_response,now())
  returning id into v_receipt;

  -- before_state carries the exact prior status. restore_tournament_v1 reads it
  -- back rather than assuming a default, so restoring a finalized tournament
  -- cannot quietly reopen its registration.
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,
    entity_id,action,before_state,after_state)
  values(p_tournament_id,p_actor_id,v_receipt,'tournament',p_tournament_id,'tournament_archived',
    jsonb_build_object('status',v_tournament.status,'registrationStatus',v_tournament.registration_status),
    v_response || jsonb_build_object('reason',v_reason));

  return v_response;
end;
$$;

create or replace function public.restore_tournament_v1(
  p_actor_id uuid, p_tournament_id uuid, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
  v_tournament app.tournaments%rowtype; v_previous text; v_response jsonb;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode='P0001', message='server-only tournament restore';
  end if;
  if p_actor_id is null or p_tournament_id is null or p_operation_id is null then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'restore_tournament_v1', p_actor_id::text, p_tournament_id::text, p_operation_id::text
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_existing from app.operation_receipts
    where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type='restore_tournament_v1' and v_existing.request_hash=v_hash then
      return v_existing.response_payload;
    end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict');
  end if;

  select * into v_tournament from app.tournaments where id=p_tournament_id for update;
  if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable'); end if;
  if v_tournament.director_profile_id <> p_actor_id
     and not exists(select 1 from app.platform_administrators where profile_id=p_actor_id) then
    return jsonb_build_object('status','rejected','code','primary_director_required');
  end if;
  if v_tournament.status <> 'archived' then
    return jsonb_build_object('status','not_archived','tournamentId',p_tournament_id);
  end if;

  select event.before_state->>'status' into v_previous from app.audit_events event
    where event.tournament_id=p_tournament_id and event.action='tournament_archived'
    order by event.created_at desc limit 1;
  if v_previous is null or v_previous not in ('draft','open','pending_finalization','finalized') then
    v_previous := 'draft';
  end if;

  update app.tournaments set status=v_previous where id=p_tournament_id;

  v_response := jsonb_build_object('status','tournament_restored','tournamentId',p_tournament_id,
    'tournamentName',v_tournament.name,'restoredStatus',v_previous);

  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,
    request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament_id,p_actor_id,'restore_tournament_v1',p_tournament_id,
    v_hash,p_operation_id,'accepted',v_response,now())
  returning id into v_receipt;

  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,
    entity_id,action,before_state,after_state)
  values(p_tournament_id,p_actor_id,v_receipt,'tournament',p_tournament_id,'tournament_restored',
    jsonb_build_object('status','archived'), v_response);

  return v_response;
end;
$$;

revoke all on function public.archive_tournament_v1(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.restore_tournament_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.archive_tournament_v1(uuid,uuid,text,uuid) to service_role;
grant execute on function public.restore_tournament_v1(uuid,uuid,uuid) to service_role;

notify pgrst,'reload schema';
