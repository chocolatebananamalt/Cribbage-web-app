-- Disposable local full-schema fixture only; no hosted data.
begin;
insert into auth.users(id,email)values('a2760000-0000-4000-8000-000000000001','declaration-director@test.invalid'),('a2760000-0000-4000-8000-000000000002','declaration-outsider@test.invalid');
insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('b2760000-0000-4000-8000-000000000001','a2760000-0000-4000-8000-000000000001','TEST ONLY event declarations','draft','closed');
insert into app.tournament_roles(tournament_id,profile_id,role)values('b2760000-0000-4000-8000-000000000001','a2760000-0000-4000-8000-000000000001','director');
insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values('c2760000-0000-4000-8000-000000000001','b2760000-0000-4000-8000-000000000001','a2760000-0000-4000-8000-000000000001','local_fixture','b2760000-0000-4000-8000-000000000001',repeat('1',64),'d2760000-0000-4000-8000-000000000001','accepted','{}',now());
insert into app.tournament_setup_revisions(id,tournament_id,version,tournament_name,city,venue,starts_at,ends_at,timezone_name,state_territory,actor_profile_id,operation_receipt_id)values('e2760000-0000-4000-8000-000000000001','b2760000-0000-4000-8000-000000000001',1,'TEST ONLY declarations','Test City','Test Hall','2027-02-03 09:00','2027-02-04 23:59','Pacific/Honolulu','Hawaii','a2760000-0000-4000-8000-000000000001','c2760000-0000-4000-8000-000000000001');
insert into app.tournament_setup_event_versions(id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,style_code,format_code,game_count,entry_fee_cents,muggins_status)values
('f2760000-0000-4000-8000-000000000001','b2760000-0000-4000-8000-000000000001','e2760000-0000-4000-8000-000000000001','d2760000-0000-4000-8000-000000000011',1,'main','Main','2027-02-03 09:00','Pacific/Honolulu','Standard','standard_singles',12,5000,'unset'),
('f2760000-0000-4000-8000-000000000002','b2760000-0000-4000-8000-000000000001','e2760000-0000-4000-8000-000000000001','d2760000-0000-4000-8000-000000000012',2,'consolation','Consolation','2027-02-04 09:00','Pacific/Honolulu','Standard','standard_singles',8,2000,'unset');
do $$declare actor uuid:='a2760000-0000-4000-8000-000000000001';tid uuid:='b2760000-0000-4000-8000-000000000001';mainrow uuid:='d2760000-0000-4000-8000-000000000011';consy uuid:='d2760000-0000-4000-8000-000000000012';req jsonb;result jsonb;schedule jsonb;op uuid:='d2760000-0000-4000-8000-000000000021';begin
 schedule:='{"kind":"regular-prize-cohort-5usd-v3","amountBasis":"total_award","expectedQualifierCount":4,"sourceReference":"TEST ONLY reviewed formula","roundingRule":"automatic-five-dollar-cohort-v3","cohorts":[{"bandStart":1,"bandEnd":1,"weight":4},{"bandStart":2,"bandEnd":2,"weight":3},{"bandStart":3,"bandEnd":4,"weight":2}]}';
 req:=jsonb_build_object('expectedVersion',0,'expectedSettingsFingerprint',app.event_prize_settings_digest_v2(app.event_prize_settings_v2(tid,mainrow)),'schedule',schedule,'reviewed',true,'reason','TEST ONLY explicit event formula');
 result:=public.save_event_prize_declaration_v2(actor,tid,mainrow,req,op);
 if result->>'status'<>'event_prize_declaration_saved_v2' then raise exception 'Main declaration failed %',result;end if;
 if public.save_event_prize_declaration_v2(actor,tid,mainrow,req,op)is distinct from result then raise exception 'Replay changed';end if;
 if public.save_event_prize_declaration_v2(actor,tid,mainrow,req||'{"reason":"changed"}',op)->>'code'<>'idempotency_conflict'then raise exception 'Changed replay accepted';end if;
 result:=public.save_event_prize_declaration_v2(actor,tid,consy,req||jsonb_build_object('expectedSettingsFingerprint',app.event_prize_settings_digest_v2(app.event_prize_settings_v2(tid,consy))),'d2760000-0000-4000-8000-000000000022');
 if result->>'status'<>'event_prize_declaration_saved_v2' then raise exception 'Consolation declaration failed %',result;end if;
 if public.save_event_prize_declaration_v2(actor,tid,mainrow,req,'d2760000-0000-4000-8000-000000000023')->>'code'<>'stale_version'then raise exception 'Stale version accepted';end if;
 if public.save_event_prize_declaration_v2('a2760000-0000-4000-8000-000000000002',tid,mainrow,req,'d2760000-0000-4000-8000-000000000024')->>'code'<>'not_director'then raise exception 'Outsider accepted';end if;
 if public.get_event_prize_declaration_v2('a2760000-0000-4000-8000-000000000002',tid,mainrow)is not null then raise exception 'Outsider read';end if;
 if public.get_event_prize_declaration_v2(actor,tid,mainrow)->>'settingsCurrent'<>'true'then raise exception 'Main not current';end if;
 if public.get_event_prize_declaration_v2(actor,tid,mainrow)->>'accountingReady'<>'false'then raise exception 'Declaration falsely claims accounting readiness';end if;
