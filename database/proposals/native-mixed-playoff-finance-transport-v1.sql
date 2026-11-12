-- LOCAL CLOSED CANDIDATE. Normal authenticated-subject RPC bridge only.
-- Dependencies: reviewed native mixed pool, playoff, own-read and Main Finance
-- proposals. Installs no application access, cohort, route or feature enablement.
-- Private writers retain all current session/issuer/expiry/scope/role/identity,
-- source, receipt, audit, concurrency and simulated-only checks.
begin;
do $transport$
declare item record;declaration text;arguments text;types text;signature text;size_guard text;
begin
 for item in select*from(values
  ('get_native_mixed_playoff_own_v1',false),
  ('get_native_mixed_playoff_v1',false),
  ('execute_native_mixed_playoff_v1',true),
  ('get_native_mixed_pool_finance_v1',false),
  ('execute_native_mixed_pool_finance_v1',true),
  ('get_native_mixed_main_finance_v1',false),
  ('execute_native_mixed_main_finance_v1',true)
 )as definitions(name,writing)loop
  declaration:='p_tournament_id uuid,p_event_id uuid';arguments:='p_tournament_id,p_event_id';types:='uuid,uuid';size_guard:='';
  if item.writing then
   declaration:=declaration||',p_operation_id uuid,p_request jsonb';arguments:=arguments||',p_operation_id,p_request';types:=types||',uuid,jsonb';
   -- Normalized UTF-8 JSON command bound, not an HTTP wire-byte bound or a
   -- business cap on custom costs, players, payout places or ratios.
   size_guard:=$guard$if p_request is not null and octet_length(convert_to(p_request::text,'UTF8'))>32768 then return jsonb_build_object('status','rejected','code','request_too_large');end if;$guard$;
  end if;
  if to_regprocedure('app.'||quote_ident(item.name)||'('||types||')')is null then
   raise exception 'native_mixed_transport_dependency_missing: %',item.name;
  end if;
  execute format($definition$
   create function public.%I(%s)returns jsonb
   language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $body$
   begin
    if auth.role()is distinct from'authenticated'then return null;end if;
    %s
    return app.%I(%s);
   end$body$;
  $definition$,item.name,declaration,size_guard,item.name,arguments);
  signature:='public.'||quote_ident(item.name)||'('||types||')';
  execute format('alter function %s owner to postgres',signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);
 end loop;
end$transport$;
commit;
