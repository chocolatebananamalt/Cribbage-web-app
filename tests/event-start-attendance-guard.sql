-- Rollback-only integration fixture for migration 0236.
-- Prerequisite: apply migrations 0001 through 0236 to an isolated PostgreSQL
-- database, then run this file as the migration owner with ON_ERROR_STOP=1:
--   psql -X -h 127.0.0.1 -d <isolated_database_name> -v ON_ERROR_STOP=1 -f tests/event-start-attendance-guard.sql
-- The fixture uses fictional identities and rolls back every row.

begin;

insert into auth.users(id,email) values
  ('a2360000-0000-4000-8000-000000000001','attendance-start-director@test.invalid'),
  ('a2360000-0000-4000-8000-000000000002','attendance-start-player-a@test.invalid'),
  ('a2360000-0000-4000-8000-000000000003','attendance-start-player-b@test.invalid');

insert into app.tournaments(id,director_profile_id,name,status,registration_status)
values('b2360000-0000-4000-8000-000000000001','a2360000-0000-4000-8000-000000000001','Synthetic Attendance Start','open','open');
insert into app.tournament_roles(tournament_id,profile_id,role)
values('b2360000-0000-4000-8000-000000000001','a2360000-0000-4000-8000-000000000001','director');

insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
values('c2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','a2360000-0000-4000-8000-000000000001','event_start_attendance_fixture','b2360000-0000-4000-8000-000000000001',repeat('1',64),'c2360000-0000-4000-8000-000000000002','accepted','{}',now());

insert into app.tournament_setup_revisions(
  id,tournament_id,version,tournament_name,city,venue,starts_at,ends_at,timezone_name,
  actor_profile_id,operation_receipt_id
) values(
  'd2360000-0000-4000-8000-000000000010','b2360000-0000-4000-8000-000000000001',1,
  'Synthetic Attendance Start','Test City','Test Venue',timestamp '2036-01-01 09:00:00',timestamp '2036-01-01 17:00:00','Etc/UTC',
  'a2360000-0000-4000-8000-000000000001','c2360000-0000-4000-8000-000000000001'
);
insert into app.tournament_setup_event_versions(
  id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,
  timezone_name,style_code,format_code,game_count,entry_fee_cents,muggins_status
) values(
  'd2360000-0000-4000-8000-000000000020','b2360000-0000-4000-8000-000000000001','d2360000-0000-4000-8000-000000000010',
  'd2360000-0000-4000-8000-000000000021',1,'satellite','Synthetic Satellite Singles',timestamp '2036-01-01 09:00:00',
  'Etc/UTC','standard_singles','standard_singles',1,0,'unset'
);
insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at)
values('d2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','Synthetic Singles','standard_singles','fixture only',current_date,now());
insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method)
values('e2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','d2360000-0000-4000-8000-000000000001','Synthetic Satellite Singles','satellite','standard_singles','digital');
insert into app.tournament_setup_activations(
  id,tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,operation_receipt_id
) values(
  'd2360000-0000-4000-8000-000000000030','b2360000-0000-4000-8000-000000000001','d2360000-0000-4000-8000-000000000010',
  'd2360000-0000-4000-8000-000000000020','d2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001',
  'a2360000-0000-4000-8000-000000000001','c2360000-0000-4000-8000-000000000001'
);

insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id) values
  ('f2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','director_manual','Fixture Player A','fixture player a','digital','a2360000-0000-4000-8000-000000000001','c2360000-0000-4000-8000-000000000001'),
  ('f2360000-0000-4000-8000-000000000002','b2360000-0000-4000-8000-000000000001','director_manual','Fixture Player B','fixture player b','digital','a2360000-0000-4000-8000-000000000001','c2360000-0000-4000-8000-000000000001');
insert into app.roster_check_in_events(tournament_id,roster_entry_id,version,check_in_state,reason,actor_profile_id,operation_receipt_id) values
  ('b2360000-0000-4000-8000-000000000001','f2360000-0000-4000-8000-000000000001',1,'checked_in','Fixture attendance','a2360000-0000-4000-8000-000000000001','c2360000-0000-4000-8000-000000000001'),
  ('b2360000-0000-4000-8000-000000000001','f2360000-0000-4000-8000-000000000002',1,'checked_in','Fixture attendance','a2360000-0000-4000-8000-000000000001','c2360000-0000-4000-8000-000000000001');
