-- Authoritative, draft-only tournament setup writer. This intentionally does
-- not create or modify app.events, rulesets, roster, seating, scoring, finance,
-- results, exports, flyers, or ACC portal records.

alter table app.tournament_setup_event_versions
  add column qualification_note text not null default '' check (length(qualification_note) <= 2000);

create or replace function app.assert_setup_object_keys(
  p_value jsonb, p_allowed text[]
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_value) <> 'object' or exists (
    select 1 from jsonb_object_keys(p_value) as key where not (key = any(p_allowed))
  ) then
    raise exception using errcode = 'P0001', message = 'invalid setup payload';
  end if;
end;
$$;
revoke all on function app.assert_setup_object_keys(jsonb, text[]) from public, anon, authenticated;

create or replace function app.parse_setup_uuid(p_value text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if p_value is null then
    raise exception using errcode = 'P0001', message = 'invalid setup payload';
  end if;
  return p_value::uuid;
exception when invalid_text_representation then
  raise exception using errcode = 'P0001', message = 'invalid setup payload';
end;
$$;
revoke all on function app.parse_setup_uuid(text) from public, anon, authenticated;

create or replace function app.parse_setup_timestamp(p_value text)
returns timestamp language plpgsql security definer set search_path = '' as $$
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$' then
    raise exception using errcode = 'P0001', message = 'invalid setup payload';
  end if;
  return p_value::timestamp;
exception when datetime_field_overflow or invalid_datetime_format then
  raise exception using errcode = 'P0001', message = 'invalid setup payload';
end;
$$;
revoke all on function app.parse_setup_timestamp(text) from public, anon, authenticated;

create or replace function public.save_tournament_setup_version(
  p_tournament_id uuid,
  p_expected_version integer,
  p_payload jsonb,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_status text;
  v_director uuid;
  v_current_version integer;
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_receipt_id uuid;
  v_revision_id uuid := extensions.gen_random_uuid();
  v_response jsonb;
  v_error text;
  v_code text;
  v_official jsonb;
  v_event jsonb;
  v_pool jsonb;
  v_official_id uuid;
  v_event_id uuid;
  v_event_kind text;
  v_event_name text;
  v_event_start timestamp;
  v_event_timezone text;
  v_official_count integer := 0;
  v_director_count integer := 0;
  v_co_director_count integer := 0;
  v_event_count integer := 0;
  v_pool_count integer;
  v_official_ids uuid[] := array[]::uuid[];
  v_event_ids uuid[] := array[]::uuid[];
  v_event_names text[] := array[]::text[];
  v_event_ordinals integer[] := array[]::integer[];
  v_event_ordinal bigint;
  v_tournament_start timestamp;
  v_tournament_end timestamp;
  v_timezone text;
begin
  begin
    if v_actor is null then
      raise exception using errcode = 'P0001', message = 'authentication required';
    end if;
    if p_tournament_id is null or p_expected_version is null or p_expected_version < 0
       or p_idempotency_key is null or jsonb_typeof(p_payload) <> 'object' then
      raise exception using errcode = 'P0001', message = 'invalid setup request';
    end if;
    perform app.assert_setup_object_keys(p_payload, array[
      'tournamentName','city','venue','startsAt','endsAt','timezone','contactDetails',
      'sanctioningFeeCents','officials','events'
    ]);
    if not (p_payload ?& array[
      'tournamentName','city','venue','startsAt','endsAt','timezone','contactDetails',
      'sanctioningFeeCents','officials','events'
    ]) then
      raise exception using errcode = 'P0001', message = 'invalid setup payload';
    end if;
    if jsonb_typeof(p_payload->'tournamentName') <> 'string'
       or jsonb_typeof(p_payload->'city') <> 'string'
       or jsonb_typeof(p_payload->'venue') <> 'string'
       or jsonb_typeof(p_payload->'startsAt') <> 'string'
       or jsonb_typeof(p_payload->'endsAt') <> 'string'
       or jsonb_typeof(p_payload->'timezone') <> 'string'
       or jsonb_typeof(p_payload->'contactDetails') <> 'string'
       or jsonb_typeof(p_payload->'officials') <> 'array'
       or jsonb_typeof(p_payload->'events') <> 'array'
       or (p_payload->'sanctioningFeeCents' <> 'null'::jsonb
         and jsonb_typeof(p_payload->'sanctioningFeeCents') <> 'number') then
      raise exception using errcode = 'P0001', message = 'invalid setup payload';
    end if;
    if length(trim(p_payload->>'tournamentName')) not between 1 and 200
       or length(trim(p_payload->>'city')) not between 1 and 160
       or length(trim(p_payload->>'venue')) not between 1 and 240
       or length(p_payload->>'contactDetails') > 1000
       or length(trim(p_payload->>'timezone')) not between 1 and 128
       or jsonb_array_length(p_payload->'officials') not between 1 and 3
       or jsonb_array_length(p_payload->'events') > 32
       or (p_payload->>'sanctioningFeeCents') is not null
         and ((p_payload->>'sanctioningFeeCents') !~ '^(0|[1-9][0-9]*)$'
           or (p_payload->>'sanctioningFeeCents')::numeric > 100000000) then
      raise exception using errcode = 'P0001', message = 'invalid setup payload';
    end if;
    v_tournament_start := app.parse_setup_timestamp(p_payload->>'startsAt');
    v_tournament_end := app.parse_setup_timestamp(p_payload->>'endsAt');
    v_timezone := trim(p_payload->>'timezone');
    if v_tournament_end < v_tournament_start
       or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
      raise exception using errcode = 'P0001', message = 'invalid setup payload';
    end if;
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'save_tournament_setup_version', p_tournament_id::text, p_expected_version,
      p_payload, p_idempotency_key::text
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
    );
    select status, director_profile_id into v_status, v_director
      from app.tournaments where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;
    if not exists (
      select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
        and r.profile_id = v_actor and r.role in ('director', 'co_director')
    ) then
      raise exception using errcode = 'P0001', message = 'director role required';
    end if;
    v_authorized := true;
    select * into v_existing from app.operation_receipts
      where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.request_hash <> v_hash then
        raise exception using errcode = 'P0001', message = 'idempotency conflict';
      end if;
      return v_existing.response_payload;
    end if;
    if v_status not in ('draft', 'open') then
      raise exception using errcode = 'P0001', message = 'setup lifecycle closed';
    end if;
    perform 1 from app.events e where e.tournament_id = p_tournament_id for update;
    if exists (select 1 from app.initial_seating_publications s where s.tournament_id = p_tournament_id)
       or exists (select 1 from app.rounds r where r.tournament_id = p_tournament_id)
       or exists (select 1 from app.canonical_games g where g.tournament_id = p_tournament_id)
       or exists (select 1 from app.event_publication_states ps where ps.tournament_id = p_tournament_id
         and ps.state <> 'draft') then
      raise exception using errcode = 'P0001', message = 'setup lifecycle closed';
    end if;
    select coalesce(max(r.version), 0) into v_current_version
      from app.tournament_setup_revisions r where r.tournament_id = p_tournament_id;
    if p_expected_version <> v_current_version then
      raise exception using errcode = 'P0001', message = 'stale setup version';
    end if;
    for v_official in select value from jsonb_array_elements(p_payload->'officials') loop
      perform app.assert_setup_object_keys(v_official, array['profileId','role']);
      if not (v_official ?& array['profileId','role'])
         or jsonb_typeof(v_official->'profileId') <> 'string'
         or jsonb_typeof(v_official->'role') <> 'string'
         or v_official->>'role' not in ('director','co_director') then
        raise exception using errcode = 'P0001', message = 'invalid setup officials';
      end if;
      v_official_id := app.parse_setup_uuid(v_official->>'profileId');
      if v_official_id = any(v_official_ids) then
        raise exception using errcode = 'P0001', message = 'invalid setup officials';
      end if;
      v_official_ids := array_append(v_official_ids, v_official_id);
      v_official_count := v_official_count + 1;
      if v_official->>'role' = 'director' then
        v_director_count := v_director_count + 1;
        if v_official_id <> v_director then
          raise exception using errcode = 'P0001', message = 'invalid setup officials';
        end if;
      else
        v_co_director_count := v_co_director_count + 1;
      end if;
      perform 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
        and r.profile_id = v_official_id and r.role = v_official->>'role' for update;
      if not found then
        raise exception using errcode = 'P0001', message = 'invalid setup officials';
      end if;
    end loop;
    if v_official_count < 1 or v_director_count <> 1 or v_co_director_count > 2 then
      raise exception using errcode = 'P0001', message = 'invalid setup officials';
    end if;
    for v_event in select value from jsonb_array_elements(p_payload->'events') loop
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
        or jsonb_typeof(v_event->'qualificationNote') <> 'string'
        or jsonb_typeof(v_event->'eligibilityNote') <> 'string' or jsonb_typeof(v_event->'mugginsStatus') <> 'string'
        or jsonb_typeof(v_event->'qPools') <> 'array' then
        raise exception using errcode = 'P0001', message = 'invalid setup event';
      end if;
      v_event_id := app.parse_setup_uuid(v_event->>'clientRowId');
      v_event_kind := v_event->>'eventKind';
      v_event_name := trim(v_event->>'displayName');
      v_event_start := app.parse_setup_timestamp(v_event->>'startsAt');
      v_event_timezone := trim(v_event->>'timezone');
      if v_event_id = any(v_event_ids) or lower(v_event_name) = any(v_event_names)
         or v_event_kind not in ('main','consolation','satellite','custom')
         or length(v_event_name) not between 1 and 200
         or length(trim(v_event->>'styleCode')) not between 1 and 160
         or v_event->>'formatCode' not in ('standard_singles','team','doubles','canadian_doubles','custom')
         or (v_event->>'gameCount') !~ '^[1-9][0-9]*$' or (v_event->>'gameCount')::integer not between 1 and 99
         or (v_event->>'entryFeeCents') !~ '^(0|[1-9][0-9]*)$' or (v_event->>'entryFeeCents')::numeric > 100000000
         or length(v_event->>'feeIncludesNote') > 1000 or length(v_event->>'payoutNote') > 2000
         or length(v_event->>'qualificationNote') > 2000 or length(v_event->>'eligibilityNote') > 2000
         or v_event->>'mugginsStatus' not in ('unset','in_effect','not_in_effect')
         or length(v_event_timezone) not between 1 and 128
         or not exists (select 1 from pg_catalog.pg_timezone_names where name=v_event_timezone)
         or jsonb_array_length(v_event->'qPools') > 2
         or (v_event_kind not in ('main','consolation') and jsonb_array_length(v_event->'qPools') <> 0) then
        raise exception using errcode = 'P0001', message = 'invalid setup event';
      end if;
      v_event_count := v_event_count + 1;
      v_event_ids := array_append(v_event_ids, v_event_id);
      v_event_names := array_append(v_event_names, lower(v_event_name));
      v_event_ordinals := array_append(v_event_ordinals, v_event_count);
    end loop;
    if coalesce((select count(*) from unnest(v_event_names) n group by n having count(*) > 1), 0) > 0 then
      raise exception using errcode = 'P0001', message = 'invalid setup event';
    end if;
    if (select count(*) from jsonb_array_elements(p_payload->'events') e where e->>'eventKind' = 'main') > 1
       or (select count(*) from jsonb_array_elements(p_payload->'events') e where e->>'eventKind' = 'consolation') > 1 then
      raise exception using errcode = 'P0001', message = 'invalid setup event';
    end if;
    v_response := jsonb_build_object(
      'status','setup_draft_saved','revisionId',v_revision_id,'version',p_expected_version + 1,
      'eventCount',v_event_count,'operationalEventsCreated',false,'rulesetApproved',false,
      'seatingUpdated',false,'financeUpdated',false,'resultsUpdated',false,
      'payoutsCalculated',false,'qualifiersCalculated',false,'accSubmissionCreated',false
    );
    insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,
      client_operation_id,outcome,response_payload,applied_at)
    values(v_actor,p_tournament_id,'save_tournament_setup_version',p_tournament_id,v_hash,
      p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt_id;
    insert into app.tournament_setup_revisions(id,tournament_id,version,tournament_name,city,venue,starts_at,ends_at,
      timezone_name,contact_details,sanctioning_fee_cents,actor_profile_id,operation_receipt_id)
    values(v_revision_id,p_tournament_id,p_expected_version + 1,trim(p_payload->>'tournamentName'),trim(p_payload->>'city'),
      trim(p_payload->>'venue'),v_tournament_start,v_tournament_end,v_timezone,p_payload->>'contactDetails',
      case when p_payload->>'sanctioningFeeCents' is null then null else (p_payload->>'sanctioningFeeCents')::integer end,
      v_actor,v_receipt_id);
    for v_official in select value from jsonb_array_elements(p_payload->'officials') loop
      insert into app.tournament_setup_official_versions(tournament_id,setup_revision_id,profile_id,role)
      values(p_tournament_id,v_revision_id,app.parse_setup_uuid(v_official->>'profileId'),v_official->>'role');
    end loop;
    for v_event, v_event_ordinal in select value, ordinality from jsonb_array_elements(p_payload->'events') with ordinality loop
      v_event_id := extensions.gen_random_uuid();
      insert into app.tournament_setup_event_versions(id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,
        display_name,starts_at,timezone_name,style_code,format_code,game_count,entry_fee_cents,fee_includes_note,
        payout_note,qualification_note,eligibility_note,muggins_status)
      values(v_event_id,p_tournament_id,v_revision_id,app.parse_setup_uuid(v_event->>'clientRowId'),
        v_event_ordinal::smallint,v_event->>'eventKind',trim(v_event->>'displayName'),
        app.parse_setup_timestamp(v_event->>'startsAt'),trim(v_event->>'timezone'),trim(v_event->>'styleCode'),
        v_event->>'formatCode',(v_event->>'gameCount')::smallint,(v_event->>'entryFeeCents')::integer,
        v_event->>'feeIncludesNote',v_event->>'payoutNote',v_event->>'qualificationNote',
        v_event->>'eligibilityNote',v_event->>'mugginsStatus');
      v_pool_count := 0;
      for v_pool in select value from jsonb_array_elements(v_event->'qPools') loop
        perform app.assert_setup_object_keys(v_pool, array['poolTypeCode','entryFeeCents','note']);
        if not (v_pool ?& array['poolTypeCode','entryFeeCents','note'])
           or jsonb_typeof(v_pool->'poolTypeCode') <> 'string'
           or jsonb_typeof(v_pool->'entryFeeCents') <> 'number'
           or jsonb_typeof(v_pool->'note') <> 'string'
           or length(trim(v_pool->>'poolTypeCode')) not between 1 and 160
           or (v_pool->>'entryFeeCents') !~ '^(0|[1-9][0-9]*)$'
           or (v_pool->>'entryFeeCents')::numeric > 100000000
           or length(v_pool->>'note') > 1000 then
          raise exception using errcode = 'P0001', message = 'invalid setup q pool';
        end if;
        v_pool_count := v_pool_count + 1;
        insert into app.tournament_setup_q_pool_versions(tournament_id,setup_revision_id,setup_event_version_id,slot,
          pool_type_code,entry_fee_cents,note)
        values(p_tournament_id,v_revision_id,v_event_id,v_pool_count,trim(v_pool->>'poolTypeCode'),
          (v_pool->>'entryFeeCents')::integer,v_pool->>'note');
      end loop;
    end loop;
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,v_actor,v_receipt_id,'tournament_setup_revision',v_revision_id,
      'tournament_setup_draft_saved',v_response);
    return v_response;
  exception
  when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'authentication required' then 'authentication_required'
      when 'director role required' then 'not_director'
      when 'idempotency conflict' then 'idempotency_conflict'
      when 'setup lifecycle closed' then 'setup_lifecycle_closed'
      when 'stale setup version' then 'stale_version'
      when 'invalid setup officials' then 'invalid_officials'
      when 'invalid setup event' then 'invalid_event'
      when 'invalid setup q pool' then 'invalid_q_pool'
      when 'invalid setup request' then 'invalid_request'
      else 'invalid_setup_payload' end;
    v_response := jsonb_build_object('status','rejected','code',v_code);
    if v_authorized and v_tournament_exists then
      if v_error = 'idempotency conflict' then
        insert into app.tournament_setup_operation_conflicts(actor_profile_id,tournament_id,expected_version,
          attempted_idempotency_key,attempted_request_hash,prior_receipt_id,reason_code)
        values(v_actor,p_tournament_id,p_expected_version,p_idempotency_key,coalesce(v_hash,''),
          case when v_existing.tournament_id=p_tournament_id then v_existing.id else null end,v_code);
      else
        insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,
          client_operation_id,outcome,response_payload,applied_at)
        values(v_actor,p_tournament_id,'save_tournament_setup_version',p_tournament_id,coalesce(v_hash,''),
          p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt_id;
        insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
        values(p_tournament_id,v_actor,v_receipt_id,'tournament_setup_revision',p_tournament_id,
          'tournament_setup_rejected',v_response);
      end if;
    end if;
    return v_response;
  when others then
    raise;
  end;
end;
$$;

revoke all on function public.save_tournament_setup_version(uuid, integer, jsonb, uuid) from public, anon;
grant execute on function public.save_tournament_setup_version(uuid, integer, jsonb, uuid) to authenticated;
