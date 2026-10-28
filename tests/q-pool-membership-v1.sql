-- Local rollback proof, synthetic foundation, actual membership/allocation and payment RPCs.
begin;
do $$begin if current_database()<>'fixture_qpool' then raise exception 'Disposable fixture_qpool required';end if;end $$;
\ir q-pool-membership-seed.sql
create function pg_temp.assert(ok boolean,note text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',note;end if;end $$;
create temporary table q_requests(label text primary key,body jsonb);
insert into q_requests values('member',jsonb_build_object('action','membership','rosterEntryId','d2430000-0000-4000-8000-000000000001','expectedVersion',0,'correction',false,'reason','TEST ONLY explicit pre-play choice',
 'pools',jsonb_build_array(jsonb_build_object('poolVersionId','c2430000-0000-4000-8000-000000000001','elected',true,'consentReference','TEST ONLY player consent Q1'),jsonb_build_object('poolVersionId','c2430000-0000-4000-8000-000000000002','elected',true,'consentReference','TEST ONLY player consent Q2'))));
do $$declare actor uuid:='a1310000-0000-4000-8000-000000000001';tid uuid:='b1310000-0000-4000-8000-000000000001';r jsonb;request jsonb;w jsonb;begin
 request:=(select body from q_requests where label='member');
 perform pg_temp.assert(public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000007',tid) is null,'outsider cannot read');
 perform pg_temp.assert(not has_function_privilege('authenticated','public.save_q_pool_membership_v1(uuid,uuid,jsonb,uuid)','execute'),'browser cannot call writer');
 perform pg_temp.assert(not has_function_privilege('anon','public.get_q_pool_membership_workspace_v1(uuid,uuid)','execute'),'anonymous cannot read');
 perform pg_temp.assert(not has_table_privilege('service_role','app.q_pool_membership_versions_v1','insert'),'service has no direct insert');
 perform pg_temp.assert((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid in('app.q_pool_membership_versions_v1'::regclass,'app.q_pool_allocation_versions_v1'::regclass)),'forced RLS');
 w:=public.get_q_pool_membership_workspace_v1(actor,tid);
 perform pg_temp.assert(w->>'supported'='true' and jsonb_array_length(w->'entries')=2,'supported current context');
 perform pg_temp.assert(w->'entries'->0->>'membershipVersion'='0' and w->'entries'->0->'pools'->0->>'paidEntryEligible'='false','legacy receipt cannot imply entry');
 r:=public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000007',tid,request,extensions.gen_random_uuid());
 perform pg_temp.assert(r->>'code'='not_director','wrong actor');
 r:=public.save_q_pool_membership_v1(actor,tid,jsonb_set(request,'{rosterEntryId}','"d2430000-0000-4000-8000-000000000099"'),extensions.gen_random_uuid());
 perform pg_temp.assert(r->>'code'='participant_unavailable','wrong roster');
 r:=public.save_q_pool_membership_v1(actor,tid,jsonb_set(request,'{pools,0,poolVersionId}','"c2430000-0000-4000-8000-000000000099"'),extensions.gen_random_uuid());
 perform pg_temp.assert(r->>'code'='pool_version_mismatch','wrong exact pool version');
 r:=public.save_q_pool_membership_v1(actor,tid,jsonb_set(request,'{pools,0,consentReference}','""'),extensions.gen_random_uuid());
 perform pg_temp.assert(r->>'code'='invalid_request','missing player consent');
 r:=public.save_q_pool_membership_v1(actor,tid,request,'02430000-0000-4000-8000-000000000001');
 perform pg_temp.assert(r->>'status'='q_pool_saved' and r->>'version'='1','unpaid explicit election saved');
 perform pg_temp.assert(public.save_q_pool_membership_v1(actor,tid,request,'02430000-0000-4000-8000-000000000001')=r,'exact replay');
 perform pg_temp.assert(public.save_q_pool_membership_v1(actor,tid,jsonb_set(request,'{reason}','"changed"'),'02430000-0000-4000-8000-000000000001')->>'code'='idempotency_conflict','changed key rejected');
 perform pg_temp.assert(public.save_q_pool_membership_v1(actor,tid,request,extensions.gen_random_uuid())->>'code'='stale_version','stale member rejected');
 perform pg_temp.assert((select count(*)=1 from app.q_pool_membership_versions_v1),'membership replay did not duplicate');
 perform pg_temp.assert(public.get_q_pool_membership_reconciliation_v1(actor,tid,'02430000-0000-4000-8000-000000000001')->'result'=r,'reconciliation exact receipt');
 perform pg_temp.assert(public.get_q_pool_membership_reconciliation_v1('a1310000-0000-4000-8000-000000000007',tid,'02430000-0000-4000-8000-000000000001') is null,'reconciliation role protected');
end $$;
select 'Q_CODEC|'||public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')::text;
select set_config('request.jwt.claim.sub','a1310000-0000-4000-8000-000000000001',true),set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.assert(public.set_roster_payment_obligation_v1('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',0,4500,'TEST ONLY base30 Q5 Q10',extensions.gen_random_uuid())->>'status'='payment_obligation_saved','explicit obligation');
select pg_temp.assert(public.record_manual_roster_payment('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',0,3750,'USD','cash',now(),'TEST ONLY no real money',extensions.gen_random_uuid())->>'status'='payment_recorded','partial cumulative receipt');
insert into q_requests select 'allocation',jsonb_build_object('action','allocation','rosterEntryId','d2430000-0000-4000-8000-000000000001','expectedVersion',0,'correction',false,'reason','TEST ONLY explicit split, no inferred priority',
 'membershipVersionId',(select id from app.q_pool_membership_versions_v1),'receiptId',(select id from app.roster_payment_events where event_type='received'),'obligationVersion',1,'baseMinor',3000,
 'pools',jsonb_build_array(jsonb_build_object('poolVersionId','c2430000-0000-4000-8000-000000000001','amountMinor',500),jsonb_build_object('poolVersionId','c2430000-0000-4000-8000-000000000002','amountMinor',250)));
do $$declare actor uuid:='a1310000-0000-4000-8000-000000000001';tid uuid:='b1310000-0000-4000-8000-000000000001';r jsonb;request jsonb;w jsonb;begin
 request:=(select body from q_requests where label='allocation');
 r:=public.save_q_pool_membership_v1(actor,tid,jsonb_set(request,'{pools,1,amountMinor}','500'),extensions.gen_random_uuid());
 perform pg_temp.assert(r->>'code'='allocation_receipt_mismatch','same dollars cannot be allocated twice');
 r:=public.save_q_pool_membership_v1(actor,tid,jsonb_set(request,'{baseMinor}','3001'),extensions.gen_random_uuid());
 perform pg_temp.assert(r->>'code'='allocation_exceeds_fee','base cannot exceed fee');
 r:=public.save_q_pool_membership_v1(actor,tid,request,'02430000-0000-4000-8000-000000000002');
 perform pg_temp.assert(r->>'status'='q_pool_saved','partial snapshot accepted');
 perform pg_temp.assert(public.save_q_pool_membership_v1(actor,tid,request,'02430000-0000-4000-8000-000000000002')=r,'allocation exact replay');
 w:=public.get_q_pool_membership_workspace_v1(actor,tid);
 perform pg_temp.assert(w->'entries'->0->>'allocationCurrent'='true','current snapshot');
 perform pg_temp.assert(w->'entries'->0->'pools'->0->>'paidEntryEligible'='true','fully funded named pool is entry eligible');
 perform pg_temp.assert(w->'entries'->0->'pools'->1->>'paidEntryEligible'='false','partial named pool is not entry eligible');
 perform pg_temp.assert(w->'entries'->0->'pools'->1->>'amountAllocatedMinor'='250','partial allocation visible');
 perform pg_temp.assert((select count(*)=1 from app.q_pool_allocation_versions_v1),'allocation replay did not duplicate');
 perform pg_temp.assert((select count(*)=2 from app.audit_events where entity_type='q_pool_membership'),'exact accepted audits');
end $$;
select 'Q_CODEC|'||public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')::text;
savepoint base_underfunded;
do $$declare request jsonb;w jsonb;begin
 request:=jsonb_set(jsonb_set(jsonb_set((select body from q_requests where label='allocation'),'{expectedVersion}','1'),'{baseMinor}','2750'),'{pools,1,amountMinor}','500');
 perform pg_temp.assert(public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',request,extensions.gen_random_uuid())->>'status'='q_pool_saved','explicit different partial split allowed');
 w:=public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001');
 perform pg_temp.assert(w->'entries'->0->'pools'->0->>'paidEntryEligible'='false','base underfunded blocks paid entry');
end $$;
rollback to base_underfunded;
-- An amended obligation invalidates the allocation even if the dollar amount is unchanged.
select public.set_roster_payment_obligation_v1('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',1,4500,'TEST ONLY reviewed obligation version',extensions.gen_random_uuid());
select pg_temp.assert(public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')->'entries'->0->>'allocationCurrent'='false','changed obligation invalidates allocation');
do $$declare request jsonb;r jsonb;begin
 request:=jsonb_set(jsonb_set((select body from q_requests where label='allocation'),'{expectedVersion}','1'),'{obligationVersion}','2');
 r:=public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',request,extensions.gen_random_uuid());
 perform pg_temp.assert(r->>'status'='q_pool_saved','reconciled obligation snapshot');
end $$;
do $$declare payment app.roster_payment_events%rowtype;r jsonb;begin
 select * into payment from app.roster_payment_events where roster_entry_id='d2430000-0000-4000-8000-000000000001' order by version desc limit 1;
 r:=public.void_manual_roster_payment('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',1,payment.id,'TEST ONLY void evidence',extensions.gen_random_uuid());
 perform pg_temp.assert(r->>'status'='payment_voided','receipt void succeeded');
 perform pg_temp.assert(public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')->'entries'->0->>'allocationCurrent'='false','void invalidates funds without deleting history');
 perform pg_temp.assert((select count(*)=2 from app.q_pool_allocation_versions_v1),'void preserves allocation history');
end $$;
select public.record_manual_roster_payment('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',2,4500,'USD','cash',now(),'TEST ONLY cumulative replacement, no actual money',extensions.gen_random_uuid());
do $$declare request jsonb;w jsonb;begin
 request:=jsonb_set(jsonb_set(jsonb_set(jsonb_set((select body from q_requests where label='allocation'),'{expectedVersion}','2'),'{obligationVersion}','2'),'{receiptId}',to_jsonb((select id from app.roster_payment_events where roster_entry_id='d2430000-0000-4000-8000-000000000001' order by version desc limit 1))),'{pools,1,amountMinor}','1000');
 perform pg_temp.assert(public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',request,extensions.gen_random_uuid())->>'status'='q_pool_saved','full replacement snapshot');
 w:=public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001');
 perform pg_temp.assert(w->'entries'->0->'pools'->0->>'paidEntryEligible'='true' and w->'entries'->0->'pools'->1->>'paidEntryEligible'='true','fully paid entries independent from payout');
end $$;
select 'Q_CODEC|'||public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')::text;
savepoint retired_extra_event;
insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method,operational_state)
 values('11310000-0000-4000-8000-000000000002','b1310000-0000-4000-8000-000000000001','f1310000-0000-4000-8000-000000000001','Retired extra fee context','satellite','standard_singles','manual','retired');
select pg_temp.assert(public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')->>'supported'='false','retired second event cannot disguise mixed cash');
select pg_temp.assert(public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')->'entries'->0->'pools'->0->>'paidEntryEligible'='false','unknown fee domain blocks eligibility');
rollback to retired_extra_event;
savepoint side_pool_context;
insert into app.event_side_pools(id,tournament_id,event_id) values('f2430000-0000-4000-8000-000000000099','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001');
select pg_temp.assert(public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')->>'supported'='false','Side Pool money is a separate unsupported allocation domain');
rollback to side_pool_context;
savepoint membership_revision;
select pg_temp.assert(public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',jsonb_set(jsonb_set((select body from q_requests where label='member'),'{expectedVersion}','1'),'{reason}','"TEST ONLY revised consent evidence"'),extensions.gen_random_uuid())->>'status'='q_pool_saved','membership revision');
select pg_temp.assert(public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')->'entries'->0->>'allocationCurrent'='false','changed membership invalidates old allocation');
rollback to membership_revision;
savepoint withdrawn_source;
insert into app.roster_entry_lifecycle_events(tournament_id,roster_entry_id,version,event_type,reason_code,note,actor_profile_id,operation_receipt_id)
 values('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',1,'withdrawn','administrative_correction','TEST ONLY withdrawal foundation','a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
select pg_temp.assert(public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')->'entries'->0->>'allocationCurrent'='false','withdrawn roster cannot retain funded eligibility');
rollback to withdrawn_source;
savepoint cross_tournament;
insert into app.tournaments(id,director_profile_id,name,status,registration_status) values('b1310000-0000-4000-8000-000000000002','a1310000-0000-4000-8000-000000000001','Other synthetic scope','open','open');
insert into app.tournament_roles(tournament_id,profile_id,role) values('b1310000-0000-4000-8000-000000000002','a1310000-0000-4000-8000-000000000001','director');
select pg_temp.assert(public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000002',(select body from q_requests where label='member'),extensions.gen_random_uuid())->>'status'='rejected','cross tournament inputs rejected');
select pg_temp.assert((select count(*)=1 from app.q_pool_membership_versions_v1),'cross tournament did not append membership');
rollback to cross_tournament;
select pg_temp.assert(public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',jsonb_set(jsonb_set(jsonb_set((select body from q_requests where label='member'),'{rosterEntryId}','"d2430000-0000-4000-8000-000000000002"'),'{pools,0,elected}','false'),'{pools,1,elected}','false'),extensions.gen_random_uuid())->>'status'='q_pool_saved','explicit preplay decline, not silent opt-in');
-- Actual immutable start record is synthetic foundation here, not proof of schedule/start workflow.
insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id)
 values('71310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','director_entry',12,2,12,repeat('7',64),'a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
insert into app.event_play_starts(tournament_id,event_id,schedule_publication_id,participant_snapshot_digest,participant_count,game_count,schedule_match_count,started_by_profile_id,operation_receipt_id,start_source)
 values('b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','71310000-0000-4000-8000-000000000001',repeat('7',64),2,12,12,'a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001','official');
do $$declare request jsonb;r jsonb;actor uuid:='a1310000-0000-4000-8000-000000000001';tid uuid:='b1310000-0000-4000-8000-000000000001';begin
 request:=jsonb_set((select body from q_requests where label='member'),'{expectedVersion}','1');
 perform pg_temp.assert(public.save_q_pool_membership_v1(actor,tid,request,extensions.gen_random_uuid())->>'code'='entries_locked','ordinary changes stop at start');
 request:=jsonb_set(request,'{correction}','true');
 perform pg_temp.assert(public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000006',tid,request,extensions.gen_random_uuid())->>'code'='correction_requires_director','co-director cannot make correction');
 r:=public.save_q_pool_membership_v1(actor,tid,request,extensions.gen_random_uuid());
 perform pg_temp.assert(r->>'status'='q_pool_saved','director reasoned correction of prior consent');
 request:=jsonb_set(jsonb_set(request,'{rosterEntryId}','"d2430000-0000-4000-8000-000000000002"'),'{expectedVersion}','1');
 perform pg_temp.assert(public.save_q_pool_membership_v1(actor,tid,request,extensions.gen_random_uuid())->>'code'='late_new_election_unsupported','first late opt-in not invented');
 request:=jsonb_set(jsonb_set(jsonb_set(jsonb_set((select body from q_requests where label='member'),'{expectedVersion}','2'),'{correction}','true'),'{pools,0,elected}','false'),'{pools,1,elected}','false');
 perform pg_temp.assert(public.save_q_pool_membership_v1(actor,tid,request,extensions.gen_random_uuid())->>'status'='q_pool_saved','director can correct existing election to declined');
 request:=jsonb_set(jsonb_set((select body from q_requests where label='member'),'{expectedVersion}','3'),'{correction}','true');
 perform pg_temp.assert(public.save_q_pool_membership_v1(actor,tid,request,extensions.gen_random_uuid())->>'status'='q_pool_saved','director can restore original pre-play elections');
 perform pg_temp.assert(public.save_q_pool_membership_v1(actor,tid,(select body from q_requests where label='member'),'02430000-0000-4000-8000-000000000001')->>'status'='q_pool_saved','old exact success replays after start');
 begin update app.q_pool_membership_versions_v1 set request='{}';raise exception 'immutable guard missing';exception when others then if sqlerrm='immutable guard missing' then raise;end if;end;
end $$;
-- A post-start correction may reuse only an already allocated pre-play receipt.
do $$declare request jsonb;r jsonb;begin
 request:=jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set((select body from q_requests where label='allocation'),'{expectedVersion}','3'),'{obligationVersion}','2'),'{pools,1,amountMinor}','1000'),'{correction}','true'),'{membershipVersionId}',to_jsonb((select id from app.q_pool_membership_versions_v1 where roster_entry_id='d2430000-0000-4000-8000-000000000001' order by version desc limit 1)));
 request:=jsonb_set(request,'{receiptId}',to_jsonb((select id from app.roster_payment_events where roster_entry_id='d2430000-0000-4000-8000-000000000001' order by version desc limit 1)));
 r:=public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',request,extensions.gen_random_uuid());
 perform pg_temp.assert(r->>'status'='q_pool_saved','existing pre-play source correction accepted');
 insert into q_requests values('postalloc',request);
end $$;
do $$declare payment app.roster_payment_events%rowtype;begin
 select * into payment from app.roster_payment_events where roster_entry_id='d2430000-0000-4000-8000-000000000001' order by version desc limit 1;
 perform pg_temp.assert(public.void_manual_roster_payment('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',3,payment.id,'TEST ONLY late void source',extensions.gen_random_uuid())->>'status'='payment_voided','late void evidence');
end $$;
select pg_temp.assert(public.record_manual_roster_payment('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',4,4500,'USD','cash',now(),'TEST ONLY late cumulative receipt, no actual money',extensions.gen_random_uuid())->>'status'='payment_recorded','late cumulative receipt');
do $$declare request jsonb;begin
 perform pg_temp.assert((select p.recorded_at<s.started_at from app.roster_payment_events p cross join app.event_play_starts s where p.roster_entry_id='d2430000-0000-4000-8000-000000000001' and p.version=5),'fixture reproduces transaction-now timestamp predating actual start');
 request:=jsonb_set(jsonb_set((select body from q_requests where label='postalloc'),'{expectedVersion}','4'),'{receiptId}',to_jsonb((select id from app.roster_payment_events where roster_entry_id='d2430000-0000-4000-8000-000000000001' and version=5)));
 perform pg_temp.assert(public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',request,extensions.gen_random_uuid())->>'code'='late_payment_unsupported','backdated transaction timestamp cannot qualify a newly inserted late receipt');
end $$;
select 'Q_CODEC|'||public.get_q_pool_membership_workspace_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')::text;
select 'Q_POOL_LOCAL_ACCEPTANCE_PASSED';
rollback;