update app.tournaments set registration_status='closed'
where id='b2360000-0000-4000-8000-000000000001';
insert into app.event_participants(id,tournament_id,event_id,profile_id,roster_entry_id,table_seat,status) values
  ('12360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','a2360000-0000-4000-8000-000000000002','f2360000-0000-4000-8000-000000000001','A-1','checked_in'),
  ('12360000-0000-4000-8000-000000000002','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','a2360000-0000-4000-8000-000000000003','f2360000-0000-4000-8000-000000000002','A-2','checked_in');

insert into app.rounds(id,tournament_id,event_id,round_number)
values('22360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001',1);
insert into app.canonical_games(id,tournament_id,event_id,round_id,side_a_participant_id,side_b_participant_id,side_a_table_seat_snapshot,side_b_table_seat_snapshot,state,version)
values('32360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','22360000-0000-4000-8000-000000000001','12360000-0000-4000-8000-000000000001','12360000-0000-4000-8000-000000000002','A-1','A-2','pending',1);
insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id)
values('42360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','director_entry',1,2,1,repeat('2',64),'a2360000-0000-4000-8000-000000000001','c2360000-0000-4000-8000-000000000001');
insert into app.event_schedule_games(publication_id,tournament_id,event_id,canonical_game_id,import_row_number)
values('42360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','32360000-0000-4000-8000-000000000001',1);

do $$
declare v_result jsonb;v_digest text;
begin
  v_digest:=app.event_participant_snapshot_digest_v1('e2360000-0000-4000-8000-000000000001');
  if app.event_play_state_v1('e2360000-0000-4000-8000-000000000001')<>'preparing' then raise exception 'no attendance window was reported ready';end if;
  v_result:=public.start_event_play_v1('a2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','42360000-0000-4000-8000-000000000001',v_digest,2,1,true,'52360000-0000-4000-8000-000000000001');
  if v_result->>'code'<>'attendance_or_seating_incomplete' then raise exception 'no-window start was not rejected: %',v_result;end if;
end $$;

insert into app.event_check_in_windows(event_id,tournament_id,state,opened_at,opened_by_profile_id,version)
values('e2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','open',now(),'a2360000-0000-4000-8000-000000000001',1);
do $$ declare v_result jsonb;begin
  v_result:=public.start_event_play_v1('a2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','42360000-0000-4000-8000-000000000001',app.event_participant_snapshot_digest_v1('e2360000-0000-4000-8000-000000000001'),2,1,true,'52360000-0000-4000-8000-000000000002');
  if v_result->>'code'<>'attendance_or_seating_incomplete' then raise exception 'open-window start was not rejected: %',v_result;end if;
end $$;

update app.event_check_in_windows set state='closed',closed_at=now(),closed_by_profile_id='a2360000-0000-4000-8000-000000000001',version=2 where event_id='e2360000-0000-4000-8000-000000000001';
do $$ declare v_result jsonb;begin
  v_result:=public.start_event_play_v1('a2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','42360000-0000-4000-8000-000000000001',app.event_participant_snapshot_digest_v1('e2360000-0000-4000-8000-000000000001'),2,1,true,'52360000-0000-4000-8000-000000000003');
  if v_result->>'code'<>'attendance_or_seating_incomplete' then raise exception 'unresolved attendance start was not rejected: %',v_result;end if;
end $$;

insert into app.event_check_in_events(tournament_id,event_id,roster_entry_id,version,state,source,actor_profile_id) values
  ('b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','f2360000-0000-4000-8000-000000000001',1,'checked_in','desk','a2360000-0000-4000-8000-000000000001'),
  ('b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','f2360000-0000-4000-8000-000000000002',1,'no_show','desk','a2360000-0000-4000-8000-000000000001');
do $$ begin
  if not app.event_attendance_ready_to_start_v1('e2360000-0000-4000-8000-000000000001') then raise exception 'no-show was not treated as a resolved day-attendance disposition';end if;
end $$;
-- The fixture writes only the attendance history here. The legacy schedule and
-- start rules still require participant.status=checked_in; 0236 does not turn a
-- no-show into a schedule-eligible player.
insert into app.event_check_in_events(tournament_id,event_id,roster_entry_id,version,state,source,actor_profile_id) values
  ('b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','f2360000-0000-4000-8000-000000000002',2,'cancelled','desk','a2360000-0000-4000-8000-000000000001');
do $$ begin
  if app.event_attendance_ready_to_start_v1('e2360000-0000-4000-8000-000000000001') then raise exception 'latest cancelled disposition was ignored';end if;
