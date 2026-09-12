-- Activate the complete latest tournament setup as one atomic operational unit.
-- Standard Singles events are digitally scoreable. Team/doubles/custom formats
-- are deliberately activated as paper/manual events for the October pilot.

alter table app.tournament_setup_activations
  drop constraint if exists tournament_setup_activations_tournament_id_key;

create index if not exists tournament_setup_activations_tournament_id_idx
  on app.tournament_setup_activations(tournament_id);

create or replace function public.activate_tournament_setup_v2(
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
  v_main_count integer;
  v_current_version integer;
  v_current_official_count integer;
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_receipt_id uuid;
  v_activation_ids uuid[] := array[]::uuid[];
  v_ruleset_ids uuid[] := array[]::uuid[];
  v_event_ids uuid[] := array[]::uuid[];
  v_events jsonb := '[]'::jsonb;
  v_response jsonb;
  v_scoring_method text;
  v_index integer := 0;
  v_error text;
  v_code text;
begin
  begin
    if p_actor_id is null or p_tournament_id is null or p_setup_revision_id is null
       or p_expected_version is null or p_expected_version < 1 or p_idempotency_key is null then
      raise exception using errcode = 'P0001', message = 'invalid activation request';
    end if;

    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'activate_tournament_setup_v2', p_actor_id::text, p_tournament_id::text,
      p_setup_revision_id::text, p_expected_version
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

    select count(*), count(*) filter (where event_kind = 'main')
    into v_setup_event_count, v_main_count
    from app.tournament_setup_event_versions e
    where e.tournament_id = p_tournament_id and e.setup_revision_id = p_setup_revision_id;
    if v_setup_event_count < 1 or v_setup_event_count > 32 or v_main_count <> 1 then
      raise exception using errcode = 'P0001', message = 'unsupported setup activation';
    end if;

    perform 1 from app.tournament_setup_event_versions e
    where e.tournament_id = p_tournament_id and e.setup_revision_id = p_setup_revision_id
    order by e.ordinal for update;

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

    for v_setup_event in
      select * from app.tournament_setup_event_versions e
      where e.tournament_id = p_tournament_id and e.setup_revision_id = p_setup_revision_id
      order by e.ordinal
    loop
      v_index := v_index + 1;
      v_activation_ids := array_append(v_activation_ids, extensions.gen_random_uuid());
      v_ruleset_ids := array_append(v_ruleset_ids, extensions.gen_random_uuid());
      v_event_ids := array_append(v_event_ids, extensions.gen_random_uuid());
      v_scoring_method := case when v_setup_event.format_code = 'standard_singles' then 'digital' else 'manual' end;
      v_events := v_events || jsonb_build_array(jsonb_build_object(
        'activationId', v_activation_ids[v_index],
        'setupEventVersionId', v_setup_event.id,
        'rulesetVersionId', v_ruleset_ids[v_index],
        'eventId', v_event_ids[v_index],
        'eventType', v_setup_event.event_kind,
        'name', v_setup_event.display_name,
        'format', v_setup_event.format_code,
        'scoringMethod', v_scoring_method,
        'gameCount', v_setup_event.game_count
      ));
    end loop;

    v_response := jsonb_build_object(
      'status', 'tournament_setup_activated',
      'setupRevisionId', p_setup_revision_id,
      'setupVersion', p_expected_version,
      'eventCount', v_setup_event_count,
      'events', v_events,
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
      p_actor_id, p_tournament_id, 'activate_tournament_setup_v2',
      p_tournament_id, v_hash, p_idempotency_key, 'accepted', v_response, now()
    ) returning id into v_receipt_id;

    v_index := 0;
    for v_setup_event in
      select * from app.tournament_setup_event_versions e
      where e.tournament_id = p_tournament_id and e.setup_revision_id = p_setup_revision_id
      order by e.ordinal
    loop
      v_index := v_index + 1;
      v_scoring_method := case when v_setup_event.format_code = 'standard_singles' then 'digital' else 'manual' end;

      insert into app.ruleset_versions(
        id, tournament_id, name, format, source_reference, effective_on, approved_at
      ) values (
        v_ruleset_ids[v_index], p_tournament_id,
        case when v_setup_event.format_code = 'standard_singles'
          then 'ACC 2025 Standard Singles scoring core / setup event ' || v_setup_event.id::text
          else 'Director-configured paper scoring / setup event ' || v_setup_event.id::text end,
        v_setup_event.format_code,
        case when v_setup_event.format_code = 'standard_singles'
          then 'ACC Official Tournament Rules 2025; https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf; sha256=db284283420259c99cfcc960bfdf4a6b79c95a5fc1bee02b1817b4af4a02f9fd; scope=standard_singles_scoring_core_only'
          else 'Director-configured paper scoring; digital scoring inactive; setup revision=' || p_setup_revision_id::text end,
        null,
        case when v_setup_event.format_code = 'standard_singles' then now() else null end
      );

      insert into app.events(
        id, tournament_id, ruleset_version_id, name, event_type, format, scoring_method
      ) values (
        v_event_ids[v_index], p_tournament_id, v_ruleset_ids[v_index],
        v_setup_event.display_name, v_setup_event.event_kind,
        v_setup_event.format_code, v_scoring_method
      );

      insert into app.tournament_setup_activations(
        id, tournament_id, setup_revision_id, setup_event_version_id,
        ruleset_version_id, event_id, actor_profile_id, operation_receipt_id
      ) values (
        v_activation_ids[v_index], p_tournament_id, p_setup_revision_id, v_setup_event.id,
        v_ruleset_ids[v_index], v_event_ids[v_index], p_actor_id, v_receipt_id
      );
    end loop;

    update app.tournaments
    set name = v_setup_revision.tournament_name, status = 'open'
    where id = p_tournament_id;

    insert into app.audit_events(
      tournament_id, actor_profile_id, operation_receipt_id,
      entity_type, entity_id, action, after_state
    ) values (
      p_tournament_id, p_actor_id, v_receipt_id,
      'tournament_setup_activation', p_setup_revision_id,
      'tournament_setup_activated', v_response
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
            p_actor_id, p_tournament_id, 'activate_tournament_setup_v2',
            p_tournament_id, coalesce(v_hash, ''), p_idempotency_key,
            'rejected', v_response, now()
          ) returning id into v_receipt_id;
          insert into app.audit_events(
            tournament_id, actor_profile_id, operation_receipt_id,
            entity_type, entity_id, action, after_state
          ) values (
            p_tournament_id, p_actor_id, v_receipt_id,
            'tournament_setup_activation', p_setup_revision_id,
            'tournament_setup_activation_rejected', v_response
          );
        end if;
      end if;
      return v_response;
    when others then
      raise;
  end;
end;
$$;

create or replace function public.get_tournament_setup_activation_state_v2(
  p_actor_id uuid,
  p_tournament_id uuid
) returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_revision_id uuid;
  v_version integer;
  v_events jsonb;
begin
  if p_actor_id is null or p_tournament_id is null then return null; end if;
  if not exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = p_actor_id
      and r.role in ('director', 'co_director')
  ) then return null; end if;

  select a.setup_revision_id, r.version
  into v_revision_id, v_version
  from app.tournament_setup_activations a
  join app.tournament_setup_revisions r
    on r.id = a.setup_revision_id and r.tournament_id = a.tournament_id
  where a.tournament_id = p_tournament_id
  order by a.created_at, a.id
  limit 1;

  if v_revision_id is null then
    return jsonb_build_object('status', 'not_activated');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'eventId', e.id,
    'eventType', e.event_type,
    'name', e.name,
    'format', e.format,
    'scoringMethod', e.scoring_method,
    'gameCount', sev.game_count
  ) order by sev.ordinal), '[]'::jsonb)
  into v_events
  from app.tournament_setup_activations a
  join app.events e on e.id = a.event_id and e.tournament_id = a.tournament_id
  join app.tournament_setup_event_versions sev
    on sev.id = a.setup_event_version_id and sev.tournament_id = a.tournament_id
  where a.tournament_id = p_tournament_id and a.setup_revision_id = v_revision_id;

  return jsonb_build_object(
    'status', 'activated',
    'setupRevisionId', v_revision_id,
    'setupVersion', v_version,
    'eventCount', jsonb_array_length(v_events),
    'events', v_events
  );
end;
$$;

revoke all on function public.activate_tournament_setup_v2(uuid, uuid, uuid, integer, uuid)
from public, anon, authenticated;
grant execute on function public.activate_tournament_setup_v2(uuid, uuid, uuid, integer, uuid)
to service_role;

revoke all on function public.get_tournament_setup_activation_state_v2(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.get_tournament_setup_activation_state_v2(uuid, uuid)
to service_role;
