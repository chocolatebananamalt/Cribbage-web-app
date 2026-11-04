-- DISPOSABLE LOCAL DATABASE ONLY. Load the additive versioned settlement v5 proposal inside this transaction.
-- Rollback-only synthetic fixture based on the reviewed 0240 qualification seed; no hosted or played evidence.
-- Positive finalization remains pending real cross-check and closure evidence; guards stay enabled.
begin;
do $$ begin if current_database()<>'fixture_0240' then raise exception 'Disposable fixture_0240 database required';end if;end $$;
create temp table fixture_legacy_acl_before as
select p.oid::regprocedure::text as signature, p.proacl, p.proconfig, pg_get_userbyid(p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'get_standard_singles_playoff_placement_workspace_v1','get_standard_singles_playoff_placement_workspace_v2',
 'get_standard_singles_playoff_placement_reconciliation_v1','get_standard_singles_playoff_placement_reconciliation_v2',
 'get_standard_singles_settlement_reconciliation_v4','get_standard_singles_settlement_finalization_reconciliation_v1'
);
\ir ../docs/quality/2026-10-27-proposed-versioned-settlement-v5.sql
create function app.fixture_0240_unexpected_settlement_fault()
returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.request_payload->>'officialSourceReference'='TEST ONLY induce unexpected SQL fault' then
  raise exception using errcode='XX000',message='TEST ONLY unexpected settlement storage fault';
 end if;
 return new;
end $$;
revoke all on function app.fixture_0240_unexpected_settlement_fault() from public,anon,authenticated,service_role;
create trigger fixture_0240_unexpected_settlement_fault before insert on app.event_settlement_drafts_v5
for each row execute function app.fixture_0240_unexpected_settlement_fault();
do $$ begin
 if exists(select 1 from fixture_legacy_acl_before b left join pg_proc p on p.oid::regprocedure::text=b.signature
   where p.oid is null or p.proacl is distinct from b.proacl or p.proconfig is distinct from b.proconfig or pg_get_userbyid(p.proowner) is distinct from b.owner)
 then raise exception 'legacy reader/reconciliation ACL owner or search_path changed'; end if;
end $$;

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
do $$ begin
 if not has_function_privilege('service_role','public.record_standard_singles_playoff_placements_v2(uuid,uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE')
   or not has_function_privilege('service_role','public.save_standard_singles_settlement_draft_v3(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid)','EXECUTE')
 then raise exception 'supported legacy writer grants were not preserved';end if;
end $$;
do $$ declare routine record;role_name text;expected boolean;begin
 for routine in select p.oid,n.nspname,p.proname,p.proconfig,pg_get_userbyid(p.proowner) owner
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='public' and p.proname in(
    'record_standard_singles_playoff_outcomes_v3','get_standard_singles_playoff_outcome_workspace_v3','get_standard_singles_playoff_outcome_reconciliation_v3',
    'save_event_settlement_draft_v5','finalize_event_settlement_v2','get_event_settlement_workspace_v5','get_event_settlement_reconciliation_v5'))
   or (n.nspname='app' and p.proname in(
    'derive_four_player_playoff_v3','playoff_outcome_blocker_v3','canonical_settlement_mrp_v5','settlement_ledger_v5','settlement_source_current_v5',
    'settlement_award_blocked_v5','write_event_settlement_v5','valid_settlement_request_v5','settlement_assessment_v5','require_canonical_legacy_mrp_v5','require_settlement_write_domain_v5'))
 loop
  if routine.owner<>'postgres' or routine.proconfig is distinct from array['search_path=""'] then raise exception 'new settlement owner/search_path boundary failed: %.%',routine.nspname,routine.proname;end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   expected:=routine.nspname='public' and role_name='service_role';
   if has_function_privilege(role_name,routine.oid,'EXECUTE')<>expected then raise exception 'new settlement RPC ACL matrix failed: %.% %',routine.nspname,routine.proname,role_name;end if;
  end loop;
 end loop;
