-- Event-day attendance is distinct from enrollment. Closing a check-in window
-- requires a disposition for every active enrolled player, and a player may
-- not be actively checked into two unfinished events at the same time.

alter table app.event_check_in_events drop constraint event_check_in_events_state_check;
alter table app.event_check_in_events add constraint event_check_in_events_state_check
  check (state in ('checked_in','no_show','cancelled'));

create or replace function app.event_attendance_conflict_v1(
  p_tournament_id uuid,p_event_id uuid,p_roster_entry_id uuid
) returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1
    from (
      select distinct on (attendance.event_id) attendance.event_id,attendance.state
      from app.event_check_in_events attendance
      where attendance.tournament_id=p_tournament_id
        and attendance.roster_entry_id=p_roster_entry_id
        and attendance.event_id<>p_event_id
      order by attendance.event_id,attendance.version desc
    ) latest
    where latest.state='checked_in'
      and app.event_play_state_v1(latest.event_id) not in ('completed','finalized')
  )
$$;
revoke all on function app.event_attendance_conflict_v1(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function app.event_attendance_unresolved_count_v1(p_event_id uuid)
returns integer language sql stable security definer set search_path='' as $$
  select count(*)::integer
  from app.event_participants participant
  left join lateral (
    select attendance.state
    from app.event_check_in_events attendance
    where attendance.event_id=participant.event_id
      and attendance.roster_entry_id=participant.roster_entry_id
    order by attendance.version desc limit 1
  ) latest on true
  where participant.event_id=p_event_id
    and participant.roster_entry_id is not null
    and participant.status not in ('withdrawn','disqualified','substituted')
    and coalesce(latest.state,'cancelled') not in ('checked_in','no_show')
$$;
revoke all on function app.event_attendance_unresolved_count_v1(uuid) from public,anon,authenticated;

create or replace function public.open_event_check_in_window_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_receipt uuid;v_hash text;v_existing app.operation_receipts%rowtype;v_version integer;v_response jsonb;
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  perform 1 from app.tournaments t where t.id=p_tournament_id and t.registration_status in('open','closed') for update;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
  perform 1 from app.events e where e.id=p_event_id and e.tournament_id=p_tournament_id and exists(select 1 from app.tournament_setup_activations a where a.tournament_id=e.tournament_id and a.event_id=e.id);if not found then return jsonb_build_object('status','rejected','code','event_unavailable');end if;
  if app.event_play_state_v1(p_event_id) in ('in_progress','completed','finalized') then return jsonb_build_object('status','rejected','code','event_already_started');end if;
  if exists(select 1 from app.events e where e.id=p_event_id and e.event_type='consolation') and not exists(select 1 from app.qualification_result_versions q join app.events main on main.id=q.event_id where q.tournament_id=p_tournament_id and main.event_type='main') then return jsonb_build_object('status','rejected','code','consolation_not_eligible');end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('open_event_check_in_window_v1',p_tournament_id::text,p_event_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
  if exists(select 1 from app.event_check_in_windows where event_id=p_event_id and state='open') then return jsonb_build_object('status','rejected','code','window_already_open');end if;
  select coalesce((select version from app.event_check_in_windows where event_id=p_event_id for update),0)+1 into v_version;
  v_response:=jsonb_build_object('status','event_check_in_opened','eventId',p_event_id,'version',v_version,'reopened',v_version>1);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_tournament_id,p_actor_id,'open_event_check_in_window_v1',p_event_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.event_check_in_windows(event_id,tournament_id,state,opened_at,opened_by_profile_id,version) values(p_event_id,p_tournament_id,'open',now(),p_actor_id,v_version) on conflict(event_id) do update set state='open',opened_at=excluded.opened_at,opened_by_profile_id=excluded.opened_by_profile_id,closed_at=null,closed_by_profile_id=null,version=excluded.version;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'event_check_in_window',p_event_id,case when v_version>1 then 'event_check_in_reopened' else 'event_check_in_opened' end,v_response);return v_response;
end $$;

create or replace function public.close_event_check_in_window_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_receipt uuid;v_hash text;v_existing app.operation_receipts%rowtype;v_version integer;v_unresolved integer;v_response jsonb;
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('close_event_check_in_window_v1',p_tournament_id::text,p_event_id::text)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
  select version+1 into v_version from app.event_check_in_windows where event_id=p_event_id and tournament_id=p_tournament_id and state='open' for update;if not found then return jsonb_build_object('status','rejected','code','window_not_open');end if;
  v_unresolved:=app.event_attendance_unresolved_count_v1(p_event_id);if v_unresolved>0 then return jsonb_build_object('status','rejected','code','attendance_incomplete','unresolvedCount',v_unresolved);end if;
  v_response:=jsonb_build_object('status','event_check_in_closed','eventId',p_event_id,'version',v_version,'unresolvedCount',0);insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_tournament_id,p_actor_id,'close_event_check_in_window_v1',p_event_id,v_hash,p_idempotency_key,'accepted',v_response,now())returning id into v_receipt;
  update app.event_check_in_windows set state='closed',closed_at=now(),closed_by_profile_id=p_actor_id,version=v_version where event_id=p_event_id;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,v_receipt,'event_check_in_window',p_event_id,'event_check_in_closed',v_response);return v_response;
