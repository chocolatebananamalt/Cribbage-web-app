-- Rollback-only hosted integration proof for migration 0144.
-- Fictional identities only; every row is rolled back.
begin;

create temporary table paper_completion_results(label text primary key,result jsonb not null) on commit drop;
grant select,insert on paper_completion_results to service_role;

insert into auth.users(id,email) values
 ('a9440000-0000-4000-8000-000000000001','paper-director@test.invalid'),
 ('a9440000-0000-4000-8000-000000000002','paper-checker@test.invalid'),
 ('a9440000-0000-4000-8000-000000000003','paper-linked-player@test.invalid'),
 ('a9440000-0000-4000-8000-000000000004','paper-codirector@test.invalid'),
 ('a9440000-0000-4000-8000-000000000005','paper-event-player@test.invalid');
update app.profiles set display_name=case id
 when 'a9440000-0000-4000-8000-000000000001' then 'Paper Director'
 when 'a9440000-0000-4000-8000-000000000002' then 'Paper Checker'
 when 'a9440000-0000-4000-8000-000000000004' then 'Paper Co-Director'
 when 'a9440000-0000-4000-8000-000000000005' then 'Paper Event Player'
 else 'Paper Linked Player' end
where id in ('a9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000002','a9440000-0000-4000-8000-000000000003','a9440000-0000-4000-8000-000000000004','a9440000-0000-4000-8000-000000000005');

insert into app.tournaments(id,director_profile_id,name,status,registration_status)
values('b9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000001','Synthetic Paper Completion','open','open');
insert into app.tournament_roles(tournament_id,profile_id,role) values
 ('b9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000001','director'),
 ('b9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000002','cross_checker'),
 ('b9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000003','cross_checker'),
 ('b9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000004','co_director'),
 ('b9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000005','cross_checker');
insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
values
 ('c9440000-0000-4000-8000-000000000001','b9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000001','paper_fixture','b9440000-0000-4000-8000-000000000001',repeat('1',64),'c9440000-0000-4000-8000-000000000002','accepted','{}',now()),
 ('c9440000-0000-4000-8000-000000000003','b9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000001','paper_fixture','b9440000-0000-4000-8000-000000000001',repeat('3',64),'c9440000-0000-4000-8000-000000000004','accepted','{}',now());

insert into app.tournament_roster_entries(id,tournament_id,claimed_display_name,claimed_normalized_name,creator_profile_id,operation_receipt_id,source_kind) values
 ('d9440000-0000-4000-8000-000000000001','b9440000-0000-4000-8000-000000000001','Paper Player A','paper player a','a9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000001','director_manual'),
 ('d9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','Paper Player B','paper player b','a9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000001','director_manual'),
 ('d9440000-0000-4000-8000-000000000003','b9440000-0000-4000-8000-000000000001','Paper Player C','paper player c','a9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000001','director_manual');
insert into app.roster_account_links(id,tournament_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id)
values('d9440000-0000-4000-8000-000000000011','b9440000-0000-4000-8000-000000000001','d9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000003','a9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000001');
update app.tournaments set registration_status='closed' where id='b9440000-0000-4000-8000-000000000001';
insert into app.initial_seating_publications(id,tournament_id,table_count,seats_per_table,actor_profile_id,operation_receipt_id)
values('d9440000-0000-4000-8000-000000000020','b9440000-0000-4000-8000-000000000001',1,4,'a9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000001');
insert into app.initial_seating_assignments(id,publication_id,tournament_id,roster_entry_id,initial_table_seat) values
 ('d9440000-0000-4000-8000-000000000021','d9440000-0000-4000-8000-000000000020','b9440000-0000-4000-8000-000000000001','d9440000-0000-4000-8000-000000000001','A-1'),
 ('d9440000-0000-4000-8000-000000000022','d9440000-0000-4000-8000-000000000020','b9440000-0000-4000-8000-000000000001','d9440000-0000-4000-8000-000000000002','A-2'),
 ('d9440000-0000-4000-8000-000000000023','d9440000-0000-4000-8000-000000000020','b9440000-0000-4000-8000-000000000001','d9440000-0000-4000-8000-000000000003','A-3');

insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at)
values('e9440000-0000-4000-8000-000000000001','b9440000-0000-4000-8000-000000000001','Synthetic Standard Singles','standard_singles','synthetic paper fixture',current_date,now());
insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method)
values('e9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000001','Main','main','standard_singles','digital');
insert into app.event_participants(id,tournament_id,event_id,profile_id,roster_entry_id,table_seat,status) values
 ('e9440000-0000-4000-8000-000000000011','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','a9440000-0000-4000-8000-000000000003','d9440000-0000-4000-8000-000000000001','A-1','checked_in'),
 ('e9440000-0000-4000-8000-000000000012','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','a9440000-0000-4000-8000-000000000005','d9440000-0000-4000-8000-000000000002','A-2','checked_in'),
 ('e9440000-0000-4000-8000-000000000013','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002',null,'d9440000-0000-4000-8000-000000000003','A-3','checked_in');
insert into app.rounds(id,tournament_id,event_id,round_number) values
 ('e9440000-0000-4000-8000-000000000021','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002',1),
 ('e9440000-0000-4000-8000-000000000022','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002',2),
 ('e9440000-0000-4000-8000-000000000023','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002',3);
insert into app.canonical_games(id,tournament_id,event_id,round_id,side_a_participant_id,side_b_participant_id,side_a_table_seat_snapshot,side_b_table_seat_snapshot,state,version) values
 ('f9440000-0000-4000-8000-000000000001','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','e9440000-0000-4000-8000-000000000021','e9440000-0000-4000-8000-000000000011','e9440000-0000-4000-8000-000000000012','A-1','A-2','pending',1),
 ('f9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','e9440000-0000-4000-8000-000000000022','e9440000-0000-4000-8000-000000000011','e9440000-0000-4000-8000-000000000013','A-1','A-3','pending',1),
 ('f9440000-0000-4000-8000-000000000003','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','e9440000-0000-4000-8000-000000000023','e9440000-0000-4000-8000-000000000012','e9440000-0000-4000-8000-000000000013','A-2','A-3','pending',1);
insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id)
values('f9440000-0000-4000-8000-000000000010','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','director_entry',2,3,2,repeat('2',64),'a9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000001');
insert into app.event_schedule_games(publication_id,tournament_id,event_id,canonical_game_id,import_row_number) values
 ('f9440000-0000-4000-8000-000000000010','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000001',1),
 ('f9440000-0000-4000-8000-000000000010','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000002',2);

select set_config('request.jwt.claim.role','service_role',true);
-- Hosted SQL-editor proof runs as the project owner. Production RPC access is
-- still service-role only (asserted below); set local role service_role would
-- intentionally prevent this fixture's direct trigger-race probes.
select public.bind_paper_official_identity_v1('a9440000-0000-4000-8000-000000000001','b9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000101','a9440000-0000-4000-8000-000000000002','nonparticipant',null,0,'c9440000-0000-4000-8000-000000000201');
select public.bind_paper_official_identity_v1('a9440000-0000-4000-8000-000000000001','b9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000102','a9440000-0000-4000-8000-000000000003','roster_entry','d9440000-0000-4000-8000-000000000001',0,'c9440000-0000-4000-8000-000000000202');
select public.bind_paper_official_identity_v1('a9440000-0000-4000-8000-000000000001','b9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000103','a9440000-0000-4000-8000-000000000004','nonparticipant',null,0,'c9440000-0000-4000-8000-000000000203');
select public.bind_paper_official_identity_v1('a9440000-0000-4000-8000-000000000004','b9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000104','a9440000-0000-4000-8000-000000000001','nonparticipant',null,0,'c9440000-0000-4000-8000-000000000204');
insert into paper_completion_results values('linked_nonparticipant_denied',public.bind_paper_official_identity_v1('a9440000-0000-4000-8000-000000000001','b9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000107','a9440000-0000-4000-8000-000000000003','nonparticipant',null,1,'c9440000-0000-4000-8000-000000000207'));
insert into paper_completion_results values('event_participant_nonparticipant_denied',public.bind_paper_official_identity_v1('a9440000-0000-4000-8000-000000000001','b9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000108','a9440000-0000-4000-8000-000000000005','nonparticipant',null,0,'c9440000-0000-4000-8000-000000000208'));
do $$ begin
 begin
  insert into app.roster_account_links(id,tournament_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id)
  values('d9440000-0000-4000-8000-000000000012','b9440000-0000-4000-8000-000000000001','d9440000-0000-4000-8000-000000000002','a9440000-0000-4000-8000-000000000002','a9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000001');
  raise exception 'nonparticipant roster-link race unexpectedly succeeded';
 exception when others then
  if sqlerrm='nonparticipant roster-link race unexpectedly succeeded' then raise; end if;
  if sqlerrm<>'profile has a current nonparticipant official binding' then raise; end if;
 end;
 begin
  update app.event_participants set profile_id='a9440000-0000-4000-8000-000000000002' where id='e9440000-0000-4000-8000-000000000013';
  raise exception 'nonparticipant event-link race unexpectedly succeeded';
 exception when others then
  if sqlerrm='nonparticipant event-link race unexpectedly succeeded' then raise; end if;
  if sqlerrm<>'profile has a current nonparticipant official binding' then raise; end if;
 end;
