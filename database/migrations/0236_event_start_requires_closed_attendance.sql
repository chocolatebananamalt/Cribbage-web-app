-- Standard Singles Start Play is allowed only after event-day attendance is
-- explicitly closed and resolved. Enrollment's checked_in projection is not
-- event-day attendance. A no_show is resolved for this day-attendance gate,
-- while the unchanged schedule/start participant-status rules still decide
-- schedule eligibility. Team/Doubles start remains governed by 0174/0185:
-- those events use team entries and do not have 0113 event_participant rows.

create or replace function app.event_attendance_ready_to_start_v1(p_event_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from app.event_check_in_windows window_row
    where window_row.event_id=p_event_id and window_row.state='closed'
  )
  and app.event_attendance_unresolved_count_v1(p_event_id)=0
  and not exists(
    select 1
    from app.event_check_in_requests request_row
    where request_row.event_id=p_event_id and request_row.request_state='pending_desk'
  )
$$;
revoke all on function app.event_attendance_ready_to_start_v1(uuid) from public,anon,authenticated;

create or replace function app.lock_event_attendance_lifecycle_v1(p_event_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('event-attendance-lifecycle:'||p_event_id::text,0)
  );
end $$;
revoke all on function app.lock_event_attendance_lifecycle_v1(uuid) from public,anon,authenticated;

-- Keep the stricter legacy schedule, participant-status, seating, and snapshot
-- readiness rules. The attendance predicate only adds the missing day-of gate.
create or replace function app.event_play_state_v1(p_event_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select case
    when exists(select 1 from app.standard_singles_settlement_final_versions final where final.event_id=p_event_id)
      then 'finalized'
    when exists(select 1 from app.event_play_starts started where started.event_id=p_event_id)
      and exists(select 1 from app.event_schedule_games scheduled where scheduled.event_id=p_event_id)
      and not exists(select 1 from app.event_schedule_games scheduled
        where scheduled.event_id=p_event_id
          and not app.game_is_authoritatively_resolved_v1(scheduled.canonical_game_id))
      then 'completed'
    when exists(select 1 from app.event_play_starts started where started.event_id=p_event_id)
      then 'in_progress'
    when exists(select 1 from app.event_schedule_publications publication where publication.event_id=p_event_id)
      and exists(select 1 from app.events event_row join app.tournaments tournament on tournament.id=event_row.tournament_id
        where event_row.id=p_event_id and tournament.status='open' and tournament.registration_status='closed')
      and app.event_attendance_ready_to_start_v1(p_event_id)
      and not exists(select 1 from app.event_participants participant
        where participant.event_id=p_event_id and participant.status<>'checked_in')
      and not exists(select 1 from app.event_participants participant
        left join app.initial_seating_assignments seating on seating.tournament_id=participant.tournament_id and seating.roster_entry_id=participant.roster_entry_id
        where participant.event_id=p_event_id and coalesce(seating.verification_id,participant.table_seat) is null)
      and (select count(*) from app.event_participants participant where participant.event_id=p_event_id)
        =(select publication.participant_count from app.event_schedule_publications publication where publication.event_id=p_event_id)
      and (select count(*) from app.event_schedule_games scheduled where scheduled.event_id=p_event_id)
        =(select publication.match_count from app.event_schedule_publications publication where publication.event_id=p_event_id)
      then 'ready_to_start'
    else 'preparing' end
$$;
revoke all on function app.event_play_state_v1(uuid) from public,anon,authenticated;

-- Rename the current implementations and expose only lifecycle-serialized
-- wrappers. Actor-owned wrappers still require the caller's current director
-- role before receipt replay, then resolve an exact receipt before consulting
-- lifecycle state so a lost-response retry remains exact after state advances.
alter function public.open_event_check_in_window_v1(uuid,uuid,uuid,uuid)
  rename to open_event_check_in_window_v1_before_start_guard;
alter function public.close_event_check_in_window_v1(uuid,uuid,uuid,uuid)
  rename to close_event_check_in_window_v1_before_start_guard;
alter function public.set_event_attendance_v1(uuid,uuid,uuid,uuid,text,text,uuid)
  rename to set_event_attendance_v1_before_start_guard;
alter function public.desk_check_in_event_v1(uuid,uuid,uuid,uuid,uuid)
  rename to desk_check_in_event_v1_before_start_guard;
alter function public.submit_event_check_in_completion_v1(uuid,text,text,text,text,text)
  rename to submit_event_check_in_completion_v1_before_start_guard;
alter function public.enroll_roster_entries_in_event_v3(uuid,uuid,uuid,jsonb,uuid)
  rename to enroll_roster_entries_in_event_v3_before_start_guard;
alter function public.start_event_play_v1_before_sanctioning_snapshot(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid)
  rename to start_event_play_v1_before_attendance_guard;

create function public.open_event_check_in_window_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('open_event_check_in_window_v1',p_tournament_id::text,p_event_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
  perform app.lock_event_attendance_lifecycle_v1(p_event_id);
  return public.open_event_check_in_window_v1_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_idempotency_key);
end $$;

create function public.close_event_check_in_window_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('close_event_check_in_window_v1',p_tournament_id::text,p_event_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
  perform app.lock_event_attendance_lifecycle_v1(p_event_id);
  return public.close_event_check_in_window_v1_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_idempotency_key);
end $$;

create function public.set_event_attendance_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_roster_entry_id uuid,
  p_state text,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;
begin
  if p_actor_id is null or p_idempotency_key is null or p_state not in ('no_show','cancelled') or length(trim(coalesce(p_reason,''))) not between 1 and 500 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('set_event_attendance_v1',p_tournament_id::text,p_event_id::text,p_roster_entry_id::text,p_state,trim(p_reason))::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
  perform app.lock_event_attendance_lifecycle_v1(p_event_id);
  return public.set_event_attendance_v1_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_roster_entry_id,p_state,p_reason,p_idempotency_key);
