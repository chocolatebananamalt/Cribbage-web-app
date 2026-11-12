-- LOCAL REVIEWED MIGRATION PROPOSAL. Not applied to hosted databases.
-- Explicit opt-in: only a saved schedule later bound during activation adopts these rules.

create table app.setup_prize_schedule_streams_v1 (
  tournament_id uuid not null references app.tournaments(id),
  client_row_id uuid not null,
  created_by uuid not null references app.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  primary key (tournament_id, client_row_id)
);

create table app.setup_prize_schedule_versions_v1 (
  id uuid primary key,
  tournament_id uuid not null references app.tournaments(id),
  client_row_id uuid not null,
  version integer not null check (version > 0),
  supersedes_id uuid,
  schedule_payload jsonb not null,
  settings_snapshot jsonb not null,
  settings_fingerprint text not null check (length(settings_fingerprint) = 64),
  reason text not null check (length(trim(reason)) between 1 and 500),
  reviewed boolean not null check (reviewed),
  recorded_by uuid not null references app.profiles(id),
  operation_receipt_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  foreign key (operation_receipt_id, tournament_id) references app.operation_receipts(id, tournament_id),
  foreign key (tournament_id, client_row_id) references app.setup_prize_schedule_streams_v1(tournament_id, client_row_id),
  foreign key (supersedes_id, tournament_id, client_row_id) references app.setup_prize_schedule_versions_v1(id, tournament_id, client_row_id),
  unique (tournament_id, client_row_id, version),
  unique (id, tournament_id, client_row_id),
  unique (id, tournament_id)
);

create table app.event_prize_schedule_bindings_v1 (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null,
  event_id uuid not null,
  client_row_id uuid not null,
  binding_version integer not null check (binding_version > 0),
  schedule_version_id uuid not null,
  binding_source text not null check (binding_source in ('activation', 'reviewed_revision')),
  bound_at timestamptz not null default clock_timestamp(),
  foreign key (event_id, tournament_id) references app.events(id, tournament_id),
  foreign key (schedule_version_id, tournament_id, client_row_id) references app.setup_prize_schedule_versions_v1(id, tournament_id, client_row_id),
  unique (event_id, binding_version),
  unique (id, tournament_id, event_id)
);

create table app.setup_prize_schedule_conflicts_v1 (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id),
  client_row_id uuid not null,
  actor_id uuid not null references app.profiles(id),
  operation_id uuid not null,
  attempted_request_hash text not null check (length(attempted_request_hash) = 64),
  prior_receipt_id uuid references app.operation_receipts(id),
  reason_code text not null check (reason_code = 'idempotency_conflict'),
  created_at timestamptz not null default clock_timestamp()
);

alter table app.event_settlement_drafts_v5 add column prize_schedule_version_id uuid;
alter table app.event_settlement_drafts_v5 add constraint event_settlement_draft_prize_schedule_fk
  foreign key (prize_schedule_version_id, tournament_id) references app.setup_prize_schedule_versions_v1(id, tournament_id);

do $$
declare table_name text;
begin
  foreach table_name in array array['setup_prize_schedule_streams_v1', 'setup_prize_schedule_versions_v1', 'event_prize_schedule_bindings_v1', 'setup_prize_schedule_conflicts_v1'] loop
    execute format('alter table app.%I enable row level security', table_name);
    execute format('alter table app.%I force row level security', table_name);
    execute format('revoke all on app.%I from public, anon, authenticated, service_role', table_name);
    execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()', table_name || '_immutable', table_name);
  end loop;
end $$;

create function app.bind_prize_schedule_on_activation_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare setup_event app.tournament_setup_event_versions%rowtype; schedule app.setup_prize_schedule_versions_v1%rowtype; settings jsonb;
begin
  select * into setup_event from app.tournament_setup_event_versions where id = new.setup_event_version_id and tournament_id = new.tournament_id;
  select * into schedule from app.setup_prize_schedule_versions_v1 where tournament_id = new.tournament_id and client_row_id = setup_event.client_row_id order by version desc limit 1;
  if not found then return new; end if;
  settings := app.prize_schedule_settings_v1(new.tournament_id, setup_event.client_row_id);
  if settings->>'setupEventVersionId' <> new.setup_event_version_id::text or schedule.settings_fingerprint <> app.prize_schedule_settings_fingerprint_v1(settings) then raise exception 'schedule_revision_required'; end if;
  insert into app.event_prize_schedule_bindings_v1(tournament_id, event_id, client_row_id, binding_version, schedule_version_id, binding_source)
    values(new.tournament_id, new.event_id, setup_event.client_row_id, 1, schedule.id, 'activation');
  return new;
end $$;
revoke all on function app.bind_prize_schedule_on_activation_v1() from public, anon, authenticated, service_role;
create trigger bind_prize_schedule_on_activation_v1 after insert on app.tournament_setup_activations for each row execute function app.bind_prize_schedule_on_activation_v1();

