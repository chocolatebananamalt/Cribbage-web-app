-- Rollback-only hosted integration proof for migration 0148.
-- Fictional identities only; every row is rolled back.
begin;

create temporary table hybrid_results(label text primary key,result jsonb not null) on commit drop;
grant select,insert on hybrid_results to service_role;

insert into auth.users(id,email) values
 ('a9480000-0000-4000-8000-000000000001','hybrid-director@test.invalid'),
 ('a9480000-0000-4000-8000-000000000002','hybrid-checker@test.invalid'),
 ('a9480000-0000-4000-8000-000000000003','hybrid-codirector@test.invalid'),
 ('a9480000-0000-4000-8000-000000000004','hybrid-player@test.invalid');
update app.profiles set display_name=case id
 when 'a9480000-0000-4000-8000-000000000001' then 'Hybrid Director'
 when 'a9480000-0000-4000-8000-000000000002' then 'Hybrid Checker'
 when 'a9480000-0000-4000-8000-000000000003' then 'Hybrid Co-Director'
 else 'Hybrid Digital Player' end
where id in('a9480000-0000-4000-8000-000000000001','a9480000-0000-4000-8000-000000000002','a9480000-0000-4000-8000-000000000003','a9480000-0000-4000-8000-000000000004');

insert into app.tournaments(id,director_profile_id,name,status,registration_status)
values('b9480000-0000-4000-8000-000000000001','a9480000-0000-4000-8000-000000000001','Synthetic Hybrid Completion','open','open');
insert into app.tournament_roles(tournament_id,profile_id,role) values
 ('b9480000-0000-4000-8000-000000000001','a9480000-0000-4000-8000-000000000001','director'),
 ('b9480000-0000-4000-8000-000000000001','a9480000-0000-4000-8000-000000000002','cross_checker'),
 ('b9480000-0000-4000-8000-000000000001','a9480000-0000-4000-8000-000000000003','co_director'),
 ('b9480000-0000-4000-8000-000000000001','a9480000-0000-4000-8000-000000000004','player');
insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
values('c9480000-0000-4000-8000-000000000001','b9480000-0000-4000-8000-000000000001','a9480000-0000-4000-8000-000000000001','hybrid_fixture','b9480000-0000-4000-8000-000000000001',repeat('1',64),'c9480000-0000-4000-8000-000000000002','accepted','{}',now());

insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id) values
 ('d9480000-0000-4000-8000-000000000001','b9480000-0000-4000-8000-000000000001','director_manual','Digital Player','digital player','digital','a9480000-0000-4000-8000-000000000001','c9480000-0000-4000-8000-000000000001'),
 ('d9480000-0000-4000-8000-000000000002','b9480000-0000-4000-8000-000000000001','director_manual','Paper Player','paper player','paper','a9480000-0000-4000-8000-000000000001','c9480000-0000-4000-8000-000000000001');
insert into app.roster_account_links(id,tournament_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id)
values('d9480000-0000-4000-8000-000000000011','b9480000-0000-4000-8000-000000000001','d9480000-0000-4000-8000-000000000001','a9480000-0000-4000-8000-000000000004','a9480000-0000-4000-8000-000000000001','c9480000-0000-4000-8000-000000000001');
update app.tournaments set registration_status='closed' where id='b9480000-0000-4000-8000-000000000001';
insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at)
values('e9480000-0000-4000-8000-000000000001','b9480000-0000-4000-8000-000000000001','Synthetic Standard Singles','standard_singles','synthetic hybrid fixture',current_date,now());
insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method)
values('e9480000-0000-4000-8000-000000000002','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000001','Main','main','standard_singles','digital');
insert into app.event_participants(id,tournament_id,event_id,profile_id,roster_entry_id,table_seat,status) values
 ('e9480000-0000-4000-8000-000000000011','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','a9480000-0000-4000-8000-000000000004','d9480000-0000-4000-8000-000000000001','A-1','checked_in'),
 ('e9480000-0000-4000-8000-000000000012','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002',null,'d9480000-0000-4000-8000-000000000002','A-2','checked_in');
