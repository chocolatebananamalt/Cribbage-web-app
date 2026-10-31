-- DISPOSABLE LOCAL DATABASE ONLY. Load proposal0240 inside this transaction before fixture inserts.
-- Executed in the approved disposable fixture on 2026-10-27; see quality evidence. Baseline through0239.
-- Rollback-only synthetic scaffold; not hosted tournament or played-game evidence.
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
\ir ../docs/quality/2026-10-27-proposed-0240-playoff-outcomes-v3.sql
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
do $$ declare actor uuid:='a1310000-0000-4000-8000-000000000001'; tid uuid:='b1310000-0000-4000-8000-000000000001'; eid uuid:='11310000-0000-4000-8000-000000000001'; q uuid:='a2400000-0000-4000-8000-000000000001';
 p1 uuid:='41310000-0000-4000-8000-000000000001';p2 uuid:='41310000-0000-4000-8000-000000000002';p3 uuid:='41310000-0000-4000-8000-000000000003';p4 uuid:='41310000-0000-4000-8000-000000000004';
 payload jsonb; bad jsonb; first_result jsonb; response jsonb; derived jsonb; k uuid:='a2400000-0000-4000-8000-000000000002';
begin
 payload:=jsonb_build_array(jsonb_build_object('winnerId',p1,'loserId',p4,'evidenceNote','TEST ONLY synthetic semifinal 1'),jsonb_build_object('winnerId',p2,'loserId',p3,'evidenceNote','TEST ONLY synthetic semifinal 2'),jsonb_build_object('winnerId',p1,'loserId',p2,'evidenceNote','TEST ONLY synthetic final'));
 derived:=app.derive_four_player_playoff_v3(q,payload);
 if derived->0->>'totalMrp'<>'97' or derived->1->>'totalMrp'<>'76' or derived->2->>'totalMrp'<>'12' or derived->3->>'totalMrp'<>'12'
   or derived->2->>'bandStart'<>'3' or derived->2->>'bandEnd'<>'4' or derived->3->>'bandStart'<>'3' then raise exception 'source oracle or shared band failed';end if;
 bad:=jsonb_set(payload,'{2,loserId}',to_jsonb(p3));
 if app.derive_four_player_playoff_v3(q,bad) is not null then raise exception 'wrong finalist accepted';end if;
 if app.derive_four_player_playoff_v3(q,jsonb_build_array(payload->1,payload->0,payload->2)) is not null then raise exception 'wrong seed slots accepted';end if;
 if app.derive_four_player_playoff_v3(q,payload||jsonb_build_array(payload->2)) is not null then raise exception 'extra series accepted';end if;
 bad:=jsonb_set(payload,'{0,playedMatchWins}','2');
 if app.derive_four_player_playoff_v3(q,bad) is not null then raise exception 'client derived claim accepted';end if;
 response:=public.record_standard_singles_playoff_outcomes_v3('a1310000-0000-4000-8000-000000000006',tid,eid,q,0,payload,k);
 if response->>'code'<>'not_director' then raise exception 'outsider write accepted';end if;
 if public.get_standard_singles_playoff_outcome_workspace_v3('a1310000-0000-4000-8000-000000000006',tid,eid) is not null then raise exception 'outsider read accepted';end if;
 if public.get_standard_singles_playoff_outcome_reconciliation_v3('a1310000-0000-4000-8000-000000000006',tid,eid,k) is not null then raise exception 'outsider reconciliation accepted';end if;
 response:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,null,payload,'a2400000-0000-4000-8000-000000000008');
 if response->>'code'<>'stale_version' then raise exception 'null expected version accepted';end if;
 if public.get_standard_singles_playoff_outcome_reconciliation_v3(actor,'b1310000-0000-4000-8000-000000000099',eid,k) is not null then raise exception 'wrong tournament reconciliation accepted';end if;
 first_result:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,0,payload,k);
 if first_result->>'status'<>'playoff_outcomes_recorded' then raise exception 'first v3 save failed: %',first_result;end if;
 response:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,0,payload,k);
 if response<>first_result then raise exception 'exact accepted replay failed';end if;
 response:=public.get_standard_singles_playoff_outcome_reconciliation_v3(actor,tid,eid,k);
 if response->>'authorized'<>'true' or response->'result'<>first_result then raise exception 'reconciliation receipt failed';end if;
 response:=public.get_standard_singles_playoff_outcome_workspace_v3(actor,tid,eid);
 if response->'result'->>'bracketSourceVersion'<>'acc-rulebook-2025-effective-2025-08-01' or response->'result'->>'mrpSourceVersion'<>'acc-published-mrp-2016-08-01' then raise exception 'source readback failed';end if;
 response:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,1,jsonb_set(payload,'{2,loserId}',to_jsonb(p3)),'a2400000-0000-4000-8000-000000000007');
 if response->>'code'<>'invalid_series' or (select count(*) from app.playoff_outcome_versions_v3 where event_id=eid)<>1 then raise exception 'malformed writer created version';end if;
 if not exists(select 1 from app.operation_receipts r join app.audit_events a on a.operation_receipt_id=r.id where r.client_operation_id='a2400000-0000-4000-8000-000000000007' and r.outcome='rejected') then raise exception 'malformed rejection receipt audit missing';end if;
 response:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,0,bad,k);
 if response->>'code'<>'idempotency_conflict' then raise exception 'changed key did not conflict';end if;
 response:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,0,payload,'a2400000-0000-4000-8000-000000000003');
 if response->>'code'<>'stale_version' then raise exception 'stale version accepted';end if;
 response:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,0,payload,'a2400000-0000-4000-8000-000000000003');
 if response->>'code'<>'stale_version' then raise exception 'rejected replay failed';end if;
 payload:=jsonb_set(jsonb_set(payload,'{2,winnerId}',to_jsonb(p2)),'{2,loserId}',to_jsonb(p1));
 response:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,1,payload,'a2400000-0000-4000-8000-000000000004');
 if response->>'version'<>'2' then raise exception 'append correction failed';end if;
 if (select outcomes->0->>'totalMrp' from app.playoff_outcome_versions_v3 where id=(response->>'resultId')::uuid)<>'76' then raise exception 'changed final did not recalculate';end if;
 if (select supersedes_id from app.playoff_outcome_versions_v3 where id=(response->>'resultId')::uuid)<>(first_result->>'resultId')::uuid then raise exception 'correction history lost';end if;
 begin update app.playoff_outcome_versions_v3 set outcomes='[]' where id=(first_result->>'resultId')::uuid;raise exception 'immutable update accepted';
 exception when others then if sqlerrm='immutable update accepted' then raise;end if;end;
 begin delete from app.playoff_outcome_versions_v3 where id=(first_result->>'resultId')::uuid;raise exception 'immutable delete accepted';
 exception when others then if sqlerrm='immutable delete accepted' then raise;end if;end;
 update app.tournaments set status='archived' where id=tid;
 if public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,0,jsonb_set(jsonb_set(payload,'{2,winnerId}',to_jsonb(p1)),'{2,loserId}',to_jsonb(p2)),k)<>first_result then raise exception 'closed exact replay failed';end if;
 response:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,2,payload,'a2400000-0000-4000-8000-000000000005');
 if response->>'code'<>'tournament_unavailable' then raise exception 'new closed write accepted';end if;
 if exists(select 1 from app.standard_singles_playoff_result_versions where event_id=eid)
 or exists(select 1 from app.standard_singles_settlement_drafts where event_id=eid) then raise exception 'legacy or settlement side effect';end if;
 if (select count(*) from app.playoff_outcome_versions_v3 where event_id=eid)<>2 then raise exception 'duplicate outcome version';end if;
 if exists(select 1 from app.playoff_outcome_versions_v3 v left join app.audit_events a on a.operation_receipt_id=v.operation_receipt_id where v.event_id=eid and a.id is null) then raise exception 'missing receipt-bound audit';end if;
 update app.tournaments set status='open' where id=tid;
 insert into app.standard_singles_playoff_result_versions(id,tournament_id,event_id,qualification_result_version_id,version,placement_count,recorded_by_profile_id,operation_receipt_id,recorded_at)
  values('a2400000-0000-4000-8000-000000000009',tid,eid,q,1,4,actor,'c1310000-0000-4000-8000-000000000001',now());
 response:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,eid,q,2,payload,'a2400000-0000-4000-8000-000000000006');
 if response->>'code'<>'legacy_conflict' then raise exception 'legacy conflict accepted';end if;
 response:=public.get_standard_singles_playoff_outcome_workspace_v3(actor,tid,eid);
 if response->>'canRecord'<>'false' or response->>'blocker'<>'legacy_conflict' then raise exception 'reader blocker parity failed';end if;
