-- Version 2 registration links deliberately store only an opaque link ID, a
-- per-link salt, and a fixed-length digest. Raw bearer values are created and
-- handled only by the Next.js server. This migration follows 0070, which
-- retired the unsafe path-token public surface before v2 may be opened.

alter table app.tournament_registration_links
  drop constraint if exists tournament_registration_links_tournament_id_key;

alter table app.tournament_registration_links
  alter column token_hash drop not null,
  add column if not exists token_version smallint not null default 1
    check (token_version in (1, 2)),
  add column if not exists token_salt bytea,
  add column if not exists token_digest bytea,
  add column if not exists lifecycle_state text not null default 'retired'
    check (lifecycle_state in ('issued', 'retired', 'closed', 'expired')),
  add column if not exists issued_at timestamptz,
  add column if not exists expires_at timestamptz;

alter table app.tournament_registration_links
  add constraint tournament_registration_links_id_tournament_key
  unique (id, tournament_id);

alter table app.tournament_registration_links
  add constraint tournament_registration_links_v2_material_check
  check (
    (token_version = 1 and token_hash is not null and token_salt is null
      and token_digest is null and lifecycle_state <> 'issued' and not enabled)
    or
    (token_version = 2 and token_hash is null and octet_length(token_salt) = 32
      and octet_length(token_digest) = 32 and issued_at is not null
      and expires_at is not null and expires_at > issued_at
      and ((lifecycle_state = 'issued' and enabled and disabled_at is null)
        or (lifecycle_state <> 'issued' and not enabled)))
  );

alter table app.registration_claims
  add constraint registration_claims_link_tournament_fkey
  foreign key (registration_link_id, tournament_id)
  references app.tournament_registration_links(id, tournament_id)
  on delete restrict;

create table app.registration_link_lifecycle_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  registration_link_id uuid not null,
  sequence integer not null check (sequence > 0),
  event_type text not null check (event_type in ('issued', 'rotated', 'closed', 'expired', 'retired_legacy')),
  actor_profile_id uuid references app.profiles(id) on delete restrict,
  operation_receipt_id uuid,
  created_at timestamptz not null default now(),
  foreign key (registration_link_id, tournament_id)
    references app.tournament_registration_links(id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (registration_link_id, sequence)
);

alter table app.registration_link_lifecycle_events enable row level security;
alter table app.registration_link_lifecycle_events force row level security;
revoke all on table app.registration_link_lifecycle_events from public, anon, authenticated;
create trigger registration_link_lifecycle_events_immutable
before update or delete on app.registration_link_lifecycle_events
for each row execute function app.reject_immutable_history();

-- Historical v1 headers were already closed by 0070. Preserve an ID-linked
-- immutable marker for any existing history without reopening or rehashing it.
insert into app.registration_link_lifecycle_events(
  tournament_id, registration_link_id, sequence, event_type, actor_profile_id, created_at
)
select l.tournament_id, l.id, 1, 'retired_legacy', l.created_by_profile_id, coalesce(l.disabled_at, l.created_at)
from app.tournament_registration_links l
where l.token_version = 1
  and not exists (
    select 1 from app.registration_link_lifecycle_events e
    where e.registration_link_id = l.id
  );

create table app.tournament_registration_link_heads (
  tournament_id uuid primary key references app.tournaments(id) on delete restrict,
  registration_link_id uuid not null unique,
  state text not null check (state in ('open', 'closed')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  foreign key (registration_link_id, tournament_id)
    references app.tournament_registration_links(id, tournament_id) on delete restrict
);

alter table app.tournament_registration_link_heads enable row level security;
alter table app.tournament_registration_link_heads force row level security;
revoke all on table app.tournament_registration_link_heads from public, anon, authenticated;

create table app.registration_link_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  attempted_operation_id uuid not null,
  attempted_request_hash text not null check (length(attempted_request_hash) = 64),
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null check (reason_code in ('idempotency_conflict', 'active_link_exists', 'link_unavailable')),
  created_at timestamptz not null default now()
);

alter table app.registration_link_operation_conflicts enable row level security;
alter table app.registration_link_operation_conflicts force row level security;
revoke all on table app.registration_link_operation_conflicts from public, anon, authenticated;
create trigger registration_link_operation_conflicts_immutable
before update or delete on app.registration_link_operation_conflicts
for each row execute function app.reject_immutable_history();

create or replace function app.registration_v2_service_only()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only registration lifecycle';
  end if;
end;
$$;
revoke all on function app.registration_v2_service_only() from public, anon, authenticated;

