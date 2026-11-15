-- Director witness decision. Approval invokes the private link writer inside
-- an exception subtransaction: a failed nested link cannot leave either link
-- or approval history behind.

create function public.decide_roster_account_activation_v1(
  p_actor_id uuid, p_tournament_id uuid, p_request_id uuid, p_decision text,
  p_confirmation_phrase text, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_request app.roster_account_activation_requests%rowtype;
  v_activation app.roster_account_activations%rowtype;
  v_existing app.operation_receipts%rowtype; v_hash text; v_receipt_id uuid;
  v_link jsonb; v_response jsonb;
begin
  perform app.roster_account_activation_service_only();
  if p_actor_id is null or p_tournament_id is null or p_request_id is null or p_operation_id is null
    or p_decision is null or p_decision not in ('approve', 'reject')
    or (p_decision = 'approve' and (p_confirmation_phrase is null or p_confirmation_phrase !~ '^[A-Z]{4}-[A-Z]{4}$')) then
    return jsonb_build_object('status', 'rejected');
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'roster_account_activation_decision_v1', p_actor_id::text, p_tournament_id::text,
    p_request_id::text, p_decision, coalesce(p_confirmation_phrase, ''), p_operation_id::text
  )::text, 'utf8'), 'sha256'), 'hex');
  -- Every state-changing activation operation takes this shared advisory lock
  -- before mutable row locks. Resolve the immutable scope first without a row
  -- lock, then re-read both rows under the advisory lock.
  select * into v_request from app.roster_account_activation_requests
    where id = p_request_id and tournament_id = p_tournament_id;
  if not found then return jsonb_build_object('status', 'rejected'); end if;
  select * into v_activation from app.roster_account_activations
    where id = v_request.activation_id and tournament_id = p_tournament_id;
  if not found then return jsonb_build_object('status', 'rejected'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'roster-account-activation:' || p_tournament_id::text || ':' || v_activation.roster_entry_id::text, 0));
  select * into v_request from app.roster_account_activation_requests
    where id = p_request_id and tournament_id = p_tournament_id for update;
  if not found then return jsonb_build_object('status', 'rejected'); end if;
  select * into v_activation from app.roster_account_activations
    where id = v_request.activation_id and tournament_id = p_tournament_id for update;
  if not found or not exists (select 1 from app.tournament_roles where tournament_id = p_tournament_id
    and profile_id = p_actor_id and role in ('director', 'co_director')) or p_actor_id = v_request.profile_id then
    return jsonb_build_object('status', 'rejected');
  end if;
  select * into v_existing from app.operation_receipts where actor_profile_id = p_actor_id
    and client_operation_id = p_operation_id for update;
  if found then
    if v_existing.request_hash = v_hash and v_existing.operation_type = 'roster_account_activation_decision_v1'
      then return v_existing.response_payload;
    end if;
    insert into app.roster_account_activation_operation_conflicts(actor_profile_id, roster_entry_id, attempted_operation_id, attempted_request_hash, prior_receipt_id, reason_code)
      values(p_actor_id, v_activation.roster_entry_id, p_operation_id, v_hash, v_existing.id, 'idempotency_conflict');
    return jsonb_build_object('status', 'rejected');
  end if;
  if v_request.state <> 'pending' or v_activation.state <> 'pending' or v_activation.expires_at <= now() then
    if v_activation.state = 'pending' and v_activation.expires_at <= now() then
      update app.roster_account_activation_requests set state = 'rejected', resolved_at = now() where id = v_request.id;
      update app.roster_account_activations set state = 'expired', terminal_at = now() where id = v_activation.id;
      insert into app.roster_account_activation_events(tournament_id, activation_id, request_id, actor_profile_id, event_type)
        values(p_tournament_id, v_activation.id, v_request.id, p_actor_id, 'expired');
    end if;
    return jsonb_build_object('status', 'rejected');
  end if;
  if p_decision = 'approve' then
    if p_confirmation_phrase <> v_request.confirmation_phrase then return jsonb_build_object('status', 'rejected'); end if;
    begin
      v_link := app.link_roster_account_service_v1(p_actor_id, p_tournament_id,
        v_activation.roster_entry_id, v_request.profile_id, v_request.link_operation_id);
      if jsonb_typeof(v_link) <> 'object' or v_link->>'status' <> 'roster_account_linked'
        or v_link->>'rosterEntryId' <> v_activation.roster_entry_id::text
        or jsonb_typeof(v_link->'linkId') <> 'string' then
        raise exception using errcode = 'P0001', message = 'nested link receipt unavailable';
      end if;
    exception when others then
      raise exception using errcode = 'P0001', message = 'activation approval unavailable';
    end;
    v_response := jsonb_build_object('status', 'approved', 'requestId', v_request.id,
      'rosterEntryId', v_activation.roster_entry_id, 'linkId', v_link->>'linkId');
    update app.roster_account_activation_requests set state = 'approved', resolved_at = now() where id = v_request.id;
    update app.roster_account_activations set state = 'approved', terminal_at = now() where id = v_activation.id;
  else
    v_response := jsonb_build_object('status', 'rejected', 'requestId', v_request.id);
    update app.roster_account_activation_requests set state = 'rejected', resolved_at = now() where id = v_request.id;
    update app.roster_account_activations set state = 'rejected', terminal_at = now() where id = v_activation.id;
  end if;
  insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
    values(p_actor_id, p_tournament_id, 'roster_account_activation_decision_v1', v_request.id,
      v_hash, p_operation_id, 'accepted', v_response, now()) returning id into v_receipt_id;
  insert into app.roster_account_activation_events(tournament_id, activation_id, request_id, actor_profile_id, event_type, operation_receipt_id)
    values(p_tournament_id, v_activation.id, v_request.id, p_actor_id,
      case when p_decision = 'approve' then 'approved' else 'rejected' end, v_receipt_id);
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
    values(p_tournament_id, p_actor_id, v_receipt_id, 'roster_account_activation_request', v_request.id,
      case when p_decision = 'approve' then 'roster_account_activation_approved' else 'roster_account_activation_rejected' end, v_response);
  return v_response;
end;
$$;

revoke all on function public.decide_roster_account_activation_v1(uuid, uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.decide_roster_account_activation_v1(uuid, uuid, uuid, text, text, uuid) to service_role;
