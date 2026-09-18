-- Rollback-only hosted acceptance fixture for transient, two-Judge calls.
begin;
select set_config('request.jwt.claim.role','service_role',true);

insert into auth.users(id,email) values
 ('a2130000-0000-4000-8000-000000000001','judge-call-director@test.invalid'),
 ('a2130000-0000-4000-8000-000000000002','judge-call-player-a@test.invalid'),
 ('a2130000-0000-4000-8000-000000000003','judge-call-player-b@test.invalid'),
 ('a2130000-0000-4000-8000-000000000004','judge-call-judge-one@test.invalid'),
 ('a2130000-0000-4000-8000-000000000005','judge-call-judge-two@test.invalid'),
 ('a2130000-0000-4000-8000-000000000006','judge-call-judge-three@test.invalid'),
 ('a2130000-0000-4000-8000-000000000007','judge-call-outsider@test.invalid');

insert into app.tournaments(id,director_profile_id,name,status,registration_status) values
 ('b2130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000001','Transient Judge Call Fixture','open','closed');
insert into app.tournament_roles(tournament_id,profile_id,role) values
 ('b2130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000001','director'),
 ('b2130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000002','player'),
 ('b2130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000002','judge'),
 ('b2130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000003','player'),
 ('b2130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000004','judge'),
 ('b2130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000005','judge'),
 ('b2130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000006','judge');
insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values
 ('c2130000-0000-4000-8000-000000000001','b2130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000001','judge_call_fixture','b2130000-0000-4000-8000-000000000001',repeat('1',64),'d2130000-0000-4000-8000-000000000001','accepted','{}',clock_timestamp());
insert into app.tournament_setup_revisions(id,tournament_id,version,tournament_name,city,venue,starts_at,ends_at,timezone_name,actor_profile_id,operation_receipt_id) values
 ('e2130000-0000-4000-8000-000000000001','b2130000-0000-4000-8000-000000000001',1,'Transient Judge Call Fixture','Test City','Test Venue','2026-10-03 09:00','2026-10-03 18:00','Pacific/Honolulu','a2130000-0000-4000-8000-000000000001','c2130000-0000-4000-8000-000000000001');
insert into app.tournament_setup_event_versions(id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,style_code,format_code,game_count,entry_fee_cents,muggins_status) values
 ('e2130000-0000-4000-8000-000000000002','b2130000-0000-4000-8000-000000000001','e2130000-0000-4000-8000-000000000001','e2130000-0000-4000-8000-000000000003',1,'main','Main','2026-10-03 09:00','Pacific/Honolulu','director_configured_standard_singles','standard_singles',1,0,'unset');
insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at) values
 ('f2130000-0000-4000-8000-000000000001','b2130000-0000-4000-8000-000000000001','ACC 2025 fixture','standard_singles','ACC Official Tournament Rules 2025','2025-01-01',clock_timestamp());
insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method) values
 ('12130000-0000-4000-8000-000000000001','b2130000-0000-4000-8000-000000000001','f2130000-0000-4000-8000-000000000001','Main','main','standard_singles','digital');
insert into app.tournament_setup_activations(id,tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,operation_receipt_id) values
 ('22130000-0000-4000-8000-000000000001','b2130000-0000-4000-8000-000000000001','e2130000-0000-4000-8000-000000000001','e2130000-0000-4000-8000-000000000002','f2130000-0000-4000-8000-000000000001','12130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000001','c2130000-0000-4000-8000-000000000001');
insert into app.event_participants(id,tournament_id,event_id,profile_id,table_seat,status) values
 ('42130000-0000-4000-8000-000000000001','b2130000-0000-4000-8000-000000000001','12130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000002','A-1','checked_in'),
 ('42130000-0000-4000-8000-000000000002','b2130000-0000-4000-8000-000000000001','12130000-0000-4000-8000-000000000001','a2130000-0000-4000-8000-000000000003','A-2','checked_in');
insert into app.rounds(id,tournament_id,event_id,round_number) values
 ('52130000-0000-4000-8000-000000000001','b2130000-0000-4000-8000-000000000001','12130000-0000-4000-8000-000000000001',1);
insert into app.canonical_games(id,tournament_id,event_id,round_id,match_instance,side_a_participant_id,side_b_participant_id,side_a_table_seat_snapshot,side_b_table_seat_snapshot,state,version) values
 ('62130000-0000-4000-8000-000000000001','b2130000-0000-4000-8000-000000000001','12130000-0000-4000-8000-000000000001','52130000-0000-4000-8000-000000000001',1,'42130000-0000-4000-8000-000000000001','42130000-0000-4000-8000-000000000002','A-1','A-2','pending',1);
insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id) values
 ('72130000-0000-4000-8000-000000000001','b2130000-0000-4000-8000-000000000001','12130000-0000-4000-8000-000000000001','director_entry',1,2,1,repeat('7',64),'a2130000-0000-4000-8000-000000000001','c2130000-0000-4000-8000-000000000001');
insert into app.event_schedule_games(publication_id,tournament_id,event_id,canonical_game_id,import_row_number) values
 ('72130000-0000-4000-8000-000000000001','b2130000-0000-4000-8000-000000000001','12130000-0000-4000-8000-000000000001','62130000-0000-4000-8000-000000000001',1);
