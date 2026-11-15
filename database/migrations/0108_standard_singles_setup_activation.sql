-- Narrow, server-only activation of one latest director-approved Standard Singles
-- setup revision. This creates only the operational ruleset/event boundary; it
-- deliberately does not create rounds, seating, participants, finance, results,
-- qualifications, payouts, or ACC submission artifacts.

create table app.tournament_setup_activations (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null unique references app.tournaments(id) on delete restrict,
  setup_revision_id uuid not null,
  setup_event_version_id uuid not null,
  ruleset_version_id uuid not null,
  event_id uuid not null,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (setup_revision_id, tournament_id)
    references app.tournament_setup_revisions(id, tournament_id) on delete restrict,
  foreign key (setup_event_version_id, tournament_id, setup_revision_id)
    references app.tournament_setup_event_versions(id, tournament_id, setup_revision_id) on delete restrict,
  foreign key (ruleset_version_id, tournament_id)
    references app.ruleset_versions(id, tournament_id) on delete restrict,
  foreign key (event_id, tournament_id)
    references app.events(id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id, actor_profile_id)
    references app.operation_receipts(id, tournament_id, actor_profile_id) on delete restrict,
  unique (setup_event_version_id),
  unique (ruleset_version_id),
  unique (event_id)
);
alter table app.tournament_setup_activations enable row level security;
alter table app.tournament_setup_activations force row level security;
revoke all on table app.tournament_setup_activations from public, anon, authenticated;
create trigger tournament_setup_activations_immutable
before update or delete on app.tournament_setup_activations
for each row execute function app.reject_immutable_history();
create index tournament_setup_activations_actor_profile_id_idx
  on app.tournament_setup_activations(actor_profile_id);
create index tournament_setup_activations_receipt_scope_idx
  on app.tournament_setup_activations(operation_receipt_id, tournament_id, actor_profile_id);
create index tournament_setup_activations_revision_scope_idx
  on app.tournament_setup_activations(setup_revision_id, tournament_id);
create index tournament_setup_activations_event_scope_idx
  on app.tournament_setup_activations(event_id, tournament_id);
create index tournament_setup_activations_ruleset_scope_idx
  on app.tournament_setup_activations(ruleset_version_id, tournament_id);
create index tournament_setup_activations_setup_event_scope_idx
  on app.tournament_setup_activations(setup_event_version_id, tournament_id, setup_revision_id);

create table app.tournament_setup_activation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  setup_revision_id uuid not null,
  expected_version integer not null check (expected_version > 0),
  attempted_idempotency_key uuid not null,
  attempted_request_hash text not null check (length(attempted_request_hash) = 64),
  prior_receipt_id uuid,
  reason_code text not null check (reason_code = 'idempotency_conflict'),
  created_at timestamptz not null default now(),
  foreign key (prior_receipt_id, tournament_id, actor_profile_id)
    references app.operation_receipts(id, tournament_id, actor_profile_id) on delete restrict
);
alter table app.tournament_setup_activation_conflicts enable row level security;
alter table app.tournament_setup_activation_conflicts force row level security;
revoke all on table app.tournament_setup_activation_conflicts from public, anon, authenticated;
create trigger tournament_setup_activation_conflicts_immutable
before update or delete on app.tournament_setup_activation_conflicts
for each row execute function app.reject_immutable_history();
create index tournament_setup_activation_conflicts_actor_profile_id_idx
  on app.tournament_setup_activation_conflicts(actor_profile_id);
create index tournament_setup_activation_conflicts_tournament_id_idx
  on app.tournament_setup_activation_conflicts(tournament_id);
create index tournament_setup_activation_conflicts_receipt_scope_idx
  on app.tournament_setup_activation_conflicts(prior_receipt_id, tournament_id, actor_profile_id);

create or replace function public.activate_standard_singles_setup_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_setup_revision_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_tournament app.tournaments%rowtype;
  v_setup_revision app.tournament_setup_revisions%rowtype;
  v_setup_event app.tournament_setup_event_versions%rowtype;
  v_setup_event_count integer;
  v_current_version integer;
  v_current_official_count integer;
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_receipt_id uuid;
  v_activation_id uuid := extensions.gen_random_uuid();
  v_ruleset_id uuid := extensions.gen_random_uuid();
  v_event_id uuid := extensions.gen_random_uuid();
  v_response jsonb;
  v_error text;
  v_code text;