insert into app.rounds(id,tournament_id,event_id,round_number) values
 ('e9480000-0000-4000-8000-000000000021','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002',1),
 ('e9480000-0000-4000-8000-000000000022','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002',2),
 ('e9480000-0000-4000-8000-000000000023','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002',3);
insert into app.canonical_games(id,tournament_id,event_id,round_id,side_a_participant_id,side_b_participant_id,side_a_table_seat_snapshot,side_b_table_seat_snapshot,state,version) values
 ('f9480000-0000-4000-8000-000000000001','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','e9480000-0000-4000-8000-000000000021','e9480000-0000-4000-8000-000000000011','e9480000-0000-4000-8000-000000000012','A-1','A-2','pending',1),
 ('f9480000-0000-4000-8000-000000000002','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','e9480000-0000-4000-8000-000000000022','e9480000-0000-4000-8000-000000000011','e9480000-0000-4000-8000-000000000012','A-1','A-2','pending',1),
 ('f9480000-0000-4000-8000-000000000003','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','e9480000-0000-4000-8000-000000000023','e9480000-0000-4000-8000-000000000011','e9480000-0000-4000-8000-000000000012','A-1','A-2','pending',1);
insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id)
values('f9480000-0000-4000-8000-000000000010','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','director_entry',2,2,2,repeat('2',64),'a9480000-0000-4000-8000-000000000001','c9480000-0000-4000-8000-000000000001');
insert into app.event_schedule_games(publication_id,tournament_id,event_id,canonical_game_id,import_row_number) values
 ('f9480000-0000-4000-8000-000000000010','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000001',1),
 ('f9480000-0000-4000-8000-000000000010','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000002',2);
insert into app.score_submissions(id,tournament_id,event_id,canonical_game_id,submitter_profile_id,submitter_participant_id,submission_slot,winner_side,margin,source_method,payload_digest) values
 ('f9480000-0000-4000-8000-000000000101','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000001','a9480000-0000-4000-8000-000000000004','e9480000-0000-4000-8000-000000000011',1,'a',31,'digital',repeat('a',64)),
 ('f9480000-0000-4000-8000-000000000102','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000002','a9480000-0000-4000-8000-000000000004','e9480000-0000-4000-8000-000000000011',1,'b',20,'digital',repeat('b',64)),
 ('f9480000-0000-4000-8000-000000000103','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000003','a9480000-0000-4000-8000-000000000004','e9480000-0000-4000-8000-000000000011',1,'a',10,'digital',repeat('c',64));
-- Direct fixture seeding bypasses the player RPC's version envelope; normalize
-- the synthetic game versions to the request version exercised below.
update app.canonical_games set version=1 where id in(
 'f9480000-0000-4000-8000-000000000001',
 'f9480000-0000-4000-8000-000000000002',
 'f9480000-0000-4000-8000-000000000003');

select set_config('request.jwt.claim.role','service_role',true);
-- Hosted SQL-editor proof runs as the project owner. Production RPC access is
-- still service-role only (asserted below); set local role service_role would
-- intentionally prevent this fixture's direct exclusion probes.
select public.bind_paper_official_identity_v1('a9480000-0000-4000-8000-000000000001','b9480000-0000-4000-8000-000000000001','c9480000-0000-4000-8000-000000000101','a9480000-0000-4000-8000-000000000002','nonparticipant',null,0,'c9480000-0000-4000-8000-000000000201');
select public.bind_paper_official_identity_v1('a9480000-0000-4000-8000-000000000003','b9480000-0000-4000-8000-000000000001','c9480000-0000-4000-8000-000000000102','a9480000-0000-4000-8000-000000000001','nonparticipant',null,0,'c9480000-0000-4000-8000-000000000202');

