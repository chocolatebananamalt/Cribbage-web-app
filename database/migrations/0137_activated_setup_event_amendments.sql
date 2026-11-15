-- Append new events to an activated tournament without rewriting its existing
-- setup snapshots, operational events, or rulesets. The transaction creates a
-- new complete setup snapshot but activates only the newly supplied events.

create table app.tournament_setup_amendments (
  id uuid primary key,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  base_setup_revision_id uuid not null,
  setup_revision_id uuid not null,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  added_event_count smallint not null check (added_event_count between 1 and 31),
  created_at timestamptz not null default now(),
  foreign key (base_setup_revision_id, tournament_id)
    references app.tournament_setup_revisions(id, tournament_id) on delete restrict,
  foreign key (setup_revision_id, tournament_id)
    references app.tournament_setup_revisions(id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id, actor_profile_id)
    references app.operation_receipts(id, tournament_id, actor_profile_id) on delete restrict,
  unique (setup_revision_id),
  unique (operation_receipt_id)
);
alter table app.tournament_setup_amendments enable row level security;
alter table app.tournament_setup_amendments force row level security;
revoke all on table app.tournament_setup_amendments from public, anon, authenticated;
create trigger tournament_setup_amendments_immutable before update or delete on app.tournament_setup_amendments
for each row execute function app.reject_immutable_history();
create index tournament_setup_amendments_tournament_id_idx on app.tournament_setup_amendments(tournament_id);
create index tournament_setup_amendments_base_revision_idx on app.tournament_setup_amendments(base_setup_revision_id, tournament_id);
create index tournament_setup_amendments_actor_profile_id_idx on app.tournament_setup_amendments(actor_profile_id);

-- Once operational activation exists, the ordinary authenticated draft writer
-- may no longer append a competing setup snapshot. Only this server-only
-- amendment transaction may append the next immutable revision.
create function app.guard_activated_setup_revision_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from app.tournament_setup_activations activation
    where activation.tournament_id = new.tournament_id
  ) and coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'setup lifecycle closed';
  end if;
  return new;
end;
$$;
revoke all on function app.guard_activated_setup_revision_insert() from public, anon, authenticated;
create trigger guard_activated_setup_revision_insert before insert on app.tournament_setup_revisions
for each row execute function app.guard_activated_setup_revision_insert();

create or replace function app.setup_amendment_service_only()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only setup amendment';
  end if;
end;
$$;
revoke all on function app.setup_amendment_service_only() from public, anon, authenticated;

create function public.append_tournament_setup_events_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_expected_setup_revision_id uuid,
  p_expected_setup_version integer,
  p_events jsonb,
  p_operation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament app.tournaments%rowtype;
  v_base app.tournament_setup_revisions%rowtype;
  v_existing_event app.tournament_setup_event_versions%rowtype;
  v_event jsonb;
  v_pool jsonb;
  v_existing app.operation_receipts%rowtype;
  v_hash text;
  v_receipt_id uuid;
  v_amendment_id uuid := extensions.gen_random_uuid();
  v_revision_id uuid := extensions.gen_random_uuid();
  v_setup_event_ids uuid[] := array[]::uuid[];
  v_ruleset_ids uuid[] := array[]::uuid[];
  v_event_ids uuid[] := array[]::uuid[];
  v_activation_ids uuid[] := array[]::uuid[];
  v_existing_names text[];
  v_existing_client_ids uuid[];
  v_new_names text[] := array[]::text[];
  v_new_client_ids uuid[] := array[]::uuid[];
  v_event_count integer;
  v_existing_count integer;
  v_index integer := 0;
  v_pool_count integer;
  v_copy_event_id uuid;
  v_response_events jsonb := '[]'::jsonb;
  v_response jsonb;
  v_scoring_method text;
  v_error text;
  v_code text;
  v_authorized boolean := false;
  v_tournament_exists boolean := false;