end $$;

-- Prove the supported legacy path derives a complete no-bye bracket and blocks
-- a false direct-v3 MRP claim. Roll it all back before creating the v3 source,
-- so the per-event playoff-domain guard never sees two write domains.
savepoint legacy_canonical_probe;
do $$ declare
 actor constant uuid:='a1310000-0000-4000-8000-000000000001';tid constant uuid:='b1310000-0000-4000-8000-000000000001';eid constant uuid:='11310000-0000-4000-8000-000000000001';q constant uuid:='a2400000-0000-4000-8000-000000000001';
 p1 constant uuid:='41310000-0000-4000-8000-000000000001';p2 constant uuid:='41310000-0000-4000-8000-000000000002';p3 constant uuid:='41310000-0000-4000-8000-000000000003';p4 constant uuid:='41310000-0000-4000-8000-000000000004';
 placements jsonb;financial_placements jsonb;legacy_source jsonb;transition_request jsonb;
 legacy_result jsonb;canonical jsonb;wrong_claim jsonb;old_draft jsonb;new_draft jsonb;old_replay jsonb;old_conflict jsonb;old_draft_id uuid;
begin
 placements:=jsonb_build_array(
  jsonb_build_object('participantId',p1,'placement',1,'mrpPlayoffExitRound',2),
  jsonb_build_object('participantId',p2,'placement',2,'mrpPlayoffExitRound',2),
  jsonb_build_object('participantId',p3,'placement',4,'mrpPlayoffExitRound',1),
  jsonb_build_object('participantId',p4,'placement',3,'mrpPlayoffExitRound',1));
 legacy_result:=public.record_standard_singles_playoff_placements_v2(actor,tid,eid,q,0,placements,'a2500000-0000-4000-8000-000000000001');
 if legacy_result->>'status'<>'playoff_placements_recorded' then raise exception 'supported legacy v2 write failed: %',legacy_result;end if;
 canonical:=app.canonical_settlement_mrp_v5(tid,eid,jsonb_build_object('kind','legacy_placement_v2','resultId',legacy_result->>'playoffResultVersionId','qualificationResultVersionId',q));
 if canonical->>'status'<>'available' or canonical->>'bracketSourceVersion'<>'legacy-complete-no-bye-v2'
   or canonical->'rows'->0->>'totalMrp'<>'97' or canonical->'rows'->1->>'totalMrp'<>'76'
   or canonical->'rows'->2->>'totalMrp'<>'12' or canonical->'rows'->3->>'totalMrp'<>'12'
   or canonical->'rows'->2->>'bandStart'<>'3' or canonical->'rows'->3->>'bandEnd'<>'4'
 then raise exception 'legacy canonical MRP or cohort derivation failed: %',canonical;end if;
 financial_placements:=jsonb_build_array(
  jsonb_build_object('participantId',p1,'placement',1,'prizeAmountMinor',0),
  jsonb_build_object('participantId',p2,'placement',2,'prizeAmountMinor',0),
  jsonb_build_object('participantId',p3,'placement',4,'prizeAmountMinor',0),
  jsonb_build_object('participantId',p4,'placement',3,'prizeAmountMinor',0));
 wrong_claim:=public.save_standard_singles_settlement_draft_v3(actor,tid,eid,q,(legacy_result->>'playoffResultVersionId')::uuid,0,financial_placements,'[]'::jsonb,
  jsonb_build_array(jsonb_build_object('participantId',p1,'mrpPoints',999,'evidenceNote','TEST ONLY deliberately incorrect legacy MRP claim')),
  'a2500000-0000-4000-8000-000000000002');
 if wrong_claim->>'code'<>'invalid_mrp_claims' then raise exception 'direct legacy v3 false MRP claim was not blocked: %',wrong_claim;end if;
 old_draft:=public.save_standard_singles_settlement_draft_v1(actor,tid,eid,q,0,financial_placements,'[]'::jsonb,'a2500000-0000-4000-8000-000000000003');
 if old_draft->>'status'<>'settlement_draft_saved' or old_draft->>'version'<>'1' then raise exception 'legacy v1 transition prerequisite failed: %',old_draft;end if;
 old_draft_id:=(old_draft->>'settlementDraftId')::uuid;
 legacy_source:=jsonb_build_object('kind','legacy_placement_v2','resultId',legacy_result->>'playoffResultVersionId','qualificationResultVersionId',q);
 transition_request:=jsonb_build_object('source',legacy_source,'expectedVersion',1,'prizeClaims','[]'::jsonb,'eventIncomeMinor',0,'eventExpenseMinor',0,'retainedBalanceMinor',0,'officialSourceReference','TEST ONLY legacy-to-v5 lineage transition','sanctioningExpenseEventId',null);
 new_draft:=public.save_event_settlement_draft_v5(actor,tid,eid,transition_request,'a2500000-0000-4000-8000-000000000004');
 if new_draft->>'status'<>'settlement_draft_saved_v5' or new_draft->>'version'<>'2'
   or not exists(select 1 from app.event_settlement_drafts_v5 where id=(new_draft->>'draftId')::uuid and prior_legacy_draft_id=old_draft_id and version=2)
 then raise exception 'v5 did not adopt exact legacy draft lineage: %',new_draft;end if;
 old_replay:=public.save_standard_singles_settlement_draft_v1(actor,tid,eid,q,0,financial_placements,'[]'::jsonb,'a2500000-0000-4000-8000-000000000003');
 if old_replay<>old_draft then raise exception 'accepted legacy replay changed after v5 transition';end if;
 old_conflict:=public.save_standard_singles_settlement_draft_v1(actor,tid,eid,q,1,financial_placements,'[]'::jsonb,'a2500000-0000-4000-8000-000000000005');
 if old_conflict->>'code'<>'settlement_domain_conflict'
   or (select count(*) from app.standard_singles_settlement_drafts where event_id=eid)<>1
   or (select count(*) from app.event_settlement_drafts_v5 where event_id=eid)<>1
   or not exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id='a2500000-0000-4000-8000-000000000005' and outcome='rejected')
 then raise exception 'new legacy write after v5 transition was not conserved: %',old_conflict;end if;
