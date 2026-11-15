-- Manual payment evidence is deliberately distinct from registration, seating,
-- scorecards, qualification, and payout. It records only an append-only
-- director/co-director-entered receipt or void for an existing private roster
-- identity. There is no mutable paid flag and no "paid in full" inference.

alter table app.tournament_roster_entries
  add constraint tournament_roster_entries_id_tournament_unique
  unique (id, tournament_id);

create table app.roster_payment_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  roster_entry_id uuid not null,
  version integer not null check (version > 0),
  event_type text not null check (event_type in ('received', 'voided')),
  amount_minor integer not null check (amount_minor > 0),
  currency_code text not null check (currency_code = 'USD'),
  payment_method text not null check (payment_method in ('cash', 'check', 'other')),
  payment_received_at timestamptz,
  receipt_note text,
  payment_voided_at timestamptz,
  void_reason text,
  voids_payment_event_id uuid,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  recorded_at timestamptz not null default now(),
  foreign key (roster_entry_id, tournament_id)
    references app.tournament_roster_entries(id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  foreign key (voids_payment_event_id, roster_entry_id, tournament_id)
    references app.roster_payment_events(id, roster_entry_id, tournament_id) on delete restrict,
  unique (id, roster_entry_id, tournament_id),
  unique (roster_entry_id, version),
  check (
    (event_type = 'received' and payment_received_at is not null
      and (receipt_note is null or (length(receipt_note) between 1 and 500 and octet_length(receipt_note) <= 2000))
      and payment_voided_at is null and void_reason is null and voids_payment_event_id is null)
    or
    (event_type = 'voided' and payment_received_at is not null
      and receipt_note is null
      and payment_voided_at is not null and void_reason is not null
      and length(trim(void_reason)) between 1 and 500 and octet_length(void_reason) <= 2000
      and voids_payment_event_id is not null)
  )
);
alter table app.roster_payment_events enable row level security;
alter table app.roster_payment_events force row level security;
revoke all on table app.roster_payment_events from public, anon, authenticated;
create trigger roster_payment_events_immutable before update or delete on app.roster_payment_events
for each row execute function app.reject_immutable_history();
create index roster_payment_events_tournament_recorded_idx
  on app.roster_payment_events(tournament_id, recorded_at desc);
create index roster_payment_events_actor_profile_id_idx
  on app.roster_payment_events(actor_profile_id);
create index roster_payment_events_operation_receipt_scope_idx
  on app.roster_payment_events(operation_receipt_id, tournament_id);
create index roster_payment_events_voided_event_scope_idx
  on app.roster_payment_events(voids_payment_event_id, roster_entry_id, tournament_id);

create table app.roster_payment_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid references app.profiles(id) on delete restrict,
  tournament_id uuid references app.tournaments(id) on delete restrict,
  attempted_roster_entry_id uuid,
  attempted_idempotency_key uuid,
  attempted_request_hash text not null,
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);
alter table app.roster_payment_operation_conflicts enable row level security;
alter table app.roster_payment_operation_conflicts force row level security;
revoke all on table app.roster_payment_operation_conflicts from public, anon, authenticated;
create trigger roster_payment_operation_conflicts_immutable before update or delete on app.roster_payment_operation_conflicts
for each row execute function app.reject_immutable_history();
create index roster_payment_operation_conflicts_actor_profile_id_idx
  on app.roster_payment_operation_conflicts(actor_profile_id);
create index roster_payment_operation_conflicts_tournament_id_idx
  on app.roster_payment_operation_conflicts(tournament_id);
create index roster_payment_operation_conflicts_attempted_roster_entry_id_idx
  on app.roster_payment_operation_conflicts(attempted_roster_entry_id);
create index roster_payment_operation_conflicts_prior_receipt_id_idx
  on app.roster_payment_operation_conflicts(prior_receipt_id);

