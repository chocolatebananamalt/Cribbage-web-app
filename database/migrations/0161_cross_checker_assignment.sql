-- Audited director assignment of already-linked tournament accounts as
-- cross-checkers. The October pilot boundary is deliberately assignment-only:
-- completed evidence remains valid and a mistaken assignment requires an
-- explicit support remediation rather than an unaudited browser deletion.

create table app.cross_checker_assignment_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  roster_entry_id uuid not null,
  profile_id uuid not null references app.profiles(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (roster_entry_id, tournament_id)
    references app.tournament_roster_entries(id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (tournament_id, profile_id)
);
alter table app.cross_checker_assignment_events enable row level security;
alter table app.cross_checker_assignment_events force row level security;
revoke all on table app.cross_checker_assignment_events from public, anon, authenticated;
create trigger cross_checker_assignment_events_immutable
before update or delete on app.cross_checker_assignment_events
for each row execute function app.reject_immutable_history();
create index cross_checker_assignment_events_roster_scope_idx
  on app.cross_checker_assignment_events(roster_entry_id, tournament_id);
create index cross_checker_assignment_events_profile_idx
  on app.cross_checker_assignment_events(profile_id);
create index cross_checker_assignment_events_actor_idx
  on app.cross_checker_assignment_events(actor_profile_id);
create index cross_checker_assignment_events_receipt_scope_idx
  on app.cross_checker_assignment_events(operation_receipt_id, tournament_id);

create table app.cross_checker_assignment_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  attempted_roster_entry_id uuid not null,
  attempted_operation_id uuid not null,
  attempted_request_hash text not null,
  prior_receipt_id uuid not null references app.operation_receipts(id) on delete restrict,
  reason_code text not null check (reason_code = 'idempotency_conflict'),
  created_at timestamptz not null default now(),
  unique (actor_profile_id, attempted_operation_id, attempted_request_hash)
);
alter table app.cross_checker_assignment_operation_conflicts enable row level security;
alter table app.cross_checker_assignment_operation_conflicts force row level security;
revoke all on table app.cross_checker_assignment_operation_conflicts from public, anon, authenticated;
create trigger cross_checker_assignment_operation_conflicts_immutable
before update or delete on app.cross_checker_assignment_operation_conflicts
for each row execute function app.reject_immutable_history();
create index cross_checker_assignment_conflicts_tournament_idx
  on app.cross_checker_assignment_operation_conflicts(tournament_id);
create index cross_checker_assignment_conflicts_actor_idx
  on app.cross_checker_assignment_operation_conflicts(actor_profile_id);
create index cross_checker_assignment_conflicts_prior_receipt_idx
  on app.cross_checker_assignment_operation_conflicts(prior_receipt_id);

create or replace function public.get_cross_checker_assignment_workspace_v1(
  p_actor_id uuid,
  p_tournament_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when coalesce(auth.role(), '') = 'service_role'
    and p_actor_id is not null
    and exists (
      select 1 from app.tournament_roles actor_role
      where actor_role.tournament_id = p_tournament_id
        and actor_role.profile_id = p_actor_id
        and actor_role.role in ('director', 'co_director')
    ) then jsonb_build_object(
      'tournamentName', tournament.name,
      'assignments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'assignmentId', assignment.id,
          'displayName', profile.display_name,
          'assignedAt', event.created_at
        ) order by lower(profile.display_name), profile.id)
        from app.tournament_roles assignment
        join app.profiles profile on profile.id = assignment.profile_id
        left join app.cross_checker_assignment_events event
          on event.tournament_id = assignment.tournament_id
          and event.profile_id = assignment.profile_id
        where assignment.tournament_id = tournament.id
          and assignment.role = 'cross_checker'
      ), '[]'::jsonb),
      'candidates', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rosterEntryId', roster.id,
          'displayName', roster.claimed_display_name,
          'identityHint', concat(
            case
              when roster.claimed_acc_number is not null then 'ACC # ' || roster.claimed_acc_number
              when roster.claimed_email is not null then 'Email ' || left(roster.claimed_email, 1) || '***@' || split_part(roster.claimed_email, '@', 2)
              else 'Roster'
            end,
            ' · Ref ', upper(roster.id::text)
          )
        ) order by roster.claimed_normalized_name, roster.id)
        from app.tournament_roster_entries roster
        join app.roster_account_links link_row
          on link_row.tournament_id = roster.tournament_id
          and link_row.roster_entry_id = roster.id
        where roster.tournament_id = tournament.id
          and link_row.profile_id <> p_actor_id
          and not exists (
            select 1 from app.tournament_roles protected_role
            where protected_role.tournament_id = tournament.id
              and protected_role.profile_id = link_row.profile_id
              and protected_role.role in ('director', 'co_director', 'judge', 'cross_checker')
          )
      ), '[]'::jsonb)
    ) else null end
  from app.tournaments tournament
  where tournament.id = p_tournament_id
    and tournament.status in ('draft', 'open')
$$;