end $$;
rollback to savepoint legacy_canonical_probe;
do $$ begin
 if exists(select 1 from app.standard_singles_playoff_result_versions where event_id='11310000-0000-4000-8000-000000000001')
   or exists(select 1 from app.standard_singles_settlement_drafts where event_id='11310000-0000-4000-8000-000000000001')
   or exists(select 1 from app.event_settlement_drafts_v5 where event_id='11310000-0000-4000-8000-000000000001')
 then raise exception 'legacy probe did not roll back before v3 source';end if;
end $$;

-- A zero-rate override is recorded through the supported writer before play
-- starts. The start snapshot, cross-check assignment/finalization, settlement
-- draft, and settlement final all use supported evidence. The savepoint rolls
-- this proof back so the immutable 16 x 300 snapshot can be tested separately.
savepoint zero_assessment_positive_final;
do $$ declare
 actor constant uuid:='a1310000-0000-4000-8000-000000000001';tid constant uuid:='b1310000-0000-4000-8000-000000000001';eid constant uuid:='11310000-0000-4000-8000-000000000001';q constant uuid:='a2400000-0000-4000-8000-000000000001';
 p1 constant uuid:='41310000-0000-4000-8000-000000000001';p2 constant uuid:='41310000-0000-4000-8000-000000000002';p3 constant uuid:='41310000-0000-4000-8000-000000000003';p4 constant uuid:='41310000-0000-4000-8000-000000000004';
 override_result jsonb;assignment_result jsonb;crosscheck_result jsonb;playoff_result jsonb;draft_result jsonb;final_result jsonb;
 series jsonb;source jsonb;request jsonb;final_request jsonb;draft_id uuid;override_id uuid;
