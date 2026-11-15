-- Versioned application-facing wrappers bind a response to the exact browser
-- operation without mutating the append-only receipt shapes created by 0047.
-- The underlying functions remain the sole authority for lifecycle, role,
-- idempotency, audit, and immutable-history enforcement.

create or replace function public.record_roster_check_in_event_v2(
  p_tournament_id uuid,
  p_roster_entry_id uuid,
  p_check_in_state text,
  p_reason text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_result jsonb;
begin
  v_result := public.record_roster_check_in_event(
    p_tournament_id, p_roster_entry_id, p_check_in_state, p_reason, p_idempotency_key
  );
  return v_result || jsonb_build_object(
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
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_result jsonb;
begin
  v_result := public.publish_initial_seating(
    p_tournament_id, p_table_count, p_seats_per_table, p_assignments, p_idempotency_key
  );
  return v_result || jsonb_build_object(
    'tournamentId', p_tournament_id,
    'operationId', p_idempotency_key
  );
end;
$$;

revoke all on function public.record_roster_check_in_event_v2(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.publish_initial_seating_v2(uuid, smallint, smallint, jsonb, uuid) from public, anon;
grant execute on function public.record_roster_check_in_event_v2(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.publish_initial_seating_v2(uuid, smallint, smallint, jsonb, uuid) to authenticated;
