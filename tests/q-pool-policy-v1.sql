begin;
do $$begin if current_database()<>'fixture_qpolicy' then raise exception 'Disposable fixture_qpolicy required'; end if;end $$;
\ir q-pool-membership-seed.sql
create function pg_temp.assert(ok boolean,note text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',note;end if;end $$;
select set_config('request.jwt.claim.sub','a1310000-0000-4000-8000-000000000001',true),set_config('request.jwt.claim.role','authenticated',true);
savepoint old_receipt;
select pg_temp.assert(public.record_manual_roster_payment('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',0,3000,'USD','cash',now(),'TEST ONLY',extensions.gen_random_uuid())->>'status'='payment_recorded','legacy receipt created');
select public.void_manual_roster_payment('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',1,(select id from app.roster_payment_events where event_type='received'),'TEST ONLY',extensions.gen_random_uuid());
select pg_temp.assert(public.publish_q_pool_policy_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','{"poolVersionId":"c2430000-0000-4000-8000-000000000001","method":"equal-paid-qualifiers-v1","disclosureReference":"TEST ONLY flyer","disclosed":true}',extensions.gen_random_uuid())->>'code'='collection_or_consent_already_started','voided historical receipt blocks retroactive policy');
rollback to old_receipt;
do $$declare req jsonb:='{"poolVersionId":"c2430000-0000-4000-8000-000000000001","method":"equal-paid-qualifiers-v1","disclosureReference":"TEST ONLY flyer v1","disclosed":true}';r jsonb;begin
 perform pg_temp.assert(public.publish_q_pool_policy_v1('a1310000-0000-4000-8000-000000000006','b1310000-0000-4000-8000-000000000001',req,extensions.gen_random_uuid()) is null,'co-director cannot attest disclosure');
 perform pg_temp.assert(public.get_q_pool_preview_sources_v1('a1310000-0000-4000-8000-000000000007','b1310000-0000-4000-8000-000000000001') is null,'outsider denied');
 perform pg_temp.assert(public.publish_q_pool_policy_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',jsonb_set(req,'{poolVersionId}','"c2430000-0000-4000-8000-000000000002"'),extensions.gen_random_uuid())->>'code'='setup_method_conflict','graduated setup cannot silently become equal policy');
 r:=public.publish_q_pool_policy_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',req,'02440000-0000-4000-8000-000000000001');
 perform pg_temp.assert(r->>'status'='q_policy_published','policy published');
 perform pg_temp.assert(public.publish_q_pool_policy_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',req,'02440000-0000-4000-8000-000000000001')=r,'exact policy replay');
 perform pg_temp.assert(public.publish_q_pool_policy_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',jsonb_set(req,'{disclosureReference}','"different"'),'02440000-0000-4000-8000-000000000001')->>'code'='idempotency_conflict','changed policy replay conflicts');
 perform pg_temp.assert(public.publish_q_pool_policy_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',req,extensions.gen_random_uuid())->>'code'='policy_frozen','new op cannot replace frozen policy');
 perform pg_temp.assert((select count(*)=1 from app.q_pool_policies_v1),'one immutable policy');
 perform pg_temp.assert(not has_table_privilege('service_role','app.q_pool_policies_v1','insert'),'no direct service insert');
 perform pg_temp.assert(not has_function_privilege('authenticated','public.publish_q_pool_policy_v1(uuid,uuid,jsonb,uuid)','execute'),'no browser RPC');
 perform pg_temp.assert((select relrowsecurity and relforcerowsecurity and pg_get_userbyid(relowner)='postgres' from pg_class where oid='app.q_pool_policies_v1'::regclass),'private forced RLS owner');
 perform pg_temp.assert(not has_function_privilege('anon','public.get_q_pool_preview_sources_v1(uuid,uuid)','execute') and has_function_privilege('service_role','public.get_q_pool_preview_sources_v1(uuid,uuid)','execute'),'preview service-only execution');
 perform pg_temp.assert(public.publish_q_pool_policy_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',jsonb_set(req,'{method}','null'),extensions.gen_random_uuid())->>'code'='invalid_request','null method rejected exactly');
 perform pg_temp.assert(public.publish_q_pool_policy_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',jsonb_set(req,'{disclosed}','false'),extensions.gen_random_uuid())->>'code'='invalid_request','missing attestation rejected');
 begin update app.q_pool_policies_v1 set disclosure_reference='changed';raise exception 'mutation unexpectedly allowed';exception when raise_exception then if sqlerrm='mutation unexpectedly allowed' then raise;end if;end;
end $$;
-- Real payment RPC rejects timestamps later than transaction now(). Start a new
-- transaction so an honest post-disclosure receipt can be recorded without backdating.
commit;
begin;
select set_config('request.jwt.claim.sub','a1310000-0000-4000-8000-000000000001',true),set_config('request.jwt.claim.role','authenticated',true);
create temporary table policy_requests as select jsonb_build_object('action','membership','rosterEntryId','d2430000-0000-4000-8000-000000000001','expectedVersion',0,'correction',false,'reason','TEST ONLY consent','pools',jsonb_build_array(
 jsonb_build_object('poolVersionId','c2430000-0000-4000-8000-000000000001','elected',true,'consentReference','legacy unbound text'),
 jsonb_build_object('poolVersionId','c2430000-0000-4000-8000-000000000002','elected',false,'consentReference',''))) body;
select pg_temp.assert(public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',(select body from policy_requests),extensions.gen_random_uuid())->>'status'='rejected','old client cannot bypass policy acknowledgment');
update policy_requests set body=jsonb_set(body,'{pools,0,consentReference}',to_jsonb('Q policy '||(select id from app.q_pool_policies_v1)::text||': TEST ONLY director acknowledgment'));
select pg_temp.assert(public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',(select body from policy_requests),extensions.gen_random_uuid())->>'status'='q_pool_saved','bound consent saved');
select pg_temp.assert(public.publish_q_pool_policy_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','{"poolVersionId":"c2430000-0000-4000-8000-000000000002","method":"equal-paid-qualifiers-v1","disclosureReference":"TEST ONLY late flyer","disclosed":true}',extensions.gen_random_uuid())->>'code'='collection_or_consent_already_started','prior election prevents retroactive second policy');
select pg_temp.assert(public.record_manual_roster_payment('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',0,3500,'USD','cash','2026-01-01','TEST ONLY backdate',extensions.gen_random_uuid())->>'status'='rejected','backdated receipt rejected across legacy writer');
select pg_temp.assert(public.set_roster_payment_obligation_v1('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',0,3500,'TEST ONLY base30 Q5',extensions.gen_random_uuid())->>'status'='payment_obligation_saved','obligation');
select pg_temp.assert(public.record_manual_roster_payment('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',0,3500,'USD','cash',now(),'TEST ONLY after disclosure',extensions.gen_random_uuid())->>'status'='payment_recorded','receipt after disclosure');
select pg_temp.assert(public.save_q_pool_membership_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001',jsonb_build_object('action','allocation','rosterEntryId','d2430000-0000-4000-8000-000000000001','expectedVersion',0,'correction',false,'reason','TEST ONLY allocated','membershipVersionId',(select id from app.q_pool_membership_versions_v1),'receiptId',(select id from app.roster_payment_events),'obligationVersion',1,'baseMinor',3000,'pools','[{"poolVersionId":"c2430000-0000-4000-8000-000000000001","amountMinor":500},{"poolVersionId":"c2430000-0000-4000-8000-000000000002","amountMinor":0}]'::jsonb),extensions.gen_random_uuid())->>'status'='q_pool_saved','allocation');
-- Immutable synthetic qualification foundation, not a claim that games were actually played.
insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id)
 values('02440000-0000-4000-8000-000000000002','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','director_entry',12,2,12,repeat('1',64),'a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001');
insert into app.qualification_result_versions(id,tournament_id,event_id,version,ruleset_version_id,schedule_publication_id,participant_count,qualifier_count,high_non_qualifier_participant_id,standings_digest,finalized_by_profile_id,operation_receipt_id,finalized_at)
 values('02440000-0000-4000-8000-000000000003','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001',1,'f1310000-0000-4000-8000-000000000001','02440000-0000-4000-8000-000000000002',2,1,'f2430000-0000-4000-8000-000000000002',repeat('2',64),'a1310000-0000-4000-8000-000000000001','c1310000-0000-4000-8000-000000000001',clock_timestamp());
insert into app.qualification_result_rows(result_version_id,tournament_id,event_id,participant_id,ranking_ordinal,numeric_rank,tied,display_name_snapshot,verified_games,game_points,games_won,plus_points,minus_points,net_spread_points,qualification_status)
 values('02440000-0000-4000-8000-000000000003','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','f2430000-0000-4000-8000-000000000001',1,1,false,'TEST ONLY Q entrant 1',12,24,12,180,0,180,'qualified');
select 'Q_POLICY_CODEC|'||public.get_q_pool_preview_sources_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')::text;
create temporary table prior_digest as select public.get_q_pool_preview_sources_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')->>'sourceDigest' d;
insert into app.qualification_result_versions(id,tournament_id,event_id,version,supersedes_result_version_id,ruleset_version_id,schedule_publication_id,participant_count,qualifier_count,high_non_qualifier_participant_id,standings_digest,finalized_by_profile_id,operation_receipt_id,finalized_at)
 select '02440000-0000-4000-8000-000000000004',tournament_id,event_id,2,id,ruleset_version_id,schedule_publication_id,participant_count,qualifier_count,'f2430000-0000-4000-8000-000000000001',repeat('3',64),finalized_by_profile_id,operation_receipt_id,clock_timestamp() from app.qualification_result_versions where version=1;
insert into app.qualification_result_rows(result_version_id,tournament_id,event_id,participant_id,ranking_ordinal,numeric_rank,tied,display_name_snapshot,verified_games,game_points,games_won,plus_points,minus_points,net_spread_points,qualification_status)
 values('02440000-0000-4000-8000-000000000004','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','f2430000-0000-4000-8000-000000000002',1,1,false,'TEST ONLY Q entrant 2',12,24,12,180,0,180,'qualified');
select pg_temp.assert((select d from prior_digest)<>public.get_q_pool_preview_sources_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')->>'sourceDigest','new qualification version invalidates old preview');
select 'Q_POLICY_CODEC|'||public.get_q_pool_preview_sources_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')::text;
select public.void_manual_roster_payment('b1310000-0000-4000-8000-000000000001','d2430000-0000-4000-8000-000000000001',1,(select id from app.roster_payment_events where event_type='received'),'TEST ONLY invalidation',extensions.gen_random_uuid());
select pg_temp.assert((select d from prior_digest)<>public.get_q_pool_preview_sources_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')->>'sourceDigest','receipt void changes source digest');
select 'Q_POLICY_CODEC|'||public.get_q_pool_preview_sources_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001')::text;
select pg_temp.assert(app.settlement_award_blocked_v5('b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001'),'Q settlement guard retained');
select 'Q_POLICY_LOCAL_PASSED';
rollback;
