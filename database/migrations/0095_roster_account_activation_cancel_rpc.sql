-- Directors may cancel an unconsumed or pending witnessed activation. This is
-- server-only and never creates a roster/account link.

create function public.cancel_roster_account_activation_v1(
  p_actor_id uuid, p_tournament_id uuid, p_activation_id uuid, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_activation app.roster_account_activations%rowtype; v_existing app.operation_receipts%rowtype;
  v_hash text; v_receipt_id uuid; v_response jsonb;
begin
  perform app.roster_account_activation_service_only();
  if p_actor_id is null or p_tournament_id is null or p_activation_id is null or p_operation_id is null then
    return jsonb_build_object('status', 'rejected');
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'roster_account_activation_cancel_v1', p_actor_id::text, p_tournament_id::text,
    p_activation_id::text, p_operation_id::text
  )::text, 'utf8'), 'sha256'), 'hex');
  select * into v_activation from app.roster_account_activations
    where id = p_activation_id and tournament_id = p_tournament_id for update;
  if not found or not exists (select 1 from app.tournament_roles where tournament_id = p_tournament_id
    and profile_id = p_actor_id and role in ('director', 'co_director')) then return jsonb_build_object('status', 'rejected'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'roster-account-activation:' || p_tournament_id::text || ':' || v_activation.roster_entry_id::text, 0));
  select * into v_existing from app.operation_receipts where actor_profile_id = p_actor_id
    and client_operation_id = p_operation_id for update;
  if found then
    if v_existing.request_hash = v_hash and v_existing.operation_type = 'roster_account_activation_cancel_v1'
      then return v_existing.response_payload;
    end if;
    insert into app.roster_account_activation_operation_conflicts(actor_profile_id, roster_entry_id, attempted_operation_id, attempted_request_hash, prior_receipt_id, reason_code)
      values(p_actor_id, v_activation.roster_entry_id, p_operation_id, v_hash, v_existing.id, 'idempotency_conflict');
    return jsonb_build_object('status', 'rejected');
  end if;
  if v_activation.state not in ('issued', 'pending') then return jsonb_build_object('status', 'rejected'); end if;
  update app.roster_account_activation_requests set state = 'rejected', resolved_at = now()
    where activation_id = v_activation.id and state = 'pending';
  update app.roster_account_activations set state = 'cancelled', terminal_at = now() where id = v_activation.id;
  v_response := jsonb_build_object('status', 'cancelled', 'activationId', v_activation.id);
  insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
    values(p_actor_id, p_tournament_id, 'roster_account_activation_cancel_v1', v_activation.id, v_hash,
      p_operation_id, 'accepted', v_response, now()) returning id into v_receipt_id;
  insert into app.roster_account_activation_events(tournament_id, activation_id, actor_profile_id, event_type, operation_receipt_id)
    values(p_tournament_id, v_activation.id, p_actor_id, 'cancelled', v_receipt_id);
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
    values(p_tournament_id, p_actor_id, v_receipt_id, 'roster_account_activation', v_activation.id,
      'roster_account_activation_cancelled', v_response);
  return v_response;
end;
$$;

revoke all on function public.cancel_roster_account_activation_v1(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_roster_account_activation_v1(uuid, uuid, uuid, uuid) to service_role;