begin
 override_result:=public.override_tournament_sanctioning_fee_rate_v1(actor,tid,'main',0,'TEST ONLY zero-rate unit proof','TEST ONLY synthetic approved zero-rate source','a2500000-0000-4000-8000-000000000040');
 if override_result->>'status'<>'sanctioning_fee_rate_overridden' then raise exception 'supported zero-rate override failed: %',override_result;end if;
 select id into override_id from app.tournament_sanctioning_fee_rate_overrides where tournament_id=tid and event_kind='main' order by version desc limit 1;
 insert into app.event_play_starts(id,tournament_id,event_id,schedule_publication_id,participant_snapshot_digest,participant_count,game_count,schedule_match_count,started_by_profile_id,start_source,started_at)
  values('e2500000-0000-4000-8000-000000000001',tid,eid,'71310000-0000-4000-8000-000000000001',app.event_participant_snapshot_digest_v1(eid),16,12,96,actor,'legacy_scoring_backfill',clock_timestamp());
 insert into app.event_sanctioning_fee_snapshots(id,tournament_id,event_id,event_play_start_id,event_kind,rate_cents,eligible_participant_count,total_cents,rate_source,rate_override_id)
  values('e2500000-0000-4000-8000-000000000002',tid,eid,'e2500000-0000-4000-8000-000000000001','main',0,16,0,'override',override_id);
 assignment_result:=public.assign_cross_checker_v1(actor,tid,'d2400000-0000-4000-8000-000000000016','a2500000-0000-4000-8000-000000000041');
 if assignment_result->>'status'<>'cross_checker_assigned' then raise exception 'supported cross-checker assignment failed: %',assignment_result;end if;
 crosscheck_result:=public.finalize_cross_checking_v1(actor,tid,'a2500000-0000-4000-8000-000000000042');
 if crosscheck_result->>'status'<>'cross_checking_finalized' then raise exception 'supported zero-game cross-check finalization failed: %',crosscheck_result;end if;
 series:=jsonb_build_array(
  jsonb_build_object('winnerId',p1,'loserId',p4,'evidenceNote','TEST ONLY synthetic semifinal 1'),
  jsonb_build_object('winnerId',p2,'loserId',p3,'evidenceNote','TEST ONLY synthetic semifinal 2'),
  jsonb_build_object('winnerId',p1,'loserId',p2,'evidenceNote','TEST ONLY synthetic final'));
 playoff_result:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,0,series,'a2500000-0000-4000-8000-000000000043');
 if playoff_result->>'status'<>'playoff_outcomes_recorded' then raise exception 'positive-path v3 source write failed: %',playoff_result;end if;
 source:=jsonb_build_object('kind','playoff_outcome_v3','resultId',playoff_result->>'resultId','qualificationResultVersionId',q);
 request:=jsonb_build_object('source',source,'expectedVersion',0,'prizeClaims','[]'::jsonb,'eventIncomeMinor',0,'eventExpenseMinor',0,'retainedBalanceMinor',0,'officialSourceReference','TEST ONLY zero-assessment final proof','sanctioningExpenseEventId',null);
 draft_result:=public.save_event_settlement_draft_v5(actor,tid,eid,request,'a2500000-0000-4000-8000-000000000044');
 if draft_result->>'status'<>'settlement_draft_saved_v5' then raise exception 'zero-assessment positive draft failed: %',draft_result;end if;
 draft_id:=(draft_result->>'draftId')::uuid;
 final_request:=jsonb_build_object('draftId',draft_id,'draftVersion',1,'expectedVersion',0,
  'attestations',jsonb_build_object('expenseLedgerReviewed',true,'mrpClaimsReviewed',true,'noAutomaticAccSubmission',true,'officialSourceReviewed',true,'payoutClaimsReviewed',true,'noQPoolClaimsRecorded',true));
 final_result:=public.finalize_event_settlement_v2(actor,tid,eid,final_request,'a2500000-0000-4000-8000-000000000045');
 if final_result->>'status'<>'settlement_finalized_v2' or not exists(select 1 from app.event_settlement_finals_v2 where event_id=eid and id=(final_result->>'finalizationId')::uuid)
 then raise exception 'zero-assessment supported finalization failed: %',final_result;end if;
