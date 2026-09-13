-- Registration closure is the server-authoritative end of attendance changes.
-- Reconcile an exact prior receipt first, then serialize a new check-in with
-- the same tournament lifecycle lock used by registration closure.

create or replace function public.record_roster_check_in_event_v2(
  p_tournament_id uuid,
  p_roster_entry_id uuid,
  p_check_in_state text,
  p_reason text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_registration_status text;
  v_existing app.operation_receipts%rowtype;
  v_hash text;
  v_receipt_id uuid;
  v_response jsonb;
begin
  if v_actor is null or p_tournament_id is null or p_roster_entry_id is null
    or p_idempotency_key is null or p_check_in_state not in ('checked_in', 'withdrawn', 'late', 'absent')
    or p_reason is null or length(p_reason) > 500 or octet_length(p_reason) > 2000 then
    return null;
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'record_roster_check_in_event', p_tournament_id::text, p_roster_entry_id::text,
    p_check_in_state, p_reason, p_idempotency_key::text
  )::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('registration-link-v2:' || p_tournament_id::text, 0)
  );
  select status, registration_status into v_status, v_registration_status
  from app.tournaments where id = p_tournament_id for update;
  if not found or not exists (
    select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
      and r.profile_id = v_actor and r.role in ('director', 'co_director')
  ) then
    return null;
  end if;
  select * into v_existing from app.operation_receipts o
  where o.actor_profile_id = v_actor and o.client_operation_id = p_idempotency_key
  for update;
  if found then
    if v_existing.request_hash <> v_hash
      or v_existing.operation_type <> 'record_roster_check_in_event'
      or v_existing.tournament_id <> p_tournament_id
      or v_existing.target_id <> p_roster_entry_id then
      return null;
    end if;
    return v_existing.response_payload || jsonb_build_object(
      'tournamentId', p_tournament_id, 'operationId', p_idempotency_key
    );
  end if;
  if v_registration_status <> 'open' then
    v_response := jsonb_build_object(
      'status', 'rejected', 'code', 'registration_closed', 'rosterEntryId', p_roster_entry_id
    );
    insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id,
      request_hash, client_operation_id, outcome, response_payload, applied_at)
    values (v_actor, p_tournament_id, 'record_roster_check_in_event', p_roster_entry_id,
      v_hash, p_idempotency_key, 'rejected', v_response, now()) returning id into v_receipt_id;
    insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type,
      entity_id, action, after_state)
    values (p_tournament_id, v_actor, v_receipt_id, 'roster_check_in_event', p_roster_entry_id,
      'roster_check_in_rejected', v_response);
    return v_response || jsonb_build_object(
      'tournamentId', p_tournament_id, 'operationId', p_idempotency_key
    );
  end if;
  perform public.record_roster_check_in_event(
    p_tournament_id, p_roster_entry_id, p_check_in_state, p_reason, p_idempotency_key
  );
  select o.response_payload into v_response from app.operation_receipts o
  where o.actor_profile_id = v_actor and o.tournament_id = p_tournament_id
    and o.operation_type = 'record_roster_check_in_event' and o.target_id = p_roster_entry_id
    and o.client_operation_id = p_idempotency_key and o.request_hash = v_hash
  limit 1;
  if v_response is null then return null; end if;
  return v_response || jsonb_build_object(
    'tournamentId', p_tournament_id, 'operationId', p_idempotency_key
  );
end;
$$;

revoke all on function public.record_roster_check_in_event_v2(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.record_roster_check_in_event_v2(uuid, uuid, text, text, uuid) to authenticated;