end $$;

create or replace function public.set_event_attendance_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_roster_entry_id uuid,
  p_state text,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_version integer;v_response jsonb;v_participant app.event_participants%rowtype;v_prior text;v_status_sequence integer;
begin
  if p_actor_id is null or p_idempotency_key is null or p_state not in ('no_show','cancelled') or length(trim(coalesce(p_reason,''))) not between 1 and 500 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  if app.event_play_state_v1(p_event_id) in ('in_progress','completed','finalized') then return jsonb_build_object('status','rejected','code','event_already_started');end if;
  if p_state='no_show' and not exists(select 1 from app.event_check_in_windows w where w.event_id=p_event_id and w.tournament_id=p_tournament_id and w.state='open') then return jsonb_build_object('status','rejected','code','window_not_open');end if;
  select * into v_participant from app.event_participants p where p.tournament_id=p_tournament_id and p.event_id=p_event_id and p.roster_entry_id=p_roster_entry_id for update;if not found or v_participant.status in ('withdrawn','disqualified','substituted') then return jsonb_build_object('status','rejected','code','participant_unavailable');end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('set_event_attendance_v1',p_tournament_id::text,p_event_id::text,p_roster_entry_id::text,p_state,trim(p_reason))::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-attendance:'||p_event_id::text||':'||p_roster_entry_id::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
  select state into v_prior from app.event_check_in_events where event_id=p_event_id and roster_entry_id=p_roster_entry_id order by version desc limit 1;if v_prior=p_state then return jsonb_build_object('status','rejected','code','invalid_transition');end if;
  select coalesce(max(version),0)+1 into v_version from app.event_check_in_events where event_id=p_event_id and roster_entry_id=p_roster_entry_id;
  v_response:=jsonb_build_object('status','attendance_recorded','eventId',p_event_id,'rosterEntryId',p_roster_entry_id,'attendanceState',p_state,'priorState',coalesce(v_prior,'unresolved'));
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_tournament_id,p_actor_id,'set_event_attendance_v1',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.event_check_in_events(tournament_id,event_id,roster_entry_id,version,state,source,actor_profile_id,operation_receipt_id) values(p_tournament_id,p_event_id,p_roster_entry_id,v_version,p_state,'desk',p_actor_id,v_receipt);
  if p_state='no_show' and v_participant.status<>'absent' then
    select coalesce(max(sequence),0)+1 into v_status_sequence from app.event_participant_status_events where participant_id=v_participant.id;
    insert into app.event_participant_status_events(tournament_id,event_id,participant_id,sequence,operation_kind,prior_status,new_status,reason,actor_profile_id,operation_receipt_id) values(p_tournament_id,p_event_id,v_participant.id,v_status_sequence,'mark_absent',v_participant.status,'absent',trim(p_reason),p_actor_id,v_receipt);
    update app.event_participants set status='absent' where id=v_participant.id;
  elsif p_state='cancelled' and v_participant.status='absent' then
    select coalesce(max(sequence),0)+1 into v_status_sequence from app.event_participant_status_events where participant_id=v_participant.id;
    insert into app.event_participant_status_events(tournament_id,event_id,participant_id,sequence,operation_kind,prior_status,new_status,reason,actor_profile_id,operation_receipt_id) values(p_tournament_id,p_event_id,v_participant.id,v_status_sequence,'reinstate','absent','registered',trim(p_reason),p_actor_id,v_receipt);
    update app.event_participants set status='registered' where id=v_participant.id;
  end if;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state) values(p_tournament_id,p_actor_id,v_receipt,'event_attendance',p_roster_entry_id,case when p_state='no_show' then 'event_no_show_recorded' else 'event_attendance_reset' end,jsonb_build_object('attendanceState',coalesce(v_prior,'unresolved')),v_response);return v_response;