begin
  begin
    perform app.setup_amendment_service_only();
    if p_actor_id is null or p_tournament_id is null or p_expected_setup_revision_id is null
       or p_expected_setup_version is null or p_expected_setup_version < 1
       or p_operation_id is null or p_events is null or jsonb_typeof(p_events) <> 'array'
       or jsonb_array_length(p_events) not between 1 and 31 then
      raise exception using errcode = 'P0001', message = 'invalid amendment request';
    end if;

    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'append_tournament_setup_events_v1', p_actor_id::text, p_tournament_id::text,
      p_expected_setup_revision_id::text, p_expected_setup_version, p_events
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('setup-amendment:' || p_tournament_id::text, 0)
    );
    select * into v_tournament from app.tournaments where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists or v_tournament.status <> 'open' then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;
    if not exists (
      select 1 from app.tournament_roles role_row
      where role_row.tournament_id = p_tournament_id and role_row.profile_id = p_actor_id
        and role_row.role in ('director', 'co_director')
    ) then raise exception using errcode = 'P0001', message = 'director role required'; end if;
    v_authorized := true;

    select * into v_existing from app.operation_receipts
    where actor_profile_id = p_actor_id and client_operation_id = p_operation_id;
    if found then
      if v_existing.operation_type = 'append_tournament_setup_events_v1'
         and v_existing.request_hash = v_hash then return v_existing.response_payload; end if;
      insert into app.tournament_setup_operation_conflicts(
        actor_profile_id, tournament_id, expected_version, attempted_idempotency_key,
        attempted_request_hash, prior_receipt_id, reason_code
      ) values (
        p_actor_id, p_tournament_id, p_expected_setup_version, p_operation_id, v_hash,
        case when v_existing.tournament_id = p_tournament_id then v_existing.id else null end,
        'idempotency_conflict'
      );
      return jsonb_build_object('status', 'rejected', 'code', 'idempotency_conflict');
    end if;

    select * into v_base from app.tournament_setup_revisions revision
    where revision.tournament_id = p_tournament_id
    order by revision.version desc limit 1 for update;
    if not found or v_base.id <> p_expected_setup_revision_id
       or v_base.version <> p_expected_setup_version then
      raise exception using errcode = 'P0001', message = 'stale setup revision';
    end if;
    if not exists (
      select 1 from app.tournament_setup_activations activation
      where activation.tournament_id = p_tournament_id and activation.setup_revision_id = v_base.id
    ) then raise exception using errcode = 'P0001', message = 'setup not activated'; end if;
    if not exists (
      select 1 from app.tournament_setup_official_versions official
      where official.setup_revision_id = v_base.id and official.role = 'director'
        and official.profile_id = v_tournament.director_profile_id
    ) or exists (
      select 1 from app.tournament_setup_official_versions official
      where official.setup_revision_id = v_base.id and not exists (
        select 1 from app.tournament_roles role_row
        where role_row.tournament_id = p_tournament_id and role_row.profile_id = official.profile_id
          and role_row.role = official.role
      )
    ) then raise exception using errcode = 'P0001', message = 'setup officials stale'; end if;

    select count(*), coalesce(array_agg(lower(trim(event_version.display_name))), array[]::text[]),
      coalesce(array_agg(event_version.client_row_id), array[]::uuid[])
    into v_existing_count, v_existing_names, v_existing_client_ids
    from app.tournament_setup_event_versions event_version
    where event_version.tournament_id = p_tournament_id and event_version.setup_revision_id = v_base.id;
    v_event_count := jsonb_array_length(p_events);
    if v_existing_count + v_event_count > 32 then
      raise exception using errcode = 'P0001', message = 'event limit reached';
    end if;

    for v_event in select value from jsonb_array_elements(p_events) loop
      v_index := v_index + 1;
      perform app.assert_setup_object_keys(v_event, array[
        'clientRowId','eventKind','displayName','startsAt','timezone','styleCode','formatCode',
        'gameCount','entryFeeCents','feeIncludesNote','payoutNote','qualificationNote','eligibilityNote','mugginsStatus','qPools'
      ]);
      if not (v_event ?& array[
        'clientRowId','eventKind','displayName','startsAt','timezone','styleCode','formatCode',
        'gameCount','entryFeeCents','feeIncludesNote','payoutNote','qualificationNote','eligibilityNote','mugginsStatus','qPools'
      ]) or jsonb_typeof(v_event->'clientRowId') <> 'string'
        or jsonb_typeof(v_event->'eventKind') <> 'string' or jsonb_typeof(v_event->'displayName') <> 'string'
        or jsonb_typeof(v_event->'startsAt') <> 'string' or jsonb_typeof(v_event->'timezone') <> 'string'
        or jsonb_typeof(v_event->'styleCode') <> 'string' or jsonb_typeof(v_event->'formatCode') <> 'string'
        or jsonb_typeof(v_event->'gameCount') <> 'number' or jsonb_typeof(v_event->'entryFeeCents') <> 'number'
        or jsonb_typeof(v_event->'feeIncludesNote') <> 'string' or jsonb_typeof(v_event->'payoutNote') <> 'string'
        or jsonb_typeof(v_event->'qualificationNote') <> 'string' or jsonb_typeof(v_event->'eligibilityNote') <> 'string'
        or jsonb_typeof(v_event->'mugginsStatus') <> 'string' or jsonb_typeof(v_event->'qPools') <> 'array' then
        raise exception using errcode = 'P0001', message = 'unsupported event';
      end if;
      if app.parse_setup_uuid(v_event->>'clientRowId') = any(v_existing_client_ids)
         or app.parse_setup_uuid(v_event->>'clientRowId') = any(v_new_client_ids)
         or lower(trim(v_event->>'displayName')) = any(v_existing_names)
         or lower(trim(v_event->>'displayName')) = any(v_new_names) then
        raise exception using errcode = 'P0001', message = 'duplicate event';
      end if;
      if v_event->>'eventKind' = 'consolation' and (
        exists (select 1 from app.tournament_setup_event_versions e where e.setup_revision_id = v_base.id and e.event_kind = 'consolation')
        or exists (select 1 from jsonb_array_elements(p_events) prior where prior->>'eventKind' = 'consolation' and prior <> v_event)
      ) then raise exception using errcode = 'P0001', message = 'consolation exists'; end if;
      if length(trim(v_event->>'displayName')) not between 1 and 200
        or length(trim(v_event->>'timezone')) not between 1 and 128
        or not exists (select 1 from pg_catalog.pg_timezone_names where name = trim(v_event->>'timezone'))
        or (v_event->>'gameCount') !~ '^[1-9][0-9]*$' or (v_event->>'gameCount')::integer not between 1 and 99
        or (v_event->>'entryFeeCents') !~ '^(0|[1-9][0-9]*)$' or (v_event->>'entryFeeCents')::numeric > 100000000
        or length(v_event->>'feeIncludesNote') > 1000 or length(v_event->>'payoutNote') > 2000
        or length(v_event->>'qualificationNote') > 2000 or length(v_event->>'eligibilityNote') > 2000
        or v_event->>'mugginsStatus' not in ('unset','in_effect','not_in_effect')
        or jsonb_array_length(v_event->'qPools') > 2
        or not (
          (v_event->>'eventKind' = 'consolation' and v_event->>'styleCode' in ('Standard','Consy Lite')
            and v_event->>'formatCode' = 'standard_singles' and (v_event->>'gameCount')::integer in (7,8,9,10))
          or (v_event->>'eventKind' = 'satellite' and (
            (v_event->>'styleCode' = 'Standard' and v_event->>'formatCode' = 'standard_singles')
            or (v_event->>'styleCode' = 'Doubles' and v_event->>'formatCode' = 'doubles')
            or (v_event->>'styleCode' = 'Canadian Doubles' and v_event->>'formatCode' = 'canadian_doubles'))
            and (v_event->>'gameCount')::integer in (3,4,5,6,7,8,9,10,11,12,18)
            and jsonb_array_length(v_event->'qPools') = 0
            and (v_event->>'payoutNote' = '' or v_event->>'payoutNote' in ('1 in 4','1 in 5','1 in 6','Top 4')))
          or (v_event->>'eventKind' = 'custom' and v_event->>'styleCode' = 'Custom'
            and v_event->>'formatCode' = 'custom' and jsonb_array_length(v_event->'qPools') = 0)
        ) then raise exception using errcode = 'P0001', message = 'unsupported event';
      end if;
      perform app.parse_setup_timestamp(v_event->>'startsAt');
      v_pool_count := 0;
      for v_pool in select value from jsonb_array_elements(v_event->'qPools') loop
        v_pool_count := v_pool_count + 1;
        perform app.assert_setup_object_keys(v_pool, array['poolTypeCode','entryFeeCents','note']);
        if not (v_pool ?& array['poolTypeCode','entryFeeCents','note'])
          or jsonb_typeof(v_pool->'poolTypeCode') <> 'string' or jsonb_typeof(v_pool->'entryFeeCents') <> 'number'
          or jsonb_typeof(v_pool->'note') <> 'string'
          or v_pool->>'poolTypeCode' not in ('Equal (Pays All Equally)','Equal (Top Qualifier Paid Double)','Graduated (1-in-4)','Graduated (1-in-6)','Graduated (1-in-8)','Graduated (1-in-10)')
          or (v_pool->>'entryFeeCents') !~ '^(0|[1-9][0-9]*)$' or (v_pool->>'entryFeeCents')::numeric > 100000000
          or length(v_pool->>'note') > 1000 then
          raise exception using errcode = 'P0001', message = 'unsupported event';
        end if;
      end loop;
      v_new_client_ids := array_append(v_new_client_ids, app.parse_setup_uuid(v_event->>'clientRowId'));
      v_new_names := array_append(v_new_names, lower(trim(v_event->>'displayName')));
      v_setup_event_ids := array_append(v_setup_event_ids, extensions.gen_random_uuid());
      v_ruleset_ids := array_append(v_ruleset_ids, extensions.gen_random_uuid());
      v_event_ids := array_append(v_event_ids, extensions.gen_random_uuid());
      v_activation_ids := array_append(v_activation_ids, extensions.gen_random_uuid());
      v_scoring_method := case when v_event->>'formatCode' = 'standard_singles' then 'digital' else 'manual' end;
      v_response_events := v_response_events || jsonb_build_array(jsonb_build_object(
        'activationId', v_activation_ids[v_index], 'setupEventVersionId', v_setup_event_ids[v_index],
        'rulesetVersionId', v_ruleset_ids[v_index], 'eventId', v_event_ids[v_index],
        'eventType', v_event->>'eventKind', 'name', trim(v_event->>'displayName'),
        'format', v_event->>'formatCode', 'scoringMethod', v_scoring_method,
        'gameCount', (v_event->>'gameCount')::integer
      ));
    end loop;

    v_response := jsonb_build_object(
      'status', 'tournament_setup_amended', 'amendmentId', v_amendment_id,
      'setupRevisionId', v_revision_id, 'setupVersion', v_base.version + 1,
      'addedEventCount', v_event_count, 'events', v_response_events
    );
    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id, request_hash,
      client_operation_id, outcome, response_payload, applied_at
    ) values (
      p_actor_id, p_tournament_id, 'append_tournament_setup_events_v1', v_amendment_id,
      v_hash, p_operation_id, 'accepted', v_response, now()
    ) returning id into v_receipt_id;

    insert into app.tournament_setup_revisions(
      id, tournament_id, version, tournament_name, city, venue, starts_at, ends_at,
      timezone_name, contact_details, sanctioning_fee_cents, actor_profile_id, operation_receipt_id
    ) values (
      v_revision_id, p_tournament_id, v_base.version + 1, v_base.tournament_name, v_base.city,
      v_base.venue, v_base.starts_at, v_base.ends_at, v_base.timezone_name, v_base.contact_details,
      v_base.sanctioning_fee_cents, p_actor_id, v_receipt_id
    );
    insert into app.tournament_setup_official_versions(tournament_id, setup_revision_id, profile_id, role)
    select p_tournament_id, v_revision_id, official.profile_id, official.role
    from app.tournament_setup_official_versions official where official.setup_revision_id = v_base.id;

    for v_existing_event in
      select * from app.tournament_setup_event_versions event_version
      where event_version.setup_revision_id = v_base.id order by event_version.ordinal
    loop
      v_copy_event_id := extensions.gen_random_uuid();
      insert into app.tournament_setup_event_versions(
        id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,
        timezone_name,style_code,format_code,game_count,entry_fee_cents,fee_includes_note,payout_note,
        qualification_note,eligibility_note,muggins_status,source_status
      ) values (
        v_copy_event_id,p_tournament_id,v_revision_id,v_existing_event.client_row_id,v_existing_event.ordinal,
        v_existing_event.event_kind,v_existing_event.display_name,v_existing_event.starts_at,v_existing_event.timezone_name,
        v_existing_event.style_code,v_existing_event.format_code,v_existing_event.game_count,v_existing_event.entry_fee_cents,
        v_existing_event.fee_includes_note,v_existing_event.payout_note,v_existing_event.qualification_note,
        v_existing_event.eligibility_note,v_existing_event.muggins_status,v_existing_event.source_status
      );
      insert into app.tournament_setup_q_pool_versions(
        tournament_id,setup_revision_id,setup_event_version_id,slot,pool_type_code,entry_fee_cents,note,source_status
      ) select p_tournament_id,v_revision_id,v_copy_event_id,pool.slot,pool.pool_type_code,pool.entry_fee_cents,pool.note,pool.source_status
        from app.tournament_setup_q_pool_versions pool where pool.setup_event_version_id = v_existing_event.id;
    end loop;

    v_index := 0;
    for v_event in select value from jsonb_array_elements(p_events) loop
      v_index := v_index + 1;
      insert into app.tournament_setup_event_versions(
        id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,
        style_code,format_code,game_count,entry_fee_cents,fee_includes_note,payout_note,qualification_note,
        eligibility_note,muggins_status
      ) values (
        v_setup_event_ids[v_index],p_tournament_id,v_revision_id,app.parse_setup_uuid(v_event->>'clientRowId'),
        (v_existing_count + v_index)::smallint,v_event->>'eventKind',trim(v_event->>'displayName'),
        app.parse_setup_timestamp(v_event->>'startsAt'),trim(v_event->>'timezone'),v_event->>'styleCode',
        v_event->>'formatCode',(v_event->>'gameCount')::smallint,(v_event->>'entryFeeCents')::integer,
        v_event->>'feeIncludesNote',v_event->>'payoutNote',v_event->>'qualificationNote',
        v_event->>'eligibilityNote',v_event->>'mugginsStatus'
      );
      v_pool_count := 0;
      for v_pool in select value from jsonb_array_elements(v_event->'qPools') loop
        v_pool_count := v_pool_count + 1;
        insert into app.tournament_setup_q_pool_versions(
          tournament_id,setup_revision_id,setup_event_version_id,slot,pool_type_code,entry_fee_cents,note
        ) values (
          p_tournament_id,v_revision_id,v_setup_event_ids[v_index],v_pool_count,trim(v_pool->>'poolTypeCode'),
          (v_pool->>'entryFeeCents')::integer,v_pool->>'note'
        );
      end loop;
      v_scoring_method := case when v_event->>'formatCode' = 'standard_singles' then 'digital' else 'manual' end;
      insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at)
      values (
        v_ruleset_ids[v_index],p_tournament_id,
        case when v_scoring_method = 'digital' then 'ACC 2025 Standard Singles scoring core / setup event ' else 'Director-configured paper scoring / setup event ' end || v_setup_event_ids[v_index]::text,
        v_event->>'formatCode',
        case when v_scoring_method = 'digital' then 'ACC Official Tournament Rules 2025; https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf; sha256=db284283420259c99cfcc960bfdf4a6b79c95a5fc1bee02b1817b4af4a02f9fd; scope=standard_singles_scoring_core_only'
          else 'Director-configured paper scoring; digital scoring inactive; setup amendment=' || v_amendment_id::text end,
        null, case when v_scoring_method = 'digital' then now() else null end
      );
      insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method)
      values (v_event_ids[v_index],p_tournament_id,v_ruleset_ids[v_index],trim(v_event->>'displayName'),v_event->>'eventKind',v_event->>'formatCode',v_scoring_method);
      insert into app.tournament_setup_activations(
        id,tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,operation_receipt_id
      ) values (
        v_activation_ids[v_index],p_tournament_id,v_revision_id,v_setup_event_ids[v_index],v_ruleset_ids[v_index],
        v_event_ids[v_index],p_actor_id,v_receipt_id
      );
    end loop;

    insert into app.tournament_setup_amendments(
      id,tournament_id,base_setup_revision_id,setup_revision_id,actor_profile_id,operation_receipt_id,added_event_count
    ) values (v_amendment_id,p_tournament_id,v_base.id,v_revision_id,p_actor_id,v_receipt_id,v_event_count);
    insert into app.audit_events(
      tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state
    ) values (
      p_tournament_id,p_actor_id,v_receipt_id,'tournament_setup_amendment',v_amendment_id,
      'tournament_setup_events_appended',jsonb_build_object('setupRevisionId',v_base.id,'setupVersion',v_base.version,'eventCount',v_existing_count),v_response
    );
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'tournament unavailable' then 'tournament_unavailable'
      when 'director role required' then 'not_director'
      when 'setup not activated' then 'setup_not_activated'
      when 'setup officials stale' then 'setup_officials_stale'
      when 'stale setup revision' then 'stale_setup_revision'
      when 'event limit reached' then 'event_limit_reached'
      when 'duplicate event' then 'duplicate_event'
      when 'consolation exists' then 'consolation_exists'
      when 'unsupported event' then 'unsupported_event'
      else 'invalid_request' end;
    v_response := jsonb_build_object('status','rejected','code',v_code);
    if v_authorized and v_tournament_exists then
      insert into app.operation_receipts(
        actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at
      ) values (
        p_actor_id,p_tournament_id,'append_tournament_setup_events_v1',p_tournament_id,coalesce(v_hash,repeat('0',64)),
        p_operation_id,'rejected',v_response,now()
      ) returning id into v_receipt_id;
      insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
      values (p_tournament_id,p_actor_id,v_receipt_id,'tournament_setup_amendment',p_tournament_id,'tournament_setup_amendment_rejected',v_response);
    end if;
    return v_response;
  end;