end$$;
-- Add a newer revision: only Consolation fee changes. Immutable old records remain.
insert into app.tournament_setup_revisions(id,tournament_id,version,tournament_name,city,venue,starts_at,ends_at,timezone_name,state_territory,actor_profile_id,operation_receipt_id)
select 'e2760000-0000-4000-8000-000000000002',tournament_id,2,tournament_name,city,venue,starts_at,ends_at,timezone_name,state_territory,actor_profile_id,operation_receipt_id from app.tournament_setup_revisions where id='e2760000-0000-4000-8000-000000000001';
insert into app.tournament_setup_event_versions(id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,style_code,format_code,game_count,entry_fee_cents,muggins_status)
select case when event_kind='main'then'f2760000-0000-4000-8000-000000000003'::uuid else'f2760000-0000-4000-8000-000000000004'::uuid end,tournament_id,'e2760000-0000-4000-8000-000000000002',client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,style_code,format_code,game_count,case when event_kind='consolation'then 2500 else entry_fee_cents end,muggins_status from app.tournament_setup_event_versions where setup_revision_id='e2760000-0000-4000-8000-000000000001';
do $$declare actor uuid:='a2760000-0000-4000-8000-000000000001';tid uuid:='b2760000-0000-4000-8000-000000000001';begin
 if public.get_event_prize_declaration_v2(actor,tid,'d2760000-0000-4000-8000-000000000011')->>'settingsCurrent'<>'true'then raise exception 'Unrelated Consolation change invalidated Main';end if;
 if public.get_event_prize_declaration_v2(actor,tid,'d2760000-0000-4000-8000-000000000012')->>'settingsCurrent'<>'false'then raise exception 'Changed Consolation fee did not stale own declaration';end if;
 if has_function_privilege('authenticated','public.save_event_prize_declaration_v2(uuid,uuid,uuid,jsonb,uuid)','EXECUTE')then raise exception 'Browser write grant';end if;
 begin update app.setup_prize_schedule_versions_v2 set reason='rewrite';raise exception 'History mutable';exception when raise_exception then if sqlerrm='History mutable'then raise;end if;end;
