-- Rollback-only hosted integration proof for migration 0129.
-- Uses fictional identities and retains no rows.

begin;

create temporary table device_recovery_results(label text primary key, result jsonb not null) on commit drop;
grant select, insert on device_recovery_results to service_role;

insert into auth.users(id, email) values
  ('a9100000-0000-4000-8000-000000000001', 'recovery-director@test.invalid'),
  ('a9100000-0000-4000-8000-000000000002', 'recovery-player-a@test.invalid'),
  ('a9100000-0000-4000-8000-000000000003', 'recovery-player-b@test.invalid'),
  ('a9100000-0000-4000-8000-000000000004', 'recovery-checker-one@test.invalid'),
  ('a9100000-0000-4000-8000-000000000005', 'recovery-checker-two@test.invalid');
update app.profiles set display_name = case id
  when 'a9100000-0000-4000-8000-000000000002' then 'Recovery Player A'
  when 'a9100000-0000-4000-8000-000000000003' then 'Recovery Player B'
  else display_name end
where id in ('a9100000-0000-4000-8000-000000000002','a9100000-0000-4000-8000-000000000003');

insert into app.tournaments(id, director_profile_id, name, status, registration_status)
values ('b9100000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000001','Synthetic Device Recovery','open','open');
insert into app.tournament_roles(tournament_id, profile_id, role) values
  ('b9100000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000001','director'),
  ('b9100000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000002','player'),
  ('b9100000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000002','cross_checker'),
  ('b9100000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000003','player'),
  ('b9100000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000004','cross_checker'),
  ('b9100000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000005','cross_checker');