insert into hybrid_results values('unscheduled',public.create_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000002','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000003','f9480000-0000-4000-8000-000000000203',1,'f9480000-0000-4000-8000-000000000103','{"winnerSide":"a","margin":10,"evidenceReference":"paper A-2 game 3"}','f9480000-0000-4000-8000-000000000303'));
insert into hybrid_results values('mismatch',public.create_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000002','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000204',1,'f9480000-0000-4000-8000-000000000101','{"winnerSide":"b","margin":31,"evidenceReference":"paper A-2 game 1"}','f9480000-0000-4000-8000-000000000304'));
insert into hybrid_results values('created',public.create_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000002','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000201',1,'f9480000-0000-4000-8000-000000000101','{"winnerSide":"a","margin":31,"evidenceReference":"paper A-2 game 1"}','f9480000-0000-4000-8000-000000000301'));
insert into hybrid_results values('create_replay',public.create_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000002','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000201',1,'f9480000-0000-4000-8000-000000000101','{"winnerSide":"a","margin":31,"evidenceReference":"paper A-2 game 1"}','f9480000-0000-4000-8000-000000000301'));

do $$ begin
 if (select result->>'status' from hybrid_results where label='created')<>'pending_review'
  or (select result from hybrid_results where label='created')<>(select result from hybrid_results where label='create_replay')
  or (select result->>'code' from hybrid_results where label='unscheduled')<>'game_progression_locked'
  or (select result->>'code' from hybrid_results where label='mismatch')<>'digital_paper_mismatch'
  or exists(select 1 from app.card_scorelines where canonical_game_id='f9480000-0000-4000-8000-000000000001')
 then raise exception 'hybrid create proof failed'; end if;
 begin
  insert into app.score_submissions(id,tournament_id,event_id,canonical_game_id,submitter_profile_id,submitter_participant_id,submission_slot,winner_side,margin,source_method,payload_digest)
  values('f9480000-0000-4000-8000-000000000111','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000001','a9480000-0000-4000-8000-000000000004','e9480000-0000-4000-8000-000000000011',2,'a',31,'digital',repeat('d',64));
  raise exception 'ordinary submission unexpectedly coexisted with hybrid case';
 exception when others then if sqlerrm='ordinary submission unexpectedly coexisted with hybrid case' or sqlerrm<>'hybrid completion case already open' then raise; end if; end;
 begin
  insert into app.score_confirmations(tournament_id,event_id,canonical_game_id,submission_id,submission_actor_id,confirmation_actor_id,confirmation_kind)
  values('b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000101','a9480000-0000-4000-8000-000000000004','a9480000-0000-4000-8000-000000000001','cross_checker');
  raise exception 'ordinary confirmation unexpectedly coexisted with hybrid case';
 exception when others then if sqlerrm='ordinary confirmation unexpectedly coexisted with hybrid case' or sqlerrm<>'hybrid completion case already open' then raise; end if; end;
 begin
  insert into app.paper_game_completions(id,tournament_id,event_id,canonical_game_id,round_id,case_sequence,base_game_version,base_game_state,winner_side,margin,cross_checker_profile_id,official_identity_binding_id,operation_receipt_id)
  values('f9480000-0000-4000-8000-000000000211','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000021',1,1,'pending','a',31,'a9480000-0000-4000-8000-000000000002','c9480000-0000-4000-8000-000000000101','c9480000-0000-4000-8000-000000000001');
  raise exception 'paper case unexpectedly coexisted with hybrid case';
 exception when others then if sqlerrm='paper case unexpectedly coexisted with hybrid case' or sqlerrm<>'another manual evidence case already open' then raise; end if; end;
 begin
  insert into app.device_failure_recoveries(id,tournament_id,event_id,canonical_game_id,round_id,case_sequence,base_game_version,base_game_state,proposed_winner_side,proposed_margin,reporter_profile_id,reporter_role,operation_receipt_id)
  values('f9480000-0000-4000-8000-000000000212','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000021',1,1,'pending','a',31,'a9480000-0000-4000-8000-000000000002','cross_checker','c9480000-0000-4000-8000-000000000001');
  raise exception 'device recovery unexpectedly coexisted with hybrid case';
 exception when others then if sqlerrm='device recovery unexpectedly coexisted with hybrid case' or sqlerrm<>'another manual evidence case already open' then raise; end if; end;
end $$;

insert into hybrid_results values('self_review',public.review_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000201',1,'f9480000-0000-4000-8000-000000000101','a',31,'{"winnerSide":"a","margin":31,"evidenceReference":"paper A-2 game 1"}','approve','f9480000-0000-4000-8000-000000000311'));
insert into hybrid_results values('approved',public.review_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000201',1,'f9480000-0000-4000-8000-000000000101','a',31,'{"winnerSide":"a","margin":31,"evidenceReference":"paper A-2 game 1"}','approve','f9480000-0000-4000-8000-000000000312'));
insert into hybrid_results values('approve_replay',public.review_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000201',1,'f9480000-0000-4000-8000-000000000101','a',31,'{"winnerSide":"a","margin":31,"evidenceReference":"paper A-2 game 1"}','approve','f9480000-0000-4000-8000-000000000312'));
delete from app.tournament_roles where tournament_id='b9480000-0000-4000-8000-000000000001' and profile_id='a9480000-0000-4000-8000-000000000002' and role='cross_checker';
insert into hybrid_results values('revoked_first_replay',public.review_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000201',1,'f9480000-0000-4000-8000-000000000101','a',31,'{"winnerSide":"a","margin":31,"evidenceReference":"paper A-2 game 1"}','approve','f9480000-0000-4000-8000-000000000312'));
insert into app.tournament_roles(tournament_id,profile_id,role) values('b9480000-0000-4000-8000-000000000001','a9480000-0000-4000-8000-000000000002','cross_checker');

insert into hybrid_results values('created_two',public.create_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000002','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000202',1,'f9480000-0000-4000-8000-000000000102','{"winnerSide":"b","margin":20,"evidenceReference":"paper A-2 game 2"}','f9480000-0000-4000-8000-000000000302'));
update app.canonical_games set version=2 where id='f9480000-0000-4000-8000-000000000002';
insert into hybrid_results values('stale_rejected',public.review_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000202',1,'f9480000-0000-4000-8000-000000000102','b',20,'{"winnerSide":"b","margin":20,"evidenceReference":"paper A-2 game 2"}','reject','f9480000-0000-4000-8000-000000000313'));
insert into hybrid_results values('reject_replay',public.review_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000202',1,'f9480000-0000-4000-8000-000000000102','b',20,'{"winnerSide":"b","margin":20,"evidenceReference":"paper A-2 game 2"}','reject','f9480000-0000-4000-8000-000000000313'));

update app.tournaments set status='finalized' where id='b9480000-0000-4000-8000-000000000001';
insert into hybrid_results values('closed_create_replay',public.create_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000002','b9480000-0000-4000-8000-000000000001','e9480000-0000-4000-8000-000000000002','f9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000201',1,'f9480000-0000-4000-8000-000000000101','{"winnerSide":"a","margin":31,"evidenceReference":"paper A-2 game 1"}','f9480000-0000-4000-8000-000000000301'));
insert into hybrid_results values('closed_approve_replay',public.review_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000201',1,'f9480000-0000-4000-8000-000000000101','a',31,'{"winnerSide":"a","margin":31,"evidenceReference":"paper A-2 game 1"}','approve','f9480000-0000-4000-8000-000000000312'));
insert into hybrid_results values('closed_reject_replay',public.review_hybrid_digital_paper_case_v1('a9480000-0000-4000-8000-000000000001','f9480000-0000-4000-8000-000000000202',1,'f9480000-0000-4000-8000-000000000102','b',20,'{"winnerSide":"b","margin":20,"evidenceReference":"paper A-2 game 2"}','reject','f9480000-0000-4000-8000-000000000313'));
insert into hybrid_results values('approve_reconciliation',public.get_hybrid_game_operation_reconciliation_v1('a9480000-0000-4000-8000-000000000001','b9480000-0000-4000-8000-000000000001','review_hybrid_digital_paper_case_v1','f9480000-0000-4000-8000-000000000201','f9480000-0000-4000-8000-000000000312'));
insert into hybrid_results values('reject_reconciliation',public.get_hybrid_game_operation_reconciliation_v1('a9480000-0000-4000-8000-000000000001','b9480000-0000-4000-8000-000000000001','review_hybrid_digital_paper_case_v1','f9480000-0000-4000-8000-000000000202','f9480000-0000-4000-8000-000000000313'));

do $$ begin
 if (select result->>'code' from hybrid_results where label='self_review')<>'not_eligible_reviewer'
  or (select result->>'status' from hybrid_results where label='approved')<>'approved'
  or (select result from hybrid_results where label='approved')<>(select result from hybrid_results where label='approve_replay')
  or (select result->>'code' from hybrid_results where label='revoked_first_replay')<>'first_official_identity_changed'
  or (select result->>'status' from hybrid_results where label='stale_rejected')<>'rejected'
  or (select result->>'decision' from hybrid_results where label='stale_rejected')<>'reject'
  or (select result->>'gameVersion' from hybrid_results where label='stale_rejected')<>'1'
  or (select result from hybrid_results where label='stale_rejected')<>(select result from hybrid_results where label='reject_replay')
  or (select result from hybrid_results where label='created')<>(select result from hybrid_results where label='closed_create_replay')
  or (select result from hybrid_results where label='approved')<>(select result from hybrid_results where label='closed_approve_replay')
  or (select result from hybrid_results where label='stale_rejected')<>(select result from hybrid_results where label='closed_reject_replay')
  or (select result->'result' from hybrid_results where label='approve_reconciliation')<>(select result from hybrid_results where label='approved')
  or (select result->'result' from hybrid_results where label='reject_reconciliation')<>(select result from hybrid_results where label='stale_rejected')
  or (select state from app.canonical_games where id='f9480000-0000-4000-8000-000000000001')<>'verified'
  or (select version from app.canonical_games where id='f9480000-0000-4000-8000-000000000001')<>2
  or (select count(*) from app.card_scorelines where canonical_game_id='f9480000-0000-4000-8000-000000000001')<>2
  or not exists(select 1 from app.card_scorelines where canonical_game_id='f9480000-0000-4000-8000-000000000001' and is_winner and game_points=3 and plus_points=31 and minus_points=0)
  or not exists(select 1 from app.card_scorelines where canonical_game_id='f9480000-0000-4000-8000-000000000001' and not is_winner and game_points=0 and plus_points=0 and minus_points=31)
  or app.hybrid_game_latest_state('f9480000-0000-4000-8000-000000000202')<>'rejected'
 then raise exception 'hybrid review/replay/reconciliation authority proof failed'; end if;
 if has_function_privilege('authenticated','public.create_hybrid_digital_paper_case_v1(uuid,uuid,uuid,uuid,uuid,integer,uuid,jsonb,uuid)','execute')
  or not has_function_privilege('service_role','public.create_hybrid_digital_paper_case_v1(uuid,uuid,uuid,uuid,uuid,integer,uuid,jsonb,uuid)','execute')
  or has_function_privilege('authenticated','public.review_hybrid_digital_paper_case_v1(uuid,uuid,integer,uuid,text,integer,jsonb,text,uuid)','execute')
  or not has_function_privilege('service_role','public.get_hybrid_game_operation_reconciliation_v1(uuid,uuid,text,uuid,uuid)','execute')
 then raise exception 'hybrid RPC privilege boundary failed'; end if;
end $$;

set constraints all immediate;
rollback;
