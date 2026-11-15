-- READ ONLY METADATA PREFLIGHT. Do not run against an unverified target.
-- The expected project ref below is a label, NOT SQL proof of physical project.
-- No profiles, Auth/session rows, scorecards, receipts or tournament records are read.
begin transaction read only;
set local lock_timeout='250ms';
set local statement_timeout='5s';
with required(signature,expected_sha256)as(values
 ('app.native_mixed_game_own_subject_v1()','7a12251f31cf175e322db9b8c685af7b75c19d27dd93ce637bdb02ecce6379b4'),
 ('app.native_mixed_game_root_current_v1(uuid, uuid, uuid)','33d670d12e5354e6f40421383609f0e2ddc3d68bb069502a809376166c847ddb'),
 ('app.native_mixed_game_complete_with_start_v1(uuid, uuid, app.native_mixed_simulation_starts_v1, uuid)','276478a2366bd9e4a79d7f96991fe990fd40b27dc9958f106d8b6317818cbca3'),
 ('app.native_mixed_funding_seal_source_v1(uuid, uuid)','2d2032c17bf937816bf35e1aa2041a281c762c6a43f936b510591e1521d4e468'),
 ('app.native_mixed_simulation_hash_v1(jsonb)','b2c136d28244eed2dd47745391714fdbd86fb60c0790982e28e93d96201074ab'),
 ('app.native_mixed_pilot_permitted_v1(uuid, uuid, uuid, boolean)','47e8c2988201f91f9ce6cbc2a21da2a4369d846913683eb99fcbabc50fb9e8f7')
),checked as(
 select signature,expected_sha256,to_regprocedure(signature)as function_id from required
),functions as(
 select c.signature,c.function_id is not null as present,p.proowner::regrole::text as owner,
  encode(extensions.digest(pg_get_functiondef(c.function_id),'sha256'),'hex')=c.expected_sha256 as definition_matches,
  coalesce(has_function_privilege('anon',c.function_id,'EXECUTE'),true)as anon_execute,
  coalesce(has_function_privilege('authenticated',c.function_id,'EXECUTE'),true)as authenticated_execute,
  coalesce(has_function_privilege('service_role',c.function_id,'EXECUTE'),true)as service_execute
 from checked c left join pg_proc p on p.oid=c.function_id
),new_signatures(signature)as(values
 ('app.native_mixed_qualification_review_enabled_v1()'),
 ('app.native_mixed_qualification_review_v1(uuid,uuid,uuid)'),
 ('public.get_native_mixed_qualification_review_provider_v1(uuid,uuid)')
),new_absence as(
 select signature,to_regprocedure(signature)is null as absent from new_signatures
),writers(signature)as(values
 ('public.execute_native_mixed_pilot_director_v1(uuid,uuid,uuid,uuid,text,jsonb)'),
 ('public.record_native_mixed_digital_consent_v1(uuid,uuid,jsonb)'),
 ('public.record_native_mixed_simulation_game_evidence_v1(uuid,uuid,jsonb)'),
 ('public.resolve_native_mixed_game_operation_v1(uuid,uuid,jsonb)')
),writer_privileges as(
 select signature,to_regprocedure(signature)is not null as present,
 coalesce(has_function_privilege('anon',to_regprocedure(signature),'EXECUTE'),true)or
 coalesce(has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE'),true)or
 coalesce(has_function_privilege('service_role',to_regprocedure(signature),'EXECUTE'),true)as any_application_execute from writers
),native_tables(name)as(values
 ('native_mixed_simulation_starts_v1'),('native_mixed_game_evidence_v1'),
 ('native_mixed_game_artifacts_v1'),('native_mixed_attendance_seals_v1'),('native_mixed_attendance_scopes_v1')
),table_security as(
 select t.name,c.oid is not null as present,c.relrowsecurity as rls,c.relforcerowsecurity as forced_rls,
 coalesce(has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE'),true)or
 coalesce(has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'),true)or
 coalesce(has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE'),true)as any_application_table_privilege
 from native_tables t left join pg_namespace n on n.nspname='app'left join pg_class c on c.relnamespace=n.oid and c.relname=t.name
),history as(
 select count(*)as entries,max(version)as latest,
 count(*)filter(where version='20261107090229'and name='native_preparation51_closed_install')=1 as preparation_present,
 count(*)filter(where version='20261108111139')=0 as candidate_absent
 from supabase_migrations.schema_migrations
),gates as(
 select app.native_mixed_admission_enabled_v1()or app.native_mixed_funding_enabled_v1()or
 app.native_mixed_attendance_enabled_v1()or app.native_mixed_attendance_consent_transport_enabled_v1()or
 app.native_mixed_simulation_publication_enabled_v1()or app.native_mixed_simulation_start_enabled_v1()or
 app.native_mixed_simulation_start_recovery_enabled_v1()or app.native_mixed_game_writer_enabled_v1()or
 app.native_mixed_game_transport_enabled_v1()or app.native_mixed_game_recovery_enabled_v1()as any_enabled
),configuration_counts as(
 select(select count(*)from app.native_mixed_pilot_deployment_v1)as deployments,
 (select count(*)from app.native_mixed_pilot_scopes_v1)as scopes
)
select jsonb_build_object(
 'mode','READ_ONLY_METADATA_ONLY',
 'expectedProjectRef','nnhcnvksxgxnpvdqjgpg',
 'targetProof','VERIFY SEPARATELY IN AUTHORIZED PROJECT METADATA; THIS LABEL IS NOT PROOF',
 'recoveryProof','CURRENT PROTECTED BACKUP AND ISOLATED RESTORE REQUIRED SEPARATELY',
 'authorization','SEPARATE APPROVAL REQUIRED; THIS SCRIPT NEVER INSTALLS OR GRANTS',
 'database',current_database(),'sessionUser',session_user,'serverVersion',current_setting('server_version'),
 'readOnly',current_setting('transaction_read_only'),
 'requiredFunctions',(select jsonb_agg(to_jsonb(f)order by signature)from functions f),
 'newFunctions',(select jsonb_agg(to_jsonb(a)order by signature)from new_absence a),
 'writers',(select jsonb_agg(to_jsonb(w)order by signature)from writer_privileges w),
 'tableSecurity',(select jsonb_agg(to_jsonb(t)order by name)from table_security t),
 'history',(select to_jsonb(h)from history h),'gates',(select to_jsonb(g)from gates g),
 'authorizationConfigurationCounts',(select to_jsonb(c)from configuration_counts c),
 'metadataChecksPass',coalesce(
 (select bool_and(present and owner='postgres'and definition_matches and not anon_execute and not authenticated_execute and not service_execute)from functions)and
 (select bool_and(absent)from new_absence)and
 (select bool_and(present and not any_application_execute)from writer_privileges)and
 (select bool_and(present and rls and forced_rls and not any_application_table_privilege)from table_security)and
 (select entries=293 and latest='20261107090229'and preparation_present and candidate_absent from history)and
 (select not any_enabled from gates)and(select deployments=0 and scopes=0 from configuration_counts),false)
);
rollback;
-- Missing metadata/function/role or any false result means STOP and review drift.
-- An already present candidate is an uncertain/repeat outcome: inspect, never retry blindly.
