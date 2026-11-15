-- Director/co-director-only operational boundary. This creates append-only
-- roster check-in evidence and one immutable initial seating publication. It
-- is intentionally not round rotation, player-account linking, or a schedule.

create table app.roster_check_in_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  roster_entry_id uuid not null,
  version integer not null check (version > 0),
  check_in_state text not null check (check_in_state in ('checked_in', 'withdrawn', 'late', 'absent')),
  reason text not null default '' check (length(reason) <= 500 and octet_length(reason) <= 2000),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (roster_entry_id, tournament_id)
    references app.tournament_roster_entries(id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (roster_entry_id, version)
);
alter table app.roster_check_in_events enable row level security;
alter table app.roster_check_in_events force row level security;
revoke all on table app.roster_check_in_events from public, anon, authenticated;
create trigger roster_check_in_events_immutable before update or delete on app.roster_check_in_events
for each row execute function app.reject_immutable_history();
create index roster_check_in_events_current_idx
  on app.roster_check_in_events(tournament_id, roster_entry_id, version desc);
create index roster_check_in_events_actor_profile_id_idx
  on app.roster_check_in_events(actor_profile_id);
create index roster_check_in_events_operation_receipt_id_idx
  on app.roster_check_in_events(operation_receipt_id);

create table app.initial_seating_publications (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null unique references app.tournaments(id) on delete restrict,
  table_count smallint not null check (table_count between 1 and 26),
  seats_per_table smallint not null check (seats_per_table between 2 and 20),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  published_at timestamptz not null default now(),
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (id, tournament_id)
);
alter table app.initial_seating_publications enable row level security;
alter table app.initial_seating_publications force row level security;
revoke all on table app.initial_seating_publications from public, anon, authenticated;
create trigger initial_seating_publications_immutable before update or delete on app.initial_seating_publications
for each row execute function app.reject_immutable_history();
create index initial_seating_publications_actor_profile_id_idx
  on app.initial_seating_publications(actor_profile_id);
create index initial_seating_publications_operation_receipt_id_idx
  on app.initial_seating_publications(operation_receipt_id);

create table app.initial_seating_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  publication_id uuid not null,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  roster_entry_id uuid not null,
  initial_table_seat text not null check (initial_table_seat ~ '^[A-Z]-[1-9][0-9]*$'),
  verification_id text generated always as (initial_table_seat) stored,
  created_at timestamptz not null default now(),
  foreign key (roster_entry_id, tournament_id)
    references app.tournament_roster_entries(id, tournament_id) on delete restrict,
  foreign key (publication_id, tournament_id)
    references app.initial_seating_publications(id, tournament_id) on delete restrict,
  unique (publication_id, roster_entry_id),
  unique (tournament_id, roster_entry_id),
  unique (tournament_id, initial_table_seat),
  unique (tournament_id, verification_id)
);
alter table app.initial_seating_assignments enable row level security;
alter table app.initial_seating_assignments force row level security;
revoke all on table app.initial_seating_assignments from public, anon, authenticated;
create trigger initial_seating_assignments_immutable before update or delete on app.initial_seating_assignments
for each row execute function app.reject_immutable_history();
create index initial_seating_assignments_publication_idx
  on app.initial_seating_assignments(publication_id, initial_table_seat);

create or replace function app.prevent_roster_entry_after_initial_seating()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from app.initial_seating_publications p where p.tournament_id = new.tournament_id) then
    raise exception using errcode = 'P0001', message = 'initial seating already published';
  end if;
  return new;
end;
$$;
revoke all on function app.prevent_roster_entry_after_initial_seating() from public, anon, authenticated;
create trigger tournament_roster_entries_block_after_initial_seating
before insert on app.tournament_roster_entries
for each row execute function app.prevent_roster_entry_after_initial_seating();

create table app.check_in_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid references app.profiles(id) on delete restrict,
  tournament_id uuid references app.tournaments(id) on delete restrict,
  attempted_operation_type text not null check (attempted_operation_type in ('record_roster_check_in_event', 'publish_initial_seating')),
  attempted_target_id uuid,
  attempted_idempotency_key uuid,
  attempted_request_hash text not null,
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);
alter table app.check_in_operation_conflicts enable row level security;
alter table app.check_in_operation_conflicts force row level security;
revoke all on table app.check_in_operation_conflicts from public, anon, authenticated;
create trigger check_in_operation_conflicts_immutable before update or delete on app.check_in_operation_conflicts
for each row execute function app.reject_immutable_history();
create index check_in_operation_conflicts_actor_profile_id_idx
  on app.check_in_operation_conflicts(actor_profile_id);
create index check_in_operation_conflicts_tournament_id_idx
  on app.check_in_operation_conflicts(tournament_id);
create index check_in_operation_conflicts_prior_receipt_id_idx
  on app.check_in_operation_conflicts(prior_receipt_id);

