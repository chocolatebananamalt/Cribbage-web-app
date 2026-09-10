-- A missing head must fail closed.  In PL/pgSQL, a NULL comparison in an IF
-- condition does not enter the rejection branch, so record both SELECT
-- outcomes explicitly before reading nullable composite fields.

create or replace function public.close_registration_link_v2(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_expected_link_id uuid,
  p_expected_version integer,
  p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_head app.tournament_registration_link_heads%rowtype;
  v_link app.tournament_registration_links%rowtype;
  v_head_found boolean := false;
  v_link_found boolean := false;
  v_receipt_id uuid;
  v_response jsonb;
  v_tournament_status text;
  v_registration_status text;
begin
  perform app.registration_v2_service_only();
  if p_actor_id is null or p_tournament_id is null or p_expected_link_id is null
    or p_expected_version is null or p_expected_version < 1 or p_operation_id is null then
    raise exception using errcode = 'P0001', message = 'invalid registration lifecycle request';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'registration_link_v2', 'close', p_actor_id::text, p_tournament_id::text,
    p_expected_link_id::text, p_expected_version, p_operation_id::text
  )::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registration-link-v2:' || p_tournament_id::text, 0));
  select status, registration_status into v_tournament_status, v_registration_status
  from app.tournaments where id = p_tournament_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'registration lifecycle unavailable'; end if;
  if not exists (
    select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
      and r.profile_id = p_actor_id and r.role in ('director', 'co_director')
  ) then raise exception using errcode = 'P0001', message = 'director role required'; end if;
  select * into v_existing from app.operation_receipts
  where actor_profile_id = p_actor_id and client_operation_id = p_operation_id for update;
  if found then
    if v_existing.request_hash <> v_hash or v_existing.operation_type <> 'registration_link_close_v3' then
      insert into app.registration_link_operation_conflicts(
        actor_profile_id, tournament_id, attempted_operation_id, attempted_request_hash,
        prior_receipt_id, prior_receipt_tournament_id, reason_code
      ) values (
        p_actor_id, p_tournament_id, p_operation_id, v_hash,
        case when v_existing.tournament_id = p_tournament_id then v_existing.id else null end,
        case when v_existing.tournament_id = p_tournament_id then v_existing.tournament_id else null end,
        'idempotency_conflict'
      );
      return jsonb_build_object('status', 'rejected', 'code', 'idempotency_conflict');
    end if;
    return v_existing.response_payload;
  end if;
  select * into v_head from app.tournament_registration_link_heads
  where tournament_id = p_tournament_id for update;
  v_head_found := found;
  select * into v_link from app.tournament_registration_links
  where id = p_expected_link_id and tournament_id = p_tournament_id for update;
  v_link_found := found;
  if v_tournament_status not in ('draft', 'open') or v_registration_status <> 'open'
    or not v_head_found or not v_link_found or v_head.state <> 'open'
    or v_head.registration_link_id <> p_expected_link_id
    or v_head.version <> p_expected_version or v_link.lifecycle_state <> 'issued'
    or not v_link.enabled or v_link.expires_at <= now() then
    v_response := jsonb_build_object('status', 'rejected', 'code', 'link_unavailable');
    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id, request_hash,
      client_operation_id, outcome, response_payload, applied_at
    ) values (
      p_actor_id, p_tournament_id, 'registration_link_close_v3', p_expected_link_id, v_hash,
      p_operation_id, 'rejected', v_response, now()
    );
    return v_response;
  end if;
  update app.tournament_registration_links
  set lifecycle_state = 'closed', enabled = false, disabled_at = now()
  where id = v_link.id;
  update app.tournament_registration_link_heads
  set state = 'closed', version = version + 1, updated_at = now()
  where tournament_id = p_tournament_id;
  v_response := jsonb_build_object(
    'status', 'closed', 'linkId', v_link.id, 'state', 'closed',
    'version', p_expected_version + 1
  );
  insert into app.operation_receipts(
    actor_profile_id, tournament_id, operation_type, target_id, request_hash,
    client_operation_id, outcome, response_payload, applied_at
  ) values (
    p_actor_id, p_tournament_id, 'registration_link_close_v3', v_link.id, v_hash,
    p_operation_id, 'accepted', v_response, now()
  ) returning id into v_receipt_id;
  perform app.record_registration_link_event(p_tournament_id, v_link.id, 'closed', p_actor_id, v_receipt_id);
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
  values (p_tournament_id, p_actor_id, v_receipt_id, 'registration_link', v_link.id, 'registration_link_closed', v_response);
  return v_response;
end;
$$;

revoke all on function public.close_registration_link_v2(uuid, uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.close_registration_link_v2(uuid, uuid, uuid, integer, uuid) to service_role;
