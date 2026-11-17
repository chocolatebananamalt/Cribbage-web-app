-- LOCAL proposal only: same own-actor/tournament/operation Director read scope.
-- Corrects v3 receipts hidden by the legacy v1-only discriminator. No grants.
begin;
do $patch$declare target regprocedure:='public.get_manual_roster_entry_reconciliation_v1(uuid,uuid)'::regprocedure;old text;definition text;acl aclitem[];owner_id oid;config text[];begin
 if current_user<>'postgres'or exists(select 1 from pg_roles where rolname=current_user and(rolsuper or not rolbypassrls))then raise exception 'manual_recovery_installer_role_required';end if;
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and prosecdef and provolatile='s'and proowner='postgres'::regrole;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'dec1500101f06e5f059ec6040673d063bfab6ce9ad096340b61b556186774295'or to_jsonb(acl)is distinct from '["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"]'::jsonb or to_jsonb(config)is distinct from '["search_path=\"\""]'::jsonb then raise exception 'manual_recovery_exact_preimage_required';end if;
 definition:=replace(pg_get_functiondef(target),E'\r\n',E'\n');if position(old in definition)=0 then raise exception 'manual_recovery_definition_mismatch';end if;execute replace(definition,old,'
  select case when auth.uid() is not null
    and p_tournament_id is not null
    and p_idempotency_key is not null
    and exists (
      select 1 from app.tournament_roles r
      where r.tournament_id = p_tournament_id
        and r.profile_id = auth.uid()
        and r.role in (''director'', ''co_director'')
    ) then (
      select o.response_payload from app.operation_receipts o
      where o.actor_profile_id = auth.uid()
        and o.tournament_id = p_tournament_id
        and o.operation_type in (''create_manual_roster_entry_v1'',''create_manual_roster_entry_v2'',''create_manual_roster_entry_v3'')
        and o.client_operation_id = p_idempotency_key
      limit 1
    ) else null end
');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef or provolatile<>'s'))then raise exception 'manual_recovery_security_changed';end if;
end$patch$;
commit;