create or replace function public.record_roster_check_in_event(
  p_tournament_id uuid,
  p_roster_entry_id uuid,
  p_check_in_state text,
  p_reason text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_status text;
  v_existing app.operation_receipts%rowtype;
  v_receipt_id uuid;
  v_event_id uuid := extensions.gen_random_uuid();
  v_version integer;
  v_hash text;
  v_response jsonb;
  v_error text;
  v_code text;
begin
  begin
    if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
    if p_tournament_id is null or p_roster_entry_id is null or p_idempotency_key is null
      or p_check_in_state not in ('checked_in', 'withdrawn', 'late', 'absent')
      or p_reason is null or length(p_reason) > 500 or octet_length(p_reason) > 2000 then
      raise exception using errcode = 'P0001', message = 'invalid check in request';
    end if;
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'record_roster_check_in_event', p_tournament_id::text, p_roster_entry_id::text,
      p_check_in_state, p_reason, p_idempotency_key::text
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
    select status into v_status from app.tournaments where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
    if not exists (select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
      and r.profile_id = v_actor and r.role in ('director', 'co_director')) then
      raise exception using errcode = 'P0001', message = 'director role required';
    end if;
    v_authorized := true;
    select * into v_existing from app.operation_receipts where actor_profile_id = v_actor
      and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
      return v_existing.response_payload;
    end if;
    if v_status not in ('draft', 'open') then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
    if not exists (select 1 from app.tournament_roster_entries e where e.id = p_roster_entry_id
      and e.tournament_id = p_tournament_id for update) then
      raise exception using errcode = 'P0001', message = 'roster entry unavailable';
    end if;
    if p_check_in_state = 'checked_in' and exists (
      select 1 from app.initial_seating_publications p where p.tournament_id = p_tournament_id
    ) and not exists (
      select 1 from app.initial_seating_assignments a where a.tournament_id = p_tournament_id
        and a.roster_entry_id = p_roster_entry_id
    ) then
      raise exception using errcode = 'P0001', message = 'initial seating already published';
    end if;
    select coalesce(max(c.version), 0) + 1 into v_version from app.roster_check_in_events c
      where c.tournament_id = p_tournament_id and c.roster_entry_id = p_roster_entry_id;
    v_response := jsonb_build_object('status', 'check_in_recorded', 'checkInEventId', v_event_id,
      'rosterEntryId', p_roster_entry_id, 'checkInState', p_check_in_state,
      'eventEnrolled', false, 'seatAssigned', false, 'verificationIdAssigned', false);
    insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id,
      request_hash, client_operation_id, outcome, response_payload, applied_at)
    values (v_actor, p_tournament_id, 'record_roster_check_in_event', p_roster_entry_id,
      v_hash, p_idempotency_key, 'accepted', v_response, now()) returning id into v_receipt_id;
    insert into app.roster_check_in_events(id, tournament_id, roster_entry_id, version, check_in_state,
      reason, actor_profile_id, operation_receipt_id)
    values (v_event_id, p_tournament_id, p_roster_entry_id, v_version, p_check_in_state,
      p_reason, v_actor, v_receipt_id);
    insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type,
      entity_id, action, after_state)
    values (p_tournament_id, v_actor, v_receipt_id, 'roster_check_in_event', v_event_id,
      'roster_check_in_recorded', v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'authentication required' then 'authentication_required'
      when 'director role required' then 'not_director'
      when 'roster entry unavailable' then 'roster_entry_unavailable'
      when 'initial seating already published' then 'unassigned_check_in_after_seating'
      when 'idempotency conflict' then 'idempotency_conflict'
      when 'invalid check in request' then 'invalid_request'
      else 'check_in_rejected' end;
    v_response := jsonb_build_object('status', 'rejected', 'code', v_code,
      'rosterEntryId', p_roster_entry_id);
    if v_error = 'idempotency conflict' then
      insert into app.check_in_operation_conflicts(actor_profile_id, tournament_id,
        attempted_operation_type, attempted_target_id, attempted_idempotency_key, attempted_request_hash, prior_receipt_id, reason_code)
      values (v_actor, p_tournament_id, 'record_roster_check_in_event', p_roster_entry_id,
        p_idempotency_key, coalesce(v_hash, ''), v_existing.id,
        'idempotency_conflict');
    elsif v_authorized and v_tournament_exists then
      insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id,
        request_hash, client_operation_id, outcome, response_payload, applied_at)
      values (v_actor, p_tournament_id, 'record_roster_check_in_event',
        coalesce(p_roster_entry_id, p_tournament_id), coalesce(v_hash, ''), p_idempotency_key,
        'rejected', v_response, now()) returning id into v_receipt_id;
      insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type,
        entity_id, action, after_state)
      values (p_tournament_id, v_actor, v_receipt_id, 'roster_check_in_event',
        coalesce(p_roster_entry_id, p_tournament_id), 'roster_check_in_rejected', v_response);
    end if;
    return v_response;
  end;
