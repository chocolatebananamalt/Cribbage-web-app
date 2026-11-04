-- Run after the proposal in a disposable local database, as postgres.
-- This is a deployment/ACL smoke test, not a substitute for lifecycle fixtures.
begin;
do $$declare n text; x jsonb; begin
 foreach n in array array['linked_main_series_v1','linked_consy_start_eligibility_v1'] loop
  if not exists(select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='app' and c.relname=n and c.relrowsecurity and c.relforcerowsecurity) then raise exception 'RLS not forced for %',n;end if;
  if has_table_privilege('anon','app.'||n,'SELECT') or has_table_privilege('authenticated','app.'||n,'INSERT') or has_table_privilege('service_role','app.'||n,'SELECT') then raise exception 'sidecar exposed: %',n;end if;
 end loop;
 if has_function_privilege('anon','public.record_linked_main_series_v1(uuid,uuid,uuid,jsonb,uuid)','EXECUTE') or has_function_privilege('authenticated','public.record_linked_main_series_v1(uuid,uuid,uuid,jsonb,uuid)','EXECUTE') or not has_function_privilege('service_role','public.record_linked_main_series_v1(uuid,uuid,uuid,jsonb,uuid)','EXECUTE') then raise exception 'RPC ACL mismatch';end if;
 if not exists(select 1 from pg_trigger where tgname='linked_main_final_guard_v3' and not tgisinternal) or not exists(select 1 from pg_trigger where tgname='linked_main_final_guard_v4' and not tgisinternal) or not exists(select 1 from pg_trigger where tgname='linked_consy_start_guard_v1' and not tgisinternal) then raise exception 'missing backstop';end if;
 x:=app.linked_consy_eligibility_v1('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
 if x->>'status'<>'no_route' then raise exception 'unknown link was routed';end if;
 if app.linked_main_slot_v1('00000000-0000-4000-8000-000000000001',1) is not null then raise exception 'unknown qualification produced slot';end if;
end$$;
rollback;