end $$;

create or replace function public.desk_check_in_event_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_roster_entry_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_version integer;v_response jsonb;v_state text;v_participant app.event_participants%rowtype;v_status_sequence integer;
begin
 if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_roster_entry_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
 if not exists(select 1 from app.event_check_in_windows w where w.tournament_id=p_tournament_id and w.event_id=p_event_id and w.state='open') then return jsonb_build_object('status','rejected','code','window_not_open');end if;
 if not app.event_qr_player_is_paid_and_enrolled(p_tournament_id,p_event_id,p_roster_entry_id) then return jsonb_build_object('status','rejected','code','payment_or_enrollment_required');end if;
 select * into v_participant from app.event_participants where tournament_id=p_tournament_id and event_id=p_event_id and roster_entry_id=p_roster_entry_id for update;if not found or v_participant.status in ('withdrawn','disqualified','substituted') then return jsonb_build_object('status','rejected','code','participant_unavailable');end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('desk_check_in_event_v1',p_tournament_id::text,p_event_id::text,p_roster_entry_id::text)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-presence:'||p_roster_entry_id::text,0));
 if app.event_attendance_conflict_v1(p_tournament_id,p_event_id,p_roster_entry_id) then return jsonb_build_object('status','rejected','code','already_checked_in_to_another_event');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('desk-check-in:'||p_event_id::text||':'||p_roster_entry_id::text,0));
 select state into v_state from app.event_check_in_events where event_id=p_event_id and roster_entry_id=p_roster_entry_id order by version desc limit 1;if v_state='checked_in' then return jsonb_build_object('status','already_checked_in','eventId',p_event_id,'rosterEntryId',p_roster_entry_id);end if;
 select coalesce(max(version),0)+1 into v_version from app.event_check_in_events where event_id=p_event_id and roster_entry_id=p_roster_entry_id;
 v_response:=jsonb_build_object('status','checked_in','eventId',p_event_id,'rosterEntryId',p_roster_entry_id,'source','desk');insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(p_tournament_id,p_actor_id,'desk_check_in_event_v1',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now())returning id into v_receipt;
 insert into app.event_check_in_events(tournament_id,event_id,roster_entry_id,version,state,source,actor_profile_id,operation_receipt_id)values(p_tournament_id,p_event_id,p_roster_entry_id,v_version,'checked_in','desk',p_actor_id,v_receipt);
 if v_participant.status<>'checked_in' then select coalesce(max(sequence),0)+1 into v_status_sequence from app.event_participant_status_events where participant_id=v_participant.id;insert into app.event_participant_status_events(tournament_id,event_id,participant_id,sequence,operation_kind,prior_status,new_status,reason,actor_profile_id,operation_receipt_id) values(p_tournament_id,p_event_id,v_participant.id,v_status_sequence,'reinstate',v_participant.status,'checked_in','Event-day desk check-in',p_actor_id,v_receipt);update app.event_participants set status='checked_in' where id=v_participant.id;end if;
 update app.event_check_in_requests set request_state='checked_in',resolved_at=now(),resolved_by_profile_id=p_actor_id where event_id=p_event_id and roster_entry_id=p_roster_entry_id and request_state='pending_desk';
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,v_receipt,'event_check_in',p_roster_entry_id,'event_check_in_recorded_at_desk',v_response);return v_response;
end $$;