end$$;
-- Optional activation-binding extension: run when 0280 is included in this local chain.
do $$declare actor uuid:='a2760000-0000-4000-8000-000000000001';tid uuid:='b2760000-0000-4000-8000-000000000001';rid uuid:='e2760000-0000-4000-8000-000000000002';rowid uuid:='d2760000-0000-4000-8000-000000000012';req jsonb;result jsonb;replay jsonb;begin
 if to_regprocedure('app.event_prize_declaration_readiness_v2(uuid,uuid)')is null then return;end if;
 if app.event_prize_declaration_readiness_v2(tid,rid)->>'status'<>'blocked'then raise exception 'Stale own declaration did not block activation';end if;
 insert into app.tournament_setup_official_versions(id,tournament_id,setup_revision_id,profile_id,role)values('e2760000-0000-4000-8000-000000000010',tid,rid,actor,'director');
 result:=public.activate_tournament_setup_v2(actor,tid,rid,2,'d2760000-0000-4000-8000-000000000030');
 if result->>'status'='tournament_setup_activated'or exists(select 1 from app.tournament_setup_activations where tournament_id=tid)then raise exception 'Stale declaration activation partially succeeded %',result;end if;
 select jsonb_build_object('expectedVersion',version,'expectedSettingsFingerprint',app.event_prize_settings_digest_v2(app.event_prize_settings_v2(tid,rowid)),'schedule',schedule_payload,'reason','TEST ONLY reviewed new Consolation fee','reviewed',true)into req from app.setup_prize_schedule_versions_v2 where tournament_id=tid and client_row_id=rowid order by version desc limit 1;
 result:=public.save_event_prize_declaration_v2(actor,tid,rowid,req,'d2760000-0000-4000-8000-000000000031');
 if result->>'status'<>'event_prize_declaration_saved_v2'then raise exception 'Re-declaration failed %',result;end if;
 if app.event_prize_declaration_readiness_v2(tid,rid)->>'status'<>'ready'then raise exception 'Complete current declarations not ready';end if;
 result:=public.activate_tournament_setup_v2(actor,tid,rid,2,'d2760000-0000-4000-8000-000000000032');
 if result->>'status'<>'tournament_setup_activated'then raise exception 'Two-event V2 activation failed %',result;end if;
 if(select count(*)from app.event_prize_schedule_bindings_v2 where tournament_id=tid)<>2 then raise exception 'Wrong per-event binding count';end if;
 if exists(select 1 from app.event_prize_schedule_bindings_v1 where tournament_id=tid)then raise exception 'V2 activation silently created legacy binding';end if;
 replay:=public.activate_tournament_setup_v2(actor,tid,rid,2,'d2760000-0000-4000-8000-000000000032');
 if replay is distinct from result or(select count(*)from app.event_prize_schedule_bindings_v2 where tournament_id=tid)<>2 then raise exception 'Activation replay duplicated bindings';end if;
end$$;
do $$declare actor uuid:='a2760000-0000-4000-8000-000000000001';tid uuid:='b2760000-0000-4000-8000-000000000002';rid uuid:='e2760000-0000-4000-8000-000000000003';rowid uuid:='d2760000-0000-4000-8000-000000000041';req jsonb;result jsonb;begin
 if to_regprocedure('app.event_prize_declaration_readiness_v2(uuid,uuid)')is null then return;end if;
 insert into app.tournaments(id,director_profile_id,name,status,registration_status)values(tid,actor,'TEST ONLY legacy activation after V2 patch','draft','closed');
 insert into app.tournament_roles(tournament_id,profile_id,role)values(tid,actor,'director');
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values('c2760000-0000-4000-8000-000000000002',tid,actor,'local_fixture',tid,repeat('2',64),'d2760000-0000-4000-8000-000000000040','accepted','{}',now());
 insert into app.tournament_setup_revisions(id,tournament_id,version,tournament_name,city,venue,starts_at,ends_at,timezone_name,state_territory,actor_profile_id,operation_receipt_id)
 select rid,tid,1,'TEST ONLY legacy activation',city,venue,starts_at,ends_at,timezone_name,state_territory,actor_profile_id,'c2760000-0000-4000-8000-000000000002' from app.tournament_setup_revisions where id='e2760000-0000-4000-8000-000000000001';
 insert into app.tournament_setup_official_versions(id,tournament_id,setup_revision_id,profile_id,role)values('e2760000-0000-4000-8000-000000000011',tid,rid,actor,'director');
 insert into app.tournament_setup_event_versions(id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,style_code,format_code,game_count,entry_fee_cents,muggins_status)values('f2760000-0000-4000-8000-000000000005',tid,rid,rowid,1,'main','Legacy Main','2027-02-03 09:00','Pacific/Honolulu','Standard','standard_singles',12,5000,'unset');
 select jsonb_build_object('expectedVersion',0,'schedule',schedule_payload,'reason','TEST ONLY old protocol after new migration','reviewed',true)into req from app.setup_prize_schedule_versions_v2 order by recorded_at limit 1;
 result:=public.save_setup_prize_schedule_v1(actor,tid,rowid,req,'d2760000-0000-4000-8000-000000000042');
 if result->>'status'<>'prize_schedule_saved_v1'then raise exception 'Legacy declaration after patch failed %',result;end if;
 result:=public.activate_tournament_setup_v2(actor,tid,rid,1,'d2760000-0000-4000-8000-000000000043');
 if result->>'status'<>'tournament_setup_activated'then raise exception 'Legacy activation after patch failed %',result;end if;
 if(select count(*)from app.event_prize_schedule_bindings_v1 where tournament_id=tid)<>1 or exists(select 1 from app.event_prize_schedule_bindings_v2 where tournament_id=tid)then raise exception 'Legacy activation incorrectly reinterpreted as V2';end if;
end$$;
rollback;