end $$;
rollback to savepoint zero_assessment_positive_final;
do $$ begin
 if exists(select 1 from app.event_play_starts where event_id='11310000-0000-4000-8000-000000000001')
   or exists(select 1 from app.event_sanctioning_fee_snapshots where event_id='11310000-0000-4000-8000-000000000001')
   or exists(select 1 from app.cross_check_finalizations where tournament_id='b1310000-0000-4000-8000-000000000001')
   or exists(select 1 from app.event_settlement_finals_v2 where event_id='11310000-0000-4000-8000-000000000001')
 then raise exception 'zero-assessment positive proof did not roll back';end if;
end $$;

insert into app.event_play_starts(id,tournament_id,event_id,schedule_publication_id,participant_snapshot_digest,participant_count,game_count,schedule_match_count,started_by_profile_id,start_source,started_at)
 values('e2500000-0000-4000-8000-000000000011','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','71310000-0000-4000-8000-000000000001',app.event_participant_snapshot_digest_v1('11310000-0000-4000-8000-000000000001'),16,12,96,'a1310000-0000-4000-8000-000000000001','legacy_scoring_backfill',clock_timestamp());
insert into app.event_sanctioning_fee_snapshots(id,tournament_id,event_id,event_play_start_id,event_kind,rate_cents,eligible_participant_count,total_cents,rate_source,setup_revision_id)
 values('e2500000-0000-4000-8000-000000000012','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','e2500000-0000-4000-8000-000000000011','main',300,16,4800,'setup','e1310000-0000-4000-8000-000000000001');

do $$ declare
 actor constant uuid:='a1310000-0000-4000-8000-000000000001';outsider constant uuid:='a1310000-0000-4000-8000-000000000006';tid constant uuid:='b1310000-0000-4000-8000-000000000001';eid constant uuid:='11310000-0000-4000-8000-000000000001';q constant uuid:='a2400000-0000-4000-8000-000000000001';
 p1 constant uuid:='41310000-0000-4000-8000-000000000001';p2 constant uuid:='41310000-0000-4000-8000-000000000002';p3 constant uuid:='41310000-0000-4000-8000-000000000003';p4 constant uuid:='41310000-0000-4000-8000-000000000004';
 series jsonb;corrected_series jsonb;source jsonb;corrected_source jsonb;request jsonb;fault_request jsonb;corrected_request jsonb;extra_request jsonb;final_request jsonb;
 playoff_result jsonb;corrected_playoff_result jsonb;draft_result jsonb;draft_replay jsonb;rejected jsonb;rejected_replay jsonb;response jsonb;workspace jsonb;canonical jsonb;draft_id uuid;
