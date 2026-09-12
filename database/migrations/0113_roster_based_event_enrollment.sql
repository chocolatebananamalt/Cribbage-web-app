-- Enroll checked-in roster identities in an activated Standard Singles event.
-- A paper-only roster member may participate without an Auth profile. Digital
-- score submission still requires the existing participant/profile composite
-- foreign key and therefore remains account-bound.

alter table app.event_participants
  alter column profile_id drop not null,
  add column roster_entry_id uuid,
  add constraint event_participants_roster_scope_fkey
    foreign key (roster_entry_id, tournament_id)
    references app.tournament_roster_entries(id, tournament_id) on delete restrict,
  add constraint event_participants_identity_check
    check (profile_id is not null or roster_entry_id is not null),
  add constraint event_participants_event_roster_unique
    unique (event_id, roster_entry_id);

create index event_participants_roster_tournament_idx
  on app.event_participants(roster_entry_id, tournament_id);

create table app.event_roster_enrollment_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  attempted_event_id uuid,
  attempted_idempotency_key uuid not null,
  attempted_request_hash text not null,
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);
alter table app.event_roster_enrollment_conflicts enable row level security;
alter table app.event_roster_enrollment_conflicts force row level security;
revoke all on table app.event_roster_enrollment_conflicts from public, anon, authenticated;
create trigger event_roster_enrollment_conflicts_immutable
before update or delete on app.event_roster_enrollment_conflicts
for each row execute function app.reject_immutable_history();
create index event_roster_enrollment_conflicts_actor_idx
  on app.event_roster_enrollment_conflicts(actor_profile_id);
create index event_roster_enrollment_conflicts_tournament_idx
  on app.event_roster_enrollment_conflicts(tournament_id);
create index event_roster_enrollment_conflicts_receipt_idx
  on app.event_roster_enrollment_conflicts(prior_receipt_id);