create or replace function app.revalidate_roster_payment_history(p_roster_entry_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_max_version integer;
begin
  select count(*), coalesce(max(version), 0)
    into v_count, v_max_version
  from app.roster_payment_events
  where roster_entry_id = p_roster_entry_id;

  if v_count <> v_max_version then
    raise exception 'payment event versions must be contiguous';
  end if;
  if exists (
    select 1 from app.roster_payment_events e
    where e.roster_entry_id = p_roster_entry_id
      and ((e.version % 2 = 1 and e.event_type <> 'received')
        or (e.version % 2 = 0 and e.event_type <> 'voided'))
  ) then
    raise exception 'payment event types must alternate received and voided';
  end if;
  if exists (
    select 1
    from app.roster_payment_events e
    left join app.roster_payment_events prior
      on prior.id = e.voids_payment_event_id
      and prior.roster_entry_id = e.roster_entry_id
      and prior.tournament_id = e.tournament_id
    where e.roster_entry_id = p_roster_entry_id
      and e.event_type = 'voided'
      and (prior.id is null or prior.event_type <> 'received'
        or prior.version <> e.version - 1
        or prior.amount_minor <> e.amount_minor
        or prior.currency_code <> e.currency_code
        or prior.payment_method <> e.payment_method
        or prior.payment_received_at <> e.payment_received_at)
  ) then
    raise exception 'payment void must reference the immediately preceding matching receipt';
  end if;
end;
$$;

create or replace function app.revalidate_roster_payment_history_from_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app.revalidate_roster_payment_history(coalesce(new.roster_entry_id, old.roster_entry_id));
  return null;
end;
$$;
create constraint trigger roster_payment_history_revalidation
after insert or update or delete on app.roster_payment_events
deferrable initially deferred for each row
execute function app.revalidate_roster_payment_history_from_event();

create or replace function public.record_manual_roster_payment(
  p_tournament_id uuid,
  p_roster_entry_id uuid,
  p_expected_payment_version integer,
  p_amount_minor integer,
  p_currency_code text,
  p_payment_method text,
  p_payment_received_at timestamptz,
  p_note text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_existing app.operation_receipts%rowtype;
  v_roster app.tournament_roster_entries%rowtype;
  v_current_version integer := 0;
  v_payment_event_id uuid := extensions.gen_random_uuid();
  v_receipt uuid;
  v_hash text;
  v_response jsonb;
  v_error text;
  v_code text;
  v_note text;
begin
  begin
    if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
    v_note := nullif(trim(p_note), '');
    if p_tournament_id is null or p_roster_entry_id is null or p_expected_payment_version is null
      or p_expected_payment_version < 0 or p_amount_minor is null or p_amount_minor <= 0
      or p_currency_code is distinct from 'USD'
      or p_payment_method is null or p_payment_method not in ('cash', 'check', 'other')
      or p_payment_received_at is null or p_payment_received_at > now()
      or length(coalesce(v_note, '')) > 500 or octet_length(coalesce(v_note, '')) > 2000
      or p_idempotency_key is null then
      raise exception using errcode = 'P0001', message = 'invalid manual payment receipt';
    end if;
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'record_manual_roster_payment', p_tournament_id::text, p_roster_entry_id::text,
      p_expected_payment_version, p_amount_minor, p_currency_code, p_payment_method,
      p_payment_received_at, coalesce(v_note, ''), p_idempotency_key::text
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
    select status into v_status from app.tournaments where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
    if not exists (select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id and r.profile_id = v_actor and r.role in ('director', 'co_director')) then raise exception using errcode = 'P0001', message = 'director role required'; end if;
    v_authorized := true;
    select * into v_existing from app.operation_receipts where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
      return v_existing.response_payload;
    end if;
    if v_status not in ('draft', 'open', 'pending_finalization') then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
    select * into v_roster from app.tournament_roster_entries where id = p_roster_entry_id and tournament_id = p_tournament_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'roster entry unavailable'; end if;
    select coalesce(max(version), 0) into v_current_version from app.roster_payment_events where roster_entry_id = p_roster_entry_id;
    if v_current_version is distinct from p_expected_payment_version then raise exception using errcode = 'P0001', message = 'stale payment history'; end if;
    if v_current_version % 2 = 1 then raise exception using errcode = 'P0001', message = 'current receipt must be voided before recording another'; end if;
    v_response := jsonb_build_object('status', 'payment_recorded', 'paymentEventId', v_payment_event_id, 'rosterEntryId', p_roster_entry_id, 'paymentVersion', v_current_version + 1, 'paymentState', 'received', 'paymentRecorded', true, 'paidInFull', false, 'reconciled', false);
    insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(v_actor,p_tournament_id,'record_manual_roster_payment',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
    insert into app.roster_payment_events(id,tournament_id,roster_entry_id,version,event_type,amount_minor,currency_code,payment_method,payment_received_at,receipt_note,actor_profile_id,operation_receipt_id)
      values(v_payment_event_id,p_tournament_id,p_roster_entry_id,v_current_version + 1,'received',p_amount_minor,p_currency_code,p_payment_method,p_payment_received_at,v_note,v_actor,v_receipt);
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
      values(p_tournament_id,v_actor,v_receipt,'roster_payment_event',v_payment_event_id,'manual_roster_payment_recorded',v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error when 'authentication required' then 'authentication_required' when 'director role required' then 'not_director' when 'idempotency conflict' then 'idempotency_conflict' when 'stale payment history' then 'stale_payment_history' when 'current receipt must be voided before recording another' then 'active_payment_receipt_exists' when 'roster entry unavailable' then 'roster_entry_unavailable' when 'tournament unavailable' then 'tournament_unavailable' when 'invalid manual payment receipt' then 'invalid_request' else 'payment_recording_rejected' end;
    v_response := jsonb_build_object('status','rejected','code',v_code,'rosterEntryId',p_roster_entry_id);
    if v_error = 'idempotency conflict' then
      insert into app.roster_payment_operation_conflicts(actor_profile_id,tournament_id,attempted_roster_entry_id,attempted_idempotency_key,attempted_request_hash,prior_receipt_id,reason_code)
        values(v_actor,p_tournament_id,p_roster_entry_id,p_idempotency_key,coalesce(v_hash,''),v_existing.id,'idempotency_conflict');
    elsif v_authorized and v_tournament_exists then
      insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
        values(v_actor,p_tournament_id,'record_manual_roster_payment',coalesce(p_roster_entry_id,p_tournament_id),coalesce(v_hash,''),p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt;
      insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
        values(p_tournament_id,v_actor,v_receipt,'roster_payment_event',coalesce(p_roster_entry_id,p_tournament_id),'manual_roster_payment_rejected',v_response);
    end if;
    return v_response;
  when others then raise;
  end;
end;
$$;

create or replace function public.void_manual_roster_payment(
  p_tournament_id uuid,
  p_roster_entry_id uuid,
  p_expected_payment_version integer,
  p_payment_event_id uuid,
  p_void_reason text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_existing app.operation_receipts%rowtype;
  v_roster app.tournament_roster_entries%rowtype;
  v_received app.roster_payment_events%rowtype;
  v_current_version integer := 0;
  v_void_id uuid := extensions.gen_random_uuid();
  v_receipt uuid;
  v_hash text;
  v_response jsonb;
  v_error text;
  v_code text;
begin
  begin
    if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
    if p_tournament_id is null or p_roster_entry_id is null or p_expected_payment_version is null or p_expected_payment_version < 1
      or p_payment_event_id is null or length(trim(coalesce(p_void_reason, ''))) not between 1 and 500
      or octet_length(coalesce(p_void_reason, '')) > 2000 or p_idempotency_key is null then
      raise exception using errcode = 'P0001', message = 'invalid payment void';
    end if;
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'void_manual_roster_payment', p_tournament_id::text, p_roster_entry_id::text,
      p_expected_payment_version, p_payment_event_id::text, p_void_reason, p_idempotency_key::text
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
    select status into v_status from app.tournaments where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
    if not exists (select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id and r.profile_id = v_actor and r.role in ('director', 'co_director')) then raise exception using errcode = 'P0001', message = 'director role required'; end if;
    v_authorized := true;
    select * into v_existing from app.operation_receipts where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
      return v_existing.response_payload;
    end if;
    if v_status not in ('draft', 'open', 'pending_finalization') then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
    select * into v_roster from app.tournament_roster_entries where id = p_roster_entry_id and tournament_id = p_tournament_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'roster entry unavailable'; end if;
    select coalesce(max(version), 0) into v_current_version from app.roster_payment_events where roster_entry_id = p_roster_entry_id;
    if v_current_version is distinct from p_expected_payment_version then raise exception using errcode = 'P0001', message = 'stale payment history'; end if;
    select * into v_received from app.roster_payment_events where id = p_payment_event_id and roster_entry_id = p_roster_entry_id and tournament_id = p_tournament_id for update;
    if not found or v_received.event_type <> 'received' or v_received.version <> v_current_version then raise exception using errcode = 'P0001', message = 'current payment receipt required'; end if;
    v_response := jsonb_build_object('status', 'payment_voided', 'paymentEventId', v_void_id, 'voidedPaymentEventId', v_received.id, 'rosterEntryId', p_roster_entry_id, 'paymentVersion', v_current_version + 1, 'paymentState', 'voided', 'paymentRecorded', false, 'paidInFull', false, 'reconciled', false);
    insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(v_actor,p_tournament_id,'void_manual_roster_payment',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
    insert into app.roster_payment_events(id,tournament_id,roster_entry_id,version,event_type,amount_minor,currency_code,payment_method,payment_received_at,payment_voided_at,void_reason,voids_payment_event_id,actor_profile_id,operation_receipt_id)
      values(v_void_id,p_tournament_id,p_roster_entry_id,v_current_version + 1,'voided',v_received.amount_minor,v_received.currency_code,v_received.payment_method,v_received.payment_received_at,now(),p_void_reason,v_received.id,v_actor,v_receipt);
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
      values(p_tournament_id,v_actor,v_receipt,'roster_payment_event',v_void_id,'manual_roster_payment_voided',v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error when 'authentication required' then 'authentication_required' when 'director role required' then 'not_director' when 'idempotency conflict' then 'idempotency_conflict' when 'stale payment history' then 'stale_payment_history' when 'current payment receipt required' then 'current_payment_receipt_required' when 'roster entry unavailable' then 'roster_entry_unavailable' when 'tournament unavailable' then 'tournament_unavailable' when 'invalid payment void' then 'invalid_request' else 'payment_void_rejected' end;
    v_response := jsonb_build_object('status','rejected','code',v_code,'rosterEntryId',p_roster_entry_id);
    if v_error = 'idempotency conflict' then
      insert into app.roster_payment_operation_conflicts(actor_profile_id,tournament_id,attempted_roster_entry_id,attempted_idempotency_key,attempted_request_hash,prior_receipt_id,reason_code)
        values(v_actor,p_tournament_id,p_roster_entry_id,p_idempotency_key,coalesce(v_hash,''),v_existing.id,'idempotency_conflict');
    elsif v_authorized and v_tournament_exists then
      insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
        values(v_actor,p_tournament_id,'void_manual_roster_payment',coalesce(p_roster_entry_id,p_tournament_id),coalesce(v_hash,''),p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt;
      insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
        values(p_tournament_id,v_actor,v_receipt,'roster_payment_event',coalesce(p_roster_entry_id,p_tournament_id),'manual_roster_payment_void_rejected',v_response);
    end if;
    return v_response;
  when others then raise;
  end;
end;
$$;

create or replace function public.get_roster_payment_operation_reconciliation(
  p_tournament_id uuid,
  p_roster_entry_id uuid,
  p_idempotency_key uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = auth.uid()
      and r.role in ('director', 'co_director')
  ) then (
    select o.response_payload
    from app.operation_receipts o
    where o.actor_profile_id = auth.uid() and o.tournament_id = p_tournament_id
      and o.target_id = p_roster_entry_id and o.client_operation_id = p_idempotency_key
      and o.operation_type in ('record_manual_roster_payment', 'void_manual_roster_payment')
    limit 1
  ) else null end
$$;

revoke all on function app.revalidate_roster_payment_history(uuid) from public, anon, authenticated;
revoke all on function app.revalidate_roster_payment_history_from_event() from public, anon, authenticated;
revoke all on function public.record_manual_roster_payment(uuid,uuid,integer,integer,text,text,timestamptz,text,uuid) from public, anon;
revoke all on function public.void_manual_roster_payment(uuid,uuid,integer,uuid,text,uuid) from public, anon;
revoke all on function public.get_roster_payment_operation_reconciliation(uuid,uuid,uuid) from public, anon;
grant execute on function public.record_manual_roster_payment(uuid,uuid,integer,integer,text,text,timestamptz,text,uuid) to authenticated;
grant execute on function public.void_manual_roster_payment(uuid,uuid,integer,uuid,text,uuid) to authenticated;
grant execute on function public.get_roster_payment_operation_reconciliation(uuid,uuid,uuid) to authenticated;
