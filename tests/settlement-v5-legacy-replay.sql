-- DISPOSABLE LOCAL DATABASE ONLY. Historical v4 replay across the canonical MRP correction.
-- Rollback-only synthetic fixture; proposal loads only after the historical receipt exists.
begin;
do $$ begin if current_database()<>'fixture_0240' then raise exception 'Disposable fixture_0240 database required';end if;end $$;
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
 ('e1310000-0000-4000-8000-000000000002','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000003',1,'main','Main','2026-10-03 09:00','Pacific/Honolulu','director_configured_standard_singles','standard_singles',12,0,'unset');
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


-- Minimal synthetic locked qualification, not a qualifying-game verification test.
do $$ declare n integer; pid uuid; rid uuid; seat text; begin
 for n in 5..16 loop
  pid:=('41310000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  rid:=('d2400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  seat:=chr(65+(n-1)/4)||'-'||(((n-1)%4)+1)::text;
  insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)
   values(rid,'b1310000-0000-4000-8000-000000000001','director_manual','TEST ONLY outcome fixture '||n,'test only outcome fixture '||n,'paper','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
  insert into app.event_participants(id,tournament_id,event_id,profile_id,roster_entry_id,table_seat,status)
   values(pid,'b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001',null,rid,seat,'checked_in');
 end loop;
end $$;
insert into app.roster_account_links(id,tournament_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id)
 values('f2400000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','d2400000-0000-4000-8000-000000000016','a1310000-0000-4000-8000-000000000006','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
update app.tournaments set registration_status='closed' where id='b1310000-0000-4000-8000-000000000001';
insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id)
 values('71310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','director_entry',12,16,96,repeat('7',64),'a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
insert into app.qualification_result_versions(id,tournament_id,event_id,version,ruleset_version_id,schedule_publication_id,participant_count,qualifier_count,high_non_qualifier_participant_id,standings_digest,finalized_by_profile_id,operation_receipt_id,finalized_at)
 values('a2400000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001',1,'f1310000-0000-4000-8000-000000000001','71310000-0000-4000-8000-000000000001',16,4,'41310000-0000-4000-8000-000000000005',repeat('a',64),'a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001',now());
insert into app.qualification_result_rows(result_version_id,tournament_id,event_id,participant_id,ranking_ordinal,numeric_rank,tied,display_name_snapshot,verified_games,game_points,games_won,plus_points,minus_points,net_spread_points,qualification_status)
 select 'a2400000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001',
 ('41310000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,n,n,false,'TEST ONLY rank '||n,12,
 case when n<=2 then 24 when n<=4 then 22 else 0 end,case when n<=2 then 12 when n<=4 then 11 else 0 end,
 case when n<=4 then 100 else 0 end,0,case when n<=4 then 100 else 0 end,
 case when n<=4 then 'qualified' when n=5 then 'high_non_qualifier' else 'not_qualified' end from generate_series(1,16) n;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);

create temp table fixture_v4_history(
 old_response jsonb not null,
 old_draft_id uuid not null,
 old_receipt_id uuid not null,
 placements jsonb not null,
 financial_placements jsonb not null,
 old_claims jsonb not null
);

do $$ declare
 actor constant uuid:='a1310000-0000-4000-8000-000000000001';
 tid constant uuid:='b1310000-0000-4000-8000-000000000001';
 eid constant uuid:='11310000-0000-4000-8000-000000000001';
 qid constant uuid:='a2400000-0000-4000-8000-000000000001';
 p1 constant uuid:='41310000-0000-4000-8000-000000000001';
 p2 constant uuid:='41310000-0000-4000-8000-000000000002';
 p3 constant uuid:='41310000-0000-4000-8000-000000000003';
 p4 constant uuid:='41310000-0000-4000-8000-000000000004';
 placements jsonb;financial_placements jsonb;playoff jsonb;old_auto jsonb;old_claims jsonb;old_response jsonb;
 old_draft_id uuid;old_receipt_id uuid;
begin
 placements:=jsonb_build_array(
  jsonb_build_object('participantId',p1,'placement',1,'mrpPlayoffExitRound',2),
  jsonb_build_object('participantId',p2,'placement',2,'mrpPlayoffExitRound',2),
  jsonb_build_object('participantId',p4,'placement',3,'mrpPlayoffExitRound',1),
  jsonb_build_object('participantId',p3,'placement',4,'mrpPlayoffExitRound',1));
 financial_placements:=jsonb_build_array(
  jsonb_build_object('participantId',p1,'placement',1,'prizeAmountMinor',0),
  jsonb_build_object('participantId',p2,'placement',2,'prizeAmountMinor',0),
  jsonb_build_object('participantId',p4,'placement',3,'prizeAmountMinor',0),
  jsonb_build_object('participantId',p3,'placement',4,'prizeAmountMinor',0));
 playoff:=public.record_standard_singles_playoff_placements_v2(actor,tid,eid,qid,0,placements,'a2700000-0000-4000-8000-000000000001');
 if playoff->>'status'<>'playoff_placements_recorded' then raise exception 'historical v2 placement prerequisite failed: %',playoff;end if;
 old_auto:=app.standard_singles_automatic_mrps_v1(tid,eid,qid,(playoff->>'playoffResultVersionId')::uuid);
 if old_auto->>'status'<>'available'
   or old_auto->'rows'->0->>'totalMrp'<>'76' or old_auto->'rows'->1->>'totalMrp'<>'76'
   or old_auto->'rows'->2->>'totalMrp'<>'12' or old_auto->'rows'->3->>'totalMrp'<>'12'
 then raise exception 'historical automatic MRP baseline changed: %',old_auto;end if;
 select jsonb_agg(jsonb_build_object(
   'participantId',row_data->>'participantId','mrpPoints',(row_data->>'totalMrp')::integer,'evidenceNote',row_data->>'evidenceNote')
   order by (row_data->>'qualificationRank')::integer)
 into old_claims from jsonb_array_elements(old_auto->'rows') row_data;
 old_response:=public.save_standard_singles_settlement_draft_v4(actor,tid,eid,qid,(playoff->>'playoffResultVersionId')::uuid,0,financial_placements,'[]'::jsonb,old_claims,'a2700000-0000-4000-8000-000000000002');
 if old_response->>'status'<>'settlement_draft_saved' or old_response->>'version'<>'1' then raise exception 'historical v4 draft was not accepted: %',old_response;end if;
 old_draft_id:=(old_response->>'settlementDraftId')::uuid;
 select operation_receipt_id into old_receipt_id from app.standard_singles_settlement_drafts where id=old_draft_id;
 if old_receipt_id is null or (select count(*) from app.standard_singles_settlement_drafts where event_id=eid)<>1
   or (select jsonb_agg(mrp_points order by participant_id) from app.standard_singles_settlement_mrp_claims where settlement_draft_id=old_draft_id)<>'[76,76,12,12]'::jsonb
 then raise exception 'historical v4 receipt or immutable claims missing';end if;
 insert into fixture_v4_history values(old_response,old_draft_id,old_receipt_id,placements,financial_placements,old_claims);
end $$;

\ir ../docs/quality/2026-10-27-proposed-versioned-settlement-v5.sql

do $$ declare
 actor constant uuid:='a1310000-0000-4000-8000-000000000001';
 tid constant uuid:='b1310000-0000-4000-8000-000000000001';
 eid constant uuid:='11310000-0000-4000-8000-000000000001';
 qid constant uuid:='a2400000-0000-4000-8000-000000000001';
 history fixture_v4_history%rowtype;playoff_id uuid;exact_replay jsonb;changed_parent_claims jsonb;parent_conflict jsonb;mismatch jsonb;corrected_auto jsonb;corrected_claims jsonb;corrected jsonb;corrected_id uuid;
begin
 select * into history from fixture_v4_history;
 select id into playoff_id from app.standard_singles_playoff_result_versions where event_id=eid and version=1;
 exact_replay:=public.save_standard_singles_settlement_draft_v4(actor,tid,eid,qid,playoff_id,0,history.financial_placements,'[]'::jsonb,history.old_claims,'a2700000-0000-4000-8000-000000000002');
 if exact_replay<>history.old_response
   or (select count(*) from app.standard_singles_settlement_drafts where event_id=eid)<>1
   or (select operation_receipt_id from app.standard_singles_settlement_drafts where id=history.old_draft_id)<>history.old_receipt_id
 then raise exception 'historical accepted v4 replay changed after canonical correction: %',exact_replay;end if;
 changed_parent_claims:=jsonb_set(history.old_claims,'{0,mrpPoints}','999'::jsonb);
 parent_conflict:=public.save_standard_singles_settlement_draft_v4(actor,tid,eid,qid,playoff_id,0,history.financial_placements,'[]'::jsonb,changed_parent_claims,'a2700000-0000-4000-8000-000000000002');
 if parent_conflict->>'code'<>'idempotency_conflict'
   or (select count(*) from app.standard_singles_settlement_drafts where event_id=eid)<>1
   or (select count(*) from app.operation_receipts where operation_type='save_standard_singles_settlement_draft_v3' and target_id=eid)<>1
   or (select count(*) from app.standard_singles_settlement_conflicts where attempted_event_id=eid and reason_code='idempotency_conflict')<>1
   or (select operation_receipt_id from app.standard_singles_settlement_drafts where id=history.old_draft_id)<>history.old_receipt_id
 then raise exception 'changed same-parent v4 replay bypassed child receipt conflict: %',parent_conflict;end if;
 mismatch:=public.save_standard_singles_settlement_draft_v4(actor,tid,eid,qid,playoff_id,1,history.financial_placements,'[]'::jsonb,history.old_claims,'a2700000-0000-4000-8000-000000000003');
 if mismatch->>'code'<>'automatic_mrp_mismatch'
   or (select count(*) from app.standard_singles_settlement_drafts where event_id=eid)<>1
   or (select count(*) from app.operation_receipts where operation_type='save_standard_singles_settlement_draft_v3' and target_id=eid)<>1
 then raise exception 'new operation reused historical 76-point champion claim: %',mismatch;end if;
 corrected_auto:=app.standard_singles_automatic_mrps_v1(tid,eid,qid,playoff_id);
 if corrected_auto->>'status'<>'available'
   or corrected_auto->'rows'->0->>'totalMrp'<>'97' or corrected_auto->'rows'->1->>'totalMrp'<>'76'
   or corrected_auto->'rows'->2->>'totalMrp'<>'12' or corrected_auto->'rows'->3->>'totalMrp'<>'12'
 then raise exception 'corrected canonical automatic MRP unavailable: %',corrected_auto;end if;
 select jsonb_agg(jsonb_build_object(
   'participantId',row_data->>'participantId','mrpPoints',(row_data->>'totalMrp')::integer,'evidenceNote',row_data->>'evidenceNote')
   order by (row_data->>'qualificationRank')::integer)
 into corrected_claims from jsonb_array_elements(corrected_auto->'rows') row_data;
 corrected:=public.save_standard_singles_settlement_draft_v4(actor,tid,eid,qid,playoff_id,1,history.financial_placements,'[]'::jsonb,corrected_claims,'a2700000-0000-4000-8000-000000000004');
 if corrected->>'status'<>'settlement_draft_saved' or corrected->>'version'<>'2' then raise exception 'corrected canonical v4 draft failed: %',corrected;end if;
 corrected_id:=(corrected->>'settlementDraftId')::uuid;
 if not exists(select 1 from app.standard_singles_settlement_drafts where id=corrected_id and version=2 and supersedes_draft_id=history.old_draft_id)
   or (select jsonb_agg(mrp_points order by participant_id) from app.standard_singles_settlement_mrp_claims where settlement_draft_id=history.old_draft_id)<>'[76,76,12,12]'::jsonb
   or (select jsonb_agg(mrp_points order by participant_id) from app.standard_singles_settlement_mrp_claims where settlement_draft_id=corrected_id)<>'[97,76,12,12]'::jsonb
 then raise exception 'corrected draft did not preserve historical v1 while appending v2';end if;
 begin
  update app.standard_singles_settlement_mrp_claims set mrp_points=97 where settlement_draft_id=history.old_draft_id and mrp_points=76;
  raise exception 'historical v1 MRP claims became mutable';
 exception when others then
  if sqlerrm='historical v1 MRP claims became mutable' then raise;end if;
  if sqlerrm<>'immutable history' then raise;end if;
 end;
end $$;

\echo SETTLEMENT_V5_LEGACY_V4_REPLAY_PASSED
set constraints all immediate;
rollback;