create or replace function app.fixed_32_byte_equal(p_left bytea, p_right bytea)
returns boolean language plpgsql immutable security definer set search_path = '' as $$
declare v_index integer; v_difference integer := 0;
begin
  if octet_length(p_left) <> 32 or octet_length(p_right) <> 32 then return false; end if;
  for v_index in 0..31 loop
    v_difference := v_difference | (get_byte(p_left, v_index) # get_byte(p_right, v_index));
  end loop;
  return v_difference = 0;
end;
$$;
revoke all on function app.fixed_32_byte_equal(bytea, bytea) from public, anon, authenticated;

create or replace function app.record_registration_link_event(
  p_tournament_id uuid, p_link_id uuid, p_event_type text, p_actor_id uuid, p_receipt_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into app.registration_link_lifecycle_events(
    tournament_id, registration_link_id, sequence, event_type, actor_profile_id, operation_receipt_id
  )
  select p_tournament_id, p_link_id, coalesce(max(sequence), 0) + 1, p_event_type, p_actor_id, p_receipt_id
  from app.registration_link_lifecycle_events
  where registration_link_id = p_link_id;
end;
$$;
revoke all on function app.record_registration_link_event(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;

create or replace function app.write_registration_link_v2(
  p_mode text, p_actor_id uuid, p_tournament_id uuid, p_salt bytea, p_digest bytea,
  p_expires_at timestamptz, p_max_claims integer, p_max_claims_per_hour integer,
  p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text; v_existing app.operation_receipts%rowtype; v_head app.tournament_registration_link_heads%rowtype;
  v_previous app.tournament_registration_links%rowtype; v_link_id uuid := extensions.gen_random_uuid();
  v_receipt_id uuid; v_response jsonb; v_tournament_status text; v_registration_status text;
  v_head_found boolean := false;
begin
  perform app.registration_v2_service_only();
  if p_mode not in ('issue', 'rotate') or p_actor_id is null or p_tournament_id is null or p_operation_id is null
    or octet_length(p_salt) <> 32 or octet_length(p_digest) <> 32
    or p_expires_at <= now() + interval '5 minutes' or p_expires_at > now() + interval '90 days'
    or p_max_claims not between 1 and 2000 or p_max_claims_per_hour not between 1 and 1000 then
    raise exception using errcode = 'P0001', message = 'invalid registration lifecycle request';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'registration_link_v2', p_mode, p_actor_id::text, p_tournament_id::text,
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
      insert into app.registration_link_operation_conflicts(actor_profile_id, tournament_id, attempted_operation_id, attempted_request_hash, prior_receipt_id, reason_code)
      values (p_actor_id, p_tournament_id, p_operation_id, v_hash, v_existing.id, 'idempotency_conflict');
      raise exception using errcode = 'P0001', message = 'idempotency conflict';
    end if;
    return v_existing.response_payload;
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
    raise exception using errcode = 'P0001', message = 'active registration link exists';
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
    v_link_id, p_tournament_id, null, 2, p_salt, p_digest, 'issued', now(), p_expires_at,
    p_actor_id, true, p_max_claims, p_max_claims_per_hour
  );
  v_response := jsonb_build_object('status', 'issued', 'linkId', v_link_id, 'state', 'open', 'expiresAt', p_expires_at);
  insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
  values (p_actor_id, p_tournament_id, 'registration_link_' || p_mode || '_v2', v_link_id, v_hash, p_operation_id, 'accepted', v_response, now())
  returning id into v_receipt_id;
  insert into app.tournament_registration_link_heads(tournament_id, registration_link_id, state, version, updated_at)
  values (p_tournament_id, v_link_id, 'open', 1, now())
  on conflict (tournament_id) do update set registration_link_id = excluded.registration_link_id, state = 'open', version = app.tournament_registration_link_heads.version + 1, updated_at = now();
  if p_mode = 'rotate' then perform app.record_registration_link_event(p_tournament_id, v_previous.id, 'rotated', p_actor_id, v_receipt_id); end if;
  perform app.record_registration_link_event(p_tournament_id, v_link_id, 'issued', p_actor_id, v_receipt_id);
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
  values (p_tournament_id, p_actor_id, v_receipt_id, 'registration_link', v_link_id, 'registration_link_' || p_mode || 'd', v_response);
  return v_response;
end;
$$;
revoke all on function app.write_registration_link_v2(text, uuid, uuid, bytea, bytea, timestamptz, integer, integer, uuid) from public, anon, authenticated;

create or replace function public.issue_registration_link_v2(
  p_actor_id uuid, p_tournament_id uuid, p_salt bytea, p_digest bytea, p_expires_at timestamptz,
  p_max_claims integer, p_max_claims_per_hour integer, p_operation_id uuid
) returns jsonb language sql security definer set search_path = '' as $$
  select app.write_registration_link_v2('issue', p_actor_id, p_tournament_id, p_salt, p_digest, p_expires_at, p_max_claims, p_max_claims_per_hour, p_operation_id)
$$;

create or replace function public.rotate_registration_link_v2(
  p_actor_id uuid, p_tournament_id uuid, p_salt bytea, p_digest bytea, p_expires_at timestamptz,
  p_max_claims integer, p_max_claims_per_hour integer, p_operation_id uuid
) returns jsonb language sql security definer set search_path = '' as $$
  select app.write_registration_link_v2('rotate', p_actor_id, p_tournament_id, p_salt, p_digest, p_expires_at, p_max_claims, p_max_claims_per_hour, p_operation_id)
$$;

create or replace function public.close_registration_link_v2(
  p_actor_id uuid, p_tournament_id uuid, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_hash text; v_existing app.operation_receipts%rowtype; v_head app.tournament_registration_link_heads%rowtype;
  v_link app.tournament_registration_links%rowtype; v_receipt_id uuid; v_response jsonb;
  v_tournament_exists boolean := false;
begin
  perform app.registration_v2_service_only();
  if p_actor_id is null or p_tournament_id is null or p_operation_id is null then raise exception using errcode = 'P0001', message = 'invalid registration lifecycle request'; end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array('registration_link_v2', 'close', p_actor_id::text, p_tournament_id::text, p_operation_id::text)::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registration-link-v2:' || p_tournament_id::text, 0));
  perform 1 from app.tournaments where id = p_tournament_id for update;
  v_tournament_exists := found;
  if not v_tournament_exists or not exists (select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id and r.profile_id = p_actor_id and r.role in ('director', 'co_director')) then raise exception using errcode = 'P0001', message = 'director role required'; end if;
  select * into v_existing from app.operation_receipts where actor_profile_id = p_actor_id and client_operation_id = p_operation_id for update;
  if found then
    if v_existing.request_hash <> v_hash or v_existing.operation_type <> 'registration_link_close_v2' then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
    return v_existing.response_payload;
  end if;
  select * into v_head from app.tournament_registration_link_heads where tournament_id = p_tournament_id for update;
  if not found or v_head.state <> 'open' then raise exception using errcode = 'P0001', message = 'active registration link unavailable'; end if;
  select * into v_link from app.tournament_registration_links where id = v_head.registration_link_id and tournament_id = p_tournament_id for update;
  if not found or v_link.lifecycle_state <> 'issued' then raise exception using errcode = 'P0001', message = 'active registration link unavailable'; end if;
  update app.tournament_registration_links set lifecycle_state = 'closed', enabled = false, disabled_at = now() where id = v_link.id;
  update app.tournament_registration_link_heads set state = 'closed', version = version + 1, updated_at = now() where tournament_id = p_tournament_id;
  v_response := jsonb_build_object('status', 'closed', 'linkId', v_link.id, 'state', 'closed');
  insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
  values (p_actor_id, p_tournament_id, 'registration_link_close_v2', v_link.id, v_hash, p_operation_id, 'accepted', v_response, now()) returning id into v_receipt_id;
  perform app.record_registration_link_event(p_tournament_id, v_link.id, 'closed', p_actor_id, v_receipt_id);
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
  values (p_tournament_id, p_actor_id, v_receipt_id, 'registration_link', v_link.id, 'registration_link_closed', v_response);
  return v_response;
end;
$$;

create or replace function public.get_registration_link_redemption_material_v2(p_link_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform app.registration_v2_service_only();
  if p_link_id is null then return null; end if;
  select jsonb_build_object('linkId', l.id, 'salt', encode(l.token_salt, 'base64'), 'tournamentName', t.name)
  into v_result
  from app.tournament_registration_link_heads h
  join app.tournament_registration_links l on l.id = h.registration_link_id and l.tournament_id = h.tournament_id
  join app.tournaments t on t.id = l.tournament_id
  where l.id = p_link_id and h.state = 'open' and l.lifecycle_state = 'issued'
    and l.expires_at > now() and t.status in ('draft', 'open') and t.registration_status = 'open';
  return v_result;
end;
$$;

create or replace function public.submit_registration_claim_v2(
  p_link_id uuid, p_digest bytea, p_display_name text, p_email text, p_acc_number text,
  p_intended_payment_method text, p_client_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_head app.tournament_registration_link_heads%rowtype; v_link app.tournament_registration_links%rowtype;
  v_name text; v_email text; v_acc text; v_status text; v_fingerprint text; v_existing text;
  v_tournament_id uuid;
begin
  perform app.registration_v2_service_only();
  if p_link_id is null or octet_length(p_digest) <> 32 or p_display_name is null or length(trim(p_display_name)) not between 1 and 160
    or p_email is null or length(trim(p_email)) not between 3 and 320 or lower(trim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or coalesce(p_intended_payment_method, '') not in ('cash', 'check', 'other', 'unspecified') or p_client_operation_id is null then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid_request');
  end if;
  v_name := lower(regexp_replace(trim(p_display_name), '[[:space:]]+', ' ', 'g'));
  v_email := lower(trim(p_email));
  v_acc := nullif(upper(regexp_replace(trim(coalesce(p_acc_number, '')), '[[:space:]]+', '', 'g')), '');
  if v_acc is not null and length(v_acc) > 64 then return jsonb_build_object('status', 'rejected', 'code', 'invalid_request'); end if;
  select h.tournament_id into v_tournament_id from app.tournament_registration_link_heads h
  where h.registration_link_id = p_link_id;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registration-link-v2:' || v_tournament_id::text, 0));
  perform 1 from app.tournaments where id = v_tournament_id for update;
  select * into v_head from app.tournament_registration_link_heads h
  where h.tournament_id = v_tournament_id and h.registration_link_id = p_link_id for update;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  select * into v_link from app.tournament_registration_links where id = p_link_id and tournament_id = v_tournament_id for update;
  if not found or v_head.state <> 'open' or v_link.lifecycle_state <> 'issued' or v_link.expires_at <= now()
    or not app.fixed_32_byte_equal(v_link.token_digest, p_digest)
    or not exists (select 1 from app.tournaments t where t.id=v_link.tournament_id and t.status in ('draft','open') and t.registration_status='open') then
    return jsonb_build_object('status', 'unavailable');
  end if;
  v_fingerprint := encode(extensions.digest(convert_to(jsonb_build_array('registration_claim_v2', p_link_id::text, v_name, v_email, coalesce(v_acc, ''), p_intended_payment_method, p_client_operation_id::text)::text, 'utf8'), 'sha256'), 'hex');
  select request_fingerprint into v_existing from app.registration_claims where tournament_id=v_link.tournament_id and client_operation_id=p_client_operation_id for update;
  if found then
    if v_existing <> v_fingerprint then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
    return jsonb_build_object('status','received');
  end if;
  if (select count(*) from app.registration_claims c where c.registration_link_id=v_link.id) >= v_link.max_claims
    or (select count(*) from app.registration_claims c where c.registration_link_id=v_link.id and c.submitted_at >= now() - interval '1 hour') >= v_link.max_claims_per_hour then
    return jsonb_build_object('status','rejected','code','registration_capacity_reached');
  end if;
  v_status := case when exists (select 1 from app.registration_claims c where c.tournament_id=v_link.tournament_id and c.status not in ('rejected','withdrawn') and (c.normalized_email=v_email or c.normalized_name=v_name or (v_acc is not null and c.normalized_acc_number=v_acc))) then 'needs_review' else 'pending_review' end;
  insert into app.registration_claims(tournament_id, registration_link_id, display_name, normalized_name, email, normalized_email, acc_number, normalized_acc_number, intended_payment_method, status, client_operation_id, request_fingerprint)
  values(v_link.tournament_id, v_link.id, trim(p_display_name), v_name, trim(p_email), v_email, nullif(trim(p_acc_number), ''), v_acc, p_intended_payment_method, v_status, p_client_operation_id, v_fingerprint);
  return jsonb_build_object('status','received');
end;
$$;

revoke all on function public.issue_registration_link_v2(uuid, uuid, bytea, bytea, timestamptz, integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.rotate_registration_link_v2(uuid, uuid, bytea, bytea, timestamptz, integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.close_registration_link_v2(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_registration_link_redemption_material_v2(uuid) from public, anon, authenticated;
revoke all on function public.submit_registration_claim_v2(uuid, bytea, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.issue_registration_link_v2(uuid, uuid, bytea, bytea, timestamptz, integer, integer, uuid) to service_role;
grant execute on function public.rotate_registration_link_v2(uuid, uuid, bytea, bytea, timestamptz, integer, integer, uuid) to service_role;
grant execute on function public.close_registration_link_v2(uuid, uuid, uuid) to service_role;
grant execute on function public.get_registration_link_redemption_material_v2(uuid) to service_role;
grant execute on function public.submit_registration_claim_v2(uuid, bytea, text, text, text, text, uuid) to service_role;
