-- Expected registration-link conflicts are business outcomes, not database
-- failures. Preserve their immutable evidence and never recreate a one-time
-- bearer credential after an ambiguous retry.

alter table app.registration_link_operation_conflicts
  add column if not exists prior_receipt_tournament_id uuid;

update app.registration_link_operation_conflicts c
set prior_receipt_tournament_id = r.tournament_id
from app.operation_receipts r
where c.prior_receipt_id = r.id and c.prior_receipt_tournament_id is null;

alter table app.registration_link_operation_conflicts
  drop constraint if exists registration_link_operation_conflicts_prior_receipt_scope_check,
  add constraint registration_link_operation_conflicts_prior_receipt_scope_check
    check ((prior_receipt_id is null) = (prior_receipt_tournament_id is null));

alter table app.registration_link_operation_conflicts
  drop constraint if exists registration_link_operation_conflicts_prior_receipt_tournament_fkey,
  add constraint registration_link_operation_conflicts_prior_receipt_tournament_fkey
    foreign key (prior_receipt_id, prior_receipt_tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict;

create or replace function app.write_registration_link_v2(
  p_mode text, p_actor_id uuid, p_tournament_id uuid, p_link_id uuid, p_salt bytea, p_digest bytea,
  p_expires_at timestamptz, p_max_claims integer, p_max_claims_per_hour integer,
  p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text; v_existing app.operation_receipts%rowtype; v_head app.tournament_registration_link_heads%rowtype;
  v_previous app.tournament_registration_links%rowtype;
  v_receipt_id uuid; v_response jsonb; v_tournament_status text; v_registration_status text;
  v_head_found boolean := false;
begin
  perform app.registration_v2_service_only();
  if p_mode not in ('issue', 'rotate') or p_actor_id is null or p_tournament_id is null or p_link_id is null or p_operation_id is null
    or octet_length(p_salt) <> 32 or octet_length(p_digest) <> 32
    or p_expires_at <= now() + interval '5 minutes' or p_expires_at > now() + interval '90 days'
    or p_max_claims not between 1 and 2000 or p_max_claims_per_hour not between 1 and 1000 then
    raise exception using errcode = 'P0001', message = 'invalid registration lifecycle request';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'registration_link_v2', p_mode, p_actor_id::text, p_tournament_id::text, p_link_id::text,
    encode(p_salt, 'hex'), encode(p_digest, 'hex'), p_expires_at, p_max_claims,
    p_max_claims_per_hour, p_operation_id::text
  )::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registration-link-v2:' || p_tournament_id::text, 0));
  select status, registration_status into v_tournament_status, v_registration_status
  from app.tournaments where id = p_tournament_id for update;
  if not found or v_tournament_status not in ('draft', 'open') or v_registration_status <> 'open' then
    raise exception using errcode = 'P0001', message = 'tournament unavailable';
  end if;
  if not exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = p_actor_id
      and r.role in ('director', 'co_director')
  ) then raise exception using errcode = 'P0001', message = 'director role required'; end if;
  select * into v_existing from app.operation_receipts
  where actor_profile_id = p_actor_id and client_operation_id = p_operation_id for update;
  if found then
    if v_existing.request_hash <> v_hash or v_existing.operation_type <> 'registration_link_' || p_mode || '_v2' then
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
  if exists (select 1 from app.tournament_registration_links l where l.id = p_link_id) then
    raise exception using errcode = 'P0001', message = 'registration link ID already exists';
  end if;
  select * into v_head from app.tournament_registration_link_heads
  where tournament_id = p_tournament_id for update;
  v_head_found := found;
  if v_head_found then
    select * into v_previous from app.tournament_registration_links
    where id = v_head.registration_link_id and tournament_id = p_tournament_id for update;
    if v_head.state = 'open' and v_previous.lifecycle_state = 'issued' and v_previous.expires_at <= now() then
      update app.tournament_registration_links set lifecycle_state = 'expired', enabled = false, disabled_at = now()
      where id = v_previous.id;
      update app.tournament_registration_link_heads set state = 'closed', version = version + 1, updated_at = now()
      where tournament_id = p_tournament_id;
      perform app.record_registration_link_event(p_tournament_id, v_previous.id, 'expired', p_actor_id, null);
      v_head.state := 'closed';
    end if;
  end if;
  if p_mode = 'issue' and v_head_found and v_head.state = 'open' then
    insert into app.registration_link_operation_conflicts(actor_profile_id, tournament_id, attempted_operation_id, attempted_request_hash, reason_code)
    values (p_actor_id, p_tournament_id, p_operation_id, v_hash, 'active_link_exists');
    return jsonb_build_object('status', 'rejected', 'code', 'active_link_exists');
  end if;
  if p_mode = 'rotate' and (not v_head_found or v_head.state <> 'open' or v_previous.lifecycle_state <> 'issued') then
    raise exception using errcode = 'P0001', message = 'active registration link unavailable';
  end if;
  if p_mode = 'rotate' then
    update app.tournament_registration_links set lifecycle_state = 'retired', enabled = false, disabled_at = now()
    where id = v_previous.id;
  end if;
  insert into app.tournament_registration_links(
    id, tournament_id, token_hash, token_version, token_salt, token_digest, lifecycle_state,
    issued_at, expires_at, created_by_profile_id, enabled, max_claims, max_claims_per_hour
  ) values (
    p_link_id, p_tournament_id, null, 2, p_salt, p_digest, 'issued', now(), p_expires_at,
    p_actor_id, true, p_max_claims, p_max_claims_per_hour
  );
  v_response := jsonb_build_object('status', 'issued', 'linkId', p_link_id, 'state', 'open', 'expiresAt', p_expires_at);
  insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
  values (p_actor_id, p_tournament_id, 'registration_link_' || p_mode || '_v2', p_link_id, v_hash, p_operation_id, 'accepted', v_response, now())
  returning id into v_receipt_id;
  insert into app.tournament_registration_link_heads(tournament_id, registration_link_id, state, version, updated_at)
  values (p_tournament_id, p_link_id, 'open', 1, now())
  on conflict (tournament_id) do update set registration_link_id = excluded.registration_link_id, state = 'open', version = app.tournament_registration_link_heads.version + 1, updated_at = now();
  if p_mode = 'rotate' then perform app.record_registration_link_event(p_tournament_id, v_previous.id, 'rotated', p_actor_id, v_receipt_id); end if;
  perform app.record_registration_link_event(p_tournament_id, p_link_id, 'issued', p_actor_id, v_receipt_id);
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
  values (p_tournament_id, p_actor_id, v_receipt_id, 'registration_link', p_link_id, 'registration_link_' || p_mode || 'd', v_response);
  return v_response;
end;
$$;

revoke all on function app.write_registration_link_v2(text, uuid, uuid, uuid, bytea, bytea, timestamptz, integer, integer, uuid) from public, anon, authenticated;
