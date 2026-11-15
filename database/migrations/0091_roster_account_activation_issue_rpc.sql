-- Server-only issue boundary for witnessed account-link activations. Browser
-- clients receive no EXECUTE grant and no raw credential reaches this SQL.

create or replace function app.roster_account_activation_service_only()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only account activation';
  end if;
end;
$$;
revoke all on function app.roster_account_activation_service_only() from public, anon, authenticated;

-- Reusing an operation ID with different intent is preserved as evidence rather
-- than being silently treated as a retry. This table contains no credential.
create table app.roster_account_activation_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  roster_entry_id uuid not null,
  attempted_operation_id uuid not null,
  attempted_request_hash text not null,
  prior_receipt_id uuid not null references app.operation_receipts(id) on delete restrict,
  reason_code text not null check (reason_code = 'idempotency_conflict'),
  created_at timestamptz not null default now()
);
alter table app.roster_account_activation_operation_conflicts enable row level security;
alter table app.roster_account_activation_operation_conflicts force row level security;
revoke all on table app.roster_account_activation_operation_conflicts from public, anon, authenticated;
create trigger roster_account_activation_operation_conflicts_immutable
before update or delete on app.roster_account_activation_operation_conflicts
for each row execute function app.reject_immutable_history();
create index roster_account_activation_operation_conflicts_receipt_idx
  on app.roster_account_activation_operation_conflicts(prior_receipt_id);
create index roster_account_activation_operation_conflicts_actor_idx
  on app.roster_account_activation_operation_conflicts(actor_profile_id);

create function public.issue_roster_account_activation_v1(
  p_actor_id uuid, p_tournament_id uuid, p_roster_entry_id uuid, p_activation_id uuid,
  p_salt bytea, p_digest bytea, p_expires_at timestamptz, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text; v_existing app.operation_receipts%rowtype; v_receipt_id uuid;
  v_response jsonb; v_status text; v_activation app.roster_account_activations%rowtype;
begin
  perform app.roster_account_activation_service_only();
  if p_actor_id is null or p_tournament_id is null or p_roster_entry_id is null or p_activation_id is null
    or p_operation_id is null or octet_length(p_salt) <> 32 or octet_length(p_digest) <> 32
    or p_expires_at <= now() + interval '5 minutes' or p_expires_at > now() + interval '60 minutes' then
    raise exception using errcode = 'P0001', message = 'invalid activation issue request';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'roster_account_activation_issue_v1', p_actor_id::text, p_tournament_id::text,
    p_roster_entry_id::text, p_expires_at, p_operation_id::text
  )::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'roster-account-activation:' || p_tournament_id::text || ':' || p_roster_entry_id::text, 0));
  select status into v_status from app.tournaments where id = p_tournament_id for update;
  if not found or not exists (select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
    and r.profile_id = p_actor_id and r.role in ('director', 'co_director')) then
    raise exception using errcode = 'P0001', message = 'activation unavailable';
  end if;
  select * into v_existing from app.operation_receipts where actor_profile_id = p_actor_id
    and client_operation_id = p_operation_id for update;
  if found then
    if v_existing.request_hash = v_hash and v_existing.operation_type = 'roster_account_activation_issue_v1'
      then return v_existing.response_payload;
    end if;
    insert into app.roster_account_activation_operation_conflicts(
      actor_profile_id, roster_entry_id, attempted_operation_id, attempted_request_hash, prior_receipt_id, reason_code
    ) values (p_actor_id, p_roster_entry_id, p_operation_id, v_hash, v_existing.id, 'idempotency_conflict');
    return jsonb_build_object('status', 'rejected', 'code', 'idempotency_conflict');
  end if;
  if v_status not in ('draft', 'open')
    or not exists (select 1 from app.tournament_roster_entries r where r.id = p_roster_entry_id and r.tournament_id = p_tournament_id for update)
    or exists (select 1 from app.roster_account_links l where l.tournament_id = p_tournament_id and l.roster_entry_id = p_roster_entry_id)
    or exists (select 1 from app.roster_account_activations a where a.id = p_activation_id) then
    v_response := jsonb_build_object('status', 'rejected', 'code', 'activation_unavailable');
    insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
    values (p_actor_id, p_tournament_id, 'roster_account_activation_issue_v1', p_roster_entry_id, v_hash, p_operation_id, 'rejected', v_response, now());
    return v_response;
  end if;
  select * into v_activation from app.roster_account_activations where tournament_id = p_tournament_id
    and roster_entry_id = p_roster_entry_id and state in ('issued', 'pending') for update;
  if found and v_activation.expires_at <= now() then
    update app.roster_account_activations set state = 'expired', terminal_at = now() where id = v_activation.id;
    update app.roster_account_activation_requests set state = 'rejected', resolved_at = now()
      where activation_id = v_activation.id and state = 'pending';
    insert into app.roster_account_activation_events(tournament_id, activation_id, actor_profile_id, event_type)
    values (p_tournament_id, v_activation.id, p_actor_id, 'expired');
  elsif found then
    v_response := jsonb_build_object('status', 'rejected', 'code', 'activation_unavailable');
    insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
    values (p_actor_id, p_tournament_id, 'roster_account_activation_issue_v1', p_roster_entry_id, v_hash, p_operation_id, 'rejected', v_response, now());
    return v_response;
  end if;
  v_response := jsonb_build_object('status', 'issued', 'activationId', p_activation_id,
    'rosterEntryId', p_roster_entry_id, 'tournamentId', p_tournament_id, 'expiresAt', p_expires_at);
  insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
  values (p_actor_id, p_tournament_id, 'roster_account_activation_issue_v1', p_roster_entry_id, v_hash, p_operation_id, 'accepted', v_response, now()) returning id into v_receipt_id;
  insert into app.roster_account_activations(id, tournament_id, roster_entry_id, issued_by_profile_id, token_salt, token_digest, state, expires_at)
  values (p_activation_id, p_tournament_id, p_roster_entry_id, p_actor_id, p_salt, p_digest, 'issued', p_expires_at);
  insert into app.roster_account_activation_events(tournament_id, activation_id, actor_profile_id, event_type, operation_receipt_id)
  values (p_tournament_id, p_activation_id, p_actor_id, 'issued', v_receipt_id);
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
  values (p_tournament_id, p_actor_id, v_receipt_id, 'roster_account_activation', p_activation_id, 'roster_account_activation_issued', v_response);
  return v_response;
end;
$$;

revoke all on function public.issue_roster_account_activation_v1(uuid, uuid, uuid, uuid, bytea, bytea, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.issue_roster_account_activation_v1(uuid, uuid, uuid, uuid, bytea, bytea, timestamptz, uuid) to service_role;
