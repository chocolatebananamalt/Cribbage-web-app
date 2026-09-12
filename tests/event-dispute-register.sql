-- Rollback-only hosted proof for the event dispute register and qualification guard.
begin;

insert into auth.users(id,email) values
 ('a1380000-0000-4000-8000-000000000001','dispute-director@test.invalid'),
 ('a1380000-0000-4000-8000-000000000002','dispute-player-a@test.invalid'),
 ('a1380000-0000-4000-8000-000000000003','dispute-player-b@test.invalid'),
 ('a1380000-0000-4000-8000-000000000004','dispute-outsider@test.invalid');
update app.profiles set display_name=case id
 when 'a1380000-0000-4000-8000-000000000001' then 'Dispute Director'
 when 'a1380000-0000-4000-8000-000000000002' then 'Dispute Player A'
 when 'a1380000-0000-4000-8000-000000000003' then 'Dispute Player B'
 else 'Dispute Outsider' end where id::text like 'a138%';

insert into app.tournaments(id,director_profile_id,name,status,registration_status) values
 ('b1380000-0000-4000-8000-000000000001','a1380000-0000-4000-8000-000000000001','Synthetic Dispute','open','closed');
insert into app.tournament_roles(tournament_id,profile_id,role) values
 ('b1380000-0000-4000-8000-000000000001','a1380000-0000-4000-8000-000000000001','director'),
 ('b1380000-0000-4000-8000-000000000001','a1380000-0000-4000-8000-000000000002','player'),
 ('b1380000-0000-4000-8000-000000000001','a1380000-0000-4000-8000-000000000002','cross_checker'),
 ('b1380000-0000-4000-8000-000000000001','a1380000-0000-4000-8000-000000000003','player');
insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values
 ('c1380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','a1380000-0000-4000-8000-000000000001','dispute_fixture','b1380000-0000-4000-8000-000000000001',repeat('1',64),'d1380000-0000-4000-8000-000000000001','accepted','{}',now());
insert into app.tournament_setup_revisions(id,tournament_id,version,tournament_name,city,venue,starts_at,ends_at,timezone_name,actor_profile_id,operation_receipt_id) values
 ('e1380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001',1,'Synthetic Dispute','Test City','Test Venue','2026-10-03 09:00','2026-10-03 18:00','Pacific/Honolulu','a1380000-0000-4000-8000-000000000001','c1380000-0000-4000-8000-000000000001');
insert into app.tournament_setup_event_versions(id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,style_code,format_code,game_count,entry_fee_cents,muggins_status) values
 ('e1380000-0000-4000-8000-000000000002','b1380000-0000-4000-8000-000000000001','e1380000-0000-4000-8000-000000000001','e1380000-0000-4000-8000-000000000003',1,'main','Main','2026-10-03 09:00','Pacific/Honolulu','director_configured_standard_singles','standard_singles',1,0,'unset');
insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at) values
 ('f1380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','ACC 2025 fixture','standard_singles','ACC Official Tournament Rules 2025','2025-01-01',now());
insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method) values
 ('11380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','f1380000-0000-4000-8000-000000000001','Main','main','standard_singles','digital');
insert into app.tournament_setup_activations(id,tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,operation_receipt_id) values
 ('21380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','e1380000-0000-4000-8000-000000000001','e1380000-0000-4000-8000-000000000002','f1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','a1380000-0000-4000-8000-000000000001','c1380000-0000-4000-8000-000000000001');
insert into app.event_participants(id,tournament_id,event_id,profile_id,table_seat,status) values
 ('41380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','a1380000-0000-4000-8000-000000000002','A-1','checked_in'),
 ('41380000-0000-4000-8000-000000000002','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','a1380000-0000-4000-8000-000000000003','A-2','checked_in');
insert into app.rounds(id,tournament_id,event_id,round_number) values
 ('51380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001',1);
insert into app.canonical_games(id,tournament_id,event_id,round_id,match_instance,side_a_participant_id,side_b_participant_id,side_a_table_seat_snapshot,side_b_table_seat_snapshot,state,version,winner_side,margin) values
 ('61380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','51380000-0000-4000-8000-000000000001',1,'41380000-0000-4000-8000-000000000001','41380000-0000-4000-8000-000000000002','A-1','A-2','verified',1,'a',40);
insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id) values
 ('71380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','director_entry',1,2,1,repeat('7',64),'a1380000-0000-4000-8000-000000000001','c1380000-0000-4000-8000-000000000001');
insert into app.event_schedule_games(publication_id,tournament_id,event_id,canonical_game_id,import_row_number) values
 ('71380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','61380000-0000-4000-8000-000000000001',1);
insert into app.card_scorelines(id,tournament_id,event_id,canonical_game_id,participant_id,opponent_participant_id,side,table_seat_snapshot,is_winner,margin,plus_points,minus_points,game_points) values
 ('81380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','61380000-0000-4000-8000-000000000001','41380000-0000-4000-8000-000000000001','41380000-0000-4000-8000-000000000002','a','A-1',true,40,40,0,3),
 ('81380000-0000-4000-8000-000000000002','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','61380000-0000-4000-8000-000000000001','41380000-0000-4000-8000-000000000002','41380000-0000-4000-8000-000000000001','b','A-2',false,40,0,40,0);