end $$;
do $$ declare routine record; role_name text; privilege text; expected boolean; begin
 if has_function_privilege('anon','public.record_standard_singles_playoff_outcomes_v3(uuid,uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE')
 or has_function_privilege('authenticated','public.record_standard_singles_playoff_outcomes_v3(uuid,uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE')
 or not has_function_privilege('service_role','public.record_standard_singles_playoff_outcomes_v3(uuid,uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE')
 or has_function_privilege('service_role','public.record_standard_singles_playoff_placements_v1(uuid,uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE')
 or has_function_privilege('service_role','public.record_standard_singles_playoff_placements_v2(uuid,uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE') then raise exception 'ACL boundary failed';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  and p.proname in ('save_standard_singles_settlement_draft_v1','save_standard_singles_settlement_draft_v2','save_standard_singles_settlement_draft_v3','save_standard_singles_settlement_draft_v4','finalize_standard_singles_settlement_manual_v1')
  and has_function_privilege('service_role',p.oid,'EXECUTE')) then raise exception 'legacy settlement still writable';end if;
 for routine in select p.oid,p.proname,p.proconfig,pg_get_userbyid(p.proowner) owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
   (n.nspname='public' and p.proname in ('record_standard_singles_playoff_outcomes_v3','get_standard_singles_playoff_outcome_workspace_v3','get_standard_singles_playoff_outcome_reconciliation_v3'))
   or (n.nspname='app' and p.proname in ('derive_four_player_playoff_v3','playoff_outcome_blocker_v3')) loop
  if routine.owner<>'postgres' or routine.proconfig is distinct from array['search_path=""'] then raise exception 'owner search path boundary failed';end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   expected:=role_name='service_role' and routine.proname not in ('derive_four_player_playoff_v3','playoff_outcome_blocker_v3');
   if has_function_privilege(role_name,routine.oid,'EXECUTE')<>expected then raise exception 'RPC ACL matrix failed';end if;
  end loop;
 end loop;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relname='playoff_outcome_versions_v3' and c.relrowsecurity and c.relforcerowsecurity) then raise exception 'RLS boundary failed';end if;
 foreach role_name in array array['anon','authenticated','service_role'] loop
  foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
   if has_table_privilege(role_name,'app.playoff_outcome_versions_v3',privilege) then raise exception 'direct table privilege exposed';end if;
  end loop;
 end loop;