create or replace function public.enroll_roster_entries_in_event_v3(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_event_id uuid,
  p_roster_entry_ids jsonb,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_receipt_id uuid;
  v_requested_count integer;
  v_created_count integer := 0;
  v_existing_count integer := 0;
  v_response jsonb;
  v_error text;
  v_code text;
begin
  begin
    if p_actor_id is null or p_tournament_id is null or p_event_id is null
       or p_idempotency_key is null or jsonb_typeof(p_roster_entry_ids) <> 'array' then
      raise exception using errcode = 'P0001', message = 'invalid enrollment request';
    end if;
    v_requested_count := jsonb_array_length(p_roster_entry_ids);
    if v_requested_count < 1 or v_requested_count > 500 then
      raise exception using errcode = 'P0001', message = 'invalid enrollment request';
    end if;
    begin
      perform (value #>> '{}')::uuid from jsonb_array_elements(p_roster_entry_ids);
    exception when invalid_text_representation then
      raise exception using errcode = 'P0001', message = 'invalid enrollment request';
    end;
    if (select count(distinct (value #>> '{}')::uuid) from jsonb_array_elements(p_roster_entry_ids)) <> v_requested_count then
      raise exception using errcode = 'P0001', message = 'duplicate roster entry';
    end if;

    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'enroll_roster_entries_in_event_v3', p_actor_id::text, p_tournament_id::text,
      p_event_id::text, p_roster_entry_ids
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_actor_id::text || ':' || p_idempotency_key::text, 0)
    );

    perform 1 from app.tournaments t where t.id = p_tournament_id and t.status = 'open' for update;
    v_tournament_exists := found;
    if not v_tournament_exists then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;
    perform 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = p_actor_id
      and r.role in ('director', 'co_director') for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'director role required';
    end if;
    v_authorized := true;

    select * into v_existing from app.operation_receipts
    where actor_profile_id = p_actor_id and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.request_hash <> v_hash then
        raise exception using errcode = 'P0001', message = 'idempotency conflict';
      end if;
      return v_existing.response_payload;
    end if;

    perform 1 from app.events e
    join app.ruleset_versions rv on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id
    where e.id = p_event_id and e.tournament_id = p_tournament_id
      and e.format = 'standard_singles' and e.scoring_method = 'digital'
      and rv.format = 'standard_singles' and rv.approved_at is not null
      and exists (
        select 1 from app.tournament_setup_activations a
        where a.tournament_id = e.tournament_id and a.event_id = e.id
      )
    for update of e;
    if not found then
      raise exception using errcode = 'P0001', message = 'event not approved for digital enrollment';
    end if;

    perform 1 from app.tournament_roster_entries r
    where r.tournament_id = p_tournament_id
      and r.id in (select (value #>> '{}')::uuid from jsonb_array_elements(p_roster_entry_ids))
    order by r.id for update;
    if (select count(*) from app.tournament_roster_entries r
        where r.tournament_id = p_tournament_id
          and r.id in (select (value #>> '{}')::uuid from jsonb_array_elements(p_roster_entry_ids))) <> v_requested_count then
      raise exception using errcode = 'P0001', message = 'roster entry unavailable';
    end if;
    if exists (
      select 1 from app.tournament_roster_entries r
      where r.tournament_id = p_tournament_id
        and r.id in (select (value #>> '{}')::uuid from jsonb_array_elements(p_roster_entry_ids))
        and coalesce((select c.check_in_state from app.roster_check_in_events c
          where c.tournament_id = p_tournament_id and c.roster_entry_id = r.id
          order by c.version desc limit 1), '') <> 'checked_in'
    ) then
      raise exception using errcode = 'P0001', message = 'checked in roster required';
    end if;
    if exists (
      select 1 from app.tournament_roster_entries r
      join app.roster_account_links l on l.tournament_id = r.tournament_id and l.roster_entry_id = r.id
      join app.event_participants ep on ep.event_id = p_event_id and ep.profile_id = l.profile_id
      where r.tournament_id = p_tournament_id
        and r.id in (select (value #>> '{}')::uuid from jsonb_array_elements(p_roster_entry_ids))
        and ep.roster_entry_id is distinct from r.id
    ) then
      raise exception using errcode = 'P0001', message = 'profile already enrolled';
    end if;

    select count(*) into v_existing_count from app.event_participants ep
    where ep.tournament_id = p_tournament_id and ep.event_id = p_event_id
      and ep.roster_entry_id in (select (value #>> '{}')::uuid from jsonb_array_elements(p_roster_entry_ids));
    v_created_count := v_requested_count - v_existing_count;

    insert into app.event_participants(
      id, tournament_id, event_id, roster_entry_id, profile_id, table_seat, status
    )
    select extensions.gen_random_uuid(), p_tournament_id, p_event_id, r.id, l.profile_id,
      a.verification_id, 'checked_in'
    from app.tournament_roster_entries r
    left join app.roster_account_links l
      on l.tournament_id = r.tournament_id and l.roster_entry_id = r.id
    left join app.initial_seating_assignments a
      on a.tournament_id = r.tournament_id and a.roster_entry_id = r.id
    where r.tournament_id = p_tournament_id
      and r.id in (select (value #>> '{}')::uuid from jsonb_array_elements(p_roster_entry_ids))
      and not exists (
        select 1 from app.event_participants ep
        where ep.event_id = p_event_id and ep.roster_entry_id = r.id
      );

    select jsonb_build_object(
      'status', 'event_participants_enrolled',
      'eventId', p_event_id,
      'requestedCount', v_requested_count,
      'createdCount', v_created_count,
      'existingCount', v_existing_count,
      'participants', coalesce(jsonb_agg(jsonb_build_object(
        'rosterEntryId', r.id,
        'participantId', ep.id,
        'profileLinked', ep.profile_id is not null,
        'verificationId', a.verification_id
      ) order by r.claimed_normalized_name, r.id), '[]'::jsonb)
    ) into v_response
    from app.tournament_roster_entries r
    join app.event_participants ep
      on ep.tournament_id = r.tournament_id and ep.event_id = p_event_id and ep.roster_entry_id = r.id
    left join app.initial_seating_assignments a
      on a.tournament_id = r.tournament_id and a.roster_entry_id = r.id
    where r.tournament_id = p_tournament_id
      and r.id in (select (value #>> '{}')::uuid from jsonb_array_elements(p_roster_entry_ids));

    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id, request_hash,
      client_operation_id, outcome, response_payload, applied_at
    ) values (
      p_actor_id, p_tournament_id, 'enroll_roster_entries_in_event_v3', p_event_id,
      v_hash, p_idempotency_key, 'accepted', v_response, now()
    ) returning id into v_receipt_id;
    insert into app.audit_events(
      tournament_id, actor_profile_id, operation_receipt_id,
      entity_type, entity_id, action, after_state
    ) values (
      p_tournament_id, p_actor_id, v_receipt_id,
      'event', p_event_id, 'event_roster_enrollment_recorded', v_response
    );
    return v_response;
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_error = message_text;
      v_code := case v_error
        when 'tournament unavailable' then 'tournament_unavailable'
        when 'director role required' then 'not_director'
        when 'idempotency conflict' then 'idempotency_conflict'
        when 'event not approved for digital enrollment' then 'event_not_approved'
        when 'roster entry unavailable' then 'roster_entry_unavailable'
        when 'checked in roster required' then 'not_checked_in'
        when 'duplicate roster entry' then 'duplicate_roster_entry'
        when 'profile already enrolled' then 'profile_already_enrolled'
        else 'invalid_request'
      end;
      v_response := jsonb_build_object('status', 'rejected', 'code', v_code);
      if v_authorized and v_tournament_exists then
        if v_error = 'idempotency conflict' then
          insert into app.event_roster_enrollment_conflicts(
            actor_profile_id, tournament_id, attempted_event_id,
            attempted_idempotency_key, attempted_request_hash, prior_receipt_id, reason_code
          ) values (
            p_actor_id, p_tournament_id, p_event_id, p_idempotency_key,
            coalesce(v_hash, ''),
            case when v_existing.tournament_id = p_tournament_id then v_existing.id else null end,
            v_code
          );
        else
          insert into app.operation_receipts(
            actor_profile_id, tournament_id, operation_type, target_id, request_hash,
            client_operation_id, outcome, response_payload, applied_at
          ) values (
            p_actor_id, p_tournament_id, 'enroll_roster_entries_in_event_v3',
            coalesce(p_event_id, p_tournament_id), coalesce(v_hash, ''), p_idempotency_key,
            'rejected', v_response, now()
          ) returning id into v_receipt_id;
          insert into app.audit_events(
            tournament_id, actor_profile_id, operation_receipt_id,
            entity_type, entity_id, action, after_state
          ) values (
            p_tournament_id, p_actor_id, v_receipt_id,
            'event', coalesce(p_event_id, p_tournament_id),
            'event_roster_enrollment_rejected', v_response
          );
        end if;
      end if;
      return v_response;
    when others then
      raise;
  end;
end;
$$;

create or replace function public.get_event_roster_enrollment_workspace_v3(
  p_actor_id uuid,
  p_tournament_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_actor_id is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles role_row
    where role_row.tournament_id = p_tournament_id
      and role_row.profile_id = p_actor_id
      and role_row.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'tournamentName', t.name,
    'registrationClosed', t.registration_status = 'closed',
    'seatingPublished', exists (
      select 1 from app.initial_seating_publications p where p.tournament_id = t.id
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventId', e.id,
        'name', e.name,
        'eventType', e.event_type,
        'format', e.format,
        'scoringMethod', e.scoring_method,
        'participantCount', (select count(*) from app.event_participants ep where ep.event_id = e.id)
      ) order by sev.ordinal)
      from app.tournament_setup_activations a
      join app.events e on e.id = a.event_id and e.tournament_id = a.tournament_id
      join app.tournament_setup_event_versions sev
        on sev.id = a.setup_event_version_id and sev.tournament_id = a.tournament_id
      where a.tournament_id = t.id
    ), '[]'::jsonb),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rosterEntryId', r.id,
        'displayName', r.claimed_display_name,
        'checkInState', coalesce(ci.check_in_state, 'not_checked_in'),
        'profileLinked', l.profile_id is not null,
        'verificationId', seat.verification_id,
        'enrolledEventIds', coalesce((select jsonb_agg(ep.event_id order by ep.event_id)
          from app.event_participants ep
          where ep.tournament_id = r.tournament_id
            and (ep.roster_entry_id = r.id or (ep.roster_entry_id is null and ep.profile_id = l.profile_id))), '[]'::jsonb)
      ) order by r.claimed_normalized_name, r.id)
      from app.tournament_roster_entries r
      left join app.roster_account_links l
        on l.tournament_id = r.tournament_id and l.roster_entry_id = r.id
      left join lateral (
        select c.check_in_state from app.roster_check_in_events c
        where c.tournament_id = r.tournament_id and c.roster_entry_id = r.id
        order by c.version desc limit 1
      ) ci on true
      left join app.initial_seating_assignments seat
        on seat.tournament_id = r.tournament_id and seat.roster_entry_id = r.id
      where r.tournament_id = t.id
    ), '[]'::jsonb)
  ) else null end
  from app.tournaments t where t.id = p_tournament_id
$$;

revoke all on function public.enroll_roster_entries_in_event_v3(uuid, uuid, uuid, jsonb, uuid)
from public, anon, authenticated;
grant execute on function public.enroll_roster_entries_in_event_v3(uuid, uuid, uuid, jsonb, uuid)
to service_role;
revoke all on function public.get_event_roster_enrollment_workspace_v3(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.get_event_roster_enrollment_workspace_v3(uuid, uuid)
to service_role;
