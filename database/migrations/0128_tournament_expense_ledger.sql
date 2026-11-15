-- Private tournament expense ledger for the September pilot. An expense is an
-- immutable director-approved event. A mistake is reversed by a second event;
-- no payout, Q-pool, MRP, reimbursement, tax, or reconciliation rule is inferred.

create table app.tournament_expense_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  expense_id uuid not null,
  version integer not null check (version in (1, 2)),
  event_type text not null check (event_type in ('recorded', 'voided')),
  description text not null check (
    length(trim(description)) between 1 and 200
    and octet_length(description) <= 800
  ),
  amount_minor integer not null check (amount_minor > 0),
  currency_code text not null check (currency_code = 'USD'),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  actor_role text not null check (actor_role in ('director', 'co_director')),
  void_reason text,
  voids_expense_event_id uuid,
  operation_receipt_id uuid not null,
  recorded_at timestamptz not null default now(),
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  foreign key (voids_expense_event_id, expense_id, tournament_id)
    references app.tournament_expense_events(id, expense_id, tournament_id) on delete restrict,
  unique (id, expense_id, tournament_id),
  unique (expense_id, version),
  unique (voids_expense_event_id),
  check (
    (event_type = 'recorded' and version = 1
      and void_reason is null and voids_expense_event_id is null)
    or
    (event_type = 'voided' and version = 2
      and void_reason is not null
      and length(trim(void_reason)) between 1 and 500
      and octet_length(void_reason) <= 2000
      and voids_expense_event_id is not null)
  )
);
alter table app.tournament_expense_events enable row level security;
alter table app.tournament_expense_events force row level security;
revoke all on table app.tournament_expense_events from public, anon, authenticated;
create trigger tournament_expense_events_immutable
before update or delete on app.tournament_expense_events
for each row execute function app.reject_immutable_history();
create index tournament_expense_events_tournament_recorded_idx
  on app.tournament_expense_events(tournament_id, recorded_at desc);
create index tournament_expense_events_actor_profile_id_idx
  on app.tournament_expense_events(actor_profile_id);
create index tournament_expense_events_operation_receipt_scope_idx
  on app.tournament_expense_events(operation_receipt_id, tournament_id);
create index tournament_expense_events_void_scope_idx
  on app.tournament_expense_events(voids_expense_event_id, expense_id, tournament_id);

create table app.tournament_expense_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  attempted_expense_id uuid,
  attempted_operation_type text not null check (
    attempted_operation_type in ('record_tournament_expense', 'void_tournament_expense')
  ),
  attempted_idempotency_key uuid not null,
  attempted_request_hash text not null check (attempted_request_hash ~ '^[0-9a-f]{64}$'),
  prior_receipt_id uuid,
  reason_code text not null check (reason_code = 'idempotency_conflict'),
  created_at timestamptz not null default now(),
  foreign key (prior_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict
);
alter table app.tournament_expense_operation_conflicts enable row level security;
alter table app.tournament_expense_operation_conflicts force row level security;
revoke all on table app.tournament_expense_operation_conflicts from public, anon, authenticated;
create trigger tournament_expense_operation_conflicts_immutable
before update or delete on app.tournament_expense_operation_conflicts
for each row execute function app.reject_immutable_history();
create index tournament_expense_conflicts_actor_profile_id_idx
  on app.tournament_expense_operation_conflicts(actor_profile_id);
create index tournament_expense_conflicts_tournament_id_idx
  on app.tournament_expense_operation_conflicts(tournament_id);
create index tournament_expense_conflicts_attempted_expense_id_idx
  on app.tournament_expense_operation_conflicts(attempted_expense_id);
create index tournament_expense_conflicts_prior_receipt_scope_idx
  on app.tournament_expense_operation_conflicts(prior_receipt_id, tournament_id);