end;
$$;

create or replace function public.publish_initial_seating(
  p_tournament_id uuid,
  p_table_count smallint,
  p_seats_per_table smallint,
  p_assignments jsonb,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_tournament_status text;
  v_registration_status text;
  v_existing app.operation_receipts%rowtype;
  v_receipt_id uuid;
  v_publication_id uuid := extensions.gen_random_uuid();
  v_hash text;
  v_response jsonb;
  v_error text;
  v_code text;
  v_assignment jsonb;
  v_roster_entry_id uuid;
  v_table_seat text;
  v_table_number integer;
  v_seat_number integer;
  v_count integer;
  v_checked_in_count integer;
begin
  begin
    if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
    if p_tournament_id is null or p_idempotency_key is null or p_table_count not between 1 and 26
      or p_seats_per_table not between 2 and 20 or jsonb_typeof(p_assignments) <> 'array'
      or jsonb_array_length(p_assignments) = 0 then
      raise exception using errcode = 'P0001', message = 'invalid seating request';
    end if;
    if jsonb_array_length(p_assignments) > p_table_count * p_seats_per_table then
      raise exception using errcode = 'P0001', message = 'seating capacity exceeded';
    end if;
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'publish_initial_seating', p_tournament_id::text, p_table_count, p_seats_per_table,
      p_assignments, p_idempotency_key::text
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
    select status, registration_status into v_tournament_status, v_registration_status
      from app.tournaments where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
    if not exists (select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
      and r.profile_id = v_actor and r.role in ('director', 'co_director')) then
      raise exception using errcode = 'P0001', message = 'director role required';
    end if;
    v_authorized := true;
    select * into v_existing from app.operation_receipts where actor_profile_id = v_actor
      and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
      return v_existing.response_payload;
    end if;
    if v_tournament_status <> 'open' then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
    if v_registration_status <> 'closed' then raise exception using errcode = 'P0001', message = 'registration must be closed'; end if;
    if exists (select 1 from app.initial_seating_publications p where p.tournament_id = p_tournament_id) then
      raise exception using errcode = 'P0001', message = 'initial seating already published';
    end if;
    for v_assignment in select value from jsonb_array_elements(p_assignments) loop
      if jsonb_typeof(v_assignment) <> 'object'
        or not (v_assignment ? 'rosterEntryId' and v_assignment ? 'tableSeat')
        or (select count(*) from jsonb_object_keys(v_assignment)) <> 2 then
        raise exception using errcode = 'P0001', message = 'invalid seating request';
      end if;
      begin
        v_roster_entry_id := (v_assignment->>'rosterEntryId')::uuid;
      exception when invalid_text_representation then
        raise exception using errcode = 'P0001', message = 'invalid seating request';
      end;
      v_table_seat := v_assignment->>'tableSeat';
      if v_table_seat is null or v_table_seat !~ '^[A-Z]-[1-9][0-9]*$' then raise exception using errcode = 'P0001', message = 'invalid seating request'; end if;
      v_table_number := ascii(split_part(v_table_seat, '-', 1)) - ascii('A') + 1;
      v_seat_number := split_part(v_table_seat, '-', 2)::integer;
      if v_table_number not between 1 and p_table_count or v_seat_number not between 1 and p_seats_per_table then
        raise exception using errcode = 'P0001', message = 'seating capacity exceeded';
      end if;
    end loop;
    select count(*) into v_count from jsonb_array_elements(p_assignments) value;
    if (select count(distinct value->>'rosterEntryId') from jsonb_array_elements(p_assignments) value) <> v_count
      or (select count(distinct value->>'tableSeat') from jsonb_array_elements(p_assignments) value) <> v_count then
      raise exception using errcode = 'P0001', message = 'duplicate seating assignment';
    end if;
    if (select count(*) from jsonb_array_elements(p_assignments) value
      where not exists (select 1 from app.tournament_roster_entries e where e.id = (value->>'rosterEntryId')::uuid
        and e.tournament_id = p_tournament_id)
      or coalesce((select c.check_in_state from app.roster_check_in_events c where c.tournament_id = p_tournament_id
        and c.roster_entry_id = (value->>'rosterEntryId')::uuid order by c.version desc limit 1), '') <> 'checked_in') <> 0 then
      raise exception using errcode = 'P0001', message = 'checked in roster required';
    end if;
    select count(*) into v_checked_in_count from app.tournament_roster_entries e
    where e.tournament_id = p_tournament_id and coalesce((select c.check_in_state
      from app.roster_check_in_events c where c.tournament_id = p_tournament_id
        and c.roster_entry_id = e.id order by c.version desc limit 1), '') = 'checked_in';
    if v_checked_in_count <> v_count then
      raise exception using errcode = 'P0001', message = 'checked in roster required';
    end if;
    v_response := jsonb_build_object('status', 'initial_seating_published',
      'publicationId', v_publication_id, 'assignmentCount', v_count,
      'registrationClosed', true, 'roundRotationGenerated', false);
    insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id,
      request_hash, client_operation_id, outcome, response_payload, applied_at)
    values (v_actor, p_tournament_id, 'publish_initial_seating', p_tournament_id,
      v_hash, p_idempotency_key, 'accepted', v_response, now()) returning id into v_receipt_id;
    insert into app.initial_seating_publications(id, tournament_id, table_count, seats_per_table,
      actor_profile_id, operation_receipt_id)
    values (v_publication_id, p_tournament_id, p_table_count, p_seats_per_table, v_actor, v_receipt_id);
    insert into app.initial_seating_assignments(publication_id, tournament_id, roster_entry_id, initial_table_seat)
    select v_publication_id, p_tournament_id, (value->>'rosterEntryId')::uuid, value->>'tableSeat'
    from jsonb_array_elements(p_assignments) value;
    insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type,
      entity_id, action, after_state)
    values (p_tournament_id, v_actor, v_receipt_id, 'initial_seating_publication', v_publication_id,
      'initial_seating_published', v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'authentication required' then 'authentication_required'
      when 'director role required' then 'not_director'
      when 'registration must be closed' then 'registration_open'
      when 'checked in roster required' then 'checked_in_roster_required'
      when 'seating capacity exceeded' then 'seating_capacity_exceeded'
      when 'duplicate seating assignment' then 'duplicate_seating_assignment'
      when 'initial seating already published' then 'initial_seating_already_published'
      when 'idempotency conflict' then 'idempotency_conflict'
      when 'invalid seating request' then 'invalid_request'
      else 'initial_seating_rejected' end;
    v_response := jsonb_build_object('status', 'rejected', 'code', v_code);
    if v_error = 'idempotency conflict' then
      insert into app.check_in_operation_conflicts(actor_profile_id, tournament_id,
        attempted_operation_type, attempted_target_id, attempted_idempotency_key, attempted_request_hash, prior_receipt_id, reason_code)
      values (v_actor, p_tournament_id, 'publish_initial_seating', p_tournament_id,
        p_idempotency_key, coalesce(v_hash, ''), v_existing.id,
        'idempotency_conflict');
    elsif v_authorized and v_tournament_exists then
      insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id,
        request_hash, client_operation_id, outcome, response_payload, applied_at)
      values (v_actor, p_tournament_id, 'publish_initial_seating', p_tournament_id,
        coalesce(v_hash, ''), p_idempotency_key, 'rejected', v_response, now()) returning id into v_receipt_id;
      insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type,
        entity_id, action, after_state)
      values (p_tournament_id, v_actor, v_receipt_id, 'initial_seating_publication', p_tournament_id,
        'initial_seating_rejected', v_response);
    end if;
    return v_response;
  end;