end $$;

create function public.desk_check_in_event_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_roster_entry_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_roster_entry_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('desk_check_in_event_v1',p_tournament_id::text,p_event_id::text,p_roster_entry_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
  perform app.lock_event_attendance_lifecycle_v1(p_event_id);
  return public.desk_check_in_event_v1_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_roster_entry_id,p_idempotency_key);
end $$;

create function public.submit_event_check_in_completion_v1(
  p_completion_id uuid,p_secret text,p_first_name text,p_last_name text,p_email text,p_acc_number text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event_id uuid;
begin
  if p_completion_id is null or p_secret !~ '^[A-Za-z0-9_-]{43}$' then
    return public.submit_event_check_in_completion_v1_before_start_guard(p_completion_id,p_secret,p_first_name,p_last_name,p_email,p_acc_number);
  end if;
  select session_row.event_id into v_event_id
  from app.event_check_in_completion_sessions session_row
  where session_row.id=p_completion_id
    and session_row.expires_at>now()
    and app.fixed_32_byte_equal(session_row.token_digest,extensions.digest(session_row.token_salt||convert_to(lower(p_completion_id::text)||'.'||p_secret,'utf8'),'sha256'));
  if v_event_id is null then
    return public.submit_event_check_in_completion_v1_before_start_guard(p_completion_id,p_secret,p_first_name,p_last_name,p_email,p_acc_number);
  end if;
  perform app.lock_event_attendance_lifecycle_v1(v_event_id);
  return public.submit_event_check_in_completion_v1_before_start_guard(p_completion_id,p_secret,p_first_name,p_last_name,p_email,p_acc_number);
end $$;

create function public.enroll_roster_entries_in_event_v3(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_roster_entry_ids jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;v_response jsonb;v_receipt_id uuid;v_requested_count integer;v_valid_entries boolean;
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_idempotency_key is null or coalesce(jsonb_typeof(p_roster_entry_ids),'')<>'array' then
    return public.enroll_roster_entries_in_event_v3_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_roster_entry_ids,p_idempotency_key);
  end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array(
    'enroll_roster_entries_in_event_v3',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_roster_entry_ids
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  perform 1 from app.tournaments tournament where tournament.id=p_tournament_id and tournament.status='open' for update;
  if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
  perform 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director') for update;
  if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then
    if v_existing.request_hash=v_hash then return v_existing.response_payload;end if;
    perform app.lock_event_attendance_lifecycle_v1(p_event_id);
    return public.enroll_roster_entries_in_event_v3_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_roster_entry_ids,p_idempotency_key);
  end if;
  perform app.lock_event_attendance_lifecycle_v1(p_event_id);
  v_requested_count:=jsonb_array_length(p_roster_entry_ids);
  v_valid_entries:=v_requested_count between 1 and 500;
  if v_valid_entries then
    select not exists(select 1 from jsonb_array_elements(p_roster_entry_ids) item where jsonb_typeof(item)<>'string' or item#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') into v_valid_entries;
  end if;
  if v_valid_entries then
    select count(distinct (item#>>'{}')::uuid)=v_requested_count into v_valid_entries from jsonb_array_elements(p_roster_entry_ids) item;
  end if;
  if not v_valid_entries then
    return public.enroll_roster_entries_in_event_v3_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_roster_entry_ids,p_idempotency_key);
  end if;
  if not exists(
    select 1 from app.events event_row
    join app.ruleset_versions ruleset on ruleset.id=event_row.ruleset_version_id and ruleset.tournament_id=event_row.tournament_id
    where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id
      and event_row.format='standard_singles' and event_row.scoring_method='digital'
      and ruleset.format='standard_singles' and ruleset.approved_at is not null
      and exists(select 1 from app.tournament_setup_activations activation where activation.tournament_id=event_row.tournament_id and activation.event_id=event_row.id)
  ) then
    return public.enroll_roster_entries_in_event_v3_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_roster_entry_ids,p_idempotency_key);
  end if;
  if (select count(*) from app.tournament_roster_entries roster_entry
      where roster_entry.tournament_id=p_tournament_id
        and roster_entry.id in(select (item#>>'{}')::uuid from jsonb_array_elements(p_roster_entry_ids) item))<>v_requested_count then
    return public.enroll_roster_entries_in_event_v3_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_roster_entry_ids,p_idempotency_key);
  end if;
  if exists(
    select 1 from app.tournament_roster_entries roster_entry
    where roster_entry.tournament_id=p_tournament_id
      and roster_entry.id in(select (item#>>'{}')::uuid from jsonb_array_elements(p_roster_entry_ids) item)
      and coalesce((select check_in.check_in_state from app.roster_check_in_events check_in
        where check_in.tournament_id=p_tournament_id and check_in.roster_entry_id=roster_entry.id
        order by check_in.version desc limit 1),'')<>'checked_in'
  ) then
    return public.enroll_roster_entries_in_event_v3_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_roster_entry_ids,p_idempotency_key);
  end if;
  if exists(
    select 1 from app.tournament_roster_entries roster_entry
    join app.roster_account_links account_link on account_link.tournament_id=roster_entry.tournament_id and account_link.roster_entry_id=roster_entry.id
    join app.event_participants participant on participant.event_id=p_event_id and participant.profile_id=account_link.profile_id
    where roster_entry.tournament_id=p_tournament_id
      and roster_entry.id in(select (item#>>'{}')::uuid from jsonb_array_elements(p_roster_entry_ids) item)
      and participant.roster_entry_id is distinct from roster_entry.id
  ) then
    return public.enroll_roster_entries_in_event_v3_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_roster_entry_ids,p_idempotency_key);
  end if;
  if exists(select 1 from app.event_play_starts started where started.event_id=p_event_id and started.tournament_id=p_tournament_id) then
    v_response:=jsonb_build_object('status','rejected','code','event_already_started');
    insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_actor_id,p_tournament_id,'enroll_roster_entries_in_event_v3',p_event_id,v_hash,p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt_id;
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,v_receipt_id,'event',p_event_id,'event_roster_enrollment_rejected',v_response);
    return v_response;
  end if;
  return public.enroll_roster_entries_in_event_v3_before_start_guard(p_actor_id,p_tournament_id,p_event_id,p_roster_entry_ids,p_idempotency_key);
end $$;

create function public.start_event_play_v1_before_sanctioning_snapshot(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_schedule_publication_id uuid,
  p_participant_snapshot_digest text,p_expected_participant_count integer,
  p_expected_game_count integer,p_confirmed boolean,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null
    or p_schedule_publication_id is null or p_idempotency_key is null or p_confirmed is distinct from true
    or p_participant_snapshot_digest !~ '^[0-9a-f]{64}$'
    or p_expected_participant_count not between 2 and 10000
    or p_expected_game_count not between 1 and 99 then
    return jsonb_build_object('status','rejected','code','invalid_start_request');
  end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('start_event_play_v1',p_actor_id::text,
    p_tournament_id::text,p_event_id::text,p_schedule_publication_id::text,p_participant_snapshot_digest,
    p_expected_participant_count,p_expected_game_count,p_confirmed)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  perform 1 from app.tournaments tournament where tournament.id=p_tournament_id and tournament.status='open' for update;
  if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
  perform 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director') for update;
  if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
  perform app.lock_event_attendance_lifecycle_v1(p_event_id);
  if not exists(select 1 from app.events event_row where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id and event_row.operational_state='active') then return jsonb_build_object('status','rejected','code','event_retired');end if;
  if not exists(select 1 from app.tournaments tournament where tournament.id=p_tournament_id and tournament.status='open') then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
  if not app.event_attendance_ready_to_start_v1(p_event_id) then return jsonb_build_object('status','rejected','code','attendance_or_seating_incomplete');end if;
  return public.start_event_play_v1_before_attendance_guard(p_actor_id,p_tournament_id,p_event_id,p_schedule_publication_id,p_participant_snapshot_digest,p_expected_participant_count,p_expected_game_count,p_confirmed,p_idempotency_key);
end $$;

-- Renamed delegates are implementation details. Only the original RPC names
-- remain executable by service_role.
revoke all on function public.open_event_check_in_window_v1_before_start_guard(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.close_event_check_in_window_v1_before_start_guard(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.set_event_attendance_v1_before_start_guard(uuid,uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.desk_check_in_event_v1_before_start_guard(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.submit_event_check_in_completion_v1_before_start_guard(uuid,text,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.enroll_roster_entries_in_event_v3_before_start_guard(uuid,uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function public.start_event_play_v1_before_attendance_guard(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) from public,anon,authenticated,service_role;
revoke all on function public.start_event_play_v1_legacy(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) from public,anon,authenticated,service_role;
revoke all on function public.submit_event_check_in_qr_request_v1(uuid,text,text,text,text,text) from public,anon,authenticated,service_role;

revoke all on function public.open_event_check_in_window_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.close_event_check_in_window_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.set_event_attendance_v1(uuid,uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.desk_check_in_event_v1(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.submit_event_check_in_completion_v1(uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.enroll_roster_entries_in_event_v3(uuid,uuid,uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.start_event_play_v1_before_sanctioning_snapshot(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) from public,anon,authenticated;
grant execute on function public.open_event_check_in_window_v1(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.close_event_check_in_window_v1(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.set_event_attendance_v1(uuid,uuid,uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.desk_check_in_event_v1(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.submit_event_check_in_completion_v1(uuid,text,text,text,text,text) to service_role;
grant execute on function public.enroll_roster_entries_in_event_v3(uuid,uuid,uuid,jsonb,uuid) to service_role;

notify pgrst,'reload schema';