create function app.setup_prize_schedule_workspace_v1(p_actor_id uuid, p_tournament_id uuid, p_client_row_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare is_director boolean; is_member boolean; event_id uuid; settings jsonb; versions jsonb; current_version integer;
begin
  select exists(select 1 from app.tournament_roles where tournament_id = p_tournament_id and profile_id = p_actor_id and role in ('director', 'co_director')),
    (exists(select 1 from app.tournament_roles where tournament_id = p_tournament_id and profile_id = p_actor_id)
      or exists(select 1 from app.event_participants participant left join app.roster_account_links link
        on link.tournament_id = participant.tournament_id and link.roster_entry_id = participant.roster_entry_id
        where participant.tournament_id = p_tournament_id and (participant.profile_id = p_actor_id or link.profile_id = p_actor_id)))
    into is_director, is_member;
  if not is_member then return null; end if;
  select activation.event_id into event_id from app.tournament_setup_activations activation
    join app.tournament_setup_event_versions setup_event on setup_event.id = activation.setup_event_version_id and setup_event.tournament_id = activation.tournament_id
    where activation.tournament_id = p_tournament_id and setup_event.client_row_id = p_client_row_id;
  if not is_director and event_id is null then return null; end if;
  settings := app.prize_schedule_settings_v1(p_tournament_id, p_client_row_id);
  select coalesce(max(version), 0), coalesce(jsonb_agg(jsonb_build_object(
    'scheduleId', id, 'version', version, 'schedule', schedule_payload, 'reason', reason, 'recordedAt', recorded_at
  ) order by version desc), '[]'::jsonb) into current_version, versions
  from app.setup_prize_schedule_versions_v1 where tournament_id = p_tournament_id and client_row_id = p_client_row_id;
  if current_version = 0 and not is_director then return null; end if;
  return jsonb_build_object('tournamentId', p_tournament_id, 'clientRowId', p_client_row_id, 'currentVersion', current_version,
    'activated', event_id is not null, 'eventId', event_id,
    'settingsCurrent', case when current_version = 0 then settings is not null and settings->>'eventKind' = 'main'
      and settings->>'styleCode' = 'Standard' and settings->>'formatCode' = 'standard_singles' and settings->>'gameCount' = '12'
      and settings->>'eventCount' = '1' and settings->>'qPoolCount' = '0' and settings->>'sidePoolCount' = '0'
      else coalesce((select settings_fingerprint = app.prize_schedule_settings_fingerprint_v1(settings)
        from app.setup_prize_schedule_versions_v1 where tournament_id = p_tournament_id and client_row_id = p_client_row_id order by version desc limit 1), false) end,
    'versions', versions);
end $$;
revoke all on function app.setup_prize_schedule_workspace_v1(uuid, uuid, uuid) from public, anon, authenticated, service_role;

create function public.get_setup_prize_schedule_v1(p_actor_id uuid, p_tournament_id uuid, p_client_row_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select app.setup_prize_schedule_workspace_v1(p_actor_id, p_tournament_id, p_client_row_id);
$$;

create function public.list_tournament_prize_schedules_v1(p_actor_id uuid, p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when exists(select 1 from app.tournament_roles where tournament_id = p_tournament_id and profile_id = p_actor_id)
    or exists(select 1 from app.event_participants participant left join app.roster_account_links link
      on link.tournament_id = participant.tournament_id and link.roster_entry_id = participant.roster_entry_id
      where participant.tournament_id = p_tournament_id and (participant.profile_id = p_actor_id or link.profile_id = p_actor_id))
    then coalesce((select jsonb_agg(workspace order by workspace->>'clientRowId') from (
      select app.setup_prize_schedule_workspace_v1(p_actor_id, p_tournament_id, stream.client_row_id) workspace
      from app.setup_prize_schedule_streams_v1 stream where stream.tournament_id = p_tournament_id
        and (exists(select 1 from app.tournament_setup_event_versions setup_event
          where setup_event.tournament_id = stream.tournament_id and setup_event.client_row_id = stream.client_row_id
            and setup_event.setup_revision_id = (select revision.id from app.tournament_setup_revisions revision
              where revision.tournament_id = stream.tournament_id order by revision.version desc limit 1))
          or exists(select 1 from app.event_prize_schedule_bindings_v1 binding
            where binding.tournament_id = stream.tournament_id and binding.client_row_id = stream.client_row_id))
    ) items where workspace is not null), '[]'::jsonb) else null end;
$$;

create function public.get_prize_schedule_reconciliation_v1(p_actor_id uuid, p_tournament_id uuid, p_client_row_id uuid, p_operation_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$declare response jsonb;begin
  if not exists(select 1 from app.tournament_roles where tournament_id = p_tournament_id and profile_id = p_actor_id and role in ('director', 'co_director')) then return null; end if;
  select response_payload into response from app.operation_receipts where actor_profile_id = p_actor_id and client_operation_id = p_operation_id
    and tournament_id = p_tournament_id and target_id = p_client_row_id and operation_type = 'save_setup_prize_schedule_v1';
  return jsonb_build_object('authorized', true, 'result', response);
end $$;


create index setup_prize_schedule_receipt_idx on app.setup_prize_schedule_versions_v1(operation_receipt_id);
create index event_prize_schedule_binding_schedule_idx on app.event_prize_schedule_bindings_v1(schedule_version_id);

create function app.prize_schedule_settings_v1(p_tournament_id uuid, p_client_row_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with latest_revision as (
    select revision.* from app.tournament_setup_revisions revision
    where revision.tournament_id = p_tournament_id order by revision.version desc limit 1
  ), setup_event as (
    select event_version.*, revision.version setup_revision_version
    from latest_revision revision join app.tournament_setup_event_versions event_version
      on event_version.setup_revision_id = revision.id and event_version.tournament_id = revision.tournament_id
    where event_version.client_row_id = p_client_row_id
  )
  select jsonb_build_object(
    'setupRevisionId', event_row.setup_revision_id,
    'setupRevisionVersion', event_row.setup_revision_version,
    'setupEventVersionId', event_row.id,
    'eventKind', event_row.event_kind,
    'styleCode', event_row.style_code,
    'formatCode', event_row.format_code,
    'gameCount', event_row.game_count,
    'entryFeeCents', event_row.entry_fee_cents,
    'eventCount', (select count(*) from app.tournament_setup_event_versions item where item.setup_revision_id = event_row.setup_revision_id),
    'qPoolCount', (select count(*) from app.tournament_setup_q_pool_versions item where item.setup_revision_id = event_row.setup_revision_id),
    'sidePoolCount', (select count(*) from app.tournament_setup_side_pool_versions item where item.setup_revision_id = event_row.setup_revision_id)
  ) from setup_event event_row;
$$;
revoke all on function app.prize_schedule_settings_v1(uuid, uuid) from public, anon, authenticated, service_role;

create function app.prize_schedule_settings_fingerprint_v1(p_settings jsonb)
returns text language sql immutable security definer set search_path = '' as $$
  select encode(extensions.digest(convert_to(jsonb_build_object(
    'eventKind', p_settings->'eventKind', 'styleCode', p_settings->'styleCode', 'formatCode', p_settings->'formatCode',
    'gameCount', p_settings->'gameCount', 'entryFeeCents', p_settings->'entryFeeCents', 'eventCount', p_settings->'eventCount',
    'qPoolCount', p_settings->'qPoolCount', 'sidePoolCount', p_settings->'sidePoolCount')::text, 'utf8'), 'sha256'), 'hex');
$$;
revoke all on function app.prize_schedule_settings_fingerprint_v1(jsonb) from public, anon, authenticated, service_role;

create function app.valid_director_prize_schedule_v1(p_schedule jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; denominator numeric := 0; seen text[] := '{}'; band text;
begin
  if jsonb_typeof(p_schedule) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_schedule)) <> 6
    or not (p_schedule ?& array['kind', 'amountBasis', 'expectedQualifierCount', 'sourceReference', 'roundingRule', 'cohorts'])
    or jsonb_typeof(p_schedule->'kind') is distinct from 'string'
    or jsonb_typeof(p_schedule->'amountBasis') is distinct from 'string'
    or jsonb_typeof(p_schedule->'expectedQualifierCount') is distinct from 'number'
    or jsonb_typeof(p_schedule->'roundingRule') is distinct from 'string'
    or p_schedule->>'kind' <> 'director-selected-prize-schedule-v1'
    or p_schedule->>'amountBasis' <> 'total_award'
    or p_schedule->>'expectedQualifierCount' <> '4'
    or p_schedule->>'roundingRule' <> 'floor_each_weighted_share_then_assign_remainder_to_champion'
    or jsonb_typeof(p_schedule->'sourceReference') is distinct from 'string'
    or length(trim(p_schedule->>'sourceReference')) not between 1 and 500
    or p_schedule->>'sourceReference' <> trim(p_schedule->>'sourceReference')
    or p_schedule->>'sourceReference' ~ '[[:cntrl:]]'
    or jsonb_typeof(p_schedule->'cohorts') is distinct from 'array'
    or jsonb_array_length(p_schedule->'cohorts') <> 3 then return false;
  end if;
  for item in select value from jsonb_array_elements(p_schedule->'cohorts') loop
    if jsonb_typeof(item) is distinct from 'object' or (select count(*) from jsonb_object_keys(item)) <> 3
      or not (item ?& array['bandStart', 'bandEnd', 'weight'])
      or jsonb_typeof(item->'bandStart') is distinct from 'number' or (item->>'bandStart') !~ '^[1-9][0-9]*$'
      or jsonb_typeof(item->'bandEnd') is distinct from 'number' or (item->>'bandEnd') !~ '^[1-9][0-9]*$'
      or jsonb_typeof(item->'weight') is distinct from 'number' or (item->>'weight') !~ '^[1-9][0-9]*$'
      or (item->>'weight')::numeric > 9007199254740991 then return false;
    end if;
    band := (item->>'bandStart') || ':' || (item->>'bandEnd');
    if band = any(seen) then return false; end if;
    seen := array_append(seen, band);
    denominator := denominator + (item->>'weight')::numeric * ((item->>'bandEnd')::integer - (item->>'bandStart')::integer + 1);
  end loop;
  return seen @> array['1:1', '2:2', '3:4'] and denominator between 1 and 9007199254740991;
exception when others then return false;
end $$;
revoke all on function app.valid_director_prize_schedule_v1(jsonb) from public, anon, authenticated, service_role;

create function app.prize_schedule_revision_is_open_v1(p_tournament_id uuid, p_client_row_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from app.tournament_setup_activations activation
    join app.tournament_setup_event_versions setup_event on setup_event.id = activation.setup_event_version_id
    where activation.tournament_id = p_tournament_id and setup_event.client_row_id = p_client_row_id
      and (exists(select 1 from app.playoff_outcome_versions_v3 item where item.event_id = activation.event_id)
        or exists(select 1 from app.qualification_result_versions item where item.tournament_id = p_tournament_id and item.event_id = activation.event_id)
        or exists(select 1 from app.event_settlement_drafts_v5 item where item.event_id = activation.event_id)
        or exists(select 1 from app.event_payback_reviews_v1 item where item.event_id = activation.event_id)
        or exists(select 1 from app.event_settlement_finals_v2 item where item.event_id = activation.event_id))
  );
$$;
revoke all on function app.prize_schedule_revision_is_open_v1(uuid, uuid) from public, anon, authenticated, service_role;

create function public.save_setup_prize_schedule_v1(p_actor_id uuid, p_tournament_id uuid, p_client_row_id uuid, p_request jsonb, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  receipt app.operation_receipts%rowtype; response jsonb; settings jsonb; request_hash text; code text; tournament_status text;
  current_version integer; prior_id uuid; activated_event_id uuid; confirmed_event_id uuid; binding_version integer;
  receipt_id uuid := extensions.gen_random_uuid(); schedule_id uuid := extensions.gen_random_uuid(); stamp timestamptz := clock_timestamp();
begin
  if p_actor_id is null or p_tournament_id is null or p_client_row_id is null or p_operation_id is null then
    return jsonb_build_object('status', 'rejected', 'clientRowId', p_client_row_id, 'code', 'invalid_request');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_operation_id::text, 0));
  select activation.event_id into activated_event_id from app.tournament_setup_activations activation join app.tournament_setup_event_versions setup_event on setup_event.id = activation.setup_event_version_id
    where activation.tournament_id = p_tournament_id and setup_event.client_row_id = p_client_row_id;
  if activated_event_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('settlement:' || activated_event_id::text, 0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('settlement-domain:' || activated_event_id::text, 0));
  end if;
  select status into tournament_status from app.tournaments where id = p_tournament_id for update;
  if not found then return jsonb_build_object('status', 'rejected', 'clientRowId', p_client_row_id, 'code', 'source_unavailable'); end if;
  perform 1 from app.tournament_roles where tournament_id = p_tournament_id and profile_id = p_actor_id and role in ('director', 'co_director') for update;
  if not found then return jsonb_build_object('status', 'rejected', 'clientRowId', p_client_row_id, 'code', 'not_director'); end if;
  select activation.event_id into confirmed_event_id from app.tournament_setup_activations activation join app.tournament_setup_event_versions setup_event on setup_event.id = activation.setup_event_version_id
    where activation.tournament_id = p_tournament_id and setup_event.client_row_id = p_client_row_id;
  if confirmed_event_id is distinct from activated_event_id then return jsonb_build_object('status', 'rejected', 'clientRowId', p_client_row_id, 'code', 'source_unavailable'); end if;
  request_hash := encode(extensions.digest(convert_to(jsonb_build_array('save_setup_prize_schedule_v1', p_actor_id, p_tournament_id, p_client_row_id, p_request)::text, 'utf8'), 'sha256'), 'hex');
  select * into receipt from app.operation_receipts where actor_profile_id = p_actor_id and client_operation_id = p_operation_id;
  if found then
    if receipt.tournament_id = p_tournament_id and receipt.target_id = p_client_row_id and receipt.operation_type = 'save_setup_prize_schedule_v1' and receipt.request_hash = request_hash then return receipt.response_payload; end if;
    insert into app.setup_prize_schedule_conflicts_v1(tournament_id, client_row_id, actor_id, operation_id, attempted_request_hash, prior_receipt_id, reason_code)
      values(p_tournament_id, p_client_row_id, p_actor_id, p_operation_id, request_hash, case when receipt.tournament_id = p_tournament_id then receipt.id end, 'idempotency_conflict');
    insert into app.audit_events(tournament_id, actor_profile_id, entity_type, entity_id, action, after_state)
      values(p_tournament_id, p_actor_id, 'setup_prize_schedule_v1', p_client_row_id, 'prize_schedule_idempotency_conflict', jsonb_build_object('operationId', p_operation_id));
    return jsonb_build_object('status', 'rejected', 'clientRowId', p_client_row_id, 'code', 'idempotency_conflict');
  end if;
  begin
    if tournament_status not in ('draft', 'open', 'pending_finalization') then raise exception 'source_unavailable'; end if;
    if jsonb_typeof(p_request) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_request)) <> 4
      or not (p_request ?& array['expectedVersion', 'schedule', 'reviewed', 'reason'])
      or jsonb_typeof(p_request->'expectedVersion') is distinct from 'number' or (p_request->>'expectedVersion') !~ '^(0|[1-9][0-9]*)$'
      or (p_request->>'expectedVersion')::numeric > 2147483647 or p_request->'reviewed' is distinct from 'true'::jsonb
      or jsonb_typeof(p_request->'reason') is distinct from 'string' or length(trim(p_request->>'reason')) not between 1 and 500
      or p_request->>'reason' <> trim(p_request->>'reason') or p_request->>'reason' ~ '[[:cntrl:]]'
      or app.valid_director_prize_schedule_v1(p_request->'schedule') is distinct from true then raise exception 'invalid_request';
    end if;
    settings := app.prize_schedule_settings_v1(p_tournament_id, p_client_row_id);
    if settings is null then raise exception 'source_unavailable'; end if;
    if settings->>'eventKind' <> 'main' or settings->>'styleCode' <> 'Standard' or settings->>'formatCode' <> 'standard_singles' or settings->>'gameCount' <> '12'
      or (settings->>'entryFeeCents')::integer <= 0 or settings->>'eventCount' <> '1'
      or settings->>'qPoolCount' <> '0' or settings->>'sidePoolCount' <> '0' then raise exception 'unsupported_prize_schedule_scope'; end if;
    if app.prize_schedule_revision_is_open_v1(p_tournament_id, p_client_row_id) is distinct from true then raise exception 'schedule_revision_closed'; end if;
    select coalesce(max(version), 0) into current_version from app.setup_prize_schedule_versions_v1 where tournament_id = p_tournament_id and client_row_id = p_client_row_id;
    if current_version >= 256 then raise exception 'schedule_revision_closed'; end if;
    if (p_request->>'expectedVersion')::integer <> current_version then raise exception 'stale_version'; end if;
    select id into prior_id from app.setup_prize_schedule_versions_v1 where tournament_id = p_tournament_id and client_row_id = p_client_row_id order by version desc limit 1;
    current_version := current_version + 1;
    response := jsonb_build_object('status', 'prize_schedule_saved_v1', 'tournamentId', p_tournament_id, 'clientRowId', p_client_row_id, 'scheduleId', schedule_id, 'version', current_version);
  exception when sqlstate 'P0001' then
    code := case when sqlerrm in ('invalid_request', 'unsupported_prize_schedule_scope', 'stale_version', 'schedule_revision_closed', 'schedule_revision_required', 'source_unavailable') then sqlerrm else null end;
    if code is null then raise; end if;
    response := jsonb_build_object('status', 'rejected', 'clientRowId', p_client_row_id, 'code', code);
  end;
  insert into app.operation_receipts(id, tournament_id, actor_profile_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
    values(receipt_id, p_tournament_id, p_actor_id, 'save_setup_prize_schedule_v1', p_client_row_id, request_hash, p_operation_id, case when code is null then 'accepted' else 'rejected' end, response, stamp);
  if code is null then
    insert into app.setup_prize_schedule_streams_v1(tournament_id, client_row_id, created_by)
      values(p_tournament_id, p_client_row_id, p_actor_id) on conflict (tournament_id, client_row_id) do nothing;
    insert into app.setup_prize_schedule_versions_v1(id, tournament_id, client_row_id, version, supersedes_id, schedule_payload, settings_snapshot, settings_fingerprint, reason, reviewed, recorded_by, operation_receipt_id, recorded_at)
      values(schedule_id, p_tournament_id, p_client_row_id, current_version, prior_id, p_request->'schedule', settings, app.prize_schedule_settings_fingerprint_v1(settings), p_request->>'reason', true, p_actor_id, receipt_id, stamp);
    if activated_event_id is not null then
      select coalesce(max(item.binding_version), 0) + 1 into binding_version from app.event_prize_schedule_bindings_v1 item where item.event_id = activated_event_id;
      insert into app.event_prize_schedule_bindings_v1(tournament_id, event_id, client_row_id, binding_version, schedule_version_id, binding_source)
        values(p_tournament_id, activated_event_id, p_client_row_id, binding_version, schedule_id, 'reviewed_revision');
    end if;
  end if;
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
    values(p_tournament_id, p_actor_id, receipt_id, 'setup_prize_schedule_v1', case when code is null then schedule_id else p_client_row_id end,
      case when code is null then 'prize_schedule_saved_v1' else 'prize_schedule_rejected' end, response);
  return response;
end $$;

create function app.event_prize_schedule_financial_basis_v1(p_tournament_id uuid, p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare entry_fee integer; participant_count integer; active_roster_count integer; participant_facts jsonb; expenses jsonb; ledger jsonb; gross bigint;
begin
  select setup_event.entry_fee_cents into entry_fee from app.tournament_setup_activations activation
    join app.tournament_setup_event_versions setup_event on setup_event.id = activation.setup_event_version_id
    where activation.tournament_id = p_tournament_id and activation.event_id = p_event_id
      and setup_event.event_kind = 'main' and setup_event.style_code = 'Standard' and setup_event.format_code = 'standard_singles'
      and setup_event.game_count = 12 and setup_event.entry_fee_cents > 0;
  if not found or (select count(*) from app.tournament_setup_activations where tournament_id = p_tournament_id) <> 1
    or exists(select 1 from app.tournament_setup_q_pool_versions where tournament_id = p_tournament_id)
    or exists(select 1 from app.tournament_setup_side_pool_versions where tournament_id = p_tournament_id) then
    return jsonb_build_object('status', 'blocked', 'code', 'unsupported_prize_schedule_scope');
  end if;
  select count(*) into active_roster_count from app.tournament_roster_entries roster
    left join lateral(select event_type from app.roster_entry_lifecycle_events lifecycle where lifecycle.roster_entry_id = roster.id order by version desc limit 1) life on true
    where roster.tournament_id = p_tournament_id and coalesce(life.event_type, 'active') <> 'withdrawn';
  with mapped as (
    select participant.id participant_id, participant.roster_entry_id direct_roster_entry_id, link.roster_entry_id linked_roster_entry_id,
      coalesce(link.link_count, 0) link_count, coalesce(participant.roster_entry_id, link.roster_entry_id) roster_entry_id
    from app.event_participants participant
    left join lateral(select first_link.roster_entry_id,
      (select count(*) from app.roster_account_links counted where counted.tournament_id = participant.tournament_id and counted.profile_id = participant.profile_id) link_count
      from app.roster_account_links first_link where first_link.tournament_id = participant.tournament_id and first_link.profile_id = participant.profile_id order by first_link.id limit 1) link on true
    where participant.tournament_id = p_tournament_id and participant.event_id = p_event_id
  ), facts as (
    select mapped.*, obligation.id obligation_id, obligation.version obligation_version, obligation.amount_owed_minor,
      payment.id payment_event_id, payment.version payment_version, payment.event_type payment_state, payment.amount_minor amount_received_minor
    from mapped
    left join lateral(select item.id, item.version, item.amount_owed_minor from app.roster_payment_obligation_versions item where item.roster_entry_id = mapped.roster_entry_id order by item.version desc limit 1) obligation on true
    left join lateral(select item.id, item.version, item.event_type, item.amount_minor from app.roster_payment_events item where item.roster_entry_id = mapped.roster_entry_id order by item.version desc limit 1) payment on true
  )
  select count(*), coalesce(jsonb_agg(to_jsonb(facts) order by participant_id), '[]'::jsonb) into participant_count, participant_facts from facts;
  if participant_count <> active_roster_count or participant_count < 1
    or (select count(distinct item->>'roster_entry_id') from jsonb_array_elements(participant_facts) item) <> participant_count
    or exists(select 1 from jsonb_array_elements(participant_facts) item where item->>'roster_entry_id' is null or (item->>'link_count')::integer > 1
      or (item->>'direct_roster_entry_id' is not null and item->>'linked_roster_entry_id' is not null and item->>'direct_roster_entry_id' <> item->>'linked_roster_entry_id')
      or not exists(select 1 from app.tournament_roster_entries roster
        left join lateral(select lifecycle.event_type from app.roster_entry_lifecycle_events lifecycle where lifecycle.roster_entry_id = roster.id order by lifecycle.version desc limit 1) life on true
        where roster.id = (item->>'roster_entry_id')::uuid and roster.tournament_id = p_tournament_id and coalesce(life.event_type, 'active') <> 'withdrawn')
      or item->>'obligation_id' is null or (item->>'amount_owed_minor')::integer is distinct from entry_fee
      or item->>'payment_event_id' is null or item->>'payment_state' is distinct from 'received'
      or (item->>'amount_received_minor')::integer is distinct from entry_fee) then
    return jsonb_build_object('status', 'blocked', 'code', 'unsupported_prize_schedule_scope');
  end if;
  gross := participant_count::bigint * entry_fee::bigint; ledger := app.settlement_ledger_v5(p_tournament_id);
  if (ledger->>'paymentCount')::integer is distinct from participant_count or (ledger->>'paymentTotalMinor')::bigint is distinct from gross
    or exists(select 1 from app.roster_payment_events where tournament_id = p_tournament_id and event_type = 'voided') then
    return jsonb_build_object('status', 'blocked', 'code', 'unsupported_prize_schedule_scope');
  end if;
  with latest as (select distinct on (expense_id) * from app.tournament_expense_events where tournament_id = p_tournament_id order by expense_id, version desc)
  select coalesce(jsonb_agg(jsonb_build_object('expenseEventId', id, 'description', description, 'amountMinor', amount_minor) order by id), '[]'::jsonb)
    into expenses from latest where event_type = 'recorded';
  return jsonb_build_object('status', 'supported', 'grossEntryIncomeMinor', gross, 'expenses', expenses,
    'participantFacts', participant_facts, 'ledgerSnapshot', ledger);
end $$;
revoke all on function app.event_prize_schedule_financial_basis_v1(uuid, uuid) from public, anon, authenticated, service_role;

create function app.resolve_event_prize_schedule_v1(p_tournament_id uuid, p_event_id uuid, p_source jsonb, p_schedule_version_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare binding app.event_prize_schedule_bindings_v1%rowtype; schedule app.setup_prize_schedule_versions_v1%rowtype; basis jsonb; canonical jsonb;
  denominator numeric; expense_total numeric; gross numeric; budget numeric; allocated numeric; remainder numeric; awards jsonb;
begin
  select * into binding from app.event_prize_schedule_bindings_v1 where tournament_id = p_tournament_id and event_id = p_event_id order by binding_version desc limit 1;
  if not found then return jsonb_build_object('status', 'unstructured'); end if;
  if p_schedule_version_id is not null and p_schedule_version_id <> binding.schedule_version_id then return jsonb_build_object('status', 'blocked', 'code', 'schedule_revision_required'); end if;
  select * into schedule from app.setup_prize_schedule_versions_v1 where id = binding.schedule_version_id and tournament_id = p_tournament_id;
  if schedule.settings_fingerprint <> app.prize_schedule_settings_fingerprint_v1(app.prize_schedule_settings_v1(p_tournament_id, binding.client_row_id))
    then return jsonb_build_object('status', 'blocked', 'code', 'schedule_revision_required'); end if;
  if app.settlement_source_current_v5(p_tournament_id, p_event_id, p_source) is distinct from true then return jsonb_build_object('status', 'blocked', 'code', 'source_unavailable'); end if;
  canonical := app.canonical_settlement_mrp_v5(p_tournament_id, p_event_id, p_source);
  if canonical->>'status' is distinct from 'available' or jsonb_array_length(canonical->'rows') <> 4
    or exists(select 1 from jsonb_array_elements(canonical->'rows') item where coalesce((item->>'byeWins')::integer, 0) <> 0)
    or (select count(*) from jsonb_array_elements(canonical->'rows') item where item->>'bandStart' = '1' and item->>'bandEnd' = '1') <> 1
    or (select count(*) from jsonb_array_elements(canonical->'rows') item where item->>'bandStart' = '2' and item->>'bandEnd' = '2') <> 1
    or (select count(*) from jsonb_array_elements(canonical->'rows') item where item->>'bandStart' = '3' and item->>'bandEnd' = '4') <> 2
    then return jsonb_build_object('status', 'blocked', 'code', 'schedule_revision_required'); end if;
  basis := app.event_prize_schedule_financial_basis_v1(p_tournament_id, p_event_id);
  if basis->>'status' <> 'supported' then return jsonb_build_object('status', 'blocked', 'code', coalesce(basis->>'code', 'unsupported_prize_schedule_scope')); end if;
  select coalesce(sum((item->>'amountMinor')::numeric), 0) into expense_total from jsonb_array_elements(basis->'expenses') item;
  gross := (basis->>'grossEntryIncomeMinor')::numeric; budget := gross - expense_total;
  if gross < 0 or gross > 9007199254740991::numeric or expense_total < 0 or expense_total > 9007199254740991::numeric
    or budget <= 0 or budget > 9007199254740991::numeric then return jsonb_build_object('status', 'blocked', 'code', 'schedule_revision_required'); end if;
  select sum((cohort->>'weight')::numeric * ((cohort->>'bandEnd')::integer - (cohort->>'bandStart')::integer + 1)) into denominator
    from jsonb_array_elements(schedule.schedule_payload->'cohorts') cohort;
  with calculated as (
    select row_item, cohort, floor(budget * (cohort->>'weight')::numeric / denominator) amount
    from jsonb_array_elements(canonical->'rows') row_item
    join jsonb_array_elements(schedule.schedule_payload->'cohorts') cohort
      on cohort->>'bandStart' = row_item->>'bandStart' and cohort->>'bandEnd' = row_item->>'bandEnd'
  ) select sum(amount) into allocated from calculated;
  remainder := budget - allocated;
  with calculated as (
    select row_item, cohort, floor(budget * (cohort->>'weight')::numeric / denominator)
      + case when row_item->>'bandStart' = '1' and row_item->>'bandEnd' = '1' then remainder else 0 end amount
    from jsonb_array_elements(canonical->'rows') row_item
    join jsonb_array_elements(schedule.schedule_payload->'cohorts') cohort
      on cohort->>'bandStart' = row_item->>'bandStart' and cohort->>'bandEnd' = row_item->>'bandEnd'
  ) select jsonb_agg(jsonb_build_object('participantId', row_item->>'participantId', 'displayName', row_item->>'displayName',
      'bandStart', (row_item->>'bandStart')::integer, 'bandEnd', (row_item->>'bandEnd')::integer,
      'weight', (cohort->>'weight')::bigint, 'totalAwardMinor', amount::bigint) order by (row_item->>'bandStart')::integer, row_item->>'participantId') into awards from calculated;
  if jsonb_array_length(awards) <> 4 or exists(select 1 from jsonb_array_elements(awards) item where (item->>'totalAwardMinor')::bigint <= 0)
    then return jsonb_build_object('status', 'blocked', 'code', 'schedule_revision_required'); end if;
  return jsonb_build_object('status', 'available', 'scheduleVersionId', schedule.id, 'scheduleVersion', schedule.version,
    'rule', schedule.schedule_payload, 'grossEntryIncomeMinor', gross::bigint, 'expenseTotalMinor', expense_total::bigint,
    'prizeBudgetMinor', budget::bigint, 'roundingRemainderMinor', remainder::bigint, 'awards', awards,
    'ledgerBasis', jsonb_build_object('participantFacts', basis->'participantFacts', 'expenseFacts', basis->'expenses', 'ledgerSnapshot', basis->'ledgerSnapshot'));
end $$;
revoke all on function app.resolve_event_prize_schedule_v1(uuid, uuid, jsonb, uuid) from public, anon, authenticated, service_role;

create function public.get_event_prize_schedule_resolution_v1(p_actor_id uuid, p_tournament_id uuid, p_event_id uuid, p_source jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare resolved jsonb;
begin
  if not exists(select 1 from app.tournament_roles where tournament_id = p_tournament_id and profile_id = p_actor_id and role in ('director', 'co_director'))
    or not exists(select 1 from app.events where id = p_event_id and tournament_id = p_tournament_id) then return null;
  end if;
  if jsonb_typeof(p_source) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_source)) <> 3
    or not (p_source ?& array['kind', 'resultId', 'qualificationResultVersionId'])
    or p_source->>'kind' not in ('legacy_placement_v2', 'playoff_outcome_v3')
    or coalesce(p_source->>'resultId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(p_source->>'qualificationResultVersionId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return jsonb_build_object('status', 'blocked', 'code', 'invalid_request');
  end if;
  resolved := app.resolve_event_prize_schedule_v1(p_tournament_id, p_event_id, p_source, null);
  if resolved->>'status' <> 'available' then
    return resolved;
  end if;
  return jsonb_build_object('status', 'available', 'scheduleVersionId', resolved->'scheduleVersionId',
    'grossEntryIncomeMinor', resolved->'grossEntryIncomeMinor', 'expenseTotalMinor', resolved->'expenseTotalMinor',
    'prizeBudgetMinor', resolved->'prizeBudgetMinor', 'roundingRemainderMinor', resolved->'roundingRemainderMinor',
    'awards', (select jsonb_agg(jsonb_build_object('participantId', item->'participantId', 'bandStart', item->'bandStart',
      'bandEnd', item->'bandEnd', 'weight', item->'weight', 'totalAwardMinor', item->'totalAwardMinor')
      order by (item->>'bandStart')::integer, item->>'participantId') from jsonb_array_elements(resolved->'awards') item));
end $$;

create function app.require_event_prize_schedule_draft_v1(p_tournament_id uuid, p_event_id uuid, p_request jsonb, p_canonical jsonb)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare binding app.event_prize_schedule_bindings_v1%rowtype; resolved jsonb; schedule_id uuid; claim jsonb; award jsonb;
begin
  select * into binding from app.event_prize_schedule_bindings_v1
    where tournament_id = p_tournament_id and event_id = p_event_id order by binding_version desc limit 1;
  if not found then
    if p_request ? 'scheduleVersionId' then raise exception 'schedule_revision_required'; end if;
    return null;
  end if;
  if not (p_request ? 'scheduleVersionId')
    or coalesce(p_request->>'scheduleVersionId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'schedule_revision_required';
  end if;
  schedule_id := (p_request->>'scheduleVersionId')::uuid;
  if schedule_id <> binding.schedule_version_id then raise exception 'schedule_revision_required'; end if;
  resolved := app.resolve_event_prize_schedule_v1(p_tournament_id, p_event_id, p_request->'source', schedule_id);
  if resolved->>'status' <> 'available' then raise exception using message = coalesce(resolved->>'code', 'schedule_revision_required'); end if;
  if p_canonical->>'status' <> 'available'
    or jsonb_array_length(p_request->'prizeClaims') <> jsonb_array_length(resolved->'awards')
    or (p_request->>'eventIncomeMinor')::numeric is distinct from (resolved->>'grossEntryIncomeMinor')::numeric
    or (p_request->>'eventExpenseMinor')::numeric is distinct from (resolved->>'expenseTotalMinor')::numeric
    or (p_request->>'retainedBalanceMinor')::numeric <> 0 then raise exception 'schedule_claim_mismatch';
  end if;
  for award in select value from jsonb_array_elements(resolved->'awards') loop
    select value into claim from jsonb_array_elements(p_request->'prizeClaims') where value->>'participantId' = award->>'participantId';
    if claim is null or (claim->>'amountMinor')::numeric is distinct from (award->>'totalAwardMinor')::numeric
      or ((award->>'bandStart')::integer = (award->>'bandEnd')::integer and claim->'prizeOrder' <> 'null'::jsonb
        and claim->>'prizeOrder' is distinct from award->>'bandStart')
      or ((award->>'bandStart')::integer <> (award->>'bandEnd')::integer and claim->'prizeOrder' is distinct from 'null'::jsonb)
    then raise exception 'schedule_claim_mismatch';
    end if;
  end loop;
  return schedule_id;
end $$;
revoke all on function app.require_event_prize_schedule_draft_v1(uuid, uuid, jsonb, jsonb) from public, anon, authenticated, service_role;

create function app.require_prize_schedule_settlement_write_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare required_schedule_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('settlement-domain:' || new.event_id::text, 0));
  if tg_table_name in ('standard_singles_settlement_drafts', 'standard_singles_settlement_final_versions') then
    if exists(select 1 from app.event_prize_schedule_bindings_v1 where tournament_id = new.tournament_id and event_id = new.event_id) then
      raise exception 'settlement_domain_conflict';
    end if;
  elsif tg_table_name = 'event_settlement_drafts_v5' then
    required_schedule_id := app.require_event_prize_schedule_draft_v1(new.tournament_id, new.event_id, new.request_payload, new.canonical_mrp);
    new.prize_schedule_version_id := required_schedule_id;
  end if;
  return new;
end $$;
revoke all on function app.require_prize_schedule_settlement_write_v1() from public, anon, authenticated, service_role;
create trigger aaa_prize_schedule_legacy_draft_guard before insert on app.standard_singles_settlement_drafts for each row execute function app.require_prize_schedule_settlement_write_v1();
create trigger aaa_prize_schedule_legacy_final_guard before insert on app.standard_singles_settlement_final_versions for each row execute function app.require_prize_schedule_settlement_write_v1();
create trigger aaa_prize_schedule_v5_draft_guard before insert on app.event_settlement_drafts_v5 for each row execute function app.require_prize_schedule_settlement_write_v1();

-- Preserve historical eight-field requests for unadopted events. A ninth,
-- explicitly pinned scheduleVersionId is only valid once an event adopts a schedule.
create or replace function app.valid_settlement_request_v5(p_request jsonb, p_action text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; key_name text; key_count integer;
begin
  if jsonb_typeof(p_request) is distinct from 'object' then return false; end if;
  if p_action = 'draft' then
    select count(*) into key_count from jsonb_object_keys(p_request);
    if key_count not in (8, 9) or not (p_request ?& array['source', 'expectedVersion', 'prizeClaims', 'eventIncomeMinor', 'eventExpenseMinor', 'retainedBalanceMinor', 'officialSourceReference', 'sanctioningExpenseEventId'])
      or (key_count = 9 and not (p_request ? 'scheduleVersionId')) or (key_count = 8 and p_request ? 'scheduleVersionId')
      or jsonb_typeof(p_request->'source') is distinct from 'object' or jsonb_typeof(p_request->'prizeClaims') is distinct from 'array' then return false;
    end if;
    if key_count = 9 and coalesce(p_request->>'scheduleVersionId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
    if (select count(*) from jsonb_object_keys(p_request->'source')) <> 3 or not ((p_request->'source') ?& array['kind', 'resultId', 'qualificationResultVersionId'])
      or coalesce(p_request->'source'->>'kind', '') not in ('legacy_placement_v2', 'playoff_outcome_v3') then return false;
    end if;
    foreach key_name in array array['resultId', 'qualificationResultVersionId'] loop
      if coalesce(p_request->'source'->>key_name, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
    end loop;
    foreach key_name in array array['expectedVersion', 'eventIncomeMinor', 'eventExpenseMinor', 'retainedBalanceMinor'] loop
      if jsonb_typeof(p_request->key_name) is distinct from 'number' or coalesce(p_request->>key_name, '') !~ '^(0|[1-9][0-9]*)$'
        or (p_request->>key_name)::numeric > 9007199254740991 then return false; end if;
    end loop;
    if (p_request->>'expectedVersion')::numeric > 2147483647 or jsonb_array_length(p_request->'prizeClaims') > 256 then return false; end if;
    if p_request->'sanctioningExpenseEventId' <> 'null'::jsonb and coalesce(p_request->>'sanctioningExpenseEventId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
    if jsonb_typeof(p_request->'officialSourceReference') is distinct from 'string' or length(trim(p_request->>'officialSourceReference')) not between 1 and 500
      or p_request->>'officialSourceReference' <> trim(p_request->>'officialSourceReference') or p_request->>'officialSourceReference' ~ '[[:cntrl:]]' then return false; end if;
    for item in select value from jsonb_array_elements(p_request->'prizeClaims') loop
      if jsonb_typeof(item) is distinct from 'object' or (select count(*) from jsonb_object_keys(item)) <> 4 or not (item ?& array['participantId', 'amountMinor', 'prizeOrder', 'note']) then return false; end if;
      if coalesce(item->>'participantId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or jsonb_typeof(item->'amountMinor') is distinct from 'number' or coalesce(item->>'amountMinor', '') !~ '^(0|[1-9][0-9]*)$'
        or (item->>'amountMinor')::numeric > 9007199254740991 then return false; end if;
      if jsonb_typeof(item->'note') is distinct from 'string' or length(trim(item->>'note')) not between 1 and 500
        or item->>'note' <> trim(item->>'note') or item->>'note' ~ '[[:cntrl:]]' then return false; end if;
      if item->'prizeOrder' <> 'null'::jsonb and (jsonb_typeof(item->'prizeOrder') is distinct from 'number'
        or coalesce(item->>'prizeOrder', '') !~ '^[1-9][0-9]*$' or (item->>'prizeOrder')::numeric > 256) then return false; end if;
    end loop;
    return true;
  elsif p_action = 'final' then
    return coalesce((select count(*) from jsonb_object_keys(p_request)) = 4 and p_request ?& array['draftId', 'draftVersion', 'expectedVersion', 'attestations']
      and coalesce(p_request->>'draftId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and jsonb_typeof(p_request->'draftVersion') = 'number' and coalesce(p_request->>'draftVersion', '') ~ '^[1-9][0-9]*$'
      and jsonb_typeof(p_request->'expectedVersion') = 'number' and coalesce(p_request->>'expectedVersion', '') ~ '^(0|[1-9][0-9]*)$'
      and (p_request->>'draftVersion')::numeric <= 2147483647 and (p_request->>'expectedVersion')::numeric <= 2147483647, false);
  end if;
  return false;
exception when others then return false;
end $$;
revoke all on function app.valid_settlement_request_v5(jsonb, text) from public, anon, authenticated, service_role;

-- Keep the V5 writer's established receipt lookup and request hash. The patch
-- only widens its exact request-key preflight and adds structured schedule checks.
do $$
declare definition text; patched text; draft_keys text; draft_anchor text; final_anchor text; rejection_anchor text;
begin
  definition := pg_get_functiondef('app.write_event_settlement_v5(uuid,uuid,uuid,jsonb,uuid,text)'::regprocedure);
  patched := definition;
  draft_keys := 'if (select count(*)from jsonb_object_keys(p_request))<>8 or not(p_request ?& array[''source'',''expectedVersion'',''prizeClaims'',''eventIncomeMinor'',''eventExpenseMinor'',''retainedBalanceMinor'',''officialSourceReference'',''sanctioningExpenseEventId'']) then raise exception ''invalid_request'';end if;';
  patched := replace(patched, draft_keys,
    'if (select count(*)from jsonb_object_keys(p_request))not in(8,9) or not(p_request ?& array[''source'',''expectedVersion'',''prizeClaims'',''eventIncomeMinor'',''eventExpenseMinor'',''retainedBalanceMinor'',''officialSourceReference'',''sanctioningExpenseEventId'']) or ((select count(*)from jsonb_object_keys(p_request))=9 and not(p_request?''scheduleVersionId'')) then raise exception ''invalid_request'';end if;');
  draft_anchor := 'mrp:=app.canonical_settlement_mrp_v5(p_tournament_id,p_event_id,source);' || chr(10) || '   version_no:=version_no+1;';
  patched := replace(patched, draft_anchor, 'mrp:=app.canonical_settlement_mrp_v5(p_tournament_id,p_event_id,source);' || chr(10)
    || '   perform app.require_event_prize_schedule_draft_v1(p_tournament_id,p_event_id,p_request,mrp);' || chr(10) || '   version_no:=version_no+1;');
  final_anchor := 'if mrp->>''status''<>''available'' or mrp is distinct from draft.canonical_mrp then raise exception ''mrp_evidence_correction_required'';end if;';
  patched := replace(patched, final_anchor, final_anchor || chr(10)
    || '   perform app.require_event_prize_schedule_draft_v1(p_tournament_id,p_event_id,draft.request_payload,mrp);');
  rejection_anchor := '''payback_evidence_required'')then sqlerrm else null end;';
  patched := replace(patched, rejection_anchor, '''payback_evidence_required'',''schedule_revision_required'',''schedule_claim_mismatch'')then sqlerrm else null end;');
  if patched = definition or position('not in(8,9)' in patched) = 0 or position('perform app.require_event_prize_schedule_draft_v1' in patched) = 0
    or position('''schedule_claim_mismatch'')then sqlerrm' in patched) = 0 then raise exception 'V5 prize schedule patch anchor unavailable'; end if;
  execute patched;
end $$;

-- Enrich 0241's fact snapshot only for opted-in drafts. Historical unstructured
-- review snapshots retain their exact JSON shape and currentness behavior.
alter function app.event_payback_facts_v1(uuid, uuid) rename to event_payback_facts_base_v1;
create function app.event_payback_facts_v1(p_tid uuid, p_eid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare facts jsonb; draft app.event_settlement_drafts_v5%rowtype; resolved jsonb;
begin
  facts := app.event_payback_facts_base_v1(p_tid, p_eid);
  select * into draft from app.event_settlement_drafts_v5 where tournament_id = p_tid and event_id = p_eid order by version desc limit 1;
  if draft.prize_schedule_version_id is null then return facts; end if;
  resolved := app.resolve_event_prize_schedule_v1(p_tid, p_eid, draft.request_payload->'source', draft.prize_schedule_version_id);
  return facts || jsonb_build_object('structuredSchedule', resolved);
end $$;
revoke all on function app.event_payback_facts_base_v1(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function app.event_payback_facts_v1(uuid, uuid) from public, anon, authenticated, service_role;

alter function app.validate_event_payback_review_v1(uuid, uuid, jsonb, jsonb) rename to validate_event_payback_review_base_v1;
create function app.validate_event_payback_review_v1(p_tid uuid, p_eid uuid, p_request jsonb, p_facts jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare totals jsonb; draft app.event_settlement_drafts_v5%rowtype; structured jsonb;
begin
  totals := app.validate_event_payback_review_base_v1(p_tid, p_eid, p_request, p_facts);
  select * into draft from app.event_settlement_drafts_v5 where id = (p_request->>'draftId')::uuid and tournament_id = p_tid and event_id = p_eid;
  if draft.prize_schedule_version_id is null then return totals; end if;
  structured := p_facts->'structuredSchedule';
  if structured->>'status' <> 'available' or structured->>'scheduleVersionId' <> draft.prize_schedule_version_id::text
    or p_request->>'scheduleReference' is distinct from structured->'rule'->>'sourceReference'
    or (draft.request_payload->>'eventIncomeMinor')::numeric is distinct from (structured->>'grossEntryIncomeMinor')::numeric
    or (draft.request_payload->>'eventExpenseMinor')::numeric is distinct from (structured->>'expenseTotalMinor')::numeric
    or (draft.request_payload->>'retainedBalanceMinor')::numeric <> 0 then raise exception 'schedule_claim_mismatch';
  end if;
  return totals;
end $$;
revoke all on function app.validate_event_payback_review_base_v1(uuid, uuid, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function app.validate_event_payback_review_v1(uuid, uuid, jsonb, jsonb) from public, anon, authenticated, service_role;

-- 0241 records every controlled review failure as a rejected receipt. Extend
-- that known-code list for the structured schedule check without swallowing SQL faults.
do $$
declare definition text; patched text; anchor text;
begin
  definition := pg_get_functiondef('public.save_event_payback_review_v1(uuid,uuid,uuid,jsonb,uuid)'::regprocedure);
  anchor := '''source_already_finalized'')then sqlerrm else null end;';
  patched := replace(definition, anchor, '''source_already_finalized'',''schedule_claim_mismatch'')then sqlerrm else null end;');
  if patched = definition or position('''schedule_claim_mismatch'')then sqlerrm' in patched) = 0 then raise exception 'payback review schedule rejection anchor unavailable'; end if;
  execute patched;
end $$;

-- The established activation writer already persists controlled P0001 failures
-- with an operation receipt and audit. Add the trigger's precise rejection code.
do $$
declare definition text; patched text; anchor text;
begin
  definition := pg_get_functiondef('public.activate_tournament_setup_v2_legacy(uuid,uuid,uuid,integer,uuid)'::regprocedure);
  anchor := 'when ''setup officials stale'' then ''setup_officials_stale''' || chr(10) || '        else ''invalid_request''';
  patched := replace(definition, anchor, 'when ''setup officials stale'' then ''setup_officials_stale''' || chr(10)
    || '        when ''schedule_revision_required'' then ''schedule_revision_required''' || chr(10) || '        else ''invalid_request''');
  if patched = definition or position('when ''schedule_revision_required'' then ''schedule_revision_required''' in patched) = 0 then raise exception 'setup activation schedule rejection anchor unavailable'; end if;
  execute patched;
end $$;

create function public.list_prize_award_summaries_v1(p_actor_id uuid, p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from app.tournament_roles where tournament_id = p_tournament_id and profile_id = p_actor_id)
    and not exists(select 1 from app.event_participants participant left join app.roster_account_links link
      on link.tournament_id = participant.tournament_id and link.roster_entry_id = participant.roster_entry_id
      where participant.tournament_id = p_tournament_id and (participant.profile_id = p_actor_id or link.profile_id = p_actor_id)) then return null;
  end if;
  with bound_events as (
    select distinct on (binding.event_id) binding.event_id from app.event_prize_schedule_bindings_v1 binding
    where binding.tournament_id = p_tournament_id order by binding.event_id, binding.binding_version desc
  ), selected_reviews as (
    select event_row.event_id, coalesce(final_review.id, current_review.id) review_id
    from bound_events event_row
    left join lateral (
      select review.id from app.event_settlement_finals_v2 final
      join app.event_payback_reviews_v1 review on review.id = final.payback_review_id
      where final.tournament_id = p_tournament_id and final.event_id = event_row.event_id and final.payback_review_id is not null
      order by final.version desc limit 1
    ) final_review on true
    left join lateral (
      select review.id from app.event_payback_reviews_v1 review
      where review.tournament_id = p_tournament_id and review.event_id = event_row.event_id
        and app.current_event_payback_review_v1(p_tournament_id, event_row.event_id, review.draft_id, review.draft_version) = review.id
      order by review.version desc limit 1
    ) current_review on final_review.id is null
  ), summaries as (
    select selected.event_id, review.facts_snapshot->'structuredSchedule' structured
    from selected_reviews selected join app.event_payback_reviews_v1 review on review.id = selected.review_id
    where review.facts_snapshot->'structuredSchedule'->>'status' = 'available'
  )
  select coalesce(jsonb_agg(jsonb_build_object('eventId', event_id, 'scheduleVersion', (structured->>'scheduleVersion')::integer,
    'awards', (select jsonb_agg(jsonb_build_object('displayName', award->'displayName', 'bandStart', award->'bandStart',
      'bandEnd', award->'bandEnd', 'amountMinor', award->'totalAwardMinor') order by (award->>'bandStart')::integer, award->>'displayName')
      from jsonb_array_elements(structured->'awards') award)) order by event_id), '[]'::jsonb) into result from summaries;
  return result;
end $$;

revoke all on function public.get_setup_prize_schedule_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_tournament_prize_schedules_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_prize_schedule_reconciliation_v1(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_setup_prize_schedule_v1(uuid, uuid, uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.get_event_prize_schedule_resolution_v1(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.list_prize_award_summaries_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_setup_prize_schedule_v1(uuid, uuid, uuid) to service_role;
grant execute on function public.list_tournament_prize_schedules_v1(uuid, uuid) to service_role;
grant execute on function public.get_prize_schedule_reconciliation_v1(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.save_setup_prize_schedule_v1(uuid, uuid, uuid, jsonb, uuid) to service_role;
grant execute on function public.get_event_prize_schedule_resolution_v1(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.list_prize_award_summaries_v1(uuid, uuid) to service_role;
notify pgrst, 'reload schema';