create or replace function app.revalidate_tournament_expense_history(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_max_version integer;
begin
  select count(*), coalesce(max(version), 0)
    into v_count, v_max_version
  from app.tournament_expense_events
  where expense_id = p_expense_id;

  if v_count <> v_max_version or v_max_version not in (1, 2) then
    raise exception 'expense event versions must be contiguous';
  end if;
  if exists (
    select 1 from app.tournament_expense_events e
    where e.expense_id = p_expense_id
      and ((e.version = 1 and e.event_type <> 'recorded')
        or (e.version = 2 and e.event_type <> 'voided'))
  ) then
    raise exception 'expense event lifecycle is invalid';
  end if;
  if exists (
    select 1
    from app.tournament_expense_events e
    join app.operation_receipts receipt
      on receipt.id = e.operation_receipt_id
      and receipt.tournament_id = e.tournament_id
    where e.expense_id = p_expense_id
      and (receipt.actor_profile_id <> e.actor_profile_id
        or receipt.target_id <> e.expense_id
        or receipt.outcome <> 'accepted'
        or receipt.operation_type <> case when e.event_type = 'recorded'
          then 'record_tournament_expense' else 'void_tournament_expense' end)
  ) then
    raise exception 'expense event authority is invalid';
  end if;
  if exists (
    select 1
    from app.tournament_expense_events reversal
    left join app.tournament_expense_events original
      on original.id = reversal.voids_expense_event_id
      and original.expense_id = reversal.expense_id
      and original.tournament_id = reversal.tournament_id
    where reversal.expense_id = p_expense_id
      and reversal.event_type = 'voided'
      and (original.id is null or original.event_type <> 'recorded'
        or original.version <> 1
        or reversal.version <> 2
        or original.description <> reversal.description
        or original.amount_minor <> reversal.amount_minor
        or original.currency_code <> reversal.currency_code)
  ) then
    raise exception 'expense void must reverse the matching recorded event';
  end if;
end;
$$;

create or replace function app.revalidate_tournament_expense_history_from_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.revalidate_tournament_expense_history(coalesce(new.expense_id, old.expense_id));
  return null;
end;
$$;

create constraint trigger tournament_expense_history_revalidation
after insert or update or delete on app.tournament_expense_events
deferrable initially deferred for each row
execute function app.revalidate_tournament_expense_history_from_event();

create or replace function public.record_tournament_expense(
  p_tournament_id uuid,
  p_amount_minor integer,
  p_currency_code text,
  p_description text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_tournament_status text;
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_description text;
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_receipt_id uuid;
  v_expense_id uuid := extensions.gen_random_uuid();
  v_event_id uuid := extensions.gen_random_uuid();
  v_response jsonb;
  v_error text;
  v_code text;
begin
  begin
    if v_actor is null then
      raise exception using errcode = 'P0001', message = 'authentication required';
    end if;
    v_description := trim(p_description);
    if p_tournament_id is null or p_amount_minor is null or p_amount_minor <= 0
       or p_currency_code is distinct from 'USD'
       or p_description is null or length(v_description) not between 1 and 200
       or octet_length(v_description) > 800 or p_idempotency_key is null then
      raise exception using errcode = 'P0001', message = 'invalid tournament expense';
    end if;

    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'record_tournament_expense', p_tournament_id::text, p_amount_minor,
      p_currency_code, v_description, p_idempotency_key::text
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
    );

    select status into v_tournament_status from app.tournaments
    where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;
    select role_row.role into v_actor_role from app.tournament_roles role_row
    where role_row.tournament_id = p_tournament_id
      and role_row.profile_id = v_actor
      and role_row.role in ('director', 'co_director')
    limit 1 for update;
    if v_actor_role is null then
      raise exception using errcode = 'P0001', message = 'director role required';
    end if;
    v_authorized := true;

    select * into v_existing from app.operation_receipts
    where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.tournament_id <> p_tournament_id
         or v_existing.operation_type <> 'record_tournament_expense'
         or v_existing.request_hash <> v_hash then
        raise exception using errcode = 'P0001', message = 'idempotency conflict';
      end if;
      return v_existing.response_payload;
    end if;

    if v_tournament_status not in ('draft', 'open', 'pending_finalization') then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;

    v_response := jsonb_build_object(
      'status', 'expense_recorded',
      'expenseId', v_expense_id,
      'expenseEventId', v_event_id,
      'expenseVersion', 1,
      'expenseState', 'recorded',
      'amountMinor', p_amount_minor,
      'currencyCode', 'USD',
      'reconciled', false
    );
    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id,
      request_hash, client_operation_id, outcome, response_payload, applied_at
    ) values (
      v_actor, p_tournament_id, 'record_tournament_expense', v_expense_id,
      v_hash, p_idempotency_key, 'accepted', v_response, now()
    ) returning id into v_receipt_id;
    insert into app.tournament_expense_events(
      id, tournament_id, expense_id, version, event_type, description,
      amount_minor, currency_code, actor_profile_id, actor_role,
      operation_receipt_id
    ) values (
      v_event_id, p_tournament_id, v_expense_id, 1, 'recorded', v_description,
      p_amount_minor, 'USD', v_actor, v_actor_role, v_receipt_id
    );
    insert into app.audit_events(
      tournament_id, actor_profile_id, operation_receipt_id,
      entity_type, entity_id, action, after_state
    ) values (
      p_tournament_id, v_actor, v_receipt_id,
      'tournament_expense', v_expense_id, 'tournament_expense_recorded', v_response
    );
    return v_response;
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_error = message_text;
      v_code := case v_error
        when 'authentication required' then 'authentication_required'
        when 'director role required' then 'not_director'
        when 'idempotency conflict' then 'idempotency_conflict'
        when 'tournament unavailable' then 'tournament_unavailable'
        when 'invalid tournament expense' then 'invalid_request'
        else 'expense_recording_rejected'
      end;
      v_response := jsonb_build_object(
        'status', 'rejected', 'code', v_code, 'expenseId', null
      );
      if v_error = 'idempotency conflict' and v_authorized and v_tournament_exists then
        insert into app.tournament_expense_operation_conflicts(
          actor_profile_id, tournament_id, attempted_expense_id,
          attempted_operation_type, attempted_idempotency_key,
          attempted_request_hash, prior_receipt_id, reason_code
        ) values (
          v_actor, p_tournament_id, null, 'record_tournament_expense',
          p_idempotency_key, v_hash,
          case when v_existing.tournament_id = p_tournament_id then v_existing.id else null end,
          'idempotency_conflict'
        );
      elsif v_authorized and v_tournament_exists
        and p_idempotency_key is not null and v_hash is not null then
        insert into app.operation_receipts(
          actor_profile_id, tournament_id, operation_type, target_id,
          request_hash, client_operation_id, outcome, response_payload, applied_at
        ) values (
          v_actor, p_tournament_id, 'record_tournament_expense', p_tournament_id,
          v_hash, p_idempotency_key, 'rejected', v_response, now()
        ) returning id into v_receipt_id;
        insert into app.audit_events(
          tournament_id, actor_profile_id, operation_receipt_id,
          entity_type, entity_id, action, after_state
        ) values (
          p_tournament_id, v_actor, v_receipt_id,
          'tournament_expense', p_tournament_id, 'tournament_expense_rejected', v_response
        );
      end if;
      return v_response;
    when others then
      raise;
  end;