end;
$$;

create or replace function public.get_tournament_setup_activation_state_v3(
  p_actor_id uuid, p_tournament_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  with allowed as (
    select 1 where p_actor_id is not null and p_tournament_id is not null and exists (
      select 1 from app.tournament_roles role_row where role_row.tournament_id = p_tournament_id
        and role_row.profile_id = p_actor_id and role_row.role in ('director','co_director')
    )
  ), latest as (
    select revision.id, revision.version from app.tournament_setup_revisions revision, allowed
    where revision.tournament_id = p_tournament_id order by revision.version desc limit 1
  ), activated_events as (
    select jsonb_agg(jsonb_build_object(
      'eventId',event.id,'eventType',event.event_type,'name',event.name,'format',event.format,
      'scoringMethod',event.scoring_method,'gameCount',setup_event.game_count
    ) order by activation.created_at, setup_event.ordinal, event.id) value
    from app.tournament_setup_activations activation
    join app.events event on event.id = activation.event_id and event.tournament_id = activation.tournament_id
    join app.tournament_setup_event_versions setup_event on setup_event.id = activation.setup_event_version_id
      and setup_event.tournament_id = activation.tournament_id
    where activation.tournament_id = p_tournament_id
  )
  select case when not exists(select 1 from allowed) then null
    when not exists(select 1 from app.tournament_setup_activations activation where activation.tournament_id=p_tournament_id)
      then jsonb_build_object('status','not_activated')
    else jsonb_build_object(
      'status','activated','setupRevisionId',latest.id,'setupVersion',latest.version,
      'eventCount',jsonb_array_length(coalesce(activated_events.value,'[]'::jsonb)),
      'events',coalesce(activated_events.value,'[]'::jsonb)
    ) end
  from allowed left join latest on true left join activated_events on true
$$;

revoke all on function public.append_tournament_setup_events_v1(uuid,uuid,uuid,integer,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.append_tournament_setup_events_v1(uuid,uuid,uuid,integer,jsonb,uuid) to service_role;
revoke all on function public.get_tournament_setup_activation_state_v3(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_tournament_setup_activation_state_v3(uuid,uuid) to service_role;