create or replace function public.assign_cross_checker_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_roster_entry_id uuid,
  p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tournament_status text;
  v_profile_id uuid;
  v_existing app.operation_receipts%rowtype;
  v_receipt_id uuid;
  v_event_id uuid := extensions.gen_random_uuid();
  v_hash text;
  v_response jsonb;
  v_rejection_code text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only cross-checker assignment';
  end if;
  if p_actor_id is null or p_tournament_id is null or p_roster_entry_id is null or p_operation_id is null then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid_request');
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'assign_cross_checker_v1', p_actor_id::text, p_tournament_id::text,
    p_roster_entry_id::text, p_operation_id::text
  )::text, 'utf8'), 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_actor_id::text || ':' || p_operation_id::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'cross-checker-assignment:' || p_tournament_id::text || ':' || p_roster_entry_id::text, 0));

  select status into v_tournament_status
  from app.tournaments where id = p_tournament_id for update;
  if not found or not exists (
    select 1 from app.tournament_roles actor_role
    where actor_role.tournament_id = p_tournament_id
      and actor_role.profile_id = p_actor_id
      and actor_role.role in ('director', 'co_director')
  ) then
    return jsonb_build_object('status', 'rejected', 'code', 'not_director');
  end if;

  select * into v_existing from app.operation_receipts
  where actor_profile_id = p_actor_id and client_operation_id = p_operation_id for update;
  if found then
    if v_existing.operation_type = 'assign_cross_checker_v1'
      and v_existing.tournament_id = p_tournament_id
      and v_existing.request_hash = v_hash then
      return v_existing.response_payload;
    end if;
    insert into app.cross_checker_assignment_operation_conflicts(
      tournament_id, actor_profile_id, attempted_roster_entry_id,
      attempted_operation_id, attempted_request_hash, prior_receipt_id, reason_code
    ) values (
      p_tournament_id, p_actor_id, p_roster_entry_id,
      p_operation_id, v_hash, v_existing.id, 'idempotency_conflict'
    ) on conflict (actor_profile_id, attempted_operation_id, attempted_request_hash) do nothing;
    return jsonb_build_object('status', 'rejected', 'code', 'idempotency_conflict');
  end if;

  if v_tournament_status not in ('draft', 'open') then
    v_rejection_code := 'tournament_unavailable';
  else
    select link_row.profile_id into v_profile_id
    from app.tournament_roster_entries roster
    join app.roster_account_links link_row
      on link_row.tournament_id = roster.tournament_id
      and link_row.roster_entry_id = roster.id
    where roster.id = p_roster_entry_id
      and roster.tournament_id = p_tournament_id
    for update of roster, link_row;

    if not found then
      v_rejection_code := 'linked_account_required';
    elsif v_profile_id = p_actor_id then
      v_rejection_code := 'self_assignment_forbidden';
    elsif exists (
      select 1 from app.tournament_roles protected_role
      where protected_role.tournament_id = p_tournament_id
        and protected_role.profile_id = v_profile_id
        and protected_role.role in ('director', 'co_director', 'judge')
    ) then
      v_rejection_code := 'official_role_conflict';
    elsif exists (
      select 1 from app.tournament_roles assignment
      where assignment.tournament_id = p_tournament_id
        and assignment.profile_id = v_profile_id
        and assignment.role = 'cross_checker'
    ) then
      v_rejection_code := 'already_assigned';
    end if;
  end if;

  if v_rejection_code is not null then
    v_response := jsonb_build_object('status', 'rejected', 'code', v_rejection_code);
    insert into app.operation_receipts(
      tournament_id, actor_profile_id, operation_type, target_id, request_hash,
      client_operation_id, outcome, response_payload, applied_at
    ) values (
      p_tournament_id, p_actor_id, 'assign_cross_checker_v1', p_roster_entry_id,
      v_hash, p_operation_id, 'rejected', v_response, now()
    ) returning id into v_receipt_id;
    insert into app.audit_events(
      tournament_id, actor_profile_id, operation_receipt_id, entity_type,
      entity_id, action, after_state
    ) values (
      p_tournament_id, p_actor_id, v_receipt_id, 'cross_checker_assignment_attempt',
      p_roster_entry_id, 'cross_checker_assignment_rejected', v_response
    );
    return v_response;
  end if;

  v_response := jsonb_build_object(
    'status', 'cross_checker_assigned',
    'tournamentId', p_tournament_id,
    'rosterEntryId', p_roster_entry_id
  );
  insert into app.operation_receipts(
    tournament_id, actor_profile_id, operation_type, target_id, request_hash,
    client_operation_id, outcome, response_payload, applied_at
  ) values (
    p_tournament_id, p_actor_id, 'assign_cross_checker_v1', p_roster_entry_id,
    v_hash, p_operation_id, 'accepted', v_response, now()
  ) returning id into v_receipt_id;

  insert into app.tournament_roles(tournament_id, profile_id, role)
  values (p_tournament_id, v_profile_id, 'cross_checker');
  insert into app.cross_checker_assignment_events(
    id, tournament_id, roster_entry_id, profile_id, actor_profile_id, operation_receipt_id
  ) values (
    v_event_id, p_tournament_id, p_roster_entry_id, v_profile_id, p_actor_id, v_receipt_id
  );
  insert into app.audit_events(
    tournament_id, actor_profile_id, operation_receipt_id, entity_type,
    entity_id, action, after_state
  ) values (
    p_tournament_id, p_actor_id, v_receipt_id, 'cross_checker_assignment',
    v_event_id, 'cross_checker_assigned', v_response
  );
  return v_response;
end;
$$;

revoke all on function public.get_cross_checker_assignment_workspace_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_cross_checker_assignment_workspace_v1(uuid, uuid)
  to service_role;
revoke all on function public.assign_cross_checker_v1(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_cross_checker_v1(uuid, uuid, uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