insert into app.event_play_starts(id,tournament_id,event_id,schedule_publication_id,participant_snapshot_digest,participant_count,game_count,schedule_match_count,started_by_profile_id,start_source) values
 ('82130000-0000-4000-8000-000000000001','b2130000-0000-4000-8000-000000000001','12130000-0000-4000-8000-000000000001','72130000-0000-4000-8000-000000000001',app.event_participant_snapshot_digest_v1('12130000-0000-4000-8000-000000000001'),2,1,1,'a2130000-0000-4000-8000-000000000001','legacy_scoring_backfill');

do $$
declare result jsonb; workspace jsonb; audit_before bigint; receipts_before bigint;
begin
  select count(*) into audit_before from app.audit_events where tournament_id='b2130000-0000-4000-8000-000000000001';
  select count(*) into receipts_before from app.operation_receipts where tournament_id='b2130000-0000-4000-8000-000000000001';
  result:=public.open_live_judge_call_v1('a2130000-0000-4000-8000-000000000007','b2130000-0000-4000-8000-000000000001','62130000-0000-4000-8000-000000000001');
  if result->>'code'<>'game_unavailable' then raise exception 'outsider opened Judge Call: %',result; end if;
  result:=public.open_live_judge_call_v1('a2130000-0000-4000-8000-000000000002','b2130000-0000-4000-8000-000000000001','62130000-0000-4000-8000-000000000001');
  if result->>'status'<>'called' or result->>'acceptedJudgeCount'<>'0' then raise exception 'player could not open Judge Call: %',result; end if;
  result:=public.accept_live_judge_call_v1('a2130000-0000-4000-8000-000000000002','b2130000-0000-4000-8000-000000000001','62130000-0000-4000-8000-000000000001');
  if result->>'code'<>'judge_is_player' then raise exception 'playing Judge accepted own game: %',result; end if;
  result:=public.accept_live_judge_call_v1('a2130000-0000-4000-8000-000000000004','b2130000-0000-4000-8000-000000000001','62130000-0000-4000-8000-000000000001');
  if result->>'status'<>'accepted' or result->>'acceptedJudgeCount'<>'1' then raise exception 'first Judge accept failed: %',result; end if;
  result:=public.accept_live_judge_call_v1('a2130000-0000-4000-8000-000000000005','b2130000-0000-4000-8000-000000000001','62130000-0000-4000-8000-000000000001');
  if result->>'status'<>'accepted' or result->>'acceptedJudgeCount'<>'2' then raise exception 'second Judge accept failed: %',result; end if;
  result:=public.accept_live_judge_call_v1('a2130000-0000-4000-8000-000000000006','b2130000-0000-4000-8000-000000000001','62130000-0000-4000-8000-000000000001');
  if result->>'code'<>'two_judges_already_assigned' then raise exception 'third Judge was not rejected: %',result; end if;
  workspace:=public.get_live_judge_calls_v1('a2130000-0000-4000-8000-000000000006','b2130000-0000-4000-8000-000000000001');
  if jsonb_array_length(workspace->'calls')<>1 or workspace#>>'{calls,0,acceptedJudgeCount}'<>'2'
    or (workspace#>>'{calls,0,assignedToMe}')::boolean or (workspace#>>'{calls,0,availableToAccept}')::boolean then
    raise exception 'Judge workspace assignment state is wrong: %',workspace;
  end if;
  if public.get_live_judge_calls_v1('a2130000-0000-4000-8000-000000000007','b2130000-0000-4000-8000-000000000001') is not null then raise exception 'non-Judge received Judge workspace'; end if;
  result:=public.resolve_live_judge_call_v1('a2130000-0000-4000-8000-000000000006','b2130000-0000-4000-8000-000000000001','62130000-0000-4000-8000-000000000001');
  if result->>'code'<>'not_assigned_judge' then raise exception 'unassigned Judge resolved call: %',result; end if;
  result:=public.resolve_live_judge_call_v1('a2130000-0000-4000-8000-000000000004','b2130000-0000-4000-8000-000000000001','62130000-0000-4000-8000-000000000001');
  if result->>'status'<>'resolved' then raise exception 'assigned Judge resolve failed: %',result; end if;
  result:=public.resolve_live_judge_call_v1('a2130000-0000-4000-8000-000000000005','b2130000-0000-4000-8000-000000000001','62130000-0000-4000-8000-000000000001');
  if result->>'status'<>'already_resolved' then raise exception 'resolved call replay failed: %',result; end if;
  if exists(select 1 from app.active_judge_calls where tournament_id='b2130000-0000-4000-8000-000000000001')
    or (select count(*) from app.audit_events where tournament_id='b2130000-0000-4000-8000-000000000001')<>audit_before
    or (select count(*) from app.operation_receipts where tournament_id='b2130000-0000-4000-8000-000000000001')<>receipts_before then
    raise exception 'Judge Call left permanent ruling, receipt, or active state';
  end if;
end $$;

do $$ begin
  if has_table_privilege('anon','app.active_judge_calls','select,insert,update,delete')
    or has_table_privilege('authenticated','app.active_judge_calls','select,insert,update,delete')
    or has_function_privilege('anon','public.open_live_judge_call_v1(uuid,uuid,uuid)','execute')
    or has_function_privilege('authenticated','public.accept_live_judge_call_v1(uuid,uuid,uuid)','execute')
    or has_function_privilege('authenticated','public.resolve_live_judge_call_v1(uuid,uuid,uuid)','execute')
    or has_function_privilege('authenticated','public.get_live_judge_calls_v1(uuid,uuid)','execute')
    or not has_function_privilege('service_role','public.open_live_judge_call_v1(uuid,uuid,uuid)','execute') then raise exception 'transient Judge Call grants are invalid'; end if;
end $$;

rollback;