end $$;
insert into paper_completion_results values('orphan_game',public.complete_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000003','f9440000-0000-4000-8000-000000000100',1,'{"winnerSide":"a","margin":10,"evidenceReference":"orphan A-2"}','{"winnerSide":"a","margin":10,"evidenceReference":"orphan A-3"}','f9440000-0000-4000-8000-000000000200'));
insert into paper_completion_results values('recorded',public.complete_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000101',1,'{"winnerSide":"a","margin":31,"evidenceReference":"original card A-1"}','{"winnerSide":"a","margin":31,"evidenceReference":"original card A-2"}','f9440000-0000-4000-8000-000000000201'));
insert into paper_completion_results values('replay',public.complete_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000101',1,'{"winnerSide":"a","margin":31,"evidenceReference":"original card A-1"}','{"winnerSide":"a","margin":31,"evidenceReference":"original card A-2"}','f9440000-0000-4000-8000-000000000201'));
delete from app.tournament_roles where tournament_id='b9440000-0000-4000-8000-000000000001' and profile_id='a9440000-0000-4000-8000-000000000002' and role='cross_checker';
insert into paper_completion_results values('revoked_replay',public.complete_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000101',1,'{"winnerSide":"a","margin":31,"evidenceReference":"original card A-1"}','{"winnerSide":"a","margin":31,"evidenceReference":"original card A-2"}','f9440000-0000-4000-8000-000000000201'));
insert into app.tournament_roles(tournament_id,profile_id,role) values('b9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000002','cross_checker');
insert into paper_completion_results values('changed_reuse',public.complete_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000101',1,'{"winnerSide":"b","margin":31,"evidenceReference":"original card A-1"}','{"winnerSide":"b","margin":31,"evidenceReference":"original card A-2"}','f9440000-0000-4000-8000-000000000201'));
insert into paper_completion_results values('nonreciprocal',public.complete_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000102',1,'{"winnerSide":"a","margin":20,"evidenceReference":"original card A-1 game 2"}','{"winnerSide":"b","margin":20,"evidenceReference":"original card A-3"}','f9440000-0000-4000-8000-000000000202'));
insert into paper_completion_results values('self_denied',public.complete_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000003','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000103',1,'{"winnerSide":"a","margin":20,"evidenceReference":"own card A-1 game 2"}','{"winnerSide":"a","margin":20,"evidenceReference":"original card A-3 game 2"}','f9440000-0000-4000-8000-000000000203'));
do $$ begin
 if (select result->>'status' from paper_completion_results where label='recorded')<>'pending_review'
  or (select state from app.canonical_games where id='f9440000-0000-4000-8000-000000000001')<>'pending'
  or exists(select 1 from app.card_scorelines where canonical_game_id='f9440000-0000-4000-8000-000000000001')
 then raise exception 'first official incorrectly created authority'; end if;
end $$;
insert into paper_completion_results values('same_official_review',public.review_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000101',1,'{"winnerSide":"a","margin":31,"evidenceReference":"original card A-1"}','{"winnerSide":"a","margin":31,"evidenceReference":"original card A-2"}','approve','f9440000-0000-4000-8000-000000000210'));
insert into paper_completion_results values('approved',public.review_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000101',1,'{"winnerSide":"a","margin":31,"evidenceReference":"original card A-1"}','{"winnerSide":"a","margin":31,"evidenceReference":"original card A-2"}','approve','f9440000-0000-4000-8000-000000000211'));
insert into paper_completion_results values('review_replay',public.review_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000101',1,'{"winnerSide":"a","margin":31,"evidenceReference":"original card A-1"}','{"winnerSide":"a","margin":31,"evidenceReference":"original card A-2"}','approve','f9440000-0000-4000-8000-000000000211'));
delete from app.tournament_roles where tournament_id='b9440000-0000-4000-8000-000000000001' and profile_id='a9440000-0000-4000-8000-000000000001' and role='director';
insert into paper_completion_results values('revoked_review_replay',public.review_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000101',1,'{"winnerSide":"a","margin":31,"evidenceReference":"original card A-1"}','{"winnerSide":"a","margin":31,"evidenceReference":"original card A-2"}','approve','f9440000-0000-4000-8000-000000000211'));
insert into app.tournament_roles(tournament_id,profile_id,role) values('b9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000001','director');
update app.tournaments set status='finalized' where id='b9440000-0000-4000-8000-000000000001';
insert into paper_completion_results values('closed_completion_replay',public.complete_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000101',1,'{"winnerSide":"a","margin":31,"evidenceReference":"original card A-1"}','{"winnerSide":"a","margin":31,"evidenceReference":"original card A-2"}','f9440000-0000-4000-8000-000000000201'));
insert into paper_completion_results values('closed_review_replay',public.review_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000101',1,'{"winnerSide":"a","margin":31,"evidenceReference":"original card A-1"}','{"winnerSide":"a","margin":31,"evidenceReference":"original card A-2"}','approve','f9440000-0000-4000-8000-000000000211'));
insert into paper_completion_results values('completion_reconciliation',public.get_paper_game_operation_reconciliation_v1('a9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','complete_paper_vs_paper_game_v1','f9440000-0000-4000-8000-000000000101','f9440000-0000-4000-8000-000000000201'));
insert into paper_completion_results values('review_reconciliation',public.get_paper_game_operation_reconciliation_v1('a9440000-0000-4000-8000-000000000001','b9440000-0000-4000-8000-000000000001','review_paper_vs_paper_game_v1','f9440000-0000-4000-8000-000000000101','f9440000-0000-4000-8000-000000000211'));
update app.tournaments set status='open' where id='b9440000-0000-4000-8000-000000000001';
insert into app.device_failure_recoveries(id,tournament_id,event_id,canonical_game_id,round_id,case_sequence,base_game_version,base_game_state,proposed_winner_side,proposed_margin,reporter_profile_id,reporter_role,operation_receipt_id)
values('f9440000-0000-4000-8000-000000000401','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000002','e9440000-0000-4000-8000-000000000022',1,1,'pending','b',20,'a9440000-0000-4000-8000-000000000002','cross_checker','c9440000-0000-4000-8000-000000000001');
insert into app.device_failure_recovery_state_events(recovery_id,tournament_id,event_id,canonical_game_id,state,transition_sequence,actor_profile_id,actor_role,operation_receipt_id)
values('f9440000-0000-4000-8000-000000000401','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000002','pending_review',1,'a9440000-0000-4000-8000-000000000002','cross_checker','c9440000-0000-4000-8000-000000000001');
insert into paper_completion_results values('recovery_blocks_paper',public.complete_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000099',1,'{"winnerSide":"b","margin":20,"evidenceReference":"recovery conflict A-1"}','{"winnerSide":"b","margin":20,"evidenceReference":"recovery conflict A-3"}','f9440000-0000-4000-8000-000000000199'));
insert into app.device_failure_recovery_state_events(recovery_id,tournament_id,event_id,canonical_game_id,state,transition_sequence,actor_profile_id,actor_role,operation_receipt_id)
values('f9440000-0000-4000-8000-000000000401','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000002','rejected',2,'a9440000-0000-4000-8000-000000000001','director','c9440000-0000-4000-8000-000000000003');
insert into paper_completion_results values('paper_case_one',public.complete_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000104',1,'{"winnerSide":"b","margin":20,"evidenceReference":"case one A-1"}','{"winnerSide":"b","margin":20,"evidenceReference":"case one A-3"}','f9440000-0000-4000-8000-000000000204'));
insert into paper_completion_results values('paper_case_rejected',public.review_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000104',1,'{"winnerSide":"b","margin":20,"evidenceReference":"case one A-1"}','{"winnerSide":"b","margin":20,"evidenceReference":"case one A-3"}','reject','f9440000-0000-4000-8000-000000000212'));
insert into paper_completion_results values('paper_case_two',public.complete_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000002','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000105',1,'{"winnerSide":"b","margin":21,"evidenceReference":"case two A-1"}','{"winnerSide":"b","margin":21,"evidenceReference":"case two A-3"}','f9440000-0000-4000-8000-000000000205'));
do $$ begin
 begin
  insert into app.device_failure_recoveries(id,tournament_id,event_id,canonical_game_id,round_id,case_sequence,base_game_version,base_game_state,proposed_winner_side,proposed_margin,reporter_profile_id,reporter_role,operation_receipt_id)
  values('f9440000-0000-4000-8000-000000000402','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000002','e9440000-0000-4000-8000-000000000022',2,1,'pending','b',21,'a9440000-0000-4000-8000-000000000002','cross_checker','c9440000-0000-4000-8000-000000000001');
  raise exception 'recovery unexpectedly coexisted with paper case';
 exception when others then
  if sqlerrm='recovery unexpectedly coexisted with paper case' then raise; end if;
  if sqlerrm<>'paper completion case already open' then raise; end if;
 end;
end $$;
insert into paper_completion_results values('binding_correction',public.bind_paper_official_identity_v1('a9440000-0000-4000-8000-000000000004','b9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000105','a9440000-0000-4000-8000-000000000002','roster_entry','d9440000-0000-4000-8000-000000000003',1,'c9440000-0000-4000-8000-000000000205'));
insert into paper_completion_results values('binding_correction_replay',public.bind_paper_official_identity_v1('a9440000-0000-4000-8000-000000000004','b9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000105','a9440000-0000-4000-8000-000000000002','roster_entry','d9440000-0000-4000-8000-000000000003',1,'c9440000-0000-4000-8000-000000000205'));
insert into paper_completion_results values('correction_before_review',public.review_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000105',1,'{"winnerSide":"b","margin":21,"evidenceReference":"case two A-1"}','{"winnerSide":"b","margin":21,"evidenceReference":"case two A-3"}','approve','f9440000-0000-4000-8000-000000000213'));
update app.tournaments set status='finalized' where id='b9440000-0000-4000-8000-000000000001';
insert into paper_completion_results values('closed_identity_replay',public.bind_paper_official_identity_v1('a9440000-0000-4000-8000-000000000004','b9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000105','a9440000-0000-4000-8000-000000000002','roster_entry','d9440000-0000-4000-8000-000000000003',1,'c9440000-0000-4000-8000-000000000205'));
insert into paper_completion_results values('identity_reconciliation',public.get_paper_game_operation_reconciliation_v1('a9440000-0000-4000-8000-000000000004','b9440000-0000-4000-8000-000000000001','bind_paper_official_identity_v1','c9440000-0000-4000-8000-000000000105','c9440000-0000-4000-8000-000000000205'));
update app.tournaments set status='open' where id='b9440000-0000-4000-8000-000000000001';
insert into paper_completion_results values('corrected_identity_case_rejected',public.review_paper_vs_paper_game_v1('a9440000-0000-4000-8000-000000000001','f9440000-0000-4000-8000-000000000105',1,'{"winnerSide":"b","margin":21,"evidenceReference":"case two A-1"}','{"winnerSide":"b","margin":21,"evidenceReference":"case two A-3"}','reject','f9440000-0000-4000-8000-000000000214'));
insert into paper_completion_results values('binding_stale',public.bind_paper_official_identity_v1('a9440000-0000-4000-8000-000000000004','b9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000106','a9440000-0000-4000-8000-000000000002','nonparticipant',null,1,'c9440000-0000-4000-8000-000000000206'));
insert into paper_completion_results values('binding_stale_replay',public.bind_paper_official_identity_v1('a9440000-0000-4000-8000-000000000004','b9440000-0000-4000-8000-000000000001','c9440000-0000-4000-8000-000000000106','a9440000-0000-4000-8000-000000000002','nonparticipant',null,1,'c9440000-0000-4000-8000-000000000206'));

do $$ begin
 if (select result->>'status' from paper_completion_results where label='recorded')<>'pending_review'
  or (select result from paper_completion_results where label='recorded')<>(select result from paper_completion_results where label='replay')
  or (select result->>'code' from paper_completion_results where label='changed_reuse')<>'idempotency_conflict'
  or (select result->>'code' from paper_completion_results where label='revoked_replay')<>'not_cross_checker'
  or (select result->>'code' from paper_completion_results where label='nonreciprocal')<>'nonreciprocal_card_claims'
  or (select result->>'code' from paper_completion_results where label='self_denied')<>'official_identity_unconfirmed'
  or (select result->>'code' from paper_completion_results where label='orphan_game')<>'game_not_scheduled'
  or (select result->>'code' from paper_completion_results where label='same_official_review')<>'reviewer_not_independent'
  or (select result->>'status' from paper_completion_results where label='approved')<>'approved'
  or (select result from paper_completion_results where label='approved')<>(select result from paper_completion_results where label='review_replay')
  or (select result->>'code' from paper_completion_results where label='revoked_review_replay')<>'not_eligible_reviewer'
  or (select result->>'status' from paper_completion_results where label='paper_case_rejected')<>'rejected'
  or (select result->>'status' from paper_completion_results where label='paper_case_two')<>'pending_review'
  or (select result->>'code' from paper_completion_results where label='recovery_blocks_paper')<>'device_recovery_case_exists'
  or (select count(*) from app.paper_game_completions where canonical_game_id='f9440000-0000-4000-8000-000000000002')<>2
  or (select max(case_sequence) from app.paper_game_completions where canonical_game_id='f9440000-0000-4000-8000-000000000002')<>2
  or (select result->>'bindingVersion' from paper_completion_results where label='binding_correction')<>'2'
  or (select result from paper_completion_results where label='binding_correction')<>(select result from paper_completion_results where label='binding_correction_replay')
  or (select result from paper_completion_results where label='binding_correction')<>(select result from paper_completion_results where label='closed_identity_replay')
  or (select result->>'code' from paper_completion_results where label='binding_stale')<>'stale_binding_version'
  or (select result->>'code' from paper_completion_results where label='linked_nonparticipant_denied')<>'profile_is_tournament_participant'
  or (select result->>'code' from paper_completion_results where label='event_participant_nonparticipant_denied')<>'profile_is_tournament_participant'
  or (select result->>'code' from paper_completion_results where label='correction_before_review')<>'first_official_identity_changed'
  or (select result->>'status' from paper_completion_results where label='corrected_identity_case_rejected')<>'rejected'
  or (select result from paper_completion_results where label='recorded')<>(select result from paper_completion_results where label='closed_completion_replay')
  or (select result from paper_completion_results where label='approved')<>(select result from paper_completion_results where label='closed_review_replay')
  or (select result->'result' from paper_completion_results where label='completion_reconciliation')<>(select result from paper_completion_results where label='recorded')
  or (select result->'result' from paper_completion_results where label='review_reconciliation')<>(select result from paper_completion_results where label='approved')
  or (select result->'result' from paper_completion_results where label='identity_reconciliation')<>(select result from paper_completion_results where label='binding_correction')
  or (select result from paper_completion_results where label='binding_stale')<>(select result from paper_completion_results where label='binding_stale_replay')
  or (select count(*) from app.paper_official_identity_bindings where tournament_id='b9440000-0000-4000-8000-000000000001' and official_profile_id='a9440000-0000-4000-8000-000000000002')<>2
  or not exists(select 1 from app.paper_official_identity_bindings where id='c9440000-0000-4000-8000-000000000105' and binding_version=2 and supersedes_binding_id='c9440000-0000-4000-8000-000000000101')
  or not exists(select 1 from app.audit_events where entity_id='c9440000-0000-4000-8000-000000000106' and action='paper_official_identity_binding_rejected')
  or not exists(select 1 from app.audit_events where entity_id='c9440000-0000-4000-8000-000000000107' and action='paper_official_identity_binding_rejected' and after_state->>'code'='profile_is_tournament_participant')
  or not exists(select 1 from app.audit_events where entity_id='c9440000-0000-4000-8000-000000000108' and action='paper_official_identity_binding_rejected' and after_state->>'code'='profile_is_tournament_participant')
  or not exists(select 1 from app.operation_receipts where actor_profile_id='a9440000-0000-4000-8000-000000000001' and client_operation_id='f9440000-0000-4000-8000-000000000213' and outcome='rejected' and response_payload->>'code'='first_official_identity_changed')
  or not exists(select 1 from app.audit_events where entity_id='f9440000-0000-4000-8000-000000000105' and action='paper_vs_paper_game_review_rejected' and after_state->>'code'='first_official_identity_changed')
  or (select state from app.canonical_games where id='f9440000-0000-4000-8000-000000000001')<>'verified'
  or (select version from app.canonical_games where id='f9440000-0000-4000-8000-000000000001')<>2
  or (select count(*) from app.card_scorelines where canonical_game_id='f9440000-0000-4000-8000-000000000001')<>2
  or (select count(*) from app.paper_game_completion_evidence where completion_id='f9440000-0000-4000-8000-000000000101')<>2
  or (select count(*) from app.score_submissions where canonical_game_id='f9440000-0000-4000-8000-000000000001')<>0
  or (select count(*) from app.score_confirmations where canonical_game_id='f9440000-0000-4000-8000-000000000001')<>0
  or not exists(select 1 from app.audit_events where entity_id='f9440000-0000-4000-8000-000000000101' and action='paper_vs_paper_game_completed')
  or (select count(*) from app.paper_game_completion_reviews where completion_id='f9440000-0000-4000-8000-000000000101' and reviewer_profile_id='a9440000-0000-4000-8000-000000000001')<>1
 then raise exception 'paper completion authority proof failed'; end if;
 begin
  insert into app.score_submissions(id,tournament_id,event_id,canonical_game_id,submitter_profile_id,submitter_participant_id,submission_slot,winner_side,margin,source_method,payload_digest)
  values('f9440000-0000-4000-8000-000000000301','b9440000-0000-4000-8000-000000000001','e9440000-0000-4000-8000-000000000002','f9440000-0000-4000-8000-000000000001','a9440000-0000-4000-8000-000000000003','e9440000-0000-4000-8000-000000000011',1,'a',31,'digital',repeat('3',64));
  raise exception 'duplicate submission unexpectedly succeeded';
 exception when others then
  if sqlerrm='duplicate submission unexpectedly succeeded' then raise; end if;
  if sqlerrm<>'authoritative paper completion blocks duplicate game history' then raise; end if;
 end;
 if has_function_privilege('authenticated','public.complete_paper_vs_paper_game_v1(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid)','execute')
  or not has_function_privilege('service_role','public.complete_paper_vs_paper_game_v1(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid)','execute')
  or has_function_privilege('authenticated','public.review_paper_vs_paper_game_v1(uuid,uuid,integer,jsonb,jsonb,text,uuid)','execute')
  or not has_function_privilege('service_role','public.review_paper_vs_paper_game_v1(uuid,uuid,integer,jsonb,jsonb,text,uuid)','execute')
  or has_function_privilege('authenticated','public.get_paper_game_operation_reconciliation_v1(uuid,uuid,text,uuid,uuid)','execute')
  or not has_function_privilege('service_role','public.get_paper_game_operation_reconciliation_v1(uuid,uuid,text,uuid,uuid)','execute')
 then raise exception 'paper completion grants failed'; end if;
end $$;

set constraints all immediate;
rollback;