end $$;
insert into app.event_check_in_events(tournament_id,event_id,roster_entry_id,version,state,source,actor_profile_id) values
  ('b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','f2360000-0000-4000-8000-000000000002',3,'checked_in','desk','a2360000-0000-4000-8000-000000000001');
insert into app.event_check_in_requests(id,tournament_id,event_id,requested_first_name,requested_last_name,requested_email,requested_acc_number,request_state,source)
values('62360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','Pending','Desk','pending-desk@test.invalid','HI236','pending_desk','qr');
do $$ declare v_result jsonb;begin
  v_result:=public.start_event_play_v1('a2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','42360000-0000-4000-8000-000000000001',app.event_participant_snapshot_digest_v1('e2360000-0000-4000-8000-000000000001'),2,1,true,'52360000-0000-4000-8000-000000000004');
  if v_result->>'code'<>'attendance_or_seating_incomplete' then raise exception 'pending-desk start was not rejected: %',v_result;end if;
end $$;

update app.event_check_in_requests set request_state='rejected' where id='62360000-0000-4000-8000-000000000001';
do $$
declare v_first jsonb;v_retry jsonb;v_digest text;
begin
  if not app.event_attendance_ready_to_start_v1('e2360000-0000-4000-8000-000000000001') then raise exception 'closed resolved attendance did not pass the gate';end if;
  v_digest:=app.event_participant_snapshot_digest_v1('e2360000-0000-4000-8000-000000000001');
  v_first:=public.start_event_play_v1('a2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','42360000-0000-4000-8000-000000000001',v_digest,2,1,true,'52360000-0000-4000-8000-000000000005');
  if v_first->>'status'<>'event_started' then raise exception 'closed resolved start failed: %',v_first;end if;
  update app.event_check_in_windows set state='open',closed_at=null,closed_by_profile_id=null,version=3 where event_id='e2360000-0000-4000-8000-000000000001';
  v_retry:=public.start_event_play_v1('a2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','42360000-0000-4000-8000-000000000001',v_digest,2,1,true,'52360000-0000-4000-8000-000000000005');
  if v_retry is distinct from v_first then raise exception 'accepted singles retry changed: first %, retry %',v_first,v_retry;end if;
  if (select count(*) from app.event_play_starts where event_id='e2360000-0000-4000-8000-000000000001')<>1 then raise exception 'accepted singles retry duplicated start';end if;
  if (select count(*) from app.operation_receipts where actor_profile_id='a2360000-0000-4000-8000-000000000001' and client_operation_id='52360000-0000-4000-8000-000000000005')<>1 then raise exception 'accepted singles retry duplicated receipt';end if;
end $$;

-- Receipt replay still requires the actor's current director authority.
delete from app.tournament_roles
where tournament_id='b2360000-0000-4000-8000-000000000001'
  and profile_id='a2360000-0000-4000-8000-000000000001';
do $$ declare v_retry jsonb;begin
  v_retry:=public.start_event_play_v1('a2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001','42360000-0000-4000-8000-000000000001',app.event_participant_snapshot_digest_v1('e2360000-0000-4000-8000-000000000001'),2,1,true,'52360000-0000-4000-8000-000000000005');
  if v_retry->>'code'<>'not_director' then raise exception 'revoked director replay was not rejected: %',v_retry;end if;
end $$;
insert into app.tournament_roles(tournament_id,profile_id,role)
values('b2360000-0000-4000-8000-000000000001','a2360000-0000-4000-8000-000000000001','director');

do $$
declare v_first jsonb;v_retry jsonb;
begin
  v_first:=public.enroll_roster_entries_in_event_v3('a2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001',jsonb_build_array('f2360000-0000-4000-8000-000000000001'),'a2360000-0000-4000-8000-000000000010');
  if v_first->>'code'<>'event_already_started' then raise exception 'post-start enrollment was not rejected: %',v_first;end if;
  v_retry:=public.enroll_roster_entries_in_event_v3('a2360000-0000-4000-8000-000000000001','b2360000-0000-4000-8000-000000000001','e2360000-0000-4000-8000-000000000001',jsonb_build_array('f2360000-0000-4000-8000-000000000001'),'a2360000-0000-4000-8000-000000000010');
  if v_retry is distinct from v_first then raise exception 'post-start enrollment retry changed: first %, retry %',v_first,v_retry;end if;
  if (select count(*) from app.operation_receipts where actor_profile_id='a2360000-0000-4000-8000-000000000001' and client_operation_id='a2360000-0000-4000-8000-000000000010')<>1 then raise exception 'post-start enrollment retry duplicated receipt';end if;
end $$;

rollback;