end;
$$;

create or replace function public.get_initial_seating_workspace(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
      and r.profile_id = auth.uid() and r.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'publication', (select jsonb_build_object('publicationId', p.id, 'tableCount', p.table_count,
      'seatsPerTable', p.seats_per_table, 'publishedAt', p.published_at,
      'assignments', coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId', a.roster_entry_id,
        'displayName', e.claimed_display_name, 'initialTableSeat', a.initial_table_seat,
        'verificationId', a.verification_id) order by a.initial_table_seat)
        from app.initial_seating_assignments a join app.tournament_roster_entries e on e.id = a.roster_entry_id
          and e.tournament_id = a.tournament_id where a.publication_id = p.id), '[]'::jsonb))
      from app.initial_seating_publications p where p.tournament_id = p_tournament_id),
    'checkIn', coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId', e.id,
      'displayName', e.claimed_display_name, 'state', coalesce(c.check_in_state, 'not_checked_in'))
      order by e.claimed_normalized_name, e.id) from app.tournament_roster_entries e left join lateral (
        select x.check_in_state from app.roster_check_in_events x where x.tournament_id = p_tournament_id
          and x.roster_entry_id = e.id order by x.version desc limit 1
      ) c on true where e.tournament_id = p_tournament_id), '[]'::jsonb)
  ) else null end
$$;

revoke all on function public.record_roster_check_in_event(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.publish_initial_seating(uuid, smallint, smallint, jsonb, uuid) from public, anon;
revoke all on function public.get_initial_seating_workspace(uuid) from public, anon;
grant execute on function public.record_roster_check_in_event(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.publish_initial_seating(uuid, smallint, smallint, jsonb, uuid) to authenticated;
grant execute on function public.get_initial_seating_workspace(uuid) to authenticated;