end;
$$;

create or replace function public.void_tournament_expense(
  p_tournament_id uuid,
  p_expense_id uuid,
  p_expected_expense_version integer,
  p_expense_event_id uuid,
  p_void_reason text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_tournament_status text;
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_reason text;
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_current app.tournament_expense_events%rowtype;
  v_receipt_id uuid;
  v_void_event_id uuid := extensions.gen_random_uuid();
  v_response jsonb;
  v_error text;
  v_code text;
begin
  begin
    if v_actor is null then
      raise exception using errcode = 'P0001', message = 'authentication required';
    end if;
    v_reason := trim(p_void_reason);
    if p_tournament_id is null or p_expense_id is null
       or p_expected_expense_version is null or p_expected_expense_version < 1
       or p_expense_event_id is null or p_void_reason is null
       or length(v_reason) not between 1 and 500
       or octet_length(v_reason) > 2000 or p_idempotency_key is null then
      raise exception using errcode = 'P0001', message = 'invalid expense void';
    end if;

    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'void_tournament_expense', p_tournament_id::text, p_expense_id::text,
      p_expected_expense_version, p_expense_event_id::text, v_reason,
      p_idempotency_key::text
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
    );

    select status into v_tournament_status from app.tournaments
    where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;
    select role_row.role into v_actor_role from app.tournament_roles role_row
    where role_row.tournament_id = p_tournament_id
      and role_row.profile_id = v_actor
      and role_row.role in ('director', 'co_director')
    limit 1 for update;
    if v_actor_role is null then
      raise exception using errcode = 'P0001', message = 'director role required';
    end if;
    v_authorized := true;

    select * into v_existing from app.operation_receipts
    where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.tournament_id <> p_tournament_id
         or v_existing.operation_type <> 'void_tournament_expense'
         or v_existing.target_id <> p_expense_id
         or v_existing.request_hash <> v_hash then
        raise exception using errcode = 'P0001', message = 'idempotency conflict';
      end if;
      return v_existing.response_payload;
    end if;

    if v_tournament_status not in ('draft', 'open', 'pending_finalization') then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;
    select * into v_current from app.tournament_expense_events
    where tournament_id = p_tournament_id and expense_id = p_expense_id
    order by version desc limit 1 for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'expense unavailable';
    end if;
    if v_current.version is distinct from p_expected_expense_version then
      raise exception using errcode = 'P0001', message = 'stale expense history';
    end if;
    if v_current.event_type <> 'recorded' or v_current.id <> p_expense_event_id then
      raise exception using errcode = 'P0001', message = 'current expense event required';
    end if;

    v_response := jsonb_build_object(
      'status', 'expense_voided',
      'expenseId', p_expense_id,
      'expenseEventId', v_void_event_id,
      'voidedExpenseEventId', v_current.id,
      'expenseVersion', v_current.version + 1,
      'expenseState', 'voided',
      'amountMinor', v_current.amount_minor,
      'currencyCode', v_current.currency_code,
      'reconciled', false
    );
    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id,
      request_hash, client_operation_id, outcome, response_payload, applied_at
    ) values (
      v_actor, p_tournament_id, 'void_tournament_expense', p_expense_id,
      v_hash, p_idempotency_key, 'accepted', v_response, now()
    ) returning id into v_receipt_id;
    insert into app.tournament_expense_events(
      id, tournament_id, expense_id, version, event_type, description,
      amount_minor, currency_code, actor_profile_id, actor_role,
      void_reason, voids_expense_event_id, operation_receipt_id
    ) values (
      v_void_event_id, p_tournament_id, p_expense_id, v_current.version + 1,
      'voided', v_current.description, v_current.amount_minor,
      v_current.currency_code, v_actor, v_actor_role, v_reason,
      v_current.id, v_receipt_id
    );
    insert into app.audit_events(
      tournament_id, actor_profile_id, operation_receipt_id,
      entity_type, entity_id, action, before_state, after_state
    ) values (
      p_tournament_id, v_actor, v_receipt_id,
      'tournament_expense', p_expense_id, 'tournament_expense_voided',
      jsonb_build_object(
        'expenseEventId', v_current.id,
        'expenseVersion', v_current.version,
        'expenseState', v_current.event_type,
        'amountMinor', v_current.amount_minor,
        'currencyCode', v_current.currency_code
      ),
      v_response
    );
    return v_response;
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_error = message_text;
      v_code := case v_error
        when 'authentication required' then 'authentication_required'
        when 'director role required' then 'not_director'
        when 'idempotency conflict' then 'idempotency_conflict'
        when 'tournament unavailable' then 'tournament_unavailable'
        when 'expense unavailable' then 'expense_unavailable'
        when 'stale expense history' then 'stale_expense_history'
        when 'current expense event required' then 'current_expense_event_required'
        when 'invalid expense void' then 'invalid_request'
        else 'expense_void_rejected'
      end;
      v_response := jsonb_build_object(
        'status', 'rejected', 'code', v_code, 'expenseId', p_expense_id
      );
      if v_error = 'idempotency conflict' and v_authorized and v_tournament_exists then
        insert into app.tournament_expense_operation_conflicts(
          actor_profile_id, tournament_id, attempted_expense_id,
          attempted_operation_type, attempted_idempotency_key,
          attempted_request_hash, prior_receipt_id, reason_code
        ) values (
          v_actor, p_tournament_id, p_expense_id, 'void_tournament_expense',
          p_idempotency_key, v_hash,
          case when v_existing.tournament_id = p_tournament_id then v_existing.id else null end,
          'idempotency_conflict'
        );
      elsif v_authorized and v_tournament_exists
        and p_idempotency_key is not null and v_hash is not null then
        insert into app.operation_receipts(
          actor_profile_id, tournament_id, operation_type, target_id,
          request_hash, client_operation_id, outcome, response_payload, applied_at
        ) values (
          v_actor, p_tournament_id, 'void_tournament_expense',
          coalesce(p_expense_id, p_tournament_id), v_hash, p_idempotency_key,
          'rejected', v_response, now()
        ) returning id into v_receipt_id;
        insert into app.audit_events(
          tournament_id, actor_profile_id, operation_receipt_id,
          entity_type, entity_id, action, after_state
        ) values (
          p_tournament_id, v_actor, v_receipt_id,
          'tournament_expense', coalesce(p_expense_id, p_tournament_id),
          'tournament_expense_void_rejected', v_response
        );
      end if;
      return v_response;
    when others then
      raise;
  end;