create or replace function public.submit_event_check_in_completion_v1(p_completion_id uuid,p_secret text,p_first_name text,p_last_name text,p_email text,p_acc_number text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session app.event_check_in_completion_sessions%rowtype;v_name text;v_email text;v_acc text;v_roster uuid;v_state text;
begin
  if p_completion_id is null or p_secret !~ '^[A-Za-z0-9_-]{43}$' or length(trim(coalesce(p_first_name,''))) not between 1 and 80 or length(trim(coalesce(p_last_name,''))) not between 1 and 80 or length(trim(coalesce(p_email,''))) not between 3 and 320 or trim(coalesce(p_acc_number,'')) !~ '^[A-Z]{2}[0-9]+Y?$' then return jsonb_build_object('status','unavailable');end if;
  select s.* into v_session from app.event_check_in_completion_sessions s join app.event_check_in_windows w on w.event_id=s.event_id and w.tournament_id=s.tournament_id and w.state='open' where s.id=p_completion_id and s.expires_at>now() and app.fixed_32_byte_equal(s.token_digest,extensions.digest(s.token_salt||convert_to(lower(p_completion_id::text)||'.'||p_secret,'utf8'),'sha256'));if not found then return jsonb_build_object('status','unavailable');end if;
  v_name:=lower(regexp_replace(trim(p_first_name)||' '||trim(p_last_name),'[[:space:]]+',' ','g'));v_email:=lower(trim(p_email));v_acc:=trim(p_acc_number);
  select r.id into v_roster from app.tournament_roster_entries r left join lateral(select l.event_type from app.roster_entry_lifecycle_events l where l.roster_entry_id=r.id order by l.version desc limit 1) life on true where r.tournament_id=v_session.tournament_id and coalesce(life.event_type,'active')<>'withdrawn' and coalesce(r.claimed_acc_identity_key,app.acc_identity_key_v1(r.claimed_normalized_acc_number))=app.acc_identity_key_v1(v_acc) and r.claimed_normalized_name=v_name and r.claimed_normalized_email=v_email limit 1;
  if v_roster is not null and app.event_qr_player_is_paid_and_enrolled(v_session.tournament_id,v_session.event_id,v_roster) and exists(select 1 from app.event_participants p where p.event_id=v_session.event_id and p.roster_entry_id=v_roster and p.status in ('registered','checked_in')) then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-presence:'||v_roster::text,0));
    if app.event_attendance_conflict_v1(v_session.tournament_id,v_session.event_id,v_roster) then return jsonb_build_object('status','desk_required');end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-attendance:'||v_session.event_id::text||':'||v_roster::text,0));
    select state into v_state from app.event_check_in_events where event_id=v_session.event_id and roster_entry_id=v_roster order by version desc limit 1;if v_state='checked_in' then return jsonb_build_object('status','already_checked_in');elsif v_state='no_show' then return jsonb_build_object('status','desk_required');end if;
    insert into app.event_check_in_events(tournament_id,event_id,roster_entry_id,version,state,source) values(v_session.tournament_id,v_session.event_id,v_roster,coalesce((select max(version)+1 from app.event_check_in_events where event_id=v_session.event_id and roster_entry_id=v_roster),1),'checked_in','qr');
    update app.event_participants set status='checked_in' where tournament_id=v_session.tournament_id and event_id=v_session.event_id and roster_entry_id=v_roster and status in ('registered','absent');
    insert into app.event_check_in_requests(tournament_id,event_id,roster_entry_id,requested_first_name,requested_last_name,requested_email,requested_acc_number,request_state,source,resolved_at) values(v_session.tournament_id,v_session.event_id,v_roster,trim(p_first_name),trim(p_last_name),v_email,v_acc,'checked_in','qr',now());return jsonb_build_object('status','checked_in');
  end if;
  insert into app.event_check_in_requests(tournament_id,event_id,roster_entry_id,requested_first_name,requested_last_name,requested_email,requested_acc_number,request_state,source) values(v_session.tournament_id,v_session.event_id,v_roster,trim(p_first_name),trim(p_last_name),v_email,v_acc,'pending_desk','qr');return jsonb_build_object('status','desk_required');
end $$;

create or replace function public.get_event_check_in_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then jsonb_build_object(
  'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',e.id,'name',e.name,'eventType',e.event_type,'format',e.format,'playState',app.event_play_state_v1(e.id),'windowState',coalesce(w.state,'closed'),'checkedInCount',(select count(*) from app.event_participants p left join lateral(select x.state from app.event_check_in_events x where x.event_id=p.event_id and x.roster_entry_id=p.roster_entry_id order by x.version desc limit 1)latest on true where p.event_id=e.id and latest.state='checked_in'),'noShowCount',(select count(*) from app.event_participants p left join lateral(select x.state from app.event_check_in_events x where x.event_id=p.event_id and x.roster_entry_id=p.roster_entry_id order by x.version desc limit 1)latest on true where p.event_id=e.id and latest.state='no_show'),'unresolvedCount',app.event_attendance_unresolved_count_v1(e.id),'pendingDeskCount',coalesce((select count(*) from app.event_check_in_requests q where q.event_id=e.id and q.request_state='pending_desk'),0)) order by v.ordinal) from app.tournament_setup_activations a join app.events e on e.id=a.event_id and e.tournament_id=a.tournament_id join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id left join app.event_check_in_windows w on w.event_id=e.id where a.tournament_id=p_tournament_id),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(jsonb_build_object('requestId',q.id,'eventId',q.event_id,'rosterEntryId',q.roster_entry_id,'firstName',q.requested_first_name,'lastName',q.requested_last_name,'email',q.requested_email,'accNumber',q.requested_acc_number,'createdAt',q.created_at) order by q.created_at desc) from app.event_check_in_requests q where q.tournament_id=p_tournament_id and q.request_state='pending_desk'),'[]'::jsonb),
  'roster',coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId',r.id,'displayName',r.claimed_display_name,'accNumber',r.claimed_acc_number,'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',p.event_id,'participantStatus',p.status,'attendanceState',coalesce(latest.state,'unresolved')) order by p.event_id) from app.event_participants p left join lateral(select x.state from app.event_check_in_events x where x.event_id=p.event_id and x.roster_entry_id=p.roster_entry_id order by x.version desc limit 1)latest on true where p.tournament_id=r.tournament_id and p.roster_entry_id=r.id),'[]'::jsonb),'paid',coalesce(payment.event_type='received' and payment.amount_minor>=obligation.amount_owed_minor,false),'amountOwedMinor',coalesce(obligation.amount_owed_minor,0),'amountReceivedMinor',case when payment.event_type='received' then payment.amount_minor else 0 end,'paymentMethod',case when payment.event_type='received' then payment.payment_method else null end) order by r.claimed_normalized_name,r.id) from app.tournament_roster_entries r left join lateral(select l.event_type from app.roster_entry_lifecycle_events l where l.roster_entry_id=r.id order by l.version desc limit 1)lifecycle on true left join lateral(select x.amount_owed_minor from app.roster_payment_obligation_versions x where x.roster_entry_id=r.id order by x.version desc limit 1)obligation on true left join lateral(select x.event_type,x.amount_minor,x.payment_method from app.roster_payment_events x where x.roster_entry_id=r.id order by x.version desc limit 1)payment on true where r.tournament_id=p_tournament_id and coalesce(lifecycle.event_type,'active')<>'withdrawn'),'[]'::jsonb)
 ) else null end
$$;

revoke all on function public.open_event_check_in_window_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.close_event_check_in_window_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.set_event_attendance_v1(uuid,uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.desk_check_in_event_v1(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.submit_event_check_in_completion_v1(uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.get_event_check_in_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.open_event_check_in_window_v1(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.close_event_check_in_window_v1(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.set_event_attendance_v1(uuid,uuid,uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.desk_check_in_event_v1(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.submit_event_check_in_completion_v1(uuid,text,text,text,text,text) to service_role;
grant execute on function public.get_event_check_in_workspace_v1(uuid,uuid) to service_role;
notify pgrst,'reload schema';
