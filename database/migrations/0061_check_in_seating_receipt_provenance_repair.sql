-- 0060 labeled the application response but did not attest the underlying
-- receipt. These wrappers recompute the exact 0047 request fingerprint and
-- return only the caller/tournament/operation/target-scoped stored receipt
-- when one exists. The fallback is limited to unreceipted rejections (for
-- example, no authenticated caller); application routes reject those before
-- reaching this boundary.

create or replace function public.record_roster_check_in_event_v2(
  p_tournament_id uuid,
  p_roster_entry_id uuid,
  p_check_in_state text,
  p_reason text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_stored jsonb;
  v_hash text;
begin
  v_result := public.record_roster_check_in_event(
    p_tournament_id, p_roster_entry_id, p_check_in_state, p_reason, p_idempotency_key
  );
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'record_roster_check_in_event', p_tournament_id::text, p_roster_entry_id::text,
    p_check_in_state, p_reason, p_idempotency_key::text
  )::text, 'utf8'), 'sha256'), 'hex');
  select o.response_payload into v_stored from app.operation_receipts o
  where o.actor_profile_id = auth.uid()
    and o.tournament_id = p_tournament_id
    and o.operation_type = 'record_roster_check_in_event'
    and o.target_id = p_roster_entry_id
    and o.client_operation_id = p_idempotency_key
    and o.request_hash = v_hash
  limit 1;
  return coalesce(v_stored, v_result) || jsonb_build_object(
    'tournamentId', p_tournament_id,
    'operationId', p_idempotency_key
  );
end;
$$;

create or replace function public.publish_initial_seating_v2(
  p_tournament_id uuid,
  p_table_count smallint,
  p_seats_per_table smallint,
  p_assignments jsonb,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_stored jsonb;
  v_hash text;
begin
  v_result := public.publish_initial_seating(
    p_tournament_id, p_table_count, p_seats_per_table, p_assignments, p_idempotency_key
  );
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'publish_initial_seating', p_tournament_id::text, p_table_count, p_seats_per_table,
    p_assignments, p_idempotency_key::text
  )::text, 'utf8'), 'sha256'), 'hex');
  select o.response_payload into v_stored from app.operation_receipts o
  where o.actor_profile_id = auth.uid()
    and o.tournament_id = p_tournament_id
    and o.operation_type = 'publish_initial_seating'
    and o.target_id = p_tournament_id
    and o.client_operation_id = p_idempotency_key
    and o.request_hash = v_hash
  limit 1;
  return coalesce(v_stored, v_result) || jsonb_build_object(
    'tournamentId', p_tournament_id,
    'operationId', p_idempotency_key
  );
end;
$$;

revoke all on function public.record_roster_check_in_event_v2(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.publish_initial_seating_v2(uuid, smallint, smallint, jsonb, uuid) from public, anon;
grant execute on function public.record_roster_check_in_event_v2(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.publish_initial_seating_v2(uuid, smallint, smallint, jsonb, uuid) to authenticated;