end $$;
savepoint playoff_outcomes_anon_rpc;
set local role anon;
do $$ begin
 begin perform public.record_standard_singles_playoff_outcomes_v3('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','a2400000-0000-4000-8000-000000000001',0,'[]'::jsonb,'a2400000-0000-4000-8000-000000000099'); raise exception 'anon RPC executed'; exception when insufficient_privilege then null; end;
end $$;
rollback to savepoint playoff_outcomes_anon_rpc;
savepoint playoff_outcomes_authenticated_rpc;
set local role authenticated;
do $$ begin
 begin perform public.record_standard_singles_playoff_outcomes_v3('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','a2400000-0000-4000-8000-000000000001',0,'[]'::jsonb,'a2400000-0000-4000-8000-000000000099'); raise exception 'authenticated RPC executed'; exception when insufficient_privilege then null; end;
end $$;
rollback to savepoint playoff_outcomes_authenticated_rpc;
savepoint playoff_outcomes_service_legacy_writer;
set local role service_role;
do $$ begin
 begin perform public.record_standard_singles_playoff_placements_v2('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','a2400000-0000-4000-8000-000000000001',0,'[]'::jsonb,'a2400000-0000-4000-8000-000000000099'); raise exception 'revoked legacy writer executed'; exception when insufficient_privilege then null; end;
end $$;
do $$ begin
 begin perform 1 from app.playoff_outcome_versions_v3; raise exception 'service direct SELECT executed'; exception when insufficient_privilege then null; end;
 begin insert into app.playoff_outcome_versions_v3 default values; raise exception 'service direct INSERT executed'; exception when insufficient_privilege then null; end;
 begin update app.playoff_outcome_versions_v3 set series=series where false; raise exception 'service direct UPDATE executed'; exception when insufficient_privilege then null; end;
 begin delete from app.playoff_outcome_versions_v3 where false; raise exception 'service direct DELETE executed'; exception when insufficient_privilege then null; end;
end $$;
rollback to savepoint playoff_outcomes_service_legacy_writer;
set constraints all immediate;
rollback;
