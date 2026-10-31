-- DISPOSABLE LOCAL DATABASE ONLY. Rollback-only structured prize schedule proof.
-- Qualification, participant, schedule, play-start, assessment, and cross-check prerequisites below are synthetic seeded foundation.
-- Financial obligations, 16 3000-cent receipt records, the expense, playoff outcome, v5 drafts, and v5 final rejection paths are exercised through supported RPCs.
begin;
do $$ begin if current_database()<>'fixture_0240' then raise exception 'Disposable fixture_0240 database required';end if;end $$;
\ir ../database/migrations/0240_versioned_settlement_v5.sql
\ir ../docs/quality/2026-10-27-proposed-payback-review-v1.sql
\ir ../docs/quality/2026-10-27-proposed-prize-schedule-v1.sql
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
do $$declare actor constant uuid:='a1310000-0000-4000-8000-000000000001';tid constant uuid:='b1310000-0000-4000-8000-000000000001';row_id constant uuid:='e1310000-0000-4000-8000-000000000003';
 schedule jsonb;request jsonb;saved jsonb;replay jsonb;response jsonb;workspace jsonb;begin
 workspace:=public.get_setup_prize_schedule_v1(actor,tid,row_id);
 if workspace->>'currentVersion'<>'0'or workspace->>'activated'<>'false'or workspace->>'settingsCurrent'<>'true'
  or jsonb_array_length(workspace->'versions')<>0 then raise exception 'director could not read exact empty schedule workspace: %',workspace;end if;
 schedule:=jsonb_build_object('kind','director-selected-prize-schedule-v1','amountBasis','total_award','expectedQualifierCount',4,
  'sourceReference','TEST ONLY reviewed director-selected schedule','roundingRule','floor_each_weighted_share_then_assign_remainder_to_champion',
  'cohorts',jsonb_build_array(jsonb_build_object('bandStart',1,'bandEnd',1,'weight',4),jsonb_build_object('bandStart',2,'bandEnd',2,'weight',3),jsonb_build_object('bandStart',3,'bandEnd',4,'weight',2)));
 request:=jsonb_build_object('expectedVersion',0,'schedule',schedule,'reviewed',true,'reason','TEST ONLY initial reviewed schedule');
 saved:=public.save_setup_prize_schedule_v1(actor,tid,row_id,request,'02420000-0000-4000-8000-000000000001');
 if saved->>'status'<>'prize_schedule_saved_v1'or saved->>'version'<>'1'then raise exception 'initial structured schedule save failed: %',saved;end if;
 replay:=public.save_setup_prize_schedule_v1(actor,tid,row_id,request,'02420000-0000-4000-8000-000000000001');
 if replay is distinct from saved then raise exception 'accepted schedule replay changed';end if;
 response:=public.save_setup_prize_schedule_v1(actor,tid,row_id,jsonb_set(request,'{reason}','"TEST ONLY changed same operation"'::jsonb),'02420000-0000-4000-8000-000000000001');
 if response->>'code'<>'idempotency_conflict'then raise exception 'changed schedule operation did not conflict: %',response;end if;
 response:=public.save_setup_prize_schedule_v1(actor,tid,row_id,request,'02420000-0000-4000-8000-000000000002');
 if response->>'code'<>'stale_version'then raise exception 'stale schedule append was accepted: %',response;end if;
end $$;
insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at) values
 ('f1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','ACC 2025 fixture','standard_singles','ACC Official Tournament Rules 2025','2025-01-01',now());
insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method) values
 ('11310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','f1310000-0000-4000-8000-000000000001','Main','main','standard_singles','digital');
