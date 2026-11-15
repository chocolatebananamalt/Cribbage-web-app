-- Continues the 0274 shared Main/Consolation synthetic receipt fixture.
do $$declare t uuid:='b2740000-0000-4000-8000-000000000001';e uuid:='a2740000-0000-4000-8000-000000000011';r uuid:='a4740000-0000-4000-8000-000000000001';sid uuid;begin
 if app.event_qr_player_is_paid_and_enrolled(t,e,r) is distinct from true then raise exception 'current shared base receipt not paid';end if;
 if app.event_qr_player_is_paid_and_enrolled(t,e,'a4740000-0000-4000-8000-000000000099') is distinct from false then raise exception 'wrong roster paid';end if;
 -- Local collision fixture: independent source tables can legally share a UUID.
 -- The unrelated pooled receipt is current while the shared base receipt goes stale.
 select id into sid from app.multi_event_finance_sources_v1 where tournament_id=t and source_kind='receipt' and roster_entry_id=r;
 insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)values('a4740000-0000-4000-8000-000000000099',t,'director_manual','TEST ONLY collision','test only collision','paper','a2740000-0000-4000-8000-000000000001','c2740000-0000-4000-8000-000000000001');
 insert into app.event_participants(id,tournament_id,event_id,roster_entry_id,status)values('a6740000-0000-4000-8000-000000000099',t,e,'a4740000-0000-4000-8000-000000000099','registered');
 insert into app.multi_event_pool_receipts_v1(id,tournament_id,roster_entry_id,amount_minor,components,bindings,reason,actor_id,operation_receipt_id)values(sid,t,'a4740000-0000-4000-8000-000000000099',5000,jsonb_build_array(jsonb_build_object('eventId',e,'baseMinor',5000,'q','[]'::jsonb,'side','[]'::jsonb)),jsonb_build_array(jsonb_build_object('eventId',e,'activationId','a3740000-0000-4000-8000-000000000001','setupEventVersionId','f2740000-0000-4000-8000-000000000001','participantId','a6740000-0000-4000-8000-000000000099')),'TEST ONLY SYNTHETIC: collision fixture','a2740000-0000-4000-8000-000000000001','c2740000-0000-4000-8000-000000000001');
 if app.multi_event_pool_receipt_current_v1('a2740000-0000-4000-8000-000000000001',t,sid) is distinct from true then raise exception 'collision fixture pooled source not current';end if;
 update app.events set operational_state='retired' where tournament_id=t and id='a2740000-0000-4000-8000-000000000012';
 if app.event_qr_player_is_paid_and_enrolled(t,e,r) is distinct from false then raise exception 'stale shared source accepted';end if;
end$$;
rollback;