end;
$$;

create or replace function public.get_tournament_expense_workspace(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is not null and p_tournament_id is not null
    and exists (
      select 1 from app.tournament_roles role_row
      where role_row.tournament_id = p_tournament_id
        and role_row.profile_id = auth.uid()
        and role_row.role in ('director', 'co_director')
    )
  then jsonb_build_object(
    'tournamentId', p_tournament_id,
    'currencyCode', 'USD',
    'activeExpenseTotalMinor', coalesce((
      select sum(recorded.amount_minor)::bigint
      from app.tournament_expense_events recorded
      where recorded.tournament_id = p_tournament_id
        and recorded.event_type = 'recorded'
        and not exists (
          select 1 from app.tournament_expense_events reversal
          where reversal.tournament_id = recorded.tournament_id
            and reversal.expense_id = recorded.expense_id
            and reversal.event_type = 'voided'
        )
    ), 0),
    'reconciled', false,
    'expenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'expenseId', recorded.expense_id,
        'expenseVersion', current_event.version,
        'expenseState', current_event.event_type,
        'currentExpenseEventId', case when current_event.event_type = 'recorded'
          then current_event.id else null end,
        'description', recorded.description,
        'amountMinor', recorded.amount_minor,
        'currencyCode', recorded.currency_code,
        'history', history.events
      ) order by recorded.recorded_at desc, recorded.expense_id)
      from app.tournament_expense_events recorded
      join lateral (
        select e.id, e.version, e.event_type
        from app.tournament_expense_events e
        where e.tournament_id = recorded.tournament_id
          and e.expense_id = recorded.expense_id
        order by e.version desc limit 1
      ) current_event on true
      join lateral (
        select jsonb_agg(jsonb_build_object(
          'expenseEventId', e.id,
          'version', e.version,
          'eventType', e.event_type,
          'description', e.description,
          'amountMinor', e.amount_minor,
          'currencyCode', e.currency_code,
          'voidReason', e.void_reason,
          'approvalActorDisplayName', profile.display_name,
          'recordedAt', e.recorded_at
        ) order by e.version desc) as events
        from app.tournament_expense_events e
        join app.profiles profile on profile.id = e.actor_profile_id
        where e.tournament_id = recorded.tournament_id
          and e.expense_id = recorded.expense_id
      ) history on true
      where recorded.tournament_id = p_tournament_id
        and recorded.event_type = 'recorded'
    ), '[]'::jsonb)
  ) else null end