select set_config('request.jwt.claim.role','service_role',true);
do $$ declare opened jsonb; replay jsonb; blocked jsonb; blocked_replay jsonb; self_result jsonb; self_conflict jsonb; resolved jsonb; resolution_replay jsonb; conflict jsonb; workspace jsonb; finalized jsonb; begin
  opened:=public.open_event_dispute_v1('a1380000-0000-4000-8000-000000000002','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','61380000-0000-4000-8000-000000000001','91380000-0000-4000-8000-000000000001','Two source cards require review','a1381000-0000-4000-8000-000000000001');
  replay:=public.open_event_dispute_v1('a1380000-0000-4000-8000-000000000002','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','61380000-0000-4000-8000-000000000001','91380000-0000-4000-8000-000000000001','Two source cards require review','a1381000-0000-4000-8000-000000000001');
  if opened<>replay or opened->>'status'<>'open' then raise exception 'open dispute replay failed'; end if;
  workspace:=public.get_event_dispute_workspace_v1('a1380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001');
  if jsonb_array_length(workspace->'games')<>1 or workspace#>>'{games,0,gameId}'<>'61380000-0000-4000-8000-000000000001'
    or (workspace#>>'{games,0,canOpen}')::boolean
    or jsonb_array_length(workspace->'openDisputes')<>1 or workspace#>>'{openDisputes,0,summary}'<>'Two source cards require review'
    or public.get_event_dispute_workspace_v1('a1380000-0000-4000-8000-000000000004','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001') is not null then raise exception 'dispute workspace scope failed'; end if;
  blocked:=public.finalize_standard_singles_qualification_v1('a1380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','a1381000-0000-4000-8000-000000000002');
  blocked_replay:=public.finalize_standard_singles_qualification_v1('a1380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','a1381000-0000-4000-8000-000000000002');
  if blocked<>blocked_replay or blocked->>'code'<>'dispute_open' or exists(select 1 from app.qualification_result_versions where event_id='11380000-0000-4000-8000-000000000001') then raise exception 'open dispute did not block qualification'; end if;
  self_result:=public.resolve_event_dispute_v1('a1380000-0000-4000-8000-000000000002','91380000-0000-4000-8000-000000000001','I cannot resolve my own game','a1381000-0000-4000-8000-000000000003');
  self_conflict:=public.resolve_event_dispute_v1('a1380000-0000-4000-8000-000000000002','91380000-0000-4000-8000-000000000001','Changed self retry must conflict','a1381000-0000-4000-8000-000000000003');
  if self_result->>'code'<>'resolver_not_independent' or self_conflict->>'code'<>'idempotency_conflict' then raise exception 'self resolution or changed replay was accepted'; end if;
  resolved:=public.resolve_event_dispute_v1('a1380000-0000-4000-8000-000000000001','91380000-0000-4000-8000-000000000001','Both source cards reviewed; no score change required','a1381000-0000-4000-8000-000000000004');
  resolution_replay:=public.resolve_event_dispute_v1('a1380000-0000-4000-8000-000000000001','91380000-0000-4000-8000-000000000001','Both source cards reviewed; no score change required','a1381000-0000-4000-8000-000000000004');
  conflict:=public.resolve_event_dispute_v1('a1380000-0000-4000-8000-000000000001','91380000-0000-4000-8000-000000000001','Changed reuse must conflict','a1381000-0000-4000-8000-000000000004');
  if resolved<>resolution_replay or resolved->>'status'<>'resolved' or conflict->>'code'<>'idempotency_conflict' then raise exception 'resolution replay or conflict failed'; end if;
  if jsonb_array_length((public.get_event_dispute_workspace_v1('a1380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001'))->'openDisputes')<>0 then raise exception 'resolved dispute remained open'; end if;
  finalized:=public.finalize_standard_singles_qualification_v1('a1380000-0000-4000-8000-000000000001','b1380000-0000-4000-8000-000000000001','11380000-0000-4000-8000-000000000001','a1381000-0000-4000-8000-000000000005');
  if finalized->>'status'<>'qualification_finalized' then raise exception 'resolved dispute did not release qualification'; end if;
end $$;

do $$ begin
  begin update app.event_disputes set summary='rewrite' where id='91380000-0000-4000-8000-000000000001'; raise exception 'immutable dispute changed'; exception when others then if sqlerrm<>'immutable history' then raise; end if; end;
  begin delete from app.event_dispute_state_events where dispute_id='91380000-0000-4000-8000-000000000001'; raise exception 'immutable state deleted'; exception when others then if sqlerrm<>'immutable history' then raise; end if; end;
  if (select count(*) from app.event_disputes where id='91380000-0000-4000-8000-000000000001')<>1
    or (select count(*) from app.event_dispute_state_events where dispute_id='91380000-0000-4000-8000-000000000001')<>2
    or (select count(*) from app.event_dispute_operation_conflicts
      where attempted_dispute_id='91380000-0000-4000-8000-000000000001')<>2
    or (select count(*) from app.audit_events
      where entity_type='event_dispute' and entity_id='91380000-0000-4000-8000-000000000001')<3
    then raise exception 'dispute history/audit count invalid'; end if;
  if has_function_privilege('authenticated','public.open_event_dispute_v1(uuid,uuid,uuid,uuid,uuid,text,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.resolve_event_dispute_v1(uuid,uuid,text,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.get_event_dispute_workspace_v1(uuid,uuid,uuid)','EXECUTE')
    or has_function_privilege('service_role','app.finalize_standard_singles_qualification_without_event_dispute_guard_v1(uuid,uuid,uuid,uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid)','EXECUTE') then raise exception 'dispute/finalization grants invalid'; end if;
end $$;

rollback;