begin
 series:=jsonb_build_array(
  jsonb_build_object('winnerId',p1,'loserId',p4,'evidenceNote','TEST ONLY synthetic semifinal 1'),
  jsonb_build_object('winnerId',p2,'loserId',p3,'evidenceNote','TEST ONLY synthetic semifinal 2'),
  jsonb_build_object('winnerId',p1,'loserId',p2,'evidenceNote','TEST ONLY synthetic final'));
 playoff_result:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,0,series,'a2500000-0000-4000-8000-000000000010');
 if playoff_result->>'status'<>'playoff_outcomes_recorded' then raise exception 'v3 source write failed: %',playoff_result;end if;
 source:=jsonb_build_object('kind','playoff_outcome_v3','resultId',playoff_result->>'resultId','qualificationResultVersionId',q);
 canonical:=app.canonical_settlement_mrp_v5(tid,eid,source);
 if canonical->>'status'<>'available' or canonical->>'bracketSourceVersion'<>'acc-rulebook-2025-effective-2025-08-01'
   or canonical->'rows'->0->>'totalMrp'<>'97' or canonical->'rows'->1->>'totalMrp'<>'76'
   or canonical->'rows'->2->>'totalMrp'<>'12' or canonical->'rows'->3->>'totalMrp'<>'12'
 then raise exception 'v3 canonical MRP failed: %',canonical;end if;

 request:=jsonb_build_object('source',source,'expectedVersion',0,'prizeClaims','[]'::jsonb,'eventIncomeMinor',0,'eventExpenseMinor',0,'retainedBalanceMinor',0,'officialSourceReference','TEST ONLY ACC source review; no automatic submission','sanctioningExpenseEventId',null);
 fault_request:=jsonb_set(request,'{officialSourceReference}',to_jsonb('TEST ONLY induce unexpected SQL fault'::text));
 begin
  response:=public.save_event_settlement_draft_v5(actor,tid,eid,fault_request,'a2500000-0000-4000-8000-000000000020');
  raise exception 'unexpected SQL fault was swallowed: %',response;
 exception when sqlstate 'XX000' then null;
 end;
 if exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id='a2500000-0000-4000-8000-000000000020')
 then raise exception 'unexpected SQL fault poisoned the operation receipt';end if;
 draft_result:=public.save_event_settlement_draft_v5(actor,tid,eid,request,'a2500000-0000-4000-8000-000000000020');
 if draft_result->>'status'<>'settlement_draft_saved_v5' or draft_result->>'version'<>'1' then raise exception 'zero-ledger v5 draft failed: %',draft_result;end if;
 draft_id:=(draft_result->>'draftId')::uuid;
 if not exists(select 1 from app.event_settlement_drafts_v5 d where d.id=draft_id and d.request_payload=request and d.canonical_mrp=canonical
   and d.ledger_snapshot->>'paymentCount'='0' and d.ledger_snapshot->>'paymentTotalMinor'='0' and d.ledger_snapshot->>'expenseCount'='0' and d.ledger_snapshot->>'expenseTotalMinor'='0')
 then raise exception 'draft did not preserve exact request, canonical MRP, and zero ledger';end if;
 workspace:=public.get_event_settlement_workspace_v5(actor,tid,eid);
 if workspace->>'currentDraftVersion'<>'1' or workspace->'draft'->>'draftId'<>draft_id::text
   or workspace->>'sanctioningAssessmentMinor'<>'4800' or not(workspace->'blockers' ? 'sanctioning_assessment_unfunded')
   or workspace->'capabilities'->>'qPoolClaims'<>'false' or workspace->'capabilities'->>'automaticPayout'<>'false'
 then raise exception 'workspace did not expose pending assessment/capability truth: %',workspace;end if;

 response:=public.save_event_settlement_draft_v5(outsider,tid,eid,request,'a2500000-0000-4000-8000-000000000021');
 if response->>'code'<>'not_director' then raise exception 'unauthorized v5 draft accepted';end if;
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,null,'a2500000-0000-4000-8000-000000000022');
 if response->>'code'<>'invalid_request' then raise exception 'null draft request accepted';end if;
 extra_request:=request||jsonb_build_object('callerMrp',999);
 rejected:=public.save_event_settlement_draft_v5(actor,tid,eid,extra_request,'a2500000-0000-4000-8000-000000000023');
 if rejected->>'code'<>'invalid_request' then raise exception 'extra draft field accepted';end if;
 rejected_replay:=public.save_event_settlement_draft_v5(actor,tid,eid,extra_request,'a2500000-0000-4000-8000-000000000023');
 if rejected_replay<>rejected then raise exception 'exact rejected v5 replay changed';end if;
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,null,'a2500000-0000-4000-8000-000000000023');
 if response->>'code'<>'idempotency_conflict' then raise exception 'changed rejected v5 key did not conflict';end if;
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,jsonb_set(request,'{source,resultId}',to_jsonb('f2500000-0000-4000-8000-000000000099'::text)),'a2500000-0000-4000-8000-000000000024');
 if response->>'code'<>'source_unavailable' then raise exception 'wrong result source binding accepted';end if;
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,jsonb_set(request,'{source,qualificationResultVersionId}',to_jsonb('d2500000-0000-4000-8000-000000000099'::text)),'a2500000-0000-4000-8000-000000000025');
 if response->>'code'<>'source_unavailable' then raise exception 'wrong qualification source binding accepted';end if;

 draft_replay:=public.save_event_settlement_draft_v5(actor,tid,eid,request,'a2500000-0000-4000-8000-000000000020');
 if draft_replay<>draft_result then raise exception 'exact accepted v5 replay changed';end if;
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,jsonb_set(request,'{officialSourceReference}',to_jsonb('TEST ONLY changed request'::text)),'a2500000-0000-4000-8000-000000000020');
 if response->>'code'<>'idempotency_conflict' then raise exception 'changed accepted v5 key did not conflict';end if;
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,request,'a2500000-0000-4000-8000-000000000026');
 if response->>'code'<>'stale_version' then raise exception 'stale v5 append accepted';end if;
 rejected_replay:=public.save_event_settlement_draft_v5(actor,tid,eid,request,'a2500000-0000-4000-8000-000000000026');
 if rejected_replay<>response then raise exception 'stale rejection replay changed';end if;
 corrected_request:=jsonb_set(jsonb_set(request,'{expectedVersion}','1'::jsonb),'{officialSourceReference}',to_jsonb('TEST ONLY supervised source review revision'::text));
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,corrected_request,'a2500000-0000-4000-8000-000000000027');
 if response->>'status'<>'settlement_draft_saved_v5' or response->>'version'<>'2' then raise exception 'v5 append correction failed: %',response;end if;

 corrected_series:=jsonb_set(jsonb_set(series,'{2,winnerId}',to_jsonb(p2)),'{2,loserId}',to_jsonb(p1));
 corrected_playoff_result:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,1,corrected_series,'a2500000-0000-4000-8000-000000000030');
 if corrected_playoff_result->>'version'<>'2' then raise exception 'v3 source correction failed: %',corrected_playoff_result;end if;
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,jsonb_set(corrected_request,'{expectedVersion}','2'::jsonb),'a2500000-0000-4000-8000-000000000031');
 if response->>'code'<>'source_unavailable' then raise exception 'stale corrected source accepted';end if;
 final_request:=jsonb_build_object('draftId',(select id from app.event_settlement_drafts_v5 where event_id=eid order by version desc limit 1),'draftVersion',2,'expectedVersion',0,
  'attestations',jsonb_build_object('expenseLedgerReviewed',true,'mrpClaimsReviewed',true,'noAutomaticAccSubmission',true,'officialSourceReviewed',true,'payoutClaimsReviewed',true,'noQPoolClaimsRecorded',true));
 response:=public.finalize_event_settlement_v2(actor,tid,eid,final_request,'a2500000-0000-4000-8000-000000000032');
 if response->>'code'<>'source_unavailable' then raise exception 'finalization accepted a superseded source';end if;

 corrected_source:=jsonb_build_object('kind','playoff_outcome_v3','resultId',corrected_playoff_result->>'resultId','qualificationResultVersionId',q);
 corrected_request:=jsonb_set(jsonb_set(jsonb_set(corrected_request,'{source}',corrected_source),'{expectedVersion}','2'::jsonb),'{officialSourceReference}',to_jsonb('TEST ONLY corrected v3 source review'::text));
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,corrected_request,'a2500000-0000-4000-8000-000000000033');
 if response->>'status'<>'settlement_draft_saved_v5' or response->>'version'<>'3' then raise exception 'corrected-source v5 draft failed: %',response;end if;
 draft_id:=(response->>'draftId')::uuid;
 final_request:=jsonb_build_object('draftId',draft_id,'draftVersion',3,'expectedVersion',0,
  'attestations',jsonb_build_object('expenseLedgerReviewed',true,'mrpClaimsReviewed',true,'noAutomaticAccSubmission',true,'officialSourceReviewed',true,'payoutClaimsReviewed',true,'noQPoolClaimsRecorded',false));
 response:=public.finalize_event_settlement_v2(outsider,tid,eid,final_request,'a2500000-0000-4000-8000-000000000036');
 if response->>'code'<>'not_director'
   or exists(select 1 from app.operation_receipts where actor_profile_id=outsider and client_operation_id='a2500000-0000-4000-8000-000000000036')
   or exists(select 1 from app.event_settlement_finals_v2 where event_id=eid)
 then raise exception 'unauthorized finalization created hidden state: %',response;end if;
 response:=public.finalize_event_settlement_v2(actor,tid,eid,final_request,'a2500000-0000-4000-8000-000000000034');
 if response->>'code'<>'invalid_request' then raise exception 'false no-Q-pool attestation accepted';end if;
 final_request:=jsonb_set(final_request,'{attestations,noQPoolClaimsRecorded}','true'::jsonb);
 if exists(select 1 from app.tournament_setup_activations a join app.tournament_setup_q_pool_versions qpool on qpool.setup_event_version_id=a.setup_event_version_id where a.event_id=eid and qpool.entry_fee_cents>0)
   or app.settlement_award_blocked_v5(tid,eid) then raise exception 'fixture cannot truthfully attest no Q-pool/award claims';end if;
 if app.settlement_assessment_v5(eid)<>4800 or (app.settlement_ledger_v5(tid)->>'expenseTotalMinor')::bigint<>0
   or (app.settlement_ledger_v5(tid)->>'paymentTotalMinor')::bigint<>0 then raise exception 'synthetic assessment/ledger precondition changed';end if;
 rejected:=public.finalize_event_settlement_v2(actor,tid,eid,final_request,'a2500000-0000-4000-8000-000000000035');
 if rejected->>'code'<>'sanctioning_assessment_unfunded' then raise exception 'unfunded 16 x 300 assessment did not block: %',rejected;end if;
 rejected_replay:=public.finalize_event_settlement_v2(actor,tid,eid,final_request,'a2500000-0000-4000-8000-000000000035');
 if rejected_replay<>rejected then raise exception 'unfunded finalization rejection replay changed';end if;
 response:=public.finalize_event_settlement_v2(actor,tid,eid,jsonb_set(final_request,'{expectedVersion}','1'::jsonb),'a2500000-0000-4000-8000-000000000035');
 if response->>'code'<>'idempotency_conflict' then raise exception 'changed rejected finalization key did not conflict';end if;
 if exists(select 1 from app.event_settlement_finals_v2 where event_id=eid) then raise exception 'blocked finalization persisted';end if;
 if not exists(select 1 from app.operation_receipts r join app.audit_events a on a.operation_receipt_id=r.id where r.operation_type='save_event_settlement_draft_v5' and r.target_id=eid and r.outcome='accepted')
   or not exists(select 1 from app.operation_receipts r join app.audit_events a on a.operation_receipt_id=r.id where r.operation_type='finalize_event_settlement_v2' and r.target_id=eid and r.outcome='rejected')
 then raise exception 'v5 receipt/audit conservation failed';end if;
end $$;

select public.get_event_settlement_workspace_v5(
 'a1310000-0000-4000-8000-000000000001',
 'b1310000-0000-4000-8000-000000000001',
 '11310000-0000-4000-8000-000000000001');
\echo VERSIONED_SETTLEMENT_V5_POSITIVE_AND_NEGATIVE_PATHS_PASSED
set constraints all immediate;
rollback;
