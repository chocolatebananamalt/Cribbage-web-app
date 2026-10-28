-- Synthetic foundation only: no real people, payments or play.
insert into auth.users(id,email) values
 ('a1310000-0000-4000-8000-000000000001','qualification-director@test.invalid'),
 ('a1310000-0000-4000-8000-000000000002','qualification-player-a@test.invalid'),
 ('a1310000-0000-4000-8000-000000000003','qualification-player-b@test.invalid'),
 ('a1310000-0000-4000-8000-000000000004','qualification-player-c@test.invalid'),
 ('a1310000-0000-4000-8000-000000000005','qualification-player-d@test.invalid'),
 ('a1310000-0000-4000-8000-000000000006','qualification-linked-player@test.invalid'),
 ('a1310000-0000-4000-8000-000000000007','qualification-outsider@test.invalid');
update app.profiles set display_name=case id
 when 'a1310000-0000-4000-8000-000000000001' then 'Test Director'
 when 'a1310000-0000-4000-8000-000000000002' then 'Alpha Player'
 when 'a1310000-0000-4000-8000-000000000003' then 'Bravo Player'
 when 'a1310000-0000-4000-8000-000000000004' then 'Charlie Player'
 when 'a1310000-0000-4000-8000-000000000005' then 'Delta Player' else display_name end
where id::text like 'a131%';

insert into app.tournaments(id,director_profile_id,name,status,registration_status) values
 ('b1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000001','Synthetic Qualification','open','open');
insert into app.tournament_roles(tournament_id,profile_id,role) values
 ('b1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000001','director'),
 ('b1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000002','player'),
 ('b1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000003','player'),
 ('b1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000004','player'),
 ('b1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000005','player');
insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values
 ('c1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000001','qualification_fixture','b1310000-0000-4000-8000-000000000001',repeat('1',64),'d1310000-0000-4000-8000-000000000001','accepted','{}',now());
insert into app.tournament_setup_revisions(id,tournament_id,version,tournament_name,city,venue,starts_at,ends_at,timezone_name,actor_profile_id,operation_receipt_id) values
 ('e1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',1,'Synthetic Qualification','Test City','Test Venue','2026-10-03 09:00','2026-10-03 18:00','Pacific/Honolulu','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
insert into app.tournament_setup_official_versions(id,tournament_id,setup_revision_id,profile_id,role) values('e1310000-0000-4000-8000-000000000005','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000001','director');
insert into app.tournament_setup_event_versions(id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,style_code,format_code,game_count,entry_fee_cents,muggins_status) values
 ('e1310000-0000-4000-8000-000000000002','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000003',1,'main','Main','2026-10-03 09:00','Pacific/Honolulu','Standard','standard_singles',12,3000,'unset');

insert into app.tournament_setup_q_pool_versions(id,tournament_id,setup_revision_id,setup_event_version_id,slot,pool_type_code,entry_fee_cents) values
 ('c2430000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000002',1,'Equal',500),
 ('c2430000-0000-4000-8000-000000000002','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000002',2,'Graduated',1000);
insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at) values
 ('f1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','ACC 2025 fixture','standard_singles','ACC Official Tournament Rules 2025','2025-01-01',now());
insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method) values
 ('11310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','f1310000-0000-4000-8000-000000000001','Main','main','standard_singles','digital');
insert into app.tournament_setup_activations(id,tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,operation_receipt_id) values
 ('21310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000002','f1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');

insert into app.tournament_roles(tournament_id,profile_id,role) values('b1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000006','co_director');
insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)
 select ('d2430000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b1310000-0000-4000-8000-000000000001','director_manual','TEST ONLY Q entrant '||n,'test only q entrant '||n,'paper','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001' from generate_series(1,2)n;
insert into app.event_participants(id,tournament_id,event_id,profile_id,roster_entry_id,table_seat,status)
 select ('f2430000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001',null,('d2430000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'A-'||n,'checked_in' from generate_series(1,2)n;
