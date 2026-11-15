-- Disposable synthetic fixture only. The start and assessment are seeded to test
-- the reader against an actual immutable sanctioning snapshot; they do not
-- represent a played tournament or an approved financial settlement.
insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id)
values('c2790000-0000-4000-8000-000000000001','b2740000-0000-4000-8000-000000000001','a2740000-0000-4000-8000-000000000011','director_entry',12,20,120,repeat('2',64),'a2740000-0000-4000-8000-000000000001','c2740000-0000-4000-8000-000000000001');
insert into app.event_play_starts(id,tournament_id,event_id,schedule_publication_id,participant_snapshot_digest,participant_count,game_count,schedule_match_count,started_by_profile_id,operation_receipt_id,start_source)
values('c2790000-0000-4000-8000-000000000002','b2740000-0000-4000-8000-000000000001','a2740000-0000-4000-8000-000000000011','c2790000-0000-4000-8000-000000000001',repeat('3',64),20,12,120,'a2740000-0000-4000-8000-000000000001','c2740000-0000-4000-8000-000000000001','official');
insert into app.event_sanctioning_fee_snapshots(tournament_id,event_id,event_play_start_id,event_kind,rate_cents,eligible_participant_count,total_cents,rate_source,setup_revision_id)
values('b2740000-0000-4000-8000-000000000001','a2740000-0000-4000-8000-000000000011','c2790000-0000-4000-8000-000000000002','main',300,20,6000,'setup','e2740000-0000-4000-8000-000000000001');
do $$declare a uuid:='a2740000-0000-4000-8000-000000000001';t uuid:='b2740000-0000-4000-8000-000000000001';e uuid:='a2740000-0000-4000-8000-000000000011';r jsonb;s jsonb;req jsonb;classes jsonb;begin
 r:=public.record_multi_event_finance_source_v1(a,t,jsonb_build_object('kind','expense','rosterEntryId',null,'amountMinor',7400,'allocations',jsonb_build_array(jsonb_build_object('eventId',e,'amountMinor',6000),jsonb_build_object('eventId','a2740000-0000-4000-8000-000000000012','amountMinor',1400)),'reason','TEST ONLY SYNTHETIC: shared expense','reviewed',true),'d2790000-0000-4000-8000-000000000001');
 if r->>'status'<>'multi_event_source_recorded' then raise exception 'expense remainder %',r;end if;
 s:=public.get_multi_event_synthetic_event_sources_v1(a,t,e);
 select jsonb_agg(jsonb_build_object('sourceId',x->>'id','category',case when (x->>'amountMinor')::integer=6000 then 'sanctioning' else 'operating' end,'amountMinor',(x->>'amountMinor')::integer)) into classes from jsonb_array_elements(s->'expenseEvidence')x;
 req:=jsonb_build_object('expectedVersion',0,'sourceDigest',s->>'sourceDigest','classifications',classes,'reason','TEST ONLY SYNTHETIC: classification review','reviewed',true);
 r:=public.review_multi_event_expenses_v1(a,t,e,req,'d2790000-0000-4000-8000-000000000002');
 if r->>'status'<>'synthetic_expenses_classified' or r->'facts'->>'sanctioningMinor'<>'6000' or r->'facts'->>'expenseMinor'<>'6300' or r->>'moneyMoved'<>'false' then raise exception 'review failed %',r;end if;
 if public.review_multi_event_expenses_v1(a,t,e,req,'d2790000-0000-4000-8000-000000000002')<>r then raise exception 'review replay changed';end if;
 s:=public.get_classified_multi_event_sources_v1(a,t,e);
 if s->>'status'<>'available' or s->>'accountingAvailable'<>'false' then raise exception 'classified reader %',s;end if;
 r:=public.record_multi_event_finance_source_v1(a,t,jsonb_build_object('kind','expense','rosterEntryId',null,'amountMinor',100,'allocations',jsonb_build_array(jsonb_build_object('eventId',e,'amountMinor',100)),'reason','TEST ONLY SYNTHETIC: later expense','reviewed',true),'d2790000-0000-4000-8000-000000000003');
 if r->>'status'<>'multi_event_source_recorded' then raise exception 'later expense %',r;end if;
 s:=public.get_classified_multi_event_sources_v1(a,t,e);
 if not(s->'blockers'?'expense_classification_stale') then raise exception 'changed source not stale %',s;end if;
end$$;
rollback;