begin
  begin
    if p_actor_id is null or p_tournament_id is null or p_setup_revision_id is null
       or p_expected_version is null or p_expected_version < 1 or p_idempotency_key is null then
      raise exception using errcode = 'P0001', message = 'invalid activation request';
    end if;

    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'activate_standard_singles_setup_v1', p_actor_id::text, p_tournament_id::text,
      p_setup_revision_id::text, p_expected_version, p_idempotency_key::text
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_actor_id::text || ':' || p_idempotency_key::text, 0)
    );

    select * into v_tournament from app.tournaments
    where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;

    perform 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = p_actor_id
      and r.role in ('director', 'co_director')
    for update;
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

    if exists (
      select 1 from app.tournament_setup_activations a
      where a.tournament_id = p_tournament_id
    ) then
      raise exception using errcode = 'P0001', message = 'setup already activated';
    end if;

    if v_tournament.status <> 'draft'
       or exists (select 1 from app.events e where e.tournament_id = p_tournament_id)
       or exists (select 1 from app.rounds r where r.tournament_id = p_tournament_id)
       or exists (select 1 from app.canonical_games g where g.tournament_id = p_tournament_id)
       or exists (select 1 from app.initial_seating_publications s where s.tournament_id = p_tournament_id) then
      raise exception using errcode = 'P0001', message = 'activation lifecycle closed';
    end if;

    select * into v_setup_revision from app.tournament_setup_revisions r
    where r.id = p_setup_revision_id and r.tournament_id = p_tournament_id
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'stale setup revision';
    end if;
    select max(r.version) into v_current_version
    from app.tournament_setup_revisions r where r.tournament_id = p_tournament_id;
    if v_setup_revision.version <> p_expected_version or v_current_version <> p_expected_version then
      raise exception using errcode = 'P0001', message = 'stale setup revision';
    end if;

    select count(*) into v_setup_event_count
    from app.tournament_setup_event_versions e
    where e.tournament_id = p_tournament_id and e.setup_revision_id = p_setup_revision_id;
    if v_setup_event_count <> 1 then
      raise exception using errcode = 'P0001', message = 'unsupported setup activation';
    end if;
    select * into v_setup_event from app.tournament_setup_event_versions e
    where e.tournament_id = p_tournament_id and e.setup_revision_id = p_setup_revision_id
    for update;
    if v_setup_event.format_code <> 'standard_singles' then
      raise exception using errcode = 'P0001', message = 'unsupported setup activation';
    end if;

    perform 1 from app.tournament_roles r
    join app.tournament_setup_official_versions o
      on o.tournament_id = r.tournament_id and o.profile_id = r.profile_id and o.role = r.role
    where o.tournament_id = p_tournament_id and o.setup_revision_id = p_setup_revision_id
    for update of r;
    select count(*) into v_current_official_count
    from app.tournament_setup_official_versions o
    join app.tournament_roles r on r.tournament_id = o.tournament_id
      and r.profile_id = o.profile_id and r.role = o.role
    where o.tournament_id = p_tournament_id and o.setup_revision_id = p_setup_revision_id;
    if v_current_official_count <> (
      select count(*) from app.tournament_setup_official_versions o
      where o.tournament_id = p_tournament_id and o.setup_revision_id = p_setup_revision_id
    ) then
      raise exception using errcode = 'P0001', message = 'setup officials stale';
    end if;
    select count(*) into v_current_official_count
    from app.tournament_setup_official_versions o
    join app.tournament_roles r on r.tournament_id = o.tournament_id
      and r.profile_id = o.profile_id and r.role = o.role
    where o.tournament_id = p_tournament_id
      and o.setup_revision_id = p_setup_revision_id
      and o.role = 'director'
      and o.profile_id = v_tournament.director_profile_id;
    if v_current_official_count <> 1 then
      raise exception using errcode = 'P0001', message = 'setup officials stale';
    end if;

    v_response := jsonb_build_object(
      'status', 'standard_singles_activated',
      'activationId', v_activation_id,
      'setupRevisionId', p_setup_revision_id,
      'setupVersion', p_expected_version,
      'rulesetVersionId', v_ruleset_id,
      'eventId', v_event_id,
      'eventType', v_setup_event.event_kind,
      'format', 'standard_singles',
      'scoringMethod', 'digital',
      'roundsCreated', false,
      'participantsEnrolled', false,
      'seatingUpdated', false,
      'financeUpdated', false,
      'resultsUpdated', false,
      'payoutsCalculated', false,
      'qualifiersCalculated', false,
      'accSubmissionCreated', false
    );

    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id, request_hash,
      client_operation_id, outcome, response_payload, applied_at
    ) values (
      p_actor_id, p_tournament_id, 'activate_standard_singles_setup_v1',
      p_tournament_id, v_hash, p_idempotency_key, 'accepted', v_response, now()
    ) returning id into v_receipt_id;

    insert into app.ruleset_versions(
      id, tournament_id, name, format, source_reference, effective_on, approved_at
    ) values (
      v_ruleset_id,
      p_tournament_id,
      'ACC 2025 Standard Singles scoring core / setup ' || p_setup_revision_id::text,
      'standard_singles',
      'ACC Official Tournament Rules 2025; https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf; sha256=db284283420259c99cfcc960bfdf4a6b79c95a5fc1bee02b1817b4af4a02f9fd; scope=standard_singles_scoring_core_only',
      null,
      now()
    );

    insert into app.events(
      id, tournament_id, ruleset_version_id, name, event_type, format, scoring_method
    ) values (
      v_event_id, p_tournament_id, v_ruleset_id, v_setup_event.display_name,
      v_setup_event.event_kind, 'standard_singles', 'digital'
    );

    insert into app.tournament_setup_activations(
      id, tournament_id, setup_revision_id, setup_event_version_id,
      ruleset_version_id, event_id, actor_profile_id, operation_receipt_id
    ) values (
      v_activation_id, p_tournament_id, p_setup_revision_id, v_setup_event.id,
      v_ruleset_id, v_event_id, p_actor_id, v_receipt_id
    );

    update app.tournaments
    set name = v_setup_revision.tournament_name, status = 'open'
    where id = p_tournament_id;

    insert into app.audit_events(
      tournament_id, actor_profile_id, operation_receipt_id,
      entity_type, entity_id, action, after_state
    ) values (
      p_tournament_id, p_actor_id, v_receipt_id,
      'tournament_setup_activation', v_activation_id,
      'standard_singles_setup_activated', v_response
    );

    return v_response;
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_error = message_text;
      v_code := case v_error
        when 'tournament unavailable' then 'tournament_unavailable'
        when 'director role required' then 'not_director'
        when 'idempotency conflict' then 'idempotency_conflict'
        when 'setup already activated' then 'already_activated'
        when 'activation lifecycle closed' then 'activation_lifecycle_closed'
        when 'stale setup revision' then 'stale_setup_revision'
        when 'unsupported setup activation' then 'unsupported_setup'
        when 'setup officials stale' then 'setup_officials_stale'
        else 'invalid_request'
      end;
      v_response := jsonb_build_object('status', 'rejected', 'code', v_code);
      if v_authorized and v_tournament_exists then
        if v_error = 'idempotency conflict' then
          insert into app.tournament_setup_activation_conflicts(
            actor_profile_id, tournament_id, setup_revision_id, expected_version,
            attempted_idempotency_key, attempted_request_hash, prior_receipt_id, reason_code
          ) values (
            p_actor_id, p_tournament_id, p_setup_revision_id, p_expected_version,
            p_idempotency_key, v_hash,
            case when v_existing.tournament_id = p_tournament_id then v_existing.id else null end,
            v_code
          );
        else
          insert into app.operation_receipts(
            actor_profile_id, tournament_id, operation_type, target_id, request_hash,
            client_operation_id, outcome, response_payload, applied_at
          ) values (
            p_actor_id, p_tournament_id, 'activate_standard_singles_setup_v1',
            p_tournament_id, coalesce(v_hash, ''), p_idempotency_key,
            'rejected', v_response, now()
          ) returning id into v_receipt_id;
          insert into app.audit_events(
            tournament_id, actor_profile_id, operation_receipt_id,
            entity_type, entity_id, action, after_state
          ) values (
            p_tournament_id, p_actor_id, v_receipt_id,
            'tournament_setup_activation', p_setup_revision_id,
            'standard_singles_setup_activation_rejected', v_response
          );
        end if;
      end if;
      return v_response;
    when others then
      raise;
  end;
end;
$$;

revoke all on function public.activate_standard_singles_setup_v1(uuid, uuid, uuid, integer, uuid)
from public, anon, authenticated;
grant execute on function public.activate_standard_singles_setup_v1(uuid, uuid, uuid, integer, uuid)
to service_role;