insert into app.operation_receipts(id, tournament_id, actor_profile_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
values ('c9100000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000001','device_recovery_fixture','b9100000-0000-4000-8000-000000000001',repeat('1',64),'c9100000-0000-4000-8000-000000000002','accepted','{}',now());

insert into app.tournament_roster_entries(id, tournament_id, claimed_display_name, claimed_normalized_name, creator_profile_id, operation_receipt_id, source_kind) values
  ('d9100000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','Recovery Player A','recovery player a','a9100000-0000-4000-8000-000000000001','c9100000-0000-4000-8000-000000000001','director_manual'),
  ('d9100000-0000-4000-8000-000000000002','b9100000-0000-4000-8000-000000000001','Recovery Player B','recovery player b','a9100000-0000-4000-8000-000000000001','c9100000-0000-4000-8000-000000000001','director_manual'),
  ('d9100000-0000-4000-8000-000000000003','b9100000-0000-4000-8000-000000000001','Unlinked Paper Player','unlinked paper player','a9100000-0000-4000-8000-000000000001','c9100000-0000-4000-8000-000000000001','director_manual');
insert into app.roster_account_links(id, tournament_id, roster_entry_id, profile_id, actor_profile_id, operation_receipt_id) values
  ('d9200000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','d9100000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000002','a9100000-0000-4000-8000-000000000001','c9100000-0000-4000-8000-000000000001'),
  ('d9200000-0000-4000-8000-000000000002','b9100000-0000-4000-8000-000000000001','d9100000-0000-4000-8000-000000000002','a9100000-0000-4000-8000-000000000003','a9100000-0000-4000-8000-000000000001','c9100000-0000-4000-8000-000000000001');
update app.tournaments set registration_status='closed'
where id='b9100000-0000-4000-8000-000000000001';
insert into app.initial_seating_publications(id, tournament_id, table_count, seats_per_table, actor_profile_id, operation_receipt_id)
values ('d9300000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001',1,2,'a9100000-0000-4000-8000-000000000001','c9100000-0000-4000-8000-000000000001');
insert into app.initial_seating_assignments(id, publication_id, tournament_id, roster_entry_id, initial_table_seat) values
  ('d9400000-0000-4000-8000-000000000001','d9300000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','d9100000-0000-4000-8000-000000000001','A-1'),
  ('d9400000-0000-4000-8000-000000000002','d9300000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','d9100000-0000-4000-8000-000000000002','A-2');

insert into app.ruleset_versions(id, tournament_id, name, format, source_reference, effective_on, approved_at)
values ('e9100000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','Synthetic Standard Singles','standard_singles','synthetic recovery fixture',current_date,now());
insert into app.events(id, tournament_id, ruleset_version_id, name, event_type, format, scoring_method)
values ('e9200000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','e9100000-0000-4000-8000-000000000001','Main','main','standard_singles','digital');
insert into app.event_participants(id, tournament_id, event_id, profile_id, roster_entry_id, table_seat, status) values
  ('e9300000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000002','d9100000-0000-4000-8000-000000000001','A-1','checked_in'),
  ('e9300000-0000-4000-8000-000000000002','b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000003','d9100000-0000-4000-8000-000000000002','A-2','checked_in'),
  ('e9300000-0000-4000-8000-000000000003','b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001',null,'d9100000-0000-4000-8000-000000000003','A-3','checked_in');
insert into app.rounds(id, tournament_id, event_id, round_number) values
  ('e9400000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001',1),
  ('e9400000-0000-4000-8000-000000000002','b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001',2),
  ('e9400000-0000-4000-8000-000000000003','b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001',3);
insert into app.canonical_games(id, tournament_id, event_id, round_id, side_a_participant_id, side_b_participant_id, side_a_table_seat_snapshot, side_b_table_seat_snapshot, state, version) values
  ('f9100000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','e9400000-0000-4000-8000-000000000001','e9300000-0000-4000-8000-000000000001','e9300000-0000-4000-8000-000000000002','A-1','A-2','pending',1),
  ('f9100000-0000-4000-8000-000000000002','b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','e9400000-0000-4000-8000-000000000002','e9300000-0000-4000-8000-000000000001','e9300000-0000-4000-8000-000000000002','A-1','A-2','pending',1),
  ('f9100000-0000-4000-8000-000000000003','b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','e9400000-0000-4000-8000-000000000003','e9300000-0000-4000-8000-000000000002','e9300000-0000-4000-8000-000000000003','A-2','A-3','pending',1);

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
insert into device_recovery_results values ('pending', public.create_device_failure_recovery_v1(
  'a9100000-0000-4000-8000-000000000004','b9100000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000001','f9200000-0000-4000-8000-000000000001','a',45,
  '[{"sourceType":"opponent_device","sourceReference":"opponent-receipt-19","winnerSide":"a","margin":45}]','f9300000-0000-4000-8000-000000000001'));
insert into device_recovery_results values ('pending_replay', public.create_device_failure_recovery_v1(
  'a9100000-0000-4000-8000-000000000004','b9100000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000001','f9200000-0000-4000-8000-000000000001','a',45,
  '[{"sourceType":"opponent_device","sourceReference":"opponent-receipt-19","winnerSide":"a","margin":45}]','f9300000-0000-4000-8000-000000000001'));
insert into device_recovery_results values ('same_actor_review', public.review_device_failure_recovery_v1(
  'a9100000-0000-4000-8000-000000000004','f9200000-0000-4000-8000-000000000001','approve','f9300000-0000-4000-8000-000000000002'));
insert into device_recovery_results values ('approved', public.review_device_failure_recovery_v1(
  'a9100000-0000-4000-8000-000000000005','f9200000-0000-4000-8000-000000000001','approve','f9300000-0000-4000-8000-000000000003'));
insert into device_recovery_results values ('conflicted', public.create_device_failure_recovery_v1(
  'a9100000-0000-4000-8000-000000000004','b9100000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000002','f9200000-0000-4000-8000-000000000002','a',12,
  '[{"sourceType":"opponent_device","sourceReference":"device-screen","winnerSide":"a","margin":12},{"sourceType":"paper_card","sourceReference":"paper-card-A-1","winnerSide":"b","margin":14}]','f9300000-0000-4000-8000-000000000004'));
insert into device_recovery_results values ('conflict_approve', public.review_device_failure_recovery_v1(
  'a9100000-0000-4000-8000-000000000005','f9200000-0000-4000-8000-000000000002','approve','f9300000-0000-4000-8000-000000000005'));
insert into device_recovery_results values ('conflict_reject', public.review_device_failure_recovery_v1(
  'a9100000-0000-4000-8000-000000000001','f9200000-0000-4000-8000-000000000002','reject','f9300000-0000-4000-8000-000000000006'));
insert into device_recovery_results values ('self_denied', public.create_device_failure_recovery_v1(
  'a9100000-0000-4000-8000-000000000002','b9100000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000002','f9200000-0000-4000-8000-000000000003','a',20,
  '[{"sourceType":"paper_card","sourceReference":"own-paper-card","winnerSide":"a","margin":20}]','f9300000-0000-4000-8000-000000000007'));
insert into device_recovery_results values ('unlinked_identity_denied', public.create_device_failure_recovery_v1(
  'a9100000-0000-4000-8000-000000000004','b9100000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000003','f9200000-0000-4000-8000-000000000004','a',20,
  '[{"sourceType":"paper_card","sourceReference":"unlinked-paper-card","winnerSide":"a","margin":20}]','f9300000-0000-4000-8000-000000000008'));
reset role;

do $$
begin
  if (select result->>'status' from device_recovery_results where label='pending') <> 'pending_review'
     or (select result from device_recovery_results where label='pending') <> (select result from device_recovery_results where label='pending_replay')
     or (select result->>'code' from device_recovery_results where label='same_actor_review') <> 'reviewer_not_independent'
     or (select result->>'status' from device_recovery_results where label='approved') <> 'approved'
     or (select result->>'status' from device_recovery_results where label='conflicted') <> 'disputed'
     or (select result->>'code' from device_recovery_results where label='conflict_approve') <> 'evidence_disputed'
     or (select result->>'status' from device_recovery_results where label='conflict_reject') <> 'rejected'
     or (select result->>'code' from device_recovery_results where label='self_denied') <> 'self_recovery_denied'
     or (select result->>'code' from device_recovery_results where label='unlinked_identity_denied') <> 'participant_identity_unresolved' then
    raise exception 'device recovery lifecycle results failed';
  end if;
  if (select count(*) from app.device_failure_recovery_projections where recovery_id='f9200000-0000-4000-8000-000000000001') <> 2
     or (select count(*) from app.device_failure_recovery_evidence where recovery_id='f9200000-0000-4000-8000-000000000002') <> 2
     or (select count(*) from app.score_submissions where canonical_game_id='f9100000-0000-4000-8000-000000000001') <> 0
     or (select count(*) from app.score_confirmations where canonical_game_id='f9100000-0000-4000-8000-000000000001') <> 0
     or (select count(*) from app.card_scorelines where canonical_game_id='f9100000-0000-4000-8000-000000000001') <> 0
     or not exists (select 1 from app.device_failure_recovery_state_events where recovery_id='f9200000-0000-4000-8000-000000000001' and state='approved' and before_totals is not null and after_totals is not null)
     or not exists (select 1 from app.audit_events where entity_id='f9200000-0000-4000-8000-000000000001' and action='device_recovery_approved') then
    raise exception 'approved recovery authority or audit evidence failed';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub','a9100000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare card jsonb; standings jsonb;
begin
  card := public.get_player_scorecard('b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001');
  standings := public.get_preliminary_event_standings('b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001');
  if jsonb_array_length(card->'lines') <> 1
     or (card->'totals'->>'gamePoints')::integer <> 3
     or (card->'totals'->>'plusPoints')::integer <> 45
     or jsonb_array_length(card->'pendingGames') <> 1
     or (standings->>'resolvedMatchCount')::integer <> 1
     or not exists (select 1 from jsonb_array_elements(standings->'rows') row_data
       where row_data->>'participantId'='e9300000-0000-4000-8000-000000000001'
         and (row_data->>'gamePoints')::integer=3 and (row_data->>'plusPoints')::integer=45
         and (row_data->>'verifiedGames')::integer=1) then
    raise exception 'approved recovery was not projected exactly once';
  end if;
end;
$$;
reset role;

do $$
begin
  begin
    insert into app.score_submissions(id,tournament_id,event_id,canonical_game_id,submitter_profile_id,submitter_participant_id,submission_slot,winner_side,margin,source_method,payload_digest)
    values ('f9400000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','f9100000-0000-4000-8000-000000000001','a9100000-0000-4000-8000-000000000002','e9300000-0000-4000-8000-000000000001',1,'a',45,'digital',repeat('9',64));
    raise exception 'submission after approved recovery unexpectedly succeeded';
  exception when others then
    if sqlerrm='submission after approved recovery unexpectedly succeeded' then raise; end if;
    if sqlerrm <> 'approved device recovery blocks fabricated or duplicate game history' then raise; end if;
  end;
  if has_function_privilege('authenticated','public.create_device_failure_recovery_v1(uuid,uuid,uuid,uuid,text,integer,jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.review_device_failure_recovery_v1(uuid,uuid,text,uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.create_device_failure_recovery_v1(uuid,uuid,uuid,uuid,text,integer,jsonb,uuid)','EXECUTE') then
    raise exception 'device recovery grants failed';
  end if;
end;
$$;

set constraints all immediate;
rollback;
