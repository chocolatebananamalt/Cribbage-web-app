-- Disposable local test of the older single-event API against V2 declarations.
begin;
do $$declare a uuid:='a2900000-0000-4000-8000-000000000001';t uuid:='b2930000-0000-4000-8000-000000000001';rid uuid:='e2930000-0000-4000-8000-000000000001';rowid uuid:='d2930000-0000-4000-8000-000000000001';req jsonb;v jsonb;pins jsonb;begin
 insert into app.tournaments(id,director_profile_id,name,status,registration_status)values(t,a,'TEST ONLY old single-event route','draft','closed');
 insert into app.tournament_roles(tournament_id,profile_id,role)values(t,a,'director');
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values('c2930000-0000-4000-8000-000000000001',t,a,'local_fixture',t,repeat('2',64),'d2930000-0000-4000-8000-000000000002','accepted','{}',now());
 insert into app.tournament_setup_revisions(id,tournament_id,version,tournament_name,city,venue,starts_at,ends_at,timezone_name,state_territory,actor_profile_id,operation_receipt_id)values(rid,t,1,'TEST ONLY single','Test City','Test Hall','2027-02-03 09:00','2027-02-04 23:59','Pacific/Honolulu','Hawaii',a,'c2930000-0000-4000-8000-000000000001');
 insert into app.tournament_setup_official_versions(id,tournament_id,setup_revision_id,profile_id,role)values('e2930000-0000-4000-8000-000000000002',t,rid,a,'director');
 insert into app.tournament_setup_event_versions(id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,style_code,format_code,game_count,entry_fee_cents,muggins_status)values('f2930000-0000-4000-8000-000000000001',t,rid,rowid,1,'main','Main','2027-02-03 09:00','Pacific/Honolulu','Standard','standard_singles',12,5000,'unset');
 select jsonb_build_object('expectedVersion',0,'expectedSettingsFingerprint',app.event_prize_settings_digest_v2(app.event_prize_settings_v2(t,rowid)),'schedule',schedule_payload,'reason','TEST ONLY single-event declaration','reviewed',true)into req from app.setup_prize_schedule_versions_v2 where tournament_id='b2900000-0000-4000-8000-000000000001' order by recorded_at limit 1;
 v:=public.save_event_prize_declaration_v2(a,t,rowid,req,'d2930000-0000-4000-8000-000000000003');if v->>'status'<>'event_prize_declaration_saved_v2' then raise exception 'single-event declaration %',v;end if;
 v:=public.activate_standard_singles_setup_v1(a,t,rid,1,'d2930000-0000-4000-8000-000000000004');
 if v->>'status'='setup_activated' or v->>'status'='tournament_setup_activated' or exists(select 1 from app.tournament_setup_activations where tournament_id=t) then raise exception 'old single-event activation bypassed pins %',v;end if;
 pins:=app.current_event_prize_activation_pins_v1(t,rid,1);v:=public.finalize_tournament_setup_pinned_v2(a,t,rid,1,true,pins,'d2930000-0000-4000-8000-000000000005');
 if v->>'status'<>'tournament_setup_activated' or (select count(*)from app.event_prize_schedule_bindings_v2 where tournament_id=t)<>1 then raise exception 'pinned single-event activation failed %',v;end if;
 begin
  insert into app.tournament_setup_activations(id,tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,operation_receipt_id)
   select 'a2930000-0000-4000-8000-000000000099',tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,'c2930000-0000-4000-8000-000000000001' from app.tournament_setup_activations where tournament_id=t;
  raise exception 'forged_activation_accepted';
 exception when raise_exception then if sqlerrm<>'declaration_pins_required' then raise;end if;end;
end$$;
rollback;
