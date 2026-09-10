-- Service-only credential lookup and redemption for a witnessed activation.
-- The raw fragment credential never enters SQL: this boundary accepts only a
-- parsed activation UUID and a fixed-size digest prepared by the application
-- server after a private salt lookup.

create function public.get_roster_account_activation_salt_v1(p_activation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_salt bytea;
begin
  perform app.roster_account_activation_service_only();
  if p_activation_id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;
  select token_salt into v_salt from app.roster_account_activations
    where id = p_activation_id and state = 'issued' and expires_at > now();
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  return jsonb_build_object('status', 'ready', 'activationId', p_activation_id, 'saltBase64', encode(v_salt, 'base64'));
end;
$$;

create function public.redeem_roster_account_activation_v1(
  p_profile_id uuid, p_activation_id uuid, p_digest bytea, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_activation app.roster_account_activations%rowtype;
  v_existing app.operation_receipts%rowtype;
  v_hash text; v_receipt_id uuid; v_request_id uuid := extensions.gen_random_uuid();
  v_phrase text; v_random text; v_response jsonb;
begin
  perform app.roster_account_activation_service_only();
  if p_profile_id is null or p_activation_id is null or p_operation_id is null
    or octet_length(p_digest) <> 32 then
    return jsonb_build_object('status', 'rejected');
  end if;
  -- Discover the immutable lock scope without a row lock, then take the
  -- shared tournament/roster lock before every mutable row lock. Issuance
  -- already takes that advisory lock first, so reversing it here can deadlock
  -- an issue-versus-redeem race.
  select * into v_activation from app.roster_account_activations where id = p_activation_id;
  if not found then return jsonb_build_object('status', 'rejected'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'roster-account-activation:' || v_activation.tournament_id::text || ':' || v_activation.roster_entry_id::text, 0));
  select * into v_activation from app.roster_account_activations where id = p_activation_id for update;
  if not found or v_activation.state <> 'issued' or v_activation.expires_at <= now()
    or p_digest <> v_activation.token_digest then
    if found and v_activation.state = 'issued' and v_activation.expires_at <= now() then
      update app.roster_account_activations set state = 'expired', terminal_at = now() where id = v_activation.id;
      insert into app.roster_account_activation_events(tournament_id, activation_id, actor_profile_id, event_type)
        values(v_activation.tournament_id, v_activation.id, p_profile_id, 'expired');
    end if;
    return jsonb_build_object('status', 'rejected');
  end if;
  if not exists (select 1 from app.profiles where id = p_profile_id) then
    return jsonb_build_object('status', 'rejected');
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'roster_account_activation_redeem_v1', p_profile_id::text, p_activation_id::text, p_operation_id::text
  )::text, 'utf8'), 'sha256'), 'hex');
  select * into v_existing from app.operation_receipts where actor_profile_id = p_profile_id
    and client_operation_id = p_operation_id for update;
  if found then
    if v_existing.request_hash = v_hash and v_existing.operation_type = 'roster_account_activation_redeem_v1'
      then return v_existing.response_payload;
    end if;
    insert into app.roster_account_activation_operation_conflicts(
      actor_profile_id, roster_entry_id, attempted_operation_id, attempted_request_hash, prior_receipt_id, reason_code
    ) values(p_profile_id, v_activation.roster_entry_id, p_operation_id, v_hash, v_existing.id, 'idempotency_conflict');
    return jsonb_build_object('status', 'rejected');
  end if;
  if exists (select 1 from app.roster_account_activation_requests where activation_id = p_activation_id)
    or exists (select 1 from app.roster_account_activation_requests where tournament_id = v_activation.tournament_id
      and profile_id = p_profile_id and state = 'pending')
    or exists (select 1 from app.roster_account_links where tournament_id = v_activation.tournament_id
      and (roster_entry_id = v_activation.roster_entry_id or profile_id = p_profile_id)) then
    return jsonb_build_object('status', 'rejected');
  end if;
  v_random := replace(extensions.gen_random_uuid()::text, '-', '');
  v_phrase := translate(substr(v_random, 1, 4), '0123456789abcdef', 'ABCDEFGHJKLMNPQR') || '-'
    || translate(substr(v_random, 5, 4), '0123456789abcdef', 'ABCDEFGHJKLMNPQR');
  v_response := jsonb_build_object('status', 'pending', 'activationId', p_activation_id,
    'requestId', v_request_id, 'confirmationPhrase', v_phrase);
  insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
    values(p_profile_id, v_activation.tournament_id, 'roster_account_activation_redeem_v1', p_activation_id,
      v_hash, p_operation_id, 'accepted', v_response, now()) returning id into v_receipt_id;
  insert into app.roster_account_activation_requests(id, tournament_id, activation_id, profile_id, confirmation_phrase, state)
    values(v_request_id, v_activation.tournament_id, p_activation_id, p_profile_id, v_phrase, 'pending');
  update app.roster_account_activations set state = 'pending' where id = p_activation_id;
  insert into app.roster_account_activation_events(tournament_id, activation_id, request_id, actor_profile_id, event_type, operation_receipt_id)
    values(v_activation.tournament_id, p_activation_id, v_request_id, p_profile_id, 'requested', v_receipt_id);
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
    values(v_activation.tournament_id, p_profile_id, v_receipt_id, 'roster_account_activation_request', v_request_id,
      'roster_account_activation_requested', v_response);
  return v_response;
end;
$$;

revoke all on function public.get_roster_account_activation_salt_v1(uuid) from public, anon, authenticated;
revoke all on function public.redeem_roster_account_activation_v1(uuid, uuid, bytea, uuid) from public, anon, authenticated;
grant execute on function public.get_roster_account_activation_salt_v1(uuid) to service_role;
grant execute on function public.redeem_roster_account_activation_v1(uuid, uuid, bytea, uuid) to service_role;
