-- Rollback-only hosted proof for immutable Standard Singles qualification finalization.
begin;

insert into auth.users(id,email) values
 ('a1310000-0000-4000-8000-000000000001','qualification-director@test.invalid'),
 ('a1310000-0000-4000-8000-000000000002','qualification-player-a@test.invalid'),
 ('a1310000-0000-4000-8000-000000000003','qualification-player-b@test.invalid'),
 ('a1310000-0000-4000-8000-000000000004','qualification-player-c@test.invalid'),
 ('a1310000-0000-4000-8000-000000000005','qualification-player-d@test.invalid'),
 ('a1310000-0000-4000-8000-000000000006','qualification-outsider@test.invalid');
update app.profiles set display_name=case id
 when 'a1310000-0000-4000-8000-000000000001' then 'Test Director'
 when 'a1310000-0000-4000-8000-000000000002' then 'Alpha Player'
 when 'a1310000-0000-4000-8000-000000000003' then 'Bravo Player'
 when 'a1310000-0000-4000-8000-000000000004' then 'Charlie Player'
 when 'a1310000-0000-4000-8000-000000000005' then 'Delta Player' else display_name end
where id::text like 'a131%';

insert into app.tournaments(id,director_profile_id,name,status,registration_status) values
 ('b1310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000001','Synthetic Qualification','open','closed');
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
insert into app.tournament_setup_event_versions(id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,style_code,format_code,game_count,entry_fee_cents,muggins_status) values
 ('e1310000-0000-4000-8000-000000000002','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000003',1,'main','Main','2026-10-03 09:00','Pacific/Honolulu','director_configured_standard_singles','standard_singles',1,0,'unset');
insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at) values
 ('f1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','ACC 2025 fixture','standard_singles','ACC Official Tournament Rules 2025','2025-01-01',now());
insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method) values
 ('11310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','f1310000-0000-4000-8000-000000000001','Main','main','standard_singles','digital');
insert into app.tournament_setup_activations(id,tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,operation_receipt_id) values
 ('21310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000002','f1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
insert into app.event_participants(id,tournament_id,event_id,profile_id,table_seat,status) values
 ('41310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000002','A-1','checked_in'),
 ('41310000-0000-4000-8000-000000000002','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000003','A-2','checked_in'),
 ('41310000-0000-4000-8000-000000000003','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000004','A-3','checked_in'),
 ('41310000-0000-4000-8000-000000000004','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000005','A-4','checked_in');
insert into app.rounds(id,tournament_id,event_id,round_number) values
 ('51310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001',1);
insert into app.canonical_games(id,tournament_id,event_id,round_id,match_instance,side_a_participant_id,side_b_participant_id,side_a_table_seat_snapshot,side_b_table_seat_snapshot,state,version,winner_side,margin) values
 ('61310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','51310000-0000-4000-8000-000000000001',1,'41310000-0000-4000-8000-000000000001','41310000-0000-4000-8000-000000000002','A-1','A-2','verified',1,'a',40),
 ('61310000-0000-4000-8000-000000000002','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','51310000-0000-4000-8000-000000000001',1,'41310000-0000-4000-8000-000000000003','41310000-0000-4000-8000-000000000004','A-3','A-4','verified',1,'a',20);
insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id) values
 ('71310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','director_entry',1,4,2,repeat('7',64),'a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
insert into app.event_schedule_games(publication_id,tournament_id,event_id,canonical_game_id,import_row_number) values
 ('71310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','61310000-0000-4000-8000-000000000001',1),
 ('71310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','61310000-0000-4000-8000-000000000002',2);
insert into app.card_scorelines(id,tournament_id,event_id,canonical_game_id,participant_id,opponent_participant_id,side,table_seat_snapshot,is_winner,margin,plus_points,minus_points,game_points) values
 ('81310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','61310000-0000-4000-8000-000000000001','41310000-0000-4000-8000-000000000001','41310000-0000-4000-8000-000000000002','a','A-1',true,40,40,0,3),
 ('81310000-0000-4000-8000-000000000002','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','61310000-0000-4000-8000-000000000001','41310000-0000-4000-8000-000000000002','41310000-0000-4000-8000-000000000001','b','A-2',false,40,0,40,0),
 ('81310000-0000-4000-8000-000000000003','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','61310000-0000-4000-8000-000000000002','41310000-0000-4000-8000-000000000003','41310000-0000-4000-8000-000000000004','a','A-3',true,20,20,0,2),
 ('81310000-0000-4000-8000-000000000004','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','61310000-0000-4000-8000-000000000002','41310000-0000-4000-8000-000000000004','41310000-0000-4000-8000-000000000003','b','A-4',false,20,0,20,0);

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
do $$ declare first_result jsonb; replay jsonb; result_view jsonb; begin
  first_result:=public.finalize_standard_singles_qualification_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','91310000-0000-4000-8000-000000000001');
  replay:=public.finalize_standard_singles_qualification_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','91310000-0000-4000-8000-000000000001');
  result_view:=public.get_standard_singles_qualification_result_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001');
  if first_result<>replay or first_result->>'status'<>'qualification_finalized'
    or jsonb_array_length(result_view->'qualifiers')<>1
    or result_view->'qualifiers'->0->>'displayName'<>'Alpha Player'
    or result_view->'highNonQualifier'->>'displayName'<>'Charlie Player'
    or (result_view->>'playoffResultsAvailable')::boolean then raise exception 'qualification finalization output failed'; end if;
  if public.get_standard_singles_qualification_result_v1('a1310000-0000-4000-8000-000000000006','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001') is not null then raise exception 'outsider received result'; end if;
end $$;
reset role;
do $$ begin
  begin insert into app.score_submissions(tournament_id,event_id,canonical_game_id,submitter_profile_id,submitter_participant_id,submission_slot,winner_side,margin,source_method,payload_digest) values('b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','61310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000002','41310000-0000-4000-8000-000000000001',1,'a',40,'digital',repeat('8',64)); raise exception 'finalized score mutation was accepted'; exception when others then if sqlerrm<>'finalized qualification snapshot blocks event mutation' then raise; end if; end;
end $$;
do $$ begin
 if has_function_privilege('authenticated','public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid)','EXECUTE')
   or not has_function_privilege('service_role','public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid)','EXECUTE') then raise exception 'qualification grants invalid'; end if;
 if (select count(*) from app.qualification_result_versions where event_id='11310000-0000-4000-8000-000000000001')<>1
   or (select count(*) from app.qualification_result_rows where event_id='11310000-0000-4000-8000-000000000001')<>4 then raise exception 'qualification snapshot not immutable/exact'; end if;
end $$;

rollback;