insert into app.tournament_setup_activations(id,tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,operation_receipt_id) values
 ('21310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000002','f1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
do $$declare schedule jsonb;request jsonb;saved jsonb;begin
 schedule:=jsonb_build_object('kind','director-selected-prize-schedule-v1','amountBasis','total_award','expectedQualifierCount',4,
  'sourceReference','TEST ONLY reviewed director-selected schedule','roundingRule','floor_each_weighted_share_then_assign_remainder_to_champion',
  'cohorts',jsonb_build_array(jsonb_build_object('bandStart',1,'bandEnd',1,'weight',4),jsonb_build_object('bandStart',2,'bandEnd',2,'weight',3),jsonb_build_object('bandStart',3,'bandEnd',4,'weight',2)));
 request:=jsonb_build_object('expectedVersion',1,'schedule',schedule,'reviewed',true,'reason','TEST ONLY reviewed revision after activation');
 saved:=public.save_setup_prize_schedule_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000003',request,'02420000-0000-4000-8000-000000000003');
 if saved->>'status'<>'prize_schedule_saved_v1'or saved->>'version'<>'2'then raise exception 'activated schedule revision failed: %',saved;end if;
 if public.get_setup_prize_schedule_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000003')->>'eventId'<>'11310000-0000-4000-8000-000000000001'
  then raise exception 'activated schedule workspace did not derive the event from activation';end if;
end $$;
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
insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)
 select ('d2400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'b1310000-0000-4000-8000-000000000001','director_manual','TEST ONLY funded participant '||n,
  'test only funded participant '||n,'paper','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001'
 from generate_series(1,4)n;
insert into app.roster_account_links(id,tournament_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id)
 select ('f2600000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'b1310000-0000-4000-8000-000000000001',('d2400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  ('a1310000-0000-4000-8000-'||lpad((n+1)::text,12,'0'))::uuid,
  'a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001'
 from generate_series(1,4)n;
insert into app.roster_account_links(id,tournament_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id)
 values('f2400000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','d2400000-0000-4000-8000-000000000016','a1310000-0000-4000-8000-000000000006','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
-- A withdrawn seventeenth identity is synthetic negative-test foundation. It is
-- never part of the supported sixteen-player facts unless a savepoint reinstates it.
insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)
 values('d2400000-0000-4000-8000-000000000017','b1310000-0000-4000-8000-000000000001','director_manual','TEST ONLY withdrawn negative','test only withdrawn negative','paper','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
insert into app.roster_entry_lifecycle_events(tournament_id,roster_entry_id,version,event_type,reason_code,note,actor_profile_id,operation_receipt_id)
 values('b1310000-0000-4000-8000-000000000001','d2400000-0000-4000-8000-000000000017',1,'withdrawn','administrative_correction','TEST ONLY negative foundation','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
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
do $$declare response jsonb;begin
 response:=public.save_setup_prize_schedule_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000003',
  jsonb_build_object('expectedVersion',2,'schedule',(select schedule_payload from app.setup_prize_schedule_versions_v1 where tournament_id='b1310000-0000-4000-8000-000000000001'order by version desc limit 1),'reviewed',true,'reason','TEST ONLY forbidden post-qualification revision'),
  '02420000-0000-4000-8000-000000000005');
 if response->>'code'<>'schedule_revision_closed'then raise exception 'post-qualification schedule revision was accepted: %',response;end if;
end $$;

create temporary table funded_rpc_results(label text primary key,result jsonb not null)on commit drop;
grant select,insert on funded_rpc_results to authenticated;

-- The sixteen obligations and sixteen receipts below are the financial behavior
-- under test. The roster, qualification, schedule, and score foundation above is
-- direct synthetic setup and does not represent a played tournament.
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','a1310000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"a1310000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
insert into funded_rpc_results(label,result)
 select 'obligation-'||n,public.set_roster_payment_obligation_v1(
  'b1310000-0000-4000-8000-000000000001',('d2400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  0,3000,'TEST ONLY fictional 3000-cent revised prize-pool obligation',
  ('a2600000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid)
 from generate_series(1,16)n;
insert into funded_rpc_results(label,result)
 select 'payment-'||n,public.record_manual_roster_payment(
  'b1310000-0000-4000-8000-000000000001',('d2400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  0,3000,'USD','cash','2026-10-03T08:00:00Z'::timestamptz,
  'TEST ONLY fictional receipt; no money changed hands',
  ('b2600000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid)
 from generate_series(1,16)n;
insert into funded_rpc_results(label,result)
 values('expense',public.record_tournament_expense(
  'b1310000-0000-4000-8000-000000000001',4800,'USD',
  'TEST ONLY fictional sanctioning assessment expense','c2600000-0000-4000-8000-000000000001'));
insert into funded_rpc_results(label,result) values
 ('expense-meals',public.record_tournament_expense('b1310000-0000-4000-8000-000000000001',4800,'USD','TEST ONLY fictional meals benefit expense','c2600000-0000-4000-8000-000000000002')),
 ('expense-snacks',public.record_tournament_expense('b1310000-0000-4000-8000-000000000001',4800,'USD','TEST ONLY fictional snacks benefit expense','c2600000-0000-4000-8000-000000000003')),
 ('expense-hall',public.record_tournament_expense('b1310000-0000-4000-8000-000000000001',7200,'USD','TEST ONLY fictional hall rental operating expense','c2600000-0000-4000-8000-000000000004'));
insert into funded_rpc_results(label,result)
 values('payment-replay-1',public.record_manual_roster_payment(
  'b1310000-0000-4000-8000-000000000001','d2400000-0000-4000-8000-000000000001',
  0,3000,'USD','cash','2026-10-03T08:00:00Z'::timestamptz,
  'TEST ONLY fictional receipt; no money changed hands','b2600000-0000-4000-8000-000000000001'));
insert into funded_rpc_results(label,result)
 values('expense-replay',public.record_tournament_expense(
  'b1310000-0000-4000-8000-000000000001',4800,'USD',
  'TEST ONLY fictional sanctioning assessment expense','c2600000-0000-4000-8000-000000000001'));
set local role postgres;

do $$declare expense_event uuid;ledger jsonb;begin
 if exists(select 1 from funded_rpc_results where label like'obligation-%'and result->>'status'<>'payment_obligation_saved')
  or(select count(*)from funded_rpc_results where label like'obligation-%')<>16 then raise exception 'supported obligation RPCs did not save sixteen exact 3000-cent obligations';end if;
 if exists(select 1 from funded_rpc_results where label ~ '^payment-[0-9]+$'and result->>'status'<>'payment_recorded')
  or(select count(*)from funded_rpc_results where label ~ '^payment-[0-9]+$')<>16 then raise exception 'supported payment RPCs did not save sixteen exact 3000-cent receipts';end if;
 if exists(select 1 from funded_rpc_results where label in('expense','expense-meals','expense-snacks','expense-hall')and result->>'status'<>'expense_recorded')
  or(select count(*)from funded_rpc_results where label in('expense','expense-meals','expense-snacks','expense-hall'))<>4 then raise exception 'supported expense RPCs did not save four exact expenses';end if;
 if(select result from funded_rpc_results where label='payment-replay-1')is distinct from(select result from funded_rpc_results where label='payment-1')
  or(select result from funded_rpc_results where label='expense-replay')is distinct from(select result from funded_rpc_results where label='expense')
 then raise exception 'supported payment or expense exact replay changed';end if;
 expense_event:=((select result->>'expenseEventId'from funded_rpc_results where label='expense'))::uuid;
 ledger:=app.settlement_ledger_v5('b1310000-0000-4000-8000-000000000001');
 if ledger->>'paymentCount'<>'16'or ledger->>'paymentTotalMinor'<>'48000'or ledger->>'expenseCount'<>'4'or ledger->>'expenseTotalMinor'<>'21600'
  or not exists(select 1 from app.tournament_expense_events where id=expense_event and event_type='recorded'and amount_minor=4800)
  then raise exception 'supported financial RPC ledger did not conserve 48000 gross income and 21600 complete expenses: %',ledger;end if;
end $$;

-- The immutable start/assessment and zero-game cross-check prerequisites are
-- synthetic foundation. Their public writers are outside this focused financial test.
-- The v3/v5 public RPCs below are called from the postgres-owned rollback fixture;
-- their service_role-only ACL is proved separately by the canonical 0240 fixture.
insert into app.event_play_starts(id,tournament_id,event_id,schedule_publication_id,participant_snapshot_digest,participant_count,game_count,schedule_match_count,started_by_profile_id,start_source,started_at)
 values('e2600000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','71310000-0000-4000-8000-000000000001',app.event_participant_snapshot_digest_v1('11310000-0000-4000-8000-000000000001'),16,12,96,'a1310000-0000-4000-8000-000000000001','legacy_scoring_backfill',clock_timestamp());
insert into app.event_sanctioning_fee_snapshots(id,tournament_id,event_id,event_play_start_id,event_kind,rate_cents,eligible_participant_count,total_cents,rate_source,setup_revision_id)
 values('e2600000-0000-4000-8000-000000000002','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','e2600000-0000-4000-8000-000000000001','main',300,16,4800,'setup','e1310000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$declare
 actor constant uuid:='a1310000-0000-4000-8000-000000000001';outsider constant uuid:='a1310000-0000-4000-8000-000000000007';
 tid constant uuid:='b1310000-0000-4000-8000-000000000001';eid constant uuid:='11310000-0000-4000-8000-000000000001';q constant uuid:='a2400000-0000-4000-8000-000000000001';
 p1 constant uuid:='41310000-0000-4000-8000-000000000001';p2 constant uuid:='41310000-0000-4000-8000-000000000002';p3 constant uuid:='41310000-0000-4000-8000-000000000003';p4 constant uuid:='41310000-0000-4000-8000-000000000004';
 expense_event uuid;series jsonb;source jsonb;draft_request jsonb;review_request jsonb;attestations jsonb;final_request jsonb;schedule_id uuid;
 assignment jsonb;crosscheck jsonb;outcome jsonb;draft jsonb;saved jsonb;response jsonb;replay jsonb;workspace jsonb;
begin
 expense_event:=((select result->>'expenseEventId'from funded_rpc_results where label='expense'))::uuid;
 assignment:=public.assign_cross_checker_v1(actor,tid,'d2400000-0000-4000-8000-000000000016','e2700000-0000-4000-8000-000000000001');
 if assignment->>'status'<>'cross_checker_assigned'then raise exception 'supported cross-checker assignment failed: %',assignment;end if;
 crosscheck:=public.finalize_cross_checking_v1(actor,tid,'e2700000-0000-4000-8000-000000000002');
 if crosscheck->>'status'<>'cross_checking_finalized'then raise exception 'supported synthetic cross-check closure failed: %',crosscheck;end if;
 series:=jsonb_build_array(
  jsonb_build_object('winnerId',p1,'loserId',p4,'evidenceNote','TEST ONLY synthetic semifinal 1'),
  jsonb_build_object('winnerId',p2,'loserId',p3,'evidenceNote','TEST ONLY synthetic semifinal 2'),
  jsonb_build_object('winnerId',p1,'loserId',p2,'evidenceNote','TEST ONLY synthetic final'));
 outcome:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,0,series,'e2700000-0000-4000-8000-000000000003');
 if outcome->>'status'<>'playoff_outcomes_recorded'then raise exception 'supported playoff outcome failed: %',outcome;end if;
 source:=jsonb_build_object('kind','playoff_outcome_v3','resultId',outcome->>'resultId','qualificationResultVersionId',q);
 workspace:=public.get_event_prize_schedule_resolution_v1(actor,tid,eid,source);
 if workspace->>'status'<>'available'or workspace->>'grossEntryIncomeMinor'<>'48000'or workspace->>'expenseTotalMinor'<>'21600'
  or workspace->>'prizeBudgetMinor'<>'26400'or workspace->>'roundingRemainderMinor'<>'0'
  or workspace->'awards'->0->>'totalAwardMinor'<>'9600'or workspace->'awards'->1->>'totalAwardMinor'<>'7200'
  or workspace->'awards'->2->>'totalAwardMinor'<>'4800'or workspace->'awards'->3->>'totalAwardMinor'<>'4800'
 then raise exception 'director schedule resolution was not exact: %',workspace;end if;
 schedule_id:=(workspace->>'scheduleVersionId')::uuid;
 response:=public.save_setup_prize_schedule_v1(actor,tid,'e1310000-0000-4000-8000-000000000003',jsonb_build_object('expectedVersion',2,'schedule',(select schedule_payload from app.setup_prize_schedule_versions_v1 where id=schedule_id),'reviewed',true,'reason','TEST ONLY forbidden post-outcome revision'),'02420000-0000-4000-8000-000000000004');
 if response->>'code'<>'schedule_revision_closed'then raise exception 'post-outcome schedule revision was accepted: %',response;end if;
 draft_request:=jsonb_build_object('source',source,'expectedVersion',0,'prizeClaims',jsonb_build_array(
  jsonb_build_object('participantId',p1,'amountMinor',9600,'prizeOrder',null,'note','TEST ONLY calculated total award'),
  jsonb_build_object('participantId',p2,'amountMinor',7200,'prizeOrder',null,'note','TEST ONLY calculated total award'),
  jsonb_build_object('participantId',p3,'amountMinor',4800,'prizeOrder',null,'note','TEST ONLY equal semifinal cohort total award'),
  jsonb_build_object('participantId',p4,'amountMinor',4800,'prizeOrder',null,'note','TEST ONLY equal semifinal cohort total award')),
  'eventIncomeMinor',48000,'eventExpenseMinor',21600,'retainedBalanceMinor',0,'officialSourceReference','TEST ONLY director-selected schedule; not ACC authorization','sanctioningExpenseEventId',expense_event);
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,draft_request,'02420000-0000-4000-8000-000000000010');
 if response->>'code'<>'schedule_revision_required'then raise exception 'adopted event accepted draft without schedule pin: %',response;end if;
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,draft_request||jsonb_build_object('scheduleVersionId','02420000-0000-4000-8000-000000000099'),'02420000-0000-4000-8000-000000000011');
 if response->>'code'<>'schedule_revision_required'then raise exception 'adopted event accepted wrong schedule pin: %',response;end if;
 response:=public.save_event_settlement_draft_v5(actor,tid,eid,jsonb_set(draft_request||jsonb_build_object('scheduleVersionId',schedule_id),'{prizeClaims,0,amountMinor}','9599'::jsonb),'02420000-0000-4000-8000-000000000012');
 if response->>'code'<>'schedule_claim_mismatch'then raise exception 'adopted event accepted mismatched calculated claim: %',response;end if;
 draft_request:=draft_request||jsonb_build_object('scheduleVersionId',schedule_id);
 draft:=public.save_event_settlement_draft_v5(actor,tid,eid,draft_request,'e2700000-0000-4000-8000-000000000004');
 if draft->>'status'<>'settlement_draft_saved_v5'or draft->>'version'<>'1'then raise exception 'supported V5 draft failed: %',draft;end if;
 attestations:=jsonb_build_object('expenseLedgerReviewed',true,'mrpClaimsReviewed',true,'noAutomaticAccSubmission',true,'officialSourceReviewed',true,'payoutClaimsReviewed',true,'noQPoolClaimsRecorded',true);
 final_request:=jsonb_build_object('draftId',draft->>'draftId','draftVersion',1,'expectedVersion',0,'attestations',attestations);
 response:=public.finalize_event_settlement_v2(actor,tid,eid,final_request,'e2700000-0000-4000-8000-000000000014');
 if response->>'code'<>'payback_evidence_required'then raise exception 'pre-review V5 final did not return structured payback rejection: %',response;end if;
 replay:=public.finalize_event_settlement_v2(actor,tid,eid,final_request,'e2700000-0000-4000-8000-000000000014');
 if replay is distinct from response then raise exception 'pre-review final rejection replay changed';end if;
 replay:=public.finalize_event_settlement_v2(actor,tid,eid,jsonb_set(final_request,'{expectedVersion}','1'::jsonb),'e2700000-0000-4000-8000-000000000014');
 if replay->>'code'<>'idempotency_conflict'then raise exception 'changed pre-review final key did not conflict: %',replay;end if;
 -- Direct insert probes prove the required-event triggers themselves fail closed.
 -- They do not claim public legacy RPC rejection mapping coverage.
 begin insert into app.standard_singles_settlement_drafts(tournament_id,event_id)values(tid,eid);raise exception 'legacy draft insert bypassed required review';
 exception when sqlstate'P0001'then if sqlerrm<>'settlement_domain_conflict'then raise;end if;end;
 begin insert into app.standard_singles_settlement_final_versions(tournament_id,event_id)values(tid,eid);raise exception 'legacy final insert bypassed required review';
 exception when sqlstate'P0001'then if sqlerrm<>'settlement_domain_conflict'then raise;end if;end;
end $$;

-- PAYBACK_REVIEW_V1_CONCURRENCY_SEED_END
-- A concurrency runner may take the file through the preceding completed DO
-- block, append COMMIT, then use independent database sessions. The ordinary
-- rollback fixture continues below and does not itself claim concurrency.
do $$declare
 actor constant uuid:='a1310000-0000-4000-8000-000000000001';outsider constant uuid:='a1310000-0000-4000-8000-000000000007';
 tid constant uuid:='b1310000-0000-4000-8000-000000000001';eid constant uuid:='11310000-0000-4000-8000-000000000001';
 p1 constant uuid:='41310000-0000-4000-8000-000000000001';p2 constant uuid:='41310000-0000-4000-8000-000000000002';p3 constant uuid:='41310000-0000-4000-8000-000000000003';p4 constant uuid:='41310000-0000-4000-8000-000000000004';
 expense_event uuid;draft jsonb;new_draft jsonb;original_request jsonb;review_request jsonb;attestations jsonb;final_request jsonb;saved jsonb;response jsonb;replay jsonb;workspace jsonb;
begin
 expense_event:=((select result->>'expenseEventId'from funded_rpc_results where label='expense'))::uuid;
 select jsonb_build_object('status','settlement_draft_saved_v5','draftId',id,'version',version)into draft
  from app.event_settlement_drafts_v5 where tournament_id=tid and event_id=eid order by version desc limit 1;
 -- Every negative mutation is rolled back by its sentinel exception. These prove
 -- missing payment evidence and ambiguous direct/account roster identity fail closed.
 begin
  insert into app.roster_entry_lifecycle_events(tournament_id,roster_entry_id,version,event_type,reason_code,note,actor_profile_id,operation_receipt_id)
   values(tid,'d2400000-0000-4000-8000-000000000017',2,'reinstated','administrative_correction','TEST ONLY missing obligation negative',actor,'c1310000-0000-4000-8000-000000000001');
  if app.event_payback_facts_v1(tid,eid)->>'status'<>'blocked'then raise exception 'active roster without participant/payment evidence was accepted';end if;
  raise exception 'ROLLBACK_MISSING_PAYMENT_NEGATIVE';
 exception when sqlstate'P0001'then if sqlerrm<>'ROLLBACK_MISSING_PAYMENT_NEGATIVE'then raise;end if;end;
 begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
  response:=public.set_roster_payment_obligation_v1(tid,'d2400000-0000-4000-8000-000000000017',0,3000,'TEST ONLY independent receipt negative','e2700000-0000-4000-8000-000000000012');
  if response->>'status'<>'payment_obligation_saved'then raise exception 'extra obligation setup failed: %',response;end if;
  response:=public.record_manual_roster_payment(tid,'d2400000-0000-4000-8000-000000000017',0,3000,'USD','cash','2026-10-03T08:00:00Z'::timestamptz,
   'TEST ONLY independent receipt outside active participant set','e2700000-0000-4000-8000-000000000013');
  if response->>'status'<>'payment_recorded'or app.event_payback_facts_v1(tid,eid)->>'status'<>'blocked'then raise exception 'independent extra receipt did not block facts: %',response;end if;
  raise exception 'ROLLBACK_EXTRA_RECEIPT_NEGATIVE';
 exception when sqlstate'P0001'then if sqlerrm<>'ROLLBACK_EXTRA_RECEIPT_NEGATIVE'then raise;end if;end;
 begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
  response:=public.void_manual_roster_payment(tid,'d2400000-0000-4000-8000-000000000001',1,
   (select id from app.roster_payment_events where roster_entry_id='d2400000-0000-4000-8000-000000000001'and event_type='received'order by version desc limit 1),
   'TEST ONLY missing current receipt negative','e2700000-0000-4000-8000-000000000011');
  if response->>'status'<>'payment_voided'or app.event_payback_facts_v1(tid,eid)->>'status'<>'blocked'then raise exception 'voided current receipt did not block facts: %',response;end if;
  raise exception 'ROLLBACK_VOIDED_PAYMENT_NEGATIVE';
 exception when sqlstate'P0001'then if sqlerrm<>'ROLLBACK_VOIDED_PAYMENT_NEGATIVE'then raise;end if;end;
 review_request:=jsonb_build_object('draftId',draft->>'draftId','draftVersion',1,'expectedVersion',0,'scheduleKind','director_selected','amountBasis','total_award',
  'scheduleReference','TEST ONLY reviewed director-selected schedule','sourceReference','ACC Tournament Directors Manual chapter 6 section III, review copy 2026-10-27',
  'eligibilityEvidence',jsonb_build_array(
   jsonb_build_object('participantId',p1,'basis','full_entry_cash_eligible','evidenceReference','TEST ONLY roster evidence A'),
   jsonb_build_object('participantId',p2,'basis','full_entry_cash_eligible','evidenceReference','TEST ONLY roster evidence B'),
   jsonb_build_object('participantId',p3,'basis','full_entry_cash_eligible','evidenceReference','TEST ONLY roster evidence C'),
   jsonb_build_object('participantId',p4,'basis','full_entry_cash_eligible','evidenceReference','TEST ONLY roster evidence D')),
  'expenseClassifications',jsonb_build_array(
   jsonb_build_object('expenseEventId',expense_event,'category','sanctioning','evidenceReference','TEST ONLY immutable assessment and expense binding'),
   jsonb_build_object('expenseEventId',(select result->>'expenseEventId'from funded_rpc_results where label='expense-meals'),'category','meals','evidenceReference','TEST ONLY supported expense receipt'),
   jsonb_build_object('expenseEventId',(select result->>'expenseEventId'from funded_rpc_results where label='expense-snacks'),'category','snacks','evidenceReference','TEST ONLY supported expense receipt'),
   jsonb_build_object('expenseEventId',(select result->>'expenseEventId'from funded_rpc_results where label='expense-hall'),'category','hall_rental','evidenceReference','TEST ONLY supported expense receipt')));
 if public.get_event_payback_workspace_v1(outsider,tid,eid)is not null then raise exception 'unauthorized workspace was disclosed';end if;
 response:=public.save_event_payback_review_v1(outsider,tid,eid,review_request,'e2700000-0000-4000-8000-000000000005');
 if response->>'code'<>'not_director'then raise exception 'unauthorized review was not rejected: %',response;end if;
 response:=public.save_event_payback_review_v1(actor,tid,eid,jsonb_set(review_request,'{eligibilityEvidence}',(review_request->'eligibilityEvidence')-3),'e2700000-0000-4000-8000-000000000006');
 if response->>'code'<>'payback_evidence_required'then raise exception 'missing qualifier evidence was not rejected: %',response;end if;
 response:=public.save_event_payback_review_v1(actor,tid,eid,jsonb_set(review_request,'{expenseClassifications,0,category}','"cards"'::jsonb),'e2700000-0000-4000-8000-000000000007');
 if response->>'code'<>'expense_classification_required'then raise exception 'mismatched sanctioning classification was not rejected: %',response;end if;
 saved:=public.save_event_payback_review_v1(actor,tid,eid,review_request,'e2700000-0000-4000-8000-000000000008');
 if saved->>'status'<>'payback_review_saved_v1'or saved->>'version'<>'1'then raise exception 'payback review was not saved: %',saved;end if;
 replay:=public.save_event_payback_review_v1(actor,tid,eid,review_request,'e2700000-0000-4000-8000-000000000008');
 if replay is distinct from saved then raise exception 'accepted payback review exact replay changed';end if;
 response:=public.save_event_payback_review_v1(actor,tid,eid,jsonb_set(review_request,'{sourceReference}','"TEST ONLY changed source"'::jsonb),'e2700000-0000-4000-8000-000000000008');
 if response->>'code'<>'idempotency_conflict'then raise exception 'changed review under the same key did not conflict: %',response;end if;
 response:=public.save_event_payback_review_v1(actor,tid,eid,review_request,'e2700000-0000-4000-8000-000000000009');
 if response->>'code'<>'stale_version'then raise exception 'stale review append was accepted: %',response;end if;
 workspace:=public.get_event_payback_workspace_v1(actor,tid,eid);
 if workspace->>'required'<>'true'or workspace->>'currentReviewVersion'<>'1'or workspace->'scope'->>'status'<>'supported'
  or workspace->'scope'->>'grossEntryIncomeMinor'<>'48000'or workspace->'review'->>'reviewId'<>saved->>'reviewId'
  or workspace->'review'->'totals'->>'benefitExpenseMinor'<>'14400'or workspace->'review'->'totals'->>'operatingExpenseMinor'<>'7200'
  or workspace->'review'->'totals'->>'awardTotalMinor'<>'26400'or workspace->'review'->'totals'->>'participantReturnMinor'<>'40800'
 then raise exception 'payback workspace did not expose exact supported review facts: %',workspace;end if;
 attestations:=jsonb_build_object('expenseLedgerReviewed',true,'mrpClaimsReviewed',true,'noAutomaticAccSubmission',true,'officialSourceReviewed',true,'payoutClaimsReviewed',true,'noQPoolClaimsRecorded',true);
 begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
  response:=public.set_roster_payment_obligation_v1(tid,'d2400000-0000-4000-8000-000000000001',1,3000,'TEST ONLY same-amount version staleness','e2700000-0000-4000-8000-000000000015');
  workspace:=public.get_event_payback_workspace_v1(actor,tid,eid);
  if response->>'status'<>'payment_obligation_saved'or workspace->'review'->>'current'<>'false'then raise exception 'same-amount obligation append did not stale review: %, %',response,workspace;end if;
  final_request:=jsonb_build_object('draftId',draft->>'draftId','draftVersion',1,'expectedVersion',0,'attestations',attestations);
  response:=public.finalize_event_settlement_v2(actor,tid,eid,final_request,'e2700000-0000-4000-8000-000000000016');
  if response->>'code'<>'ledger_snapshot_changed'then raise exception 'stale obligation facts did not block final: %',response;end if;
  raise exception 'ROLLBACK_OBLIGATION_STALENESS';
 exception when sqlstate'P0001'then if sqlerrm<>'ROLLBACK_OBLIGATION_STALENESS'then raise;end if;end;
 begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
  response:=public.record_tournament_expense(tid,100,'USD','TEST ONLY new expense staleness','e2700000-0000-4000-8000-000000000017');
  workspace:=public.get_event_payback_workspace_v1(actor,tid,eid);
  if response->>'status'<>'expense_recorded'or workspace->'review'->>'current'<>'false'then raise exception 'expense append did not stale review: %, %',response,workspace;end if;
  final_request:=jsonb_build_object('draftId',draft->>'draftId','draftVersion',1,'expectedVersion',0,'attestations',attestations);
  response:=public.finalize_event_settlement_v2(actor,tid,eid,final_request,'e2700000-0000-4000-8000-000000000018');
   if response->>'code'<>'schedule_claim_mismatch'then raise exception 'stale expense ledger did not block final with exact schedule mismatch: %',response;end if;
  raise exception 'ROLLBACK_EXPENSE_STALENESS';
 exception when sqlstate'P0001'then if sqlerrm<>'ROLLBACK_EXPENSE_STALENESS'then raise;end if;end;
 begin
  select request_payload into original_request from app.event_settlement_drafts_v5 where id=(draft->>'draftId')::uuid;
  new_draft:=public.save_event_settlement_draft_v5(actor,tid,eid,jsonb_set(original_request,'{expectedVersion}','1'::jsonb),'e2700000-0000-4000-8000-000000000019');
  workspace:=public.get_event_payback_workspace_v1(actor,tid,eid);
  if new_draft->>'status'<>'settlement_draft_saved_v5'or new_draft->>'version'<>'2'or workspace->'review'->>'current'<>'false'then raise exception 'new V5 draft did not require a fresh review: %, %',new_draft,workspace;end if;
  final_request:=jsonb_build_object('draftId',new_draft->>'draftId','draftVersion',2,'expectedVersion',0,'attestations',attestations);
  response:=public.finalize_event_settlement_v2(actor,tid,eid,final_request,'e2700000-0000-4000-8000-000000000020');
  if response->>'code'<>'ledger_snapshot_changed'then raise exception 'unreviewed new V5 draft was finalizable: %',response;end if;
  raise exception 'ROLLBACK_NEW_DRAFT_STALENESS';
 exception when sqlstate'P0001'then if sqlerrm<>'ROLLBACK_NEW_DRAFT_STALENESS'then raise;end if;end;
 final_request:=jsonb_build_object('draftId',draft->>'draftId','draftVersion',1,'expectedVersion',0,'attestations',attestations);
 response:=public.finalize_event_settlement_v2(actor,tid,eid,final_request,'e2700000-0000-4000-8000-000000000010');
 if response->>'status'<>'settlement_finalized_v2'then raise exception 'review-bound finalization failed: %',response;end if;
 if not exists(select 1 from app.event_settlement_finals_v2 where id=(response->>'finalizationId')::uuid and payback_review_id=(saved->>'reviewId')::uuid)then raise exception 'final did not pin the accepted payback review';end if;
 workspace:=public.list_prize_award_summaries_v1('a1310000-0000-4000-8000-000000000003',tid);
 if jsonb_array_length(workspace)<>1 or workspace->0->>'eventId'<>eid::text or workspace->0->>'scheduleVersion'<>'2'
  or workspace->0->'awards'->0->>'amountMinor'<>'9600'or workspace->0->'awards'->2->>'amountMinor'<>'4800'
 then raise exception 'authorized player award summary was not exact and sanitized: %',workspace;end if;
 if public.list_prize_award_summaries_v1(outsider,tid)is not null then raise exception 'unauthorized award summary was disclosed';end if;
 if(select count(*)from app.event_payback_reviews_v1 where event_id=eid)<>1
  or(select count(*)from app.operation_receipts where operation_type='save_event_payback_review_v1'and target_id=eid)<>4
  or(select count(*)from app.event_payback_review_conflicts_v1 where event_id=eid)<>1
 then raise exception 'payback review receipt/history cardinality changed';end if;
end $$;

do $$declare rpc text;helper text;table_name text;role_name text;privilege_name text;begin
 if app.minimum_payback_return_minor_v1(101)<>86 or app.minimum_payback_return_minor_v1(20)<>17 or app.minimum_payback_return_minor_v1(1)<>1
  or app.minimum_payback_return_minor_v1(9007199254740991)<>7656119366529843
 then raise exception 'exact integer payback ceiling boundary changed';end if;
 if not exists(select 1 from app.event_payback_review_requirements where event_id='11310000-0000-4000-8000-000000000001'and requirement_source='future_activation')then raise exception 'eligible activation was not pinned';end if;
 if app.prize_schedule_settings_fingerprint_v1(app.prize_schedule_settings_v1('b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000003'))
  is distinct from app.prize_schedule_settings_fingerprint_v1(jsonb_set(jsonb_set(app.prize_schedule_settings_v1('b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000003'),'{setupRevisionId}','"02420000-0000-4000-8000-000000000090"'::jsonb),'{setupEventVersionId}','"02420000-0000-4000-8000-000000000091"'::jsonb))
 then raise exception 'volatile setup identity changed the policy fingerprint';end if;
 if(select count(*)from app.setup_prize_schedule_streams_v1)<>1
  or(select count(*)from app.setup_prize_schedule_versions_v1)<>2
  or(select count(*)from app.event_prize_schedule_bindings_v1)<>2
  or(select count(*)from app.setup_prize_schedule_conflicts_v1)<>1
  or(select count(*)from app.operation_receipts where operation_type='save_setup_prize_schedule_v1')<>5
 then raise exception 'schedule stream/version/binding/receipt cardinality changed';end if;
 if public.get_prize_schedule_reconciliation_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','e1310000-0000-4000-8000-000000000003','02420000-0000-4000-8000-000000000003')->'result'->>'status'<>'prize_schedule_saved_v1'
 then raise exception 'accepted schedule reconciliation was unavailable';end if;
 begin
  insert into app.setup_prize_schedule_streams_v1(tournament_id,client_row_id,created_by)
   select 'b1310000-0000-4000-8000-000000000001',('0242ffff-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'a1310000-0000-4000-8000-000000000001'from generate_series(1,33)n;
  if jsonb_array_length(public.list_tournament_prize_schedules_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001'))<>1
   then raise exception 'orphan schedule streams poisoned the bounded list reader';end if;
  raise exception 'ROLLBACK_ORPHAN_STREAMS';
 exception when sqlstate'P0001'then if sqlerrm<>'ROLLBACK_ORPHAN_STREAMS'then raise;end if;end;
 begin update app.setup_prize_schedule_versions_v1 set reason='mutated'where version=1;raise exception 'schedule version mutation was accepted';
 exception when sqlstate'P0001'then if sqlerrm<>'immutable history'then raise;end if;end;
 begin delete from app.event_prize_schedule_bindings_v1 where binding_version=1;raise exception 'schedule binding deletion was accepted';
 exception when sqlstate'P0001'then if sqlerrm<>'immutable history'then raise;end if;end;
 if has_function_privilege('anon','public.save_event_payback_review_v1(uuid,uuid,uuid,jsonb,uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.save_event_payback_review_v1(uuid,uuid,uuid,jsonb,uuid)','EXECUTE')
  or not has_function_privilege('service_role','public.save_event_payback_review_v1(uuid,uuid,uuid,jsonb,uuid)','EXECUTE')then raise exception 'payback review writer ACL drift';end if;
 if has_function_privilege('anon','public.save_setup_prize_schedule_v1(uuid,uuid,uuid,jsonb,uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.save_setup_prize_schedule_v1(uuid,uuid,uuid,jsonb,uuid)','EXECUTE')
  or not has_function_privilege('service_role','public.save_setup_prize_schedule_v1(uuid,uuid,uuid,jsonb,uuid)','EXECUTE')then raise exception 'prize schedule writer ACL drift';end if;
 foreach rpc in array array[
  'public.get_setup_prize_schedule_v1(uuid,uuid,uuid)','public.list_tournament_prize_schedules_v1(uuid,uuid)',
  'public.get_prize_schedule_reconciliation_v1(uuid,uuid,uuid,uuid)','public.save_setup_prize_schedule_v1(uuid,uuid,uuid,jsonb,uuid)',
  'public.get_event_prize_schedule_resolution_v1(uuid,uuid,uuid,jsonb)','public.list_prize_award_summaries_v1(uuid,uuid)']loop
  if has_function_privilege('anon',rpc,'EXECUTE')or has_function_privilege('authenticated',rpc,'EXECUTE')
   or not has_function_privilege('service_role',rpc,'EXECUTE')then raise exception 'public prize schedule RPC ACL drift: %',rpc;end if;
 end loop;
 foreach helper in array array[
  'app.bind_prize_schedule_on_activation_v1()','app.setup_prize_schedule_workspace_v1(uuid,uuid,uuid)',
  'app.prize_schedule_settings_v1(uuid,uuid)','app.prize_schedule_settings_fingerprint_v1(jsonb)',
  'app.valid_director_prize_schedule_v1(jsonb)','app.prize_schedule_revision_is_open_v1(uuid,uuid)',
  'app.event_prize_schedule_financial_basis_v1(uuid,uuid)','app.resolve_event_prize_schedule_v1(uuid,uuid,jsonb,uuid)',
  'app.require_event_prize_schedule_draft_v1(uuid,uuid,jsonb,jsonb)','app.require_prize_schedule_settlement_write_v1()']loop
  if has_function_privilege('anon',helper,'EXECUTE')or has_function_privilege('authenticated',helper,'EXECUTE')
   or has_function_privilege('service_role',helper,'EXECUTE')then raise exception 'private prize schedule helper ACL drift: %',helper;end if;
 end loop;
 foreach table_name in array array['setup_prize_schedule_streams_v1','setup_prize_schedule_versions_v1','event_prize_schedule_bindings_v1','setup_prize_schedule_conflicts_v1']loop
  foreach role_name in array array['anon','authenticated','service_role']loop
   foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE']loop
    if has_table_privilege(role_name,'app.'||table_name,privilege_name)then raise exception 'private prize schedule table ACL drift: %.% %',role_name,table_name,privilege_name;end if;
   end loop;
  end loop;
 end loop;
 raise notice 'PRIZE_SCHEDULE_V1_SUPPORTED_RESOLUTION_PAYBACK_AND_FINAL_PASSED';
end $$;
set constraints all immediate;
rollback;
