-- Rollback-only synthetic lifecycle. Qualification currentness is stubbed: this
-- tests sidecar decisions and guards, not scoring or qualification verification.
begin;
create temp table fixture_start_rejection(value jsonb);
create or replace function app.qualification_resolution_snapshot_current_v1(p_result_id uuid) returns boolean language sql stable security definer set search_path='' as $$select true$$;
select set_config('request.jwt.claim.role','service_role',true);
do $$
declare tid uuid:='b2900000-0000-4000-8000-000000000001'; actor uuid:='a2900000-0000-4000-8000-000000000001'; main_id uuid; child uuid; rules uuid; rec uuid:=extensions.gen_random_uuid(); sched uuid:=extensions.gen_random_uuid(); csched uuid:=extensions.gen_random_uuid(); qid uuid:=extensions.gen_random_uuid(); rids uuid[]:='{}'; pids uuid[]:='{}'; n int; r uuid;p uuid; payload jsonb; a jsonb;b jsonb; witness jsonb; v uuid; started uuid:=extensions.gen_random_uuid();
begin
 select main_event_id,consolation_event_id into main_id,child from app.consolation_main_event_bindings_v1 where tournament_id=tid order by main_event_id limit 1;
 select ruleset_version_id into rules from app.events where id=main_id;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(rec,tid,actor,'synthetic_fixture',tid,repeat('a',64),extensions.gen_random_uuid(),'accepted','{}',clock_timestamp());
 for n in 1..17 loop
  r:=extensions.gen_random_uuid();p:=extensions.gen_random_uuid();rids:=array_append(rids,r);pids:=array_append(pids,p);
  insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id) values(r,tid,'director_manual','TEST ONLY '||n,'test only '||n,'paper',actor,rec);
  insert into app.event_participants(id,tournament_id,event_id,roster_entry_id,table_seat,status) values(p,tid,main_id,r,chr(65+(n-1)/4)||'-'||(((n-1)%4)+1)::text,'checked_in');
 end loop;
 insert into app.event_participants(tournament_id,event_id,roster_entry_id,table_seat,status) values(tid,child,rids[5],'A-1','checked_in'),(tid,child,rids[6],'A-2','checked_in');
 insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id) values(sched,tid,main_id,'director_entry',12,17,102,repeat('a',64),actor,rec),(csched,tid,child,'director_entry',8,2,8,repeat('b',64),actor,rec);
 insert into app.qualification_result_versions(id,tournament_id,event_id,version,ruleset_version_id,schedule_publication_id,participant_count,qualifier_count,high_non_qualifier_participant_id,standings_digest,finalized_by_profile_id,operation_receipt_id,finalized_at) values(qid,tid,main_id,1,rules,sched,17,5,pids[6],repeat('c',64),actor,rec,clock_timestamp());
 for n in 1..17 loop
  insert into app.qualification_result_rows(result_version_id,tournament_id,event_id,participant_id,ranking_ordinal,numeric_rank,tied,display_name_snapshot,verified_games,game_points,games_won,plus_points,minus_points,net_spread_points,qualification_status) values(qid,tid,main_id,pids[n],n,n,false,'TEST ONLY '||n,12,case when n<=5 then 24 else 0 end,case when n<=5 then 12 else 0 end,0,0,0,case when n<=5 then 'qualified' when n=6 then 'high_non_qualifier' else 'not_qualified' end);
 end loop;
 if not app.linked_main_series_domain_v1(tid,main_id,qid) then raise exception 'synthetic domain unavailable';end if;
 declare teamop uuid:=extensions.gen_random_uuid(); teamstart uuid:=extensions.gen_random_uuid(); teamreq uuid:=extensions.gen_random_uuid(); teamresult jsonb;begin
  teamresult:=public.start_event_team_play_v1(actor,tid,child,teamstart,teamreq,teamop);
  if teamresult->>'code'<>'linked_consy_team_eligibility_unsupported' or public.start_event_team_play_v1(actor,tid,child,teamstart,teamreq,teamop)<>teamresult or not exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=teamop and outcome='rejected') then raise exception 'team Start rejection/replay %',teamresult;end if;
 end;
 begin
  insert into app.consolation_playoff_outcome_versions_v1(tournament_id,event_id) values(tid,child);
  raise exception 'linked legacy consolation source unexpectedly accepted';
 exception when raise_exception then if sqlerrm<>'linked_consy_v2_source_required' then raise;end if;end;
 begin
  insert into app.event_team_starts(tournament_id,event_id) values(tid,child);
  raise exception 'linked team Start unexpectedly accepted';
 exception when raise_exception then if sqlerrm<>'linked_consy_team_eligibility_unsupported' then raise;end if;end;
 begin
  insert into app.event_team_starts(tournament_id,event_id) values(tid,main_id);
  raise exception 'incomplete unlinked team Start unexpectedly accepted';
 exception when raise_exception then if sqlerrm<>'team event is not ready to start' then raise;end if;end;
 if app.linked_consy_eligibility_v1(tid,child,rids[6])->>'source'<>'nonqualifier' or app.linked_consy_eligibility_v1(tid,child,rids[5])->>'status'<>'pending' then raise exception 'initial classification';end if;
 b:=public.start_event_play_v1(actor,tid,child,csched,repeat('a',64),2,8,true,extensions.gen_random_uuid());
 if b->>'code'<>'linked_consy_eligibility_pending' then raise exception 'pending Start preflight %',b;end if;
 insert into fixture_start_rejection values(b);
 payload:=jsonb_build_object('qualificationId',qid,'slot',1,'expectedVersion',0,'winnerId',pids[4],'resultType','played','sourceNote','synthetic director review','synthetic',true,'reviewed',true);
 v:=extensions.gen_random_uuid();a:=public.record_linked_main_series_v1(actor,tid,main_id,payload,v);
 if a->>'status'<>'recorded' or a->>'loserId'<>pids[5]::text then raise exception 'slot1 %',a;end if;
 b:=public.record_linked_main_series_v1(actor,tid,main_id,payload,v);if a<>b then raise exception 'replay mismatch';end if;
 update app.tournaments set status='pending_finalization' where id=tid;
 b:=public.record_linked_main_series_v1(actor,tid,main_id,payload,v);if a<>b then raise exception 'closed tournament exact replay changed %',b;end if;
 b:=public.record_linked_main_series_v1(actor,tid,main_id,payload,extensions.gen_random_uuid());if b->>'code'<>'tournament_unavailable' then raise exception 'new closed tournament write accepted %',b;end if;
 update app.tournaments set status='open' where id=tid;
 b:=public.record_linked_main_series_v1(actor,tid,main_id,jsonb_set(payload,'{winnerId}',to_jsonb(pids[5])),v);if b->>'code'<>'idempotency_conflict' then raise exception 'replay conflict';end if;
 b:=public.record_linked_main_series_v1(actor,tid,main_id,jsonb_set(payload,'{expectedVersion}','null'::jsonb),extensions.gen_random_uuid());if b->>'code'<>'invalid_request' or (select count(*) from app.linked_main_series_v1 where event_id=main_id and slot=1)<>1 then raise exception 'null CAS accepted %',b;end if;
 witness:=app.linked_consy_eligibility_v1(tid,child,rids[5]);if witness->>'source'<>'played_loss' then raise exception 'played loss not eligible %',witness;end if;
 payload:=jsonb_build_object('qualificationId',qid,'slot',3,'expectedVersion',0,'winnerId',pids[2],'resultType','forfeit','sourceNote','synthetic director review','synthetic',true,'reviewed',true);
 b:=public.record_linked_main_series_v1(actor,tid,main_id,payload,extensions.gen_random_uuid());if b->>'status'<>'recorded' then raise exception 'forfeit %',b;end if;
 if app.linked_consy_eligibility_v1(tid,child,rids[3])->>'status'<>'pending' then raise exception 'forfeit counted as played';end if;
 declare
  whole jsonb:=jsonb_build_array(jsonb_build_object('winnerId',pids[4],'loserId',pids[5],'evidenceNote','synthetic 1'),jsonb_build_object('winnerId',pids[1],'loserId',pids[4],'evidenceNote','synthetic 2'),jsonb_build_object('winnerId',pids[2],'loserId',pids[3],'evidenceNote','synthetic 3'),jsonb_build_object('winnerId',pids[1],'loserId',pids[2],'evidenceNote','synthetic 4'));
  fullreq jsonb;fullop uuid:=extensions.gen_random_uuid();first jsonb;legacyop uuid:=extensions.gen_random_uuid();
 begin
  fullreq:=jsonb_build_object('qualificationResultVersionId',qid,'expectedVersion',0,'sourceDigest',app.five_qualifier_playoff_source_v4(tid,main_id,qid),'series',whole,'reason','synthetic test','reviewed',true);
  first:=public.record_standard_singles_playoff_outcomes_v4(actor,tid,main_id,fullreq,fullop);
  if first->>'code'<>'linked_series_correction_conflict' or public.record_standard_singles_playoff_outcomes_v4(actor,tid,main_id,fullreq,fullop)<>first or not exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=fullop and outcome='rejected') then raise exception 'whole V4 terminal/replay %',first;end if;
  first:=public.record_standard_singles_playoff_placements_v2(actor,tid,main_id,qid,0,'[]',legacyop);
  if first->>'code'<>'linked_series_correction_conflict' or public.record_standard_singles_playoff_placements_v2(actor,tid,main_id,qid,0,'[]',legacyop)<>first or not exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=legacyop and outcome='rejected') then raise exception 'legacy terminal/replay %',first;end if;
 end;
 begin
  insert into app.standard_singles_playoff_result_versions(tournament_id,event_id) values(tid,main_id);
  raise exception 'legacy placement unexpectedly accepted';
 exception when raise_exception then if sqlerrm<>'linked_series_correction_conflict' then raise;end if;end;
 begin
  insert into app.playoff_outcome_versions_v4(tournament_id,event_id,qualification_result_version_id,version,source_digest,request_payload,series,outcomes,bracket_source_version,mrp_source_version,recorded_by,operation_receipt_id)
  values(tid,main_id,qid,1,repeat('a',64),'{}',jsonb_build_array(jsonb_build_object('winnerId',pids[4],'loserId',pids[5]),'{}'::jsonb,jsonb_build_object('winnerId',pids[2],'loserId',pids[3]),'{}'::jsonb),jsonb_build_array('{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb),'acc-rulebook-2025-effective-2025-08-01','acc-published-mrp-2016-08-01',actor,rec);
  raise exception 'forfeit final unexpectedly accepted';
 exception when raise_exception then if sqlerrm<>'linked_series_correction_conflict' then raise;end if;end;
 if app.linked_consy_eligibility_v1(tid,child,rids[5])->'witnessIds'<>witness->'witnessIds' then raise exception 'unrelated slot changed witness';end if;

 insert into app.event_play_starts(id,tournament_id,event_id,schedule_publication_id,participant_snapshot_digest,participant_count,game_count,schedule_match_count,started_by_profile_id,operation_receipt_id,start_source,started_at) values(started,tid,child,csched,repeat('a',64),2,8,8,actor,rec,'official',clock_timestamp());
 if not exists(select 1 from app.linked_consy_start_eligibility_v1 where start_id=started and roster_entry_id=rids[5] and director_declared_synthetic) then raise exception 'synthetic provenance missing';end if;
 if (select count(*) from app.linked_consy_start_eligibility_v1 where start_id=started)<>2 then raise exception 'start snapshot missing';end if;
 payload:=jsonb_build_object('qualificationId',qid,'slot',1,'expectedVersion',1,'winnerId',pids[5],'resultType','played','sourceNote','synthetic correction','synthetic',true,'reviewed',true);
 b:=public.record_linked_main_series_v1(actor,tid,main_id,payload,extensions.gen_random_uuid());if b->>'code'<>'dependent_evidence_conflict' then raise exception 'start correction allowed %',b;end if;
 payload:=jsonb_build_object('qualificationId',qid,'slot',2,'expectedVersion',0,'winnerId',pids[1],'resultType','played','sourceNote','synthetic later round','synthetic',true,'reviewed',true);
 b:=public.record_linked_main_series_v1(actor,tid,main_id,payload,extensions.gen_random_uuid());if b->>'status'<>'recorded' then raise exception 'later round blocked %',b;end if;
 if app.linked_consy_eligibility_v1(tid,child,rids[4])->>'status'<>'pending' then raise exception 'post-start loss accepted';end if;
 declare q4 uuid:=extensions.gen_random_uuid();op4 uuid:=extensions.gen_random_uuid();req4 jsonb;res4 jsonb;whole4 jsonb;begin
  insert into app.qualification_result_versions(id,tournament_id,event_id,version,ruleset_version_id,schedule_publication_id,participant_count,qualifier_count,high_non_qualifier_participant_id,standings_digest,finalized_by_profile_id,operation_receipt_id,finalized_at)
   select q4,tournament_id,event_id,2,ruleset_version_id,schedule_publication_id,participant_count,4,pids[5],standings_digest,finalized_by_profile_id,operation_receipt_id,clock_timestamp() from app.qualification_result_versions where id=qid;
  insert into app.qualification_result_rows(result_version_id,tournament_id,event_id,participant_id,ranking_ordinal,numeric_rank,tied,display_name_snapshot,verified_games,game_points,games_won,plus_points,minus_points,net_spread_points,qualification_status)
   select q4,tournament_id,event_id,participant_id,ranking_ordinal,numeric_rank,tied,display_name_snapshot,verified_games,game_points,games_won,plus_points,minus_points,net_spread_points,case when ranking_ordinal<=4 then 'qualified' when ranking_ordinal=5 then 'high_non_qualifier' else 'not_qualified' end from app.qualification_result_rows where result_version_id=qid;
  req4:=jsonb_build_object('qualificationId',q4,'slot',1,'expectedVersion',0,'winnerId',pids[1],'resultType','forfeit','sourceNote','TEST ONLY forfeit','synthetic',true,'reviewed',true);
  res4:=public.record_linked_main_series_v1(actor,tid,main_id,req4,extensions.gen_random_uuid());if res4->>'status'<>'recorded' then raise exception 'four qualifier forfeit setup %',res4;end if;
  whole4:=jsonb_build_array(jsonb_build_object('winnerId',pids[1],'loserId',pids[4],'evidenceNote','synthetic 1'),jsonb_build_object('winnerId',pids[2],'loserId',pids[3],'evidenceNote','synthetic 2'),jsonb_build_object('winnerId',pids[1],'loserId',pids[2],'evidenceNote','synthetic 3'));
  res4:=public.record_standard_singles_playoff_outcomes_v3(actor,tid,main_id,q4,0,whole4,op4);
  if res4->>'code'<>'linked_series_correction_conflict' or public.record_standard_singles_playoff_outcomes_v3(actor,tid,main_id,q4,0,whole4,op4)<>res4 or not exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op4 and outcome='rejected') then raise exception 'whole V3 terminal/replay %',res4;end if;
 end;
end$$;
select jsonb_build_object('type',operation_type,'value',response_payload) from app.operation_receipts where tournament_id='b2900000-0000-4000-8000-000000000001' and response_payload->>'code'='linked_series_correction_conflict';
select jsonb_build_object('type','event_start','value',value) from fixture_start_rejection;
rollback;