$$;

create or replace function public.get_tournament_expense_operation_reconciliation(
  p_tournament_id uuid,
  p_operation_type text,
  p_idempotency_key uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is not null and p_tournament_id is not null
    and p_idempotency_key is not null
    and p_operation_type in ('record_tournament_expense', 'void_tournament_expense')
    and exists (
      select 1 from app.tournament_roles role_row
      where role_row.tournament_id = p_tournament_id
        and role_row.profile_id = auth.uid()
        and role_row.role in ('director', 'co_director')
    )
  then jsonb_build_object(
    'authorized', true,
    'result', (
      select receipt.response_payload from app.operation_receipts receipt
      where receipt.actor_profile_id = auth.uid()
        and receipt.tournament_id = p_tournament_id
        and receipt.operation_type = p_operation_type
        and receipt.client_operation_id = p_idempotency_key
      limit 1
    )
  ) else null end
$$;

revoke all on function app.revalidate_tournament_expense_history(uuid)
  from public, anon, authenticated;
revoke all on function app.revalidate_tournament_expense_history_from_event()
  from public, anon, authenticated;
revoke all on function public.record_tournament_expense(uuid, integer, text, text, uuid)
  from public, anon;
revoke all on function public.void_tournament_expense(uuid, uuid, integer, uuid, text, uuid)
  from public, anon;
revoke all on function public.get_tournament_expense_workspace(uuid)
  from public, anon;
revoke all on function public.get_tournament_expense_operation_reconciliation(uuid, text, uuid)
  from public, anon;
grant execute on function public.record_tournament_expense(uuid, integer, text, text, uuid)
  to authenticated;
grant execute on function public.void_tournament_expense(uuid, uuid, integer, uuid, text, uuid)
  to authenticated;
grant execute on function public.get_tournament_expense_workspace(uuid)
  to authenticated;
grant execute on function public.get_tournament_expense_operation_reconciliation(uuid, text, uuid)
  to authenticated;
